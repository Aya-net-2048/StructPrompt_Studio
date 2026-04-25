const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // Security: Disable Node integration in renderer
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Example
ipcMain.handle('open-file-dialog', async (event, filters) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Data', extensions: ['csv', 'jsonl', 'xls', 'xlsx'] }]
  });
  if (canceled) return null;
  return filePaths[0];
});

const { getSample } = require('./dataParser.cjs');
ipcMain.handle('get-sample-data', async (event, filePath, limit) => {
  try {
    return await getSample(filePath, limit);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

ipcMain.handle('save-result-file', async (event, content, defaultPath) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [
      { name: 'CSV Data', extensions: ['csv'] },
      { name: 'JSON Data', extensions: ['json'] }
    ]
  });
  if (!canceled && filePath) {
    let outputContent = content;
    if (filePath.endsWith('.csv')) {
      const Papa = require('papaparse');
      outputContent = Papa.unparse(JSON.parse(content));
    }
    require('fs').writeFileSync(filePath, outputContent, 'utf-8');
    return filePath;
  }
  return null;
});

// 大模型通用接口代理 (防止前端跨域限制)
ipcMain.handle('call-llm', async (event, { baseUrl, apiKey, model, messages }) => {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }
    
    const data = await response.json();
    return { success: true, data: data.choices[0].message.content };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
});
