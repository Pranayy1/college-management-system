const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    printMarksheet: () => ipcRenderer.invoke("print-marksheet")
});