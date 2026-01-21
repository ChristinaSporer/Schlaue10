# GitHub Pages Deployment

## Erstmalige Einrichtung

### 1. Git Repository initialisieren (falls noch nicht geschehen)

```powershell
git init
git add .
git commit -m "Initial commit: Schlaue10 Quiz Game"
```

### 2. GitHub Repository erstellen

1. Gehe zu [github.com](https://github.com) und erstelle ein neues Repository
2. Name: z.B. `Schlaue10` (oder einen anderen Namen)
3. **Wichtig**: Repository auf **Public** setzen (GitHub Pages ist für private Repos kostenpflichtig)
4. Keine README, .gitignore oder License hinzufügen (existieren bereits lokal)

### 3. Repository mit GitHub verbinden

```powershell
git remote add origin https://github.com/DEIN-USERNAME/Schlaue10.git
git branch -M main
git push -u origin main
```

**Ersetze `DEIN-USERNAME`** mit deinem GitHub Benutzernamen!

### 4. GitHub Pages aktivieren

1. Gehe zu deinem Repository auf GitHub
2. Klicke auf **Settings** (Zahnrad-Symbol)
3. Klicke links auf **Pages**
4. Under **Source** wähle: **GitHub Actions**
5. Speichern

### 5. Deployment starten

Der Workflow startet automatisch nach dem Push. Du kannst den Status sehen unter:
- Repository → **Actions** Tab

Nach erfolgreichem Deployment ist die App verfügbar unter:
```
https://DEIN-USERNAME.github.io/Schlaue10/
```

## Aktualisierungen veröffentlichen

Wenn du Änderungen machst:

```powershell
git add .
git commit -m "Beschreibung der Änderungen"
git push
```

Das Deployment erfolgt automatisch nach jedem Push auf `main`.

## Lokales Testen vor dem Push

```powershell
# WASM bauen
npm run build:wasm

# Web bauen
npm run build:web

# Lokale Preview
npm run preview
```

## Fehlerbehebung

### Build schlägt fehl
- Prüfe den **Actions** Tab auf GitHub für Details
- Stelle sicher, dass alle Dependencies in `package.json` stehen
- Lokaler Test: `npm run build` sollte ohne Fehler durchlaufen

### Seite zeigt nur weiße Seite
- Prüfe Browser Console (F12) auf Fehler
- Möglicherweise falscher `base` path in `vite.config.js`
- Wenn Repository Name anders ist: `base: '/REPOSITORY-NAME/'` setzen

### WASM lädt nicht
- WASM muss mit korrektem MIME-Type ausgeliefert werden
- GitHub Pages unterstützt `.wasm` files nativ
- Falls Probleme: Prüfe Network Tab im Browser (F12)

## Wichtige Hinweise

- **Electron Version**: GitHub Pages deployed nur die Web-Version (keine .exe)
- **Question Sets**: Die `questions/` Dateien werden automatisch kopiert
- **Build Zeit**: Erster Build dauert ~2-3 Minuten, spätere Builds sind schneller durch Caching
- **Custom Domain**: Kann in Repository Settings → Pages konfiguriert werden
