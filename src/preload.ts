import { contextBridge, ipcRenderer } from "electron"

const fileAPI = {
  readFiles: (filePaths: string[]) => ipcRenderer.invoke("readFiles", filePaths),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("writeFile", filePath, content),
  readDir: (dirPath: string) => ipcRenderer.invoke("readDir", dirPath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke("renameFile", oldPath, newPath),
}

contextBridge.exposeInMainWorld("electronAPI", {
  file: fileAPI,
})
