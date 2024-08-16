import { contextBridge, ipcRenderer } from "electron"

const fileAPI = {
  readFiles: (filePaths: string[]) => ipcRenderer.invoke("readFiles", filePaths),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("writeFile", filePath, content),
  readDir: (dirPath: string) => ipcRenderer.invoke("readDir", dirPath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke("renameFile", oldPath, newPath),
  selectDirectory: () => ipcRenderer.invoke("selectDirectory"),
  selectFiles: () => ipcRenderer.invoke("selectFiles"),
  getDirectoryStructure: (dirPath: string) => ipcRenderer.invoke("getDirectoryStructure", dirPath),
}

const env = {
  getWsPort: () => ipcRenderer.invoke("getWsPort"),
}

const screenShareAPI = {
  getSources: () => ipcRenderer.invoke("getSources"),
  captureScreenshot: (sourceId: string) => ipcRenderer.invoke("captureScreenshot", sourceId),
}

contextBridge.exposeInMainWorld("electronAPI", {
  file: fileAPI,
  env,
  screenShare: screenShareAPI,
})
