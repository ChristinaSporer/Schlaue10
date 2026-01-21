# Electron Setup

Electron ist nun eingerichtet! 

## Verwendung:

### Testen (nach Build):
```bash
npm run build
npm run electron
```

### Installer erstellen:
```bash
npm run electron:build:win
```

Die .exe wird in `release/` erstellt.

### Icon hinzufügen (optional):
Platziere ein Icon als `build/icon.ico` (256x256 px), dann neu bauen.

## Was wurde erstellt:
- `electron/main.js` - Electron-Hauptprozess
- Neue npm scripts in package.json
- Build-Konfiguration für electron-builder
