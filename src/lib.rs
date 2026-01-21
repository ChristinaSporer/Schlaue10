use wasm_bindgen::prelude::*;
use std::cell::RefCell;

thread_local! {
    static GAME: RefCell<Option<Game>> = RefCell::new(None);
    static QUESTION_SETS: RefCell<Vec<QuestionSet>> = RefCell::new(Vec::new());
    static CURRENT_SET_INDEX: RefCell<usize> = RefCell::new(0);
}

struct QuestionSet {
    name: String,
    questions: Vec<Question>,
}

#[derive(Clone, Copy)]
pub enum QuestionType {
    YesNo,
    Ranking,
    Reveal,
}

#[derive(Clone)]
struct OptionItem {
    text: String,
    is_european: bool,
    answered: bool,
    answer_was_correct: Option<bool>,
}

#[derive(Clone)]
struct RankingItem {
    text: String,
    correct_position: usize,
    user_position: Option<usize>,
}

#[derive(Clone)]
struct RevealItem {
    text: String,
    answer: String,
    answered: bool,
    answer_was_correct: Option<bool>,
}

#[derive(Clone)]
struct Question {
    question_type: QuestionType,
    prompt: String,
    options: Vec<OptionItem>,
    ranking_items: Vec<RankingItem>,
    reveal_items: Vec<RevealItem>,
    score: usize,
    answered_count: usize,
}

struct Team {
    name: String,
    score: usize,
    round_score: usize,
    active: bool,
}

struct Game {
    question: Question,
    teams: [Team; 2],
    current_team: usize,
    question_index: usize,
}



fn other_team(idx: usize) -> usize {
    if idx == 0 { 1 } else { 0 }
}



















fn question_by_index(idx: usize) -> Question {
    CURRENT_SET_INDEX.with(|set_idx| {
        let current_set = *set_idx.borrow();
        QUESTION_SETS.with(|sets| {
            let sets_vec = sets.borrow();
            let set = &sets_vec[current_set % sets_vec.len()];
            let q_idx = idx % set.questions.len();
            set.questions[q_idx].clone()
        })
    })
}

fn reset_round_state(game: &mut Game) {
    game.question_index = (game.question_index + 1) % 3;
    game.question = question_by_index(game.question_index);
    for team in game.teams.iter_mut() {
        team.active = true;
        team.round_score = 0;
    }
    game.current_team = 0;
}



#[wasm_bindgen]
pub fn new_round() {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            reset_round_state(game);
        } else {
            *gm = Some(Game {
                question: question_by_index(0),
                teams: [
                    Team { name: "Team A".to_string(), score: 0, round_score: 0, active: true },
                    Team { name: "Team B".to_string(), score: 0, round_score: 0, active: true },
                ],
                current_team: 0,
                question_index: 0,
            });
        }
    });
}

#[wasm_bindgen]
pub fn prompt() -> String {
    GAME.with(|g| {
        g.borrow()
            .as_ref()
            .map(|game| game.question.prompt.clone())
            .unwrap_or_else(|| "Spiel nicht initialisiert".to_string())
    })
}

#[wasm_bindgen]
pub fn question_type() -> u8 {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return 0; };
        match game.question.question_type {
            QuestionType::YesNo => 0,
            QuestionType::Ranking => 1,
            QuestionType::Reveal => 2,
        }
    })
}

#[wasm_bindgen]
pub fn options_len() -> usize {
    GAME.with(|g| g.borrow().as_ref().map(|game| game.question.options.len()).unwrap_or(0))
}

#[wasm_bindgen]
pub fn ranking_items_len() -> usize {
    GAME.with(|g| g.borrow().as_ref().map(|game| game.question.ranking_items.len()).unwrap_or(0))
}

#[wasm_bindgen]
pub fn reveal_items_len() -> usize {
    GAME.with(|g| g.borrow().as_ref().map(|game| game.question.reveal_items.len()).unwrap_or(0))
}

#[wasm_bindgen]
pub fn ranking_item_text(index: usize) -> String {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return "".to_string(); };
        game.question.ranking_items.get(index).map(|r| r.text.clone()).unwrap_or_default()
    })
}

