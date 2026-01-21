import init, { init_empty_game, new_round, prompt, options_len, option_text, has_answered, answer, score, is_completed, correct_answer_is_yes, team_score, team_round_score, team_active, current_team_index, current_team_name, resign_current_team, question_type, ranking_items_len, ranking_item_text, ranking_correct_position, set_ranking_position, submit_ranking, load_yesno_question, add_yesno_option, load_ranking_question, add_ranking_item, next_question_from_json, reveal_items_len, reveal_item_text, reveal_item_answer, load_reveal_question, add_reveal_option, mark_reveal } from "../pkg/smart10spiel.js";

let selectedIndex = -1;
let selectedRankIndex = -1;
let selectedRevealIndex = -1;
let currentQuestionSet = null;
let currentQuestionIndex = 0;
let builtinSets = [];

// Load question sets dynamically from questions/ directory
async function loadQuestionSets() {
  // Get list of files from Electron or scan manually
  let questionFiles = [];
  
  if (window.electronAPI) {
    // Running in Electron - use IPC to get file list
    questionFiles = await window.electronAPI.listQuestionFiles();
  } else {
    // Running in browser - try known files
    questionFiles = [
      'geografie.json',
      'natur.json',
      'sport.json',
      'film_reveal.json',
      'meins.json'
    ];
  }
  
  const sets = [];
  for (const file of questionFiles) {
    try {
      const response = await fetch(`./questions/${file}`);
      if (response.ok) {
        const data = await response.json();
        sets.push(data);
      }
    } catch (err) {
      console.warn(`Could not load ${file}:`, err);
    }
  }
  
  builtinSets = sets;
  return sets;
}

async function showStartMenu() {
  const setList = document.getElementById('setList');
  setList.innerHTML = '';

  for (const data of builtinSets) {
    if (!data) continue;
    const card = document.createElement('div');
    card.className = 'set-card';
    card.innerHTML = `
      <div class="set-card-name">${data.setName}</div>
      <div class="set-card-info">${data.questions.length} Fragen</div>
    `;
    card.addEventListener('click', () => showConfirmSet(data));
    setList.appendChild(card);
  }
  if (setList.children.length === 0) {
    const hint = document.createElement('div');
    hint.style.color = 'white';
    hint.style.marginTop = '20px';
    hint.style.textAlign = 'center';
    hint.innerHTML = 'Keine Sets gefunden. Stelle sicher, dass die JSON-Dateien unter <b>questions/</b> liegen und neu gebaut wurden.';
    setList.appendChild(hint);
  }

  // Wire up upload
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadInput = document.getElementById('uploadInput');
  const uploadError = document.getElementById('uploadError');
  uploadBtn.onclick = () => uploadInput.click();
  uploadInput.onchange = async (e) => {
    uploadError.style.display = 'none';
    uploadError.textContent = '';
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const valid = validateQuestionSet(data);
      if (!valid.ok) {
        throw new Error(valid.reason || 'Ungültiges JSON-Schema');
      }
      showConfirmSet(data);
    } catch (err) {
      uploadError.textContent = `Konnte Datei nicht laden: ${err.message || err}`;
      uploadError.style.display = 'block';
    } finally {
      uploadInput.value = '';
    }
  };
}

