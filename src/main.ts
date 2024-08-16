import { app, BrowserWindow, ipcMain, dialog } from "electron"
import path from "path"
import http from "http"
import fs from "fs/promises"
import WebSocket from "ws"
import net from "net"
import httpServer from "./httpServer"
import { initializeWebSocketServer } from "./wsServer"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit()
}

const isDev = process.argv.slice(2)[0] === "--dev"
let port = 3000
console.log(isDev)

// 查找可用端口
const findAvailablePort = (startPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(startPort, () => {
      server.once("close", () => {
        resolve(startPort)
      })
      server.close()
    })
    server.on("error", () => {
      findAvailablePort(startPort + 1).then(resolve, reject)
    })
  })
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 2048,
    height: 1448,
    show: false, // 初始时不显示窗口
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDev, // 在生产环境中禁用 DevTools
      partition: "persist:main",
    },
  })

  // 先加载 index.html
  await mainWindow.loadFile("index.html")

  // 查找可用端口
  port = await findAvailablePort(3000)

  // 创建 HTTP 服务器
  const server = http.createServer(httpServer)

  // 在同一个服务器上创建 WebSocket 服务器
  const wss = new WebSocket.Server({ server })

  // 初始化 WebSocket 服务器
  initializeWebSocketServer(wss, { port })

  // 启动服务器
  server.listen(port, () => {
    console.log(`Mo-2 Agent Server running at http://localhost:${port}`)
  })

  let url
  if (isDev) {
    url = `http://localhost:8080/mo`
  } else {
    url = `https://www.mobenai.com.cn/mo`
  }

  // 通知渲染进程 WebSocket 服务器已启动
  mainWindow.webContents.send("ws-server-started", port)

  // 加载实际的 URL
  await mainWindow.loadURL(url)

  // URL 加载完成后显示窗口
  mainWindow.show()

  // 只在开发环境中打开 DevTools
  if (isDev) {
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
const allowedExtensions = [".txt", ".md", ".mdx", ".js", ".ts", ".json", ".html", ".css"]

ipcMain.handle("readFiles", async (_, filePaths) => {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { success: false, error: "Invalid file paths" }
  }
  try {
    const contents = await Promise.all(
      filePaths.map(async (filePath) => {
        if (typeof filePath !== "string" || filePath.trim() === "") {
          throw new Error(`Invalid file path: ${filePath}`)
        }
        const ext = path.extname(filePath).toLowerCase()
        // if (!allowedExtensions.includes(ext)) {
        //   throw new Error(`Unsupported file type: ${filePath}`)
        // }
        const content = await fs.readFile(filePath, "utf-8")
        return { path: filePath, content }
      })
    )
    return { success: true, contents }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("writeFile", async (_, filePath, content) => {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return { success: false, error: "Invalid file path" }
  }
  if (typeof content !== "string") {
    return { success: false, error: "Invalid content" }
  }
  try {
    const ext = path.extname(filePath).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      return { success: false, error: `Unsupported file type: ${filePath}` }
    }
    await fs.writeFile(filePath, content, "utf-8")
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("readDir", async (_, dirPath) => {
  if (typeof dirPath !== "string" || dirPath.trim() === "") {
    return { success: false, error: "Invalid directory path" }
  }
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true })
    const result = files.map((file) => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(dirPath, file.name),
    }))
    return { success: true, files: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("renameFile", async (_, oldPath, newPath) => {
  if (typeof oldPath !== "string" || oldPath.trim() === "" || typeof newPath !== "string" || newPath.trim() === "") {
    return { success: false, error: "Invalid file paths" }
  }
  try {
    await fs.rename(oldPath, newPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("getWsPort", () => {
  return port
})

ipcMain.handle("selectDirectory", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    })

    if (result.canceled) {
      return { success: false, error: "用户取消了选择" }
    }

    const directoryPath = result.filePaths[0]
    const directoryStructure = await getDirectoryStructure(directoryPath)

    return { success: true, path: directoryPath, structure: directoryStructure }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("selectFiles", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
    })

    if (result.canceled) {
      return { success: false, error: "用户取消了选择" }
    }

    return { success: true, paths: result.filePaths }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("getDirectoryStructure", async (_, dirPath) => {
  try {
    const structure = await getDirectoryStructure(dirPath)
    return { success: true, structure }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

async function getDirectoryStructure(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const structure = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      structure.push({
        name: entry.name,
        type: "directory",
        children: await getDirectoryStructure(fullPath),
      })
    } else {
      structure.push({
        name: entry.name,
        type: "file",
        path: fullPath,
      })
    }
  }

  return structure
}