#[wasm_bindgen]
pub fn reveal_item_text(index: usize) -> String {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return "".to_string(); };
        game.question.reveal_items.get(index).map(|r| r.text.clone()).unwrap_or_default()
    })
}

#[wasm_bindgen]
pub fn reveal_item_answer(index: usize) -> String {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return "".to_string(); };
        game.question.reveal_items.get(index).map(|r| r.answer.clone()).unwrap_or_default()
    })
}

#[wasm_bindgen]
pub fn ranking_correct_position(index: usize) -> usize {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return 0; };
        game.question.ranking_items.get(index).map(|r| r.correct_position).unwrap_or(0)
    })
}

#[wasm_bindgen]
pub fn set_ranking_position(index: usize, position: usize) -> bool {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        let Some(game) = gm.as_mut() else { return false; };
        if index >= game.question.ranking_items.len() || position < 1 || position > 10 {
            return false;
        }
        if !game.teams[game.current_team].active {
            return false;
        }
        let item = &mut game.question.ranking_items[index];
        if item.user_position.is_some() {
            return false;
        }
        item.user_position = Some(position);
        
        // Evaluate immediately (same scoring as answer())
        let correct = position == item.correct_position;
        
        if correct {
            game.question.score += 1;
            game.teams[game.current_team].score += 1;
            game.teams[game.current_team].round_score += 1;
        } else {
            let round_pts = game.teams[game.current_team].round_score;
            game.question.score = game.question.score.saturating_sub(round_pts);
            game.teams[game.current_team].score = game.teams[game.current_team].score.saturating_sub(round_pts);
            game.teams[game.current_team].round_score = 0;
            game.teams[game.current_team].active = false;
        }
        
        game.question.answered_count += 1;
        let other = other_team(game.current_team);
        if game.teams[other].active {
            game.current_team = other;
        }
        
        correct
    })
}

#[wasm_bindgen]
pub fn mark_reveal(index: usize, correct: bool) -> bool {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        let Some(game) = gm.as_mut() else { return false; };
        if index >= game.question.reveal_items.len() {
            return false;
        }
        if !game.teams[game.current_team].active {
            return false;
        }
        let item = &mut game.question.reveal_items[index];
        if item.answered {
            return item.answer_was_correct.unwrap_or(false);
        }

        item.answered = true;
        item.answer_was_correct = Some(correct);
        if correct {
            game.question.score += 1;
            game.teams[game.current_team].score += 1;
            game.teams[game.current_team].round_score += 1;
        } else {
            let round_pts = game.teams[game.current_team].round_score;
            game.question.score = game.question.score.saturating_sub(round_pts);
            game.teams[game.current_team].score = game.teams[game.current_team].score.saturating_sub(round_pts);
            game.teams[game.current_team].round_score = 0;
            game.teams[game.current_team].active = false;
        }

        game.question.answered_count += 1;
        let other = other_team(game.current_team);
        if game.teams[other].active {
            game.current_team = other;
        }
        correct
    })
}

#[wasm_bindgen]
pub fn submit_ranking() -> bool {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        let Some(game) = gm.as_mut() else { return false; };
        if !game.teams[game.current_team].active {
            return false;
        }
        let all_answered = game.question.ranking_items.iter().all(|r| r.user_position.is_some());
        if !all_answered {
            return false;
        }
        let correct = game.question.ranking_items.iter().all(|r| r.user_position == Some(r.correct_position));
        if correct {
            game.question.score += 1;
            game.teams[game.current_team].score += 1;
            game.teams[game.current_team].round_score += 1;
        } else {
            let round_pts = game.teams[game.current_team].round_score;
            game.question.score = game.question.score.saturating_sub(round_pts);
            game.teams[game.current_team].score = game.teams[game.current_team].score.saturating_sub(round_pts);
            game.teams[game.current_team].round_score = 0;
            game.teams[game.current_team].active = false;
        }
        game.question.answered_count += 1;
        let other = other_team(game.current_team);
        if game.teams[other].active {
            game.current_team = other;
        }
        correct
    })
}