function validateQuestionSet(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'Kein JSON-Objekt' };
  if (typeof obj.setName !== 'string') return { ok: false, reason: 'Feld setName fehlt oder ist nicht String' };
  if (!Array.isArray(obj.questions) || obj.questions.length === 0) return { ok: false, reason: 'Feld questions fehlt oder ist leer' };
  for (const q of obj.questions) {
    if (!q || typeof q !== 'object') return { ok: false, reason: 'Ungültige Frage' };
    if (typeof q.type !== 'string') return { ok: false, reason: 'Frage ohne type' };
    if (typeof q.prompt !== 'string') return { ok: false, reason: 'Frage ohne prompt' };
    if (q.type === 'yesno') {
      if (!Array.isArray(q.options) || q.options.length !== 10) return { ok: false, reason: 'Yes/No-Frage braucht genau 10 options' };
      for (const o of q.options) {
        if (typeof o.text !== 'string' || typeof o.correct !== 'boolean') return { ok: false, reason: 'Option benötigt text (String) und correct (Boolean)' };
      }
    } else if (q.type === 'ranking') {
      if (!Array.isArray(q.items) || q.items.length !== 10) return { ok: false, reason: 'Ranking-Frage braucht genau 10 items' };
      for (const it of q.items) {
        if (typeof it.text !== 'string' || typeof it.position !== 'number') return { ok: false, reason: 'Item benötigt text (String) und position (Number 1-10)' };
        if (it.position < 1 || it.position > 10) return { ok: false, reason: 'position muss 1..10 sein' };
      }
    } else if (q.type === 'reveal') {
      if (!Array.isArray(q.options) || q.options.length !== 10) return { ok: false, reason: 'Reveal-Frage braucht genau 10 options' };
      for (const o of q.options) {
        if (typeof o.text !== 'string' || typeof o.answer !== 'string') return { ok: false, reason: 'Option benötigt text (String) und answer (String)' };
      }
    } else {
      return { ok: false, reason: `Unbekannter Frage-Typ: ${q.type}` };
    }
  }
  return { ok: true };
}

function startGame(questionSet) {
  currentQuestionSet = questionSet;
  currentQuestionIndex = 0;
  document.getElementById('startMenu').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'block';
  init_empty_game();
  loadQuestionFromSet(0);
  render();
}

function showConfirmSet(questionSet) {
  const overlay = document.getElementById('confirmOverlay');
  const title = document.getElementById('confirmTitle');
  const preview = document.getElementById('confirmPreview');
  const list = document.getElementById('confirmList');
  const btnStart = document.getElementById('confirmStart');
  const btnCancel = document.getElementById('confirmCancel');

  title.textContent = `Set starten: ${questionSet.setName}`;
  preview.textContent = `${questionSet.questions.length} Fragen. Erste Vorschau:`;
  list.innerHTML = '';
  const sample = questionSet.questions.slice(0, 3);
  for (const q of sample) {
    const row = document.createElement('div');
    row.textContent = `• [${q.type}] ${q.prompt}`;
    list.appendChild(row);
  }

  const close = () => { overlay.style.display = 'none'; btnStart.onclick = null; btnCancel.onclick = null; };
  btnCancel.onclick = close;
  btnStart.onclick = () => { close(); startGame(questionSet); };
  overlay.style.display = 'flex';
}

function loadQuestionFromSet(index) {
  if (!currentQuestionSet || index >= currentQuestionSet.questions.length) {
    return;
  }
  const q = currentQuestionSet.questions[index];
  if (q.type === 'yesno') {
    load_yesno_question(q.prompt);
    q.options.forEach(opt => add_yesno_option(opt.text, opt.correct));
  } else if (q.type === 'ranking') {
    load_ranking_question(q.prompt);
    q.items.forEach(item => add_ranking_item(item.text, item.position));
  } else if (q.type === 'reveal') {
    load_reveal_question(q.prompt);
    q.options.forEach(opt => add_reveal_option(opt.text, opt.answer));
  }
}

function loadNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= currentQuestionSet.questions.length) {
    showGameOverScreen();
    return;
  }
  next_question_from_json();
  loadQuestionFromSet(currentQuestionIndex);
}

function showGameOverScreen() {
  const scoreA = team_score(0);
  const scoreB = team_score(1);
  let winnerText = '';
  winnerText = scoreA > scoreB ? 'Team A gewinnt!' : scoreB > scoreA ? 'Team B gewinnt!' : 'Unentschieden!';
  document.getElementById('winnerText').textContent = winnerText;
  document.getElementById('finalScoreA').textContent = scoreA + ' Punkte';
  document.getElementById('finalScoreB').textContent = scoreB + ' Punkte';
  document.getElementById('gameContainer').style.display = 'none';
  document.getElementById('gameOverScreen').style.display = 'block';
}

