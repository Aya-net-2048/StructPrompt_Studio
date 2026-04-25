const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
  getSampleData: (filePath, limit) => ipcRenderer.invoke('get-sample-data', filePath, limit),
  saveResultFile: (content, defaultPath) => ipcRenderer.invoke('save-result-file', content, defaultPath),
  callLLM: (payload) => ipcRenderer.invoke('call-llm', payload)
});
