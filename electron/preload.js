const { contextBridge, ipcRenderer } = require('electron');

// ✅ عرض API للـ renderer process
contextBridge.exposeInMainWorld('electron', {
  // الحصول على IP Address المحلي
  getLocalIP: () => ipcRenderer.invoke('get-local-ip')
});