function selectRank(rank) {
  if (selectedRankIndex === -1) return;
  const itemIndex = selectedRankIndex;
  const originalText = ranking_item_text(itemIndex);
  const correctPos = ranking_correct_position(itemIndex);
  const correct = set_ranking_position(itemIndex, rank);
  const optionCircles = document.querySelectorAll('#options .option-circle');
  const circle = optionCircles[itemIndex];
  circle.classList.add(correct ? 'feedback-correct' : 'feedback-incorrect');
  circle.style.color = 'white';
  circle.textContent = String(rank);
  circle.dataset.locked = 'true';
  document.getElementById('rankPanel').classList.remove('active');
  selectedRankIndex = -1;
  setTimeout(() => {
    circle.classList.remove('feedback-correct', 'feedback-incorrect');
    circle.classList.add('selected');
    circle.style.color = '';
    circle.textContent = `${originalText} (${correctPos})`;
    circle.classList.add(correct ? 'answer-yes' : 'answer-no');
    updateStatus();
  }, 2000);
}

function getRadialPosition(index, total, radius = 200) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return { x: Math.cos(angle) * radius + 300 - 40, y: Math.sin(angle) * radius + 300 - 40 };
}

function positionPanel(panel, circleRect, offsetLeft = -125, offsetTop = 100) {
  const panelRect = panel.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const left = Math.min(Math.max(circleRect.left + offsetLeft, 10), Math.max(viewportW - panelRect.width - 10, 10));
  const top = Math.min(Math.max(circleRect.top + offsetTop, 10), Math.max(viewportH - panelRect.height - 10, 10));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function updatePassButton() {
  const btn = document.getElementById('passBtnGlobal');
  const canUse = team_active(current_team_index()) && !is_completed();
  btn.disabled = !canUse;
  btn.textContent = team_active(current_team_index()) ? 'Aus Runde aussteigen' : 'Team pausiert';
}

function updateTeams() {
  const aActive = team_active(0);
  const bActive = team_active(1);
  document.getElementById('teamAScore').innerText = String(team_score(0));
  document.getElementById('teamBScore').innerText = String(team_score(1));
  document.getElementById('teamARound').innerText = String(team_round_score(0));
  document.getElementById('teamBRound').innerText = String(team_round_score(1));
  const teamA = document.getElementById('teamA');
  const teamB = document.getElementById('teamB');
  teamA.classList.toggle('active', aActive);
  teamA.classList.toggle('inactive', !aActive);
  teamB.classList.toggle('active', bActive);
  teamB.classList.toggle('inactive', !bActive);
  const turnLabel = document.getElementById('turnLabel');
  turnLabel.textContent = (!aActive && !bActive) ? 'Beide Teams sind raus. Runde beendet.' : `Aktives Team: ${current_team_name()}`;
  updatePassButton();
}

async function render() {
  const type = question_type();
  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';

  // Place the question prompt into a central circle inside the ring of options
  const promptCircle = document.createElement('div');
  promptCircle.className = 'prompt-circle';
  promptCircle.textContent = prompt();
  optionsDiv.appendChild(promptCircle);
  if (type === 0) {
    const len = options_len();
    document.getElementById('total').innerText = String(len);
    for (let i = 0; i < len; i++) {
      const circle = document.createElement('div');
      circle.className = 'option-circle';
      circle.textContent = option_text(i);
      const pos = getRadialPosition(i, len);
      circle.style.left = pos.x + 'px';
      circle.style.top = pos.y + 'px';
      if (has_answered(i)) {
        circle.classList.add('selected');
        const correctYes = correct_answer_is_yes(i);
        circle.classList.add(correctYes ? 'answer-yes' : 'answer-no');
        circle.style.pointerEvents = 'none';
      }
      circle.addEventListener('click', () => {
        if (!has_answered(i) && team_active(current_team_index()) && !is_completed()) {
          selectedIndex = i;
          document.getElementById('selectedCity').textContent = option_text(i);
          const panel = document.getElementById('answerPanel');
          panel.classList.add('active');
          const circleRect = circle.getBoundingClientRect();
          panel.style.left = (circleRect.left - 75) + 'px';
          panel.style.top = (circleRect.top + 100) + 'px';
        }
      });
      optionsDiv.appendChild(circle);
    }
  } else if (type === 1) {
    const len = ranking_items_len();
    document.getElementById('total').innerText = String(len);
    for (let i = 0; i < len; i++) {
      const circle = document.createElement('div');
      circle.className = 'option-circle';
      circle.textContent = ranking_item_text(i);
      circle.style.cursor = 'pointer';
      circle.style.zIndex = '5';
      const pos = getRadialPosition(i, len);
      circle.style.left = pos.x + 'px';
      circle.style.top = pos.y + 'px';
      circle.dataset.locked = 'false';
      const clickHandler = (event) => {
        event.stopPropagation();
        if (circle.dataset.locked === 'true') return;
        if (team_active(current_team_index()) && !is_completed()) {
          selectedRankIndex = i;
          document.getElementById('selectedRankItem').textContent = ranking_item_text(i);
          const panel = document.getElementById('rankPanel');
          panel.classList.add('active');
          const circleRect = circle.getBoundingClientRect();
          positionPanel(panel, circleRect, -125, 100);
        }
      };
      circle.addEventListener('click', clickHandler, true);
      optionsDiv.appendChild(circle);
    }
    const rankButtonsRow = document.getElementById('rankButtonsRow');
    rankButtonsRow.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.textContent = String(i);
      btn.dataset.rank = String(i);
      btn.className = 'rank-buttons-row button';
      btn.addEventListener('click', () => selectRank(i));
      rankButtonsRow.appendChild(btn);
    }
  } else if (type === 2) {
    const len = reveal_items_len();
    document.getElementById('total').innerText = String(len);
    for (let i = 0; i < len; i++) {
      const circle = document.createElement('div');
      circle.className = 'option-circle';
      circle.textContent = reveal_item_text(i);
      circle.style.cursor = 'pointer';
      circle.style.zIndex = '5';
      const pos = getRadialPosition(i, len);
      circle.style.left = pos.x + 'px';
      circle.style.top = pos.y + 'px';
      circle.dataset.locked = 'false';
      optionsDiv.appendChild(circle);
      const clickHandler = (event) => {
        event.stopPropagation();
        if (circle.dataset.locked === 'true') return;
        if (team_active(current_team_index()) && !is_completed()) {
          selectedRevealIndex = i;
          const panel = document.getElementById('revealPanel');
          document.getElementById('revealQuestion').textContent = reveal_item_text(i);
          const ans = document.getElementById('revealAnswer');
          ans.textContent = '';
          ans.style.display = 'none';
          document.getElementById('revealInitialButtons').style.display = 'flex';
          document.getElementById('revealJudgeButtons').style.display = 'none';
          panel.classList.add('active');
          const circleRect = circle.getBoundingClientRect();
          positionPanel(panel, circleRect, -75, 100);
        }
      };
      circle.addEventListener('click', clickHandler, true);
    }
  }
  updateStatus();
  updateTeams();
}

