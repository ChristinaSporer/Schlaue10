const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  listQuestionFiles: () => ipcRenderer.invoke('list-question-files')
});
