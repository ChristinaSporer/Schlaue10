const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png'),
    title: 'Schlaue10 Quiz'
  });

  // Load the built app
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

// IPC Handler to list question files
ipcMain.handle('list-question-files', async () => {
  try {
    const questionsDir = path.join(__dirname, '../dist/questions');
    const files = fs.readdirSync(questionsDir);
    return files.filter(f => f.endsWith('.json'));
  } catch (err) {
    console.error('Error reading questions directory:', err);
    return [];
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