window.backToMainMenu = function() {
  document.getElementById('gameContainer').style.display = 'none';
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('startMenu').style.display = 'flex';
  document.getElementById('options').innerHTML = '';
  document.getElementById('message').textContent = '';
  document.getElementById('answerPanel').classList.remove('active');
  document.getElementById('rankPanel').classList.remove('active');
  document.getElementById('revealPanel').classList.remove('active');
  const overlay = document.getElementById('confirmOverlay');
  if (overlay) overlay.style.display = 'none';
  selectedIndex = -1;
  selectedRankIndex = -1;
  selectedRevealIndex = -1;
  currentQuestionSet = null;
  currentQuestionIndex = 0;
  showStartMenu();
}

function updateStatus() {
  document.getElementById('score').innerText = String(score());
  const msg = document.getElementById('message');
  if (is_completed()) {
    const type = question_type();
    let total = options_len();
    if (type === 1) total = ranking_items_len();
    if (type === 2) total = reveal_items_len();
    msg.textContent = `Runde beendet! Erreichte Punkte: ${score()} / ${total}`;
    document.getElementById('answerPanel').classList.remove('active');
    document.querySelectorAll('#options .option-circle').forEach(el => { el.style.pointerEvents = 'none'; });
  } else {
    msg.textContent = '';
  }
  updateTeams();
}

