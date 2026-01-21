# Schlaue10 WebAssembly Game

Dieses Projekt verwendet Rust und wasm-pack, um ein Spiel mit WebAssembly zu erstellen.

## Voraussetzungen
- Rust (https://www.rust-lang.org/tools/install)
- wasm-pack (https://rustwasm.github.io/wasm-pack/installer/)
- Node.js und npm

## Installation
1. Rust und wasm-pack installieren
2. npm install ausführen

## Entwicklung
- `npm run build:wasm` kompiliert das Rust-Projekt zu WebAssembly (Ausgabe in `pkg/`)
- `npm start` oder `npm run dev` startet den Vite-Dev-Server unter `http://localhost:5173` (Port ist strikt, Fehlermeldung bei Belegung)
- `npm run build:web` baut das Frontend (Vite)
- `npm run build` führt beides aus: WASM bauen und anschließend das Web bauen
- `npm run preview` startet einen lokalen Preview-Server für das gebaute Frontend

## Spiel: Schlaue10-ähnliches Quiz
- Sets werden automatisch per `import.meta.glob()` aus dem Ordner `questions/` geladen (JSON-Dateien). Eigene Sets können dort abgelegt oder zur Laufzeit hochgeladen werden.
- Drei Fragetypen werden unterstützt: Yes/No, Ranking und Reveal (mit 2‑Schritt‑Flow).

## Beispiel
Das Projekt enthält ein minimales Quiz-Beispiel, das WebAssembly im Browser lädt und die Spiel-Logik in Rust ausführt.

## Lizenz
MIT