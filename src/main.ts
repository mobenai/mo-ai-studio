import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import fs from "fs/promises"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit()
}
const isDev = process.argv.slice(2)[0] === "--dev"
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 728,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDev, // 在生产环境中禁用 DevTools
    },
  })

  mainWindow.loadURL("https://www.mobenai.com.cn/login")

  // 只在开发环境中打开 DevTools
  if (true) {
    mainWindow.webContents.openDevTools()
  }

  // 在生产环境中禁用打开 DevTools 的快捷键
  if (!isDev) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key.toLowerCase() === "i" && input.control && input.shift) {
        event.preventDefault()
      }
    })
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 文件操作相关的 IPC 处理器
const allowedExtensions = [".txt", ".md", ".js", ".ts", ".json", ".html", ".css"]

ipcMain.handle("readFiles", async (_, filePaths) => {
  try {
    const contents = await Promise.all(
      filePaths.map(async (filePath) => {
        const ext = path.extname(filePath).toLowerCase()
        if (!allowedExtensions.includes(ext)) {
          throw new Error(`Unsupported file type: ${filePath}`)
        }
        const content = await fs.readFile(filePath, "utf-8")
        return { path: filePath, content }
      })
    )
    return contents
  } catch (error) {
    throw error
  }
})

ipcMain.handle("writeFile", async (_, filePath, content) => {
  try {
    const ext = path.extname(filePath).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`Unsupported file type: ${filePath}`)
    }
    await fs.writeFile(filePath, content, "utf-8")
    return true
  } catch (error) {
    throw error
  }
})

ipcMain.handle("readDir", async (_, dirPath) => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true })
    return files.map((file) => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(dirPath, file.name),
    }))
  } catch (error) {
    throw error
  }
})

ipcMain.handle("renameFile", async (_, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath)
    return true
  } catch (error) {
    throw error
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