async function run() {
  await init();
  await loadQuestionSets();
  
  // Initialize ChatGPT Prompt
  const prompt = `Generiere ein zufälliges Smart10 Quiz Set mit genau 10 Fragen im JSON-Format. Das Set soll folgende Struktur haben:

{
  "setName": "Thema Name (z.B. Geographie, Geschichte, Wissenschaft)",
  "questions": [
    {
      "type": "yesno",
      "prompt": "Ist [Statement]?",
      "options": [
        {"text": "Option 1", "correct": true},
        {"text": "Option 2", "correct": false},
        {"text": "Option 3", "correct": true},
        {"text": "Option 4", "correct": false},
        {"text": "Option 5", "correct": true},
        {"text": "Option 6", "correct": false},
        {"text": "Option 7", "correct": true},
        {"text": "Option 8", "correct": false},
        {"text": "Option 9", "correct": true},
        {"text": "Option 10", "correct": false}
      ]
    },
    {
      "type": "ranking",
      "prompt": "Ordne diese nach [Kriterium]:",
      "items": [
        {"text": "Item 1", "position": 5},
        {"text": "Item 2", "position": 2},
        {"text": "Item 3", "position": 8},
        {"text": "Item 4", "position": 1},
        {"text": "Item 5", "position": 9},
        {"text": "Item 6", "position": 3},
        {"text": "Item 7", "position": 7},
        {"text": "Item 8", "position": 4},
        {"text": "Item 9", "position": 10},
        {"text": "Item 10", "position": 6}
      ]
    },
    {
      "type": "reveal",
      "prompt": "Wer ist der Autor?",
      "options": [
        {"text": "Werk 1", "answer": "Autor 1"},
        {"text": "Werk 2", "answer": "Autor 2"},
        {"text": "Werk 3", "answer": "Autor 3"},
        {"text": "Werk 4", "answer": "Autor 4"},
        {"text": "Werk 5", "answer": "Autor 5"},
        {"text": "Werk 6", "answer": "Autor 6"},
        {"text": "Werk 7", "answer": "Autor 7"},
        {"text": "Werk 8", "answer": "Autor 8"},
        {"text": "Werk 9", "answer": "Autor 9"},
        {"text": "Werk 10", "answer": "Autor 10"}
      ]
    },
    ... (7 weitere Fragen gemischt aus den drei Typen)
  ]
}

Regeln:
- Genau 10 Fragen total (mix aus yesno, ranking, reveal)
- Yes/No Fragen: genau 10 Optionen, jeweils mit "correct": true/false
- Ranking Fragen: 10 Items mit Positionen 1-10 (die Reihenfolge der Positionen soll zufällig sein, nicht aufsteigend)
- Reveal Fragen: 10 Paare aus Text und Answer
- Texte in den kleinen Kreisen (options/items text) maximal 30 Zeichen lang
- Alle Texte auf Deutsch
- Realistische und interessante Fragen zum Thema
- JSON muss valide sein (keine Fehler)
- Generiere das Ergebnis direkt als JSON-Datei (ohne zusätzliche Erklärungen)

Bitte generiere jetzt ein Set zu einem Zufallsthema.`;
  
  document.getElementById('chatgptPrompt').textContent = prompt;
  
  // Copy button functionality
  document.getElementById('copyPromptBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(prompt).then(() => {
      const btn = document.getElementById('copyPromptBtn');
      const originalText = btn.textContent;
      btn.textContent = '✓ Kopiert!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  });
  
  showStartMenu();
  document.addEventListener('click', (e) => {
    console.log('Global click detected on:', e.target.tagName, e.target.className, e.target.id);
  }, true);

  function handleAnswer(yes) {
    if (selectedIndex === -1) return;
    if (!team_active(current_team_index()) || is_completed()) return;
    const ok = answer(selectedIndex, yes);
    const correctYes = correct_answer_is_yes(selectedIndex);
    const optionCircles = document.querySelectorAll('#options .option-circle');
    const circle = optionCircles[selectedIndex];
    const originalText = option_text(selectedIndex);
    circle.classList.remove('correct', 'incorrect', 'answer-yes', 'answer-no', 'feedback-correct', 'feedback-incorrect');
    circle.classList.add('selected', ok ? 'feedback-correct' : 'feedback-incorrect');
    circle.style.pointerEvents = 'none';
    circle.textContent = correctYes ? 'Ja' : 'Nein';
    setTimeout(() => {
      circle.classList.remove('feedback-correct', 'feedback-incorrect');
      circle.classList.add(correctYes ? 'answer-yes' : 'answer-no');
      circle.textContent = originalText;
    }, 2000);
    document.getElementById('answerPanel').classList.remove('active');
    selectedIndex = -1;
    updateStatus();
  }

  function handleReveal(correct) {
    if (selectedRevealIndex === -1) return;
    if (!team_active(current_team_index()) || is_completed()) return;
    const optionCircles = document.querySelectorAll('#options .option-circle');
    const circle = optionCircles[selectedRevealIndex];
    const originalText = reveal_item_text(selectedRevealIndex);
    const answerText = reveal_item_answer(selectedRevealIndex);
    const ok = mark_reveal(selectedRevealIndex, correct);
    circle.classList.remove('feedback-correct', 'feedback-incorrect', 'answer-yes', 'answer-no', 'selected');
    circle.classList.add(ok ? 'feedback-correct' : 'feedback-incorrect');
    circle.style.pointerEvents = 'none';
    circle.dataset.locked = 'true';
    circle.textContent = ok ? '✓' : '✕';
    document.getElementById('revealPanel').classList.remove('active');
    setTimeout(() => {
      circle.classList.remove('feedback-correct', 'feedback-incorrect');
      circle.classList.add('selected');
      circle.textContent = `${originalText} (${answerText})`;
      circle.classList.add(ok ? 'answer-yes' : 'answer-no');
    }, 2000);
    selectedRevealIndex = -1;
    updateStatus();
  }

  document.getElementById('yesBtn').addEventListener('click', () => handleAnswer(true));
  document.getElementById('noBtn').addEventListener('click', () => handleAnswer(false));
  document.getElementById('revealConfirm').addEventListener('click', () => {
    if (selectedRevealIndex === -1) return;
    const ans = document.getElementById('revealAnswer');
    ans.textContent = `Antwort: ${reveal_item_answer(selectedRevealIndex)}`;
    ans.style.display = 'block';
    document.getElementById('revealInitialButtons').style.display = 'none';
    document.getElementById('revealJudgeButtons').style.display = 'flex';
  });
  document.getElementById('revealCorrect').addEventListener('click', () => handleReveal(true));
  document.getElementById('revealWrong').addEventListener('click', () => handleReveal(false));
  document.getElementById('passBtnGlobal').addEventListener('click', () => {
    if (!team_active(current_team_index()) || is_completed()) return;
    resign_current_team();
    document.getElementById('answerPanel').classList.remove('active');
    document.getElementById('rankPanel').classList.remove('active');
    document.getElementById('revealPanel').classList.remove('active');
    selectedIndex = -1;
    selectedRankIndex = -1;
    selectedRevealIndex = -1;
    updateStatus();
  });
  document.getElementById('resetBtn').addEventListener('click', async () => {
    loadNextQuestion();
    await render();
    selectedIndex = -1;
    selectedRankIndex = -1;
    selectedRevealIndex = -1;
  });
}
run();
