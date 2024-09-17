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
  readDirectoryRecursive: async (dirPath: string) => {
    const result = await ipcRenderer.invoke("readDirectoryRecursive", dirPath)
    if (result.success) {
      // 将Base64编码的文件内容转换回原始格式
      result.files = result.files.map(file => {
        if (file.type === 'file' && file.content) {
          return {
            ...file,
            content: atob(file.content)
          }
        }
        return file
      })
    }
    return result
  },
  executePandoc: (inputFile: string, outputFile: string, fromFormat: string, toFormat: string) =>
    ipcRenderer.invoke("executePandoc", inputFile, outputFile, fromFormat, toFormat),
  getFileStats: (filePath: string) => ipcRenderer.invoke("getFileStats", filePath),
  createDirectory: () => ipcRenderer.invoke("createDirectory"),
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

const linkAPI = {
  openExternalLink: (url: string) => ipcRenderer.invoke("open-external-link", url),
}

const gitAPI = {
  undoGitCommit: () => ipcRenderer.invoke("undoGitCommit"),
  cloneGitRepository: (repoUrl: string, targetPath: string) =>
    ipcRenderer.invoke("cloneGitRepository", repoUrl, targetPath),
  promptGitRepoUrl: () => ipcRenderer.invoke("promptGitRepoUrl"),
  checkGitInstalled: () => ipcRenderer.invoke("checkGitInstalled"),
  setGitConfig: (username: string, email: string) => ipcRenderer.invoke("setGitConfig", username, email),
  generateSSHKey: () => ipcRenderer.invoke("generateSSHKey"),
}

contextBridge.exposeInMainWorld("electronAPI", {
  file: fileAPI,
  env,
  screenShare: screenShareAPI,
  window: windowAPI,
  update: updateAPI,
  bash: bashAPI,
  link: linkAPI,
  git: gitAPI,
})