import { contextBridge, ipcRenderer } from "electron"

const fileAPI = {
  readFiles: (filePaths: string[]) => ipcRenderer.invoke("readFiles", filePaths),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke("writeFile", filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke("readFile", filePath),
  readDir: (dirPath: string) => ipcRenderer.invoke("readDir", dirPath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke("renameFile", oldPath, newPath),
  selectDirectory: () => ipcRenderer.invoke("selectDirectory"),
  selectFiles: () => ipcRenderer.invoke("selectFiles"),
  getDirectoryStructure: (dirPath: string) => ipcRenderer.invoke("getDirectoryStructure", dirPath),
  getAbsolutePath: (filePath: string) => ipcRenderer.invoke("getAbsolutePath", filePath),
  readDirectoryRecursive: (dirPath: string) => ipcRenderer.invoke("readDirectoryRecursive", dirPath),
  executePandoc: (inputFile: string, outputFile: string, fromFormat: string, toFormat: string) =>
    ipcRenderer.invoke("executePandoc", inputFile, outputFile, fromFormat, toFormat),
  undoGitCommit: () => ipcRenderer.invoke("undoGitCommit"),
  getFileStats: (filePath: string) => ipcRenderer.invoke("getFileStats", filePath),
  createDirectory: () => ipcRenderer.invoke("createDirectory"),
  cloneGitRepository: (repoUrl: string, targetPath: string, progressCallback: (progress: number) => void) =>
    ipcRenderer.invoke("cloneGitRepository", repoUrl, targetPath, progressCallback),
  promptGitRepoUrl: () => ipcRenderer.invoke("promptGitRepoUrl"),
  checkGitInstalled: () => ipcRenderer.invoke("checkGitInstalled"),
}

const env = {
  getWsPort: () => ipcRenderer.invoke("getWsPort"),
}

const screenShareAPI = {
  getSources: () => ipcRenderer.invoke("getSources"),
  captureScreenshot: (sourceId: string) => ipcRenderer.invoke("captureScreenshot", sourceId),
}

const windowAPI = {
  openChildWindow: () => ipcRenderer.send("open-child-window"),
}

const updateAPI = {
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
}

const bashAPI = {
  executeBash: (script: string) => ipcRenderer.invoke("executeBash", script),
}

contextBridge.exposeInMainWorld("electronAPI", {
  file: fileAPI,
  env,
  screenShare: screenShareAPI,
  window: windowAPI,
  update: updateAPI,
  bash: bashAPI,
})