#[wasm_bindgen]
pub fn option_text(index: usize) -> String {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return "".to_string(); };
        game.question.options.get(index).map(|o| o.text.clone()).unwrap_or_default()
    })
}

#[wasm_bindgen]
pub fn has_answered(index: usize) -> bool {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return false; };
        game.question.options.get(index).map(|o| o.answered).unwrap_or(false)
    })
}

#[wasm_bindgen]
pub fn answer(index: usize, yes: bool) -> bool {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        let Some(game) = gm.as_mut() else { return false; };
        if index >= game.question.options.len() {
            return false;
        }
        if !game.teams[game.current_team].active {
            return false;
        }
        let opt = &mut game.question.options[index];
        if opt.answered {
            return opt.is_european == yes;
        }
        let correct = opt.is_european == yes;
        opt.answered = true;
        opt.answer_was_correct = Some(correct);
        if correct {
            game.question.score += 1;
            game.teams[game.current_team].score += 1;
            game.teams[game.current_team].round_score += 1;
        }
        game.question.answered_count += 1;
        if !correct {
            let round_pts = game.teams[game.current_team].round_score;
            game.question.score = game.question.score.saturating_sub(round_pts);
            game.teams[game.current_team].score = game.teams[game.current_team].score.saturating_sub(round_pts);
            game.teams[game.current_team].round_score = 0;
            game.teams[game.current_team].active = false;
        }
        let other = other_team(game.current_team);
        if game.teams[other].active {
            game.current_team = other;
        }
        correct
    })
}

#[wasm_bindgen]
pub fn score() -> usize {
    GAME.with(|g| g.borrow().as_ref().map(|game| game.question.score).unwrap_or(0))
}

#[wasm_bindgen]
pub fn is_completed() -> bool {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return false; };
        
        // If both teams are out, round is completed
        if !game.teams[0].active && !game.teams[1].active {
            return true;
        }
        
        // Check based on question type
        match game.question.question_type {
            QuestionType::YesNo => game.question.answered_count >= game.question.options.len(),
            QuestionType::Ranking => false, // Ranking questions continue until both teams are out
            QuestionType::Reveal => game.question.answered_count >= game.question.reveal_items.len(),
        }
    })
}

#[wasm_bindgen]
pub fn answer_was_correct(index: usize) -> i32 {
    // Returns: -1 = not answered, 0 = incorrect, 1 = correct
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return -1; };
        match game.question.options.get(index).and_then(|o| o.answer_was_correct) {
            Some(true) => 1,
            Some(false) => 0,
            None => -1,
        }
    })
}

#[wasm_bindgen]
pub fn correct_answer_is_yes(index: usize) -> bool {
    // Returns: true if the correct answer is "Ja" (city is European), false if "Nein"
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return false; };
        game.question.options.get(index).map(|o| o.is_european).unwrap_or(false)
    })
}

#[wasm_bindgen]
pub fn team_round_score(idx: usize) -> usize {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return 0; };
        game.teams.get(idx).map(|t| t.round_score).unwrap_or(0)
    })
}

#[wasm_bindgen]
pub fn team_score(idx: usize) -> usize {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return 0; };
        game.teams.get(idx).map(|t| t.score).unwrap_or(0)
    })
}

#[wasm_bindgen]
pub fn team_active(idx: usize) -> bool {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return false; };
        game.teams.get(idx).map(|t| t.active).unwrap_or(false)
    })
}

#[wasm_bindgen]
pub fn current_team_index() -> usize {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return 0; };
        game.current_team
    })
}

#[wasm_bindgen]
pub fn current_team_name() -> String {
    GAME.with(|g| {
        let gb = g.borrow();
        let Some(game) = gb.as_ref() else { return "".to_string(); };
        game.teams.get(game.current_team).map(|t| t.name.clone()).unwrap_or_default()
    })
}

#[wasm_bindgen]
pub fn resign_current_team() {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        let Some(game) = gm.as_mut() else { return; };
        game.teams[game.current_team].active = false;
        let other = other_team(game.current_team);
        if game.teams[other].active {
            game.current_team = other;
        }
    })
}

#[wasm_bindgen]
pub fn get_sets_count() -> usize {
    QUESTION_SETS.with(|sets| sets.borrow().len())
}

#[wasm_bindgen]
pub fn get_set_name(index: usize) -> String {
    QUESTION_SETS.with(|sets| {
        let sets_vec = sets.borrow();
        sets_vec.get(index).map(|s| s.name.clone()).unwrap_or_default()
    })
}

#[wasm_bindgen]
pub fn get_current_set_index() -> usize {
    CURRENT_SET_INDEX.with(|idx| *idx.borrow())
}

#[wasm_bindgen]
pub fn load_question_set(set_index: usize) {
    CURRENT_SET_INDEX.with(|idx| {
        *idx.borrow_mut() = set_index;
    });
    
    // Reset game with new set
    GAME.with(|g| {
        *g.borrow_mut() = Some(Game {
            question: question_by_index(0),
            teams: [
                Team { name: "Team A".to_string(), score: 0, round_score: 0, active: true },
                Team { name: "Team B".to_string(), score: 0, round_score: 0, active: true },
            ],
            current_team: 0,
            question_index: 0,
        });
    });
}

#[wasm_bindgen]
pub fn init_empty_game() {
    GAME.with(|g| {
        *g.borrow_mut() = Some(Game {
            question: Question {
                question_type: QuestionType::YesNo,
                prompt: "".to_string(),
                options: vec![],
                ranking_items: vec![],
                reveal_items: vec![],
                score: 0,
                answered_count: 0,
            },
            teams: [
                Team { name: "Team A".to_string(), score: 0, round_score: 0, active: true },
                Team { name: "Team B".to_string(), score: 0, round_score: 0, active: true },
            ],
            current_team: 0,
            question_index: 0,
        });
    });
}

#[wasm_bindgen]
pub fn load_yesno_question(prompt_text: String) {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            game.question = Question {
                question_type: QuestionType::YesNo,
                prompt: prompt_text,
                options: vec![],
                ranking_items: vec![],
                reveal_items: vec![],
                score: 0,
                answered_count: 0,
            };
        }
    });
}

#[wasm_bindgen]
pub fn add_yesno_option(text: String, is_correct: bool) {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            game.question.options.push(OptionItem {
                text,
                is_european: is_correct,
                answered: false,
                answer_was_correct: None,
            });
        }
    });
}

#[wasm_bindgen]
pub fn load_ranking_question(prompt_text: String) {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            game.question = Question {
                question_type: QuestionType::Ranking,
                prompt: prompt_text,
                options: vec![],
                ranking_items: vec![],
                reveal_items: vec![],
                score: 0,
                answered_count: 0,
            };
        }
    });
}

#[wasm_bindgen]
pub fn load_reveal_question(prompt_text: String) {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            game.question = Question {
                question_type: QuestionType::Reveal,
                prompt: prompt_text,
                options: vec![],
                ranking_items: vec![],
                reveal_items: vec![],
                score: 0,
                answered_count: 0,
            };
        }
    });
}

#[wasm_bindgen]
pub fn add_reveal_option(text: String, answer: String) {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            game.question.reveal_items.push(RevealItem {
                text,
                answer,
                answered: false,
                answer_was_correct: None,
            });
        }
    });
}

#[wasm_bindgen]
pub fn add_ranking_item(text: String, correct_position: usize) {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            game.question.ranking_items.push(RankingItem {
                text,
                correct_position,
                user_position: None,
            });
        }
    });
}

#[wasm_bindgen]
pub fn next_question_from_json() {
    GAME.with(|g| {
        let mut gm = g.borrow_mut();
        if let Some(game) = gm.as_mut() {
            game.question_index += 1;
            for team in game.teams.iter_mut() {
                team.active = true;
                team.round_score = 0;
            }
            game.current_team = 0;
        }
    });
}
