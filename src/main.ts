import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu, shell } from "electron"
import path from "path"
import http from "http"
import net from "net"
import { setupIpcHandlers } from "./ipcHandlers"
import { autoUpdater, UpdateInfo } from "electron-updater"
import { updateElectronApp } from "update-electron-app"
import log from "electron-log"
import { crashReporter } from "electron"
import Screenshots from "electron-screenshots"

updateElectronApp()

if (require("electron-squirrel-startup")) {
  app.quit()
}

const isDev = process.argv.includes("--dev")
const isDebugger = process.argv.includes("--debugger")
let port = 3000
let staticServer: http.Server | null = null

// 配置日志
log.transports.file.level = "info"
log.transports.console.level = "debug"

// 设置崩溃报告
crashReporter.start({
  productName: "Mo AI Studio",
  companyName: "Mo Ben Technology",
  submitURL: "https://your-crash-report-server.com/submit", // 替换为你的崩溃报告服务器地址
  uploadToServer: true,
})

const findAvailablePort = async (startPort: number): Promise<number> => {
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

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    backgroundColor: "#374151",
    roundedCorners: true,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDev || isDebugger,
      partition: "persist:main",
    },
  })

  return mainWindow
}

const setupWindowBehavior = (mainWindow: BrowserWindow) => {
  mainWindow.show()

  if (isDev || isDebugger) {
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      const isRefresh = (input.key.toLowerCase() === "r" && (input.control || input.meta)) || input.key === "F5"
      const isDevTools = input.key.toLowerCase() === "i" && input.control && input.shift
      if (isRefresh || isDevTools) {
        event.preventDefault()
      }
    })
  }

  // 处理新窗口的创建
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url)
      return { action: "deny" }
    }
    return { action: "allow" }
  })
}

const createWindow = async () => {
  const mainWindow = createMainWindow()

  if (isDev) {
    mainWindow.loadURL(`http://localhost:8080/mo`)
  } else {
    mainWindow.loadURL(`https://www.moben.cloud/mo`)
  }

  setupWindowBehavior(mainWindow)
}

// 新增：创建子窗口的函数
const createChildWindow = () => {
  const childWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: BrowserWindow.getFocusedWindow(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDev || isDebugger,
    },
  })

  if (isDev) {
    childWindow.loadURL(`http://localhost:8080/mo`)
  } else {
    childWindow.loadURL(`http://www.moben.cloud/mo`)
  }

  if (isDev || isDebugger) {
    childWindow.webContents.openDevTools()
  }
}

// 新增：创建应用程序菜单
const createAppMenu = () => {
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates",
          click: async () => {
            try {
              const result = await autoUpdater.checkForUpdates()
              if (result && result.updateInfo) {
                dialog
                  .showMessageBox({
                    type: "info",
                    title: "Update Available",
                    message: `A new version (${result.updateInfo.version}) is available. Do you want to download it now?`,
                    buttons: ["Yes", "No"],
                  })
                  .then((response) => {
                    if (response.response === 0) {
                      autoUpdater.downloadUpdate()
                    }
                  })
              } else {
                dialog.showMessageBox({
                  type: "info",
                  title: "No Updates",
                  message: "You are using the latest version.",
                  buttons: ["OK"],
                })
              }
            } catch (error) {
              dialog.showErrorBox("Update Error", `An error occurred while checking for updates: ${error.message}`)
            }
          },
        },
        {
          label: "About",
          click: async () => {
            const { response } = await dialog.showMessageBox({
              type: "info",
              title: "About",
              message: "Mo AI Application",
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${
                process.versions.chrome
              }\nNode.js: ${process.versions.node}`,
              buttons: ["OK"],
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.on("ready", () => {
  createWindow()
  setupIpcHandlers()
  createAppMenu()

  // 初始化自动更新
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
  }

  // 设置自动更新事件监听器
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
        message: `A new version (${info.version}) is available. Do you want to download it now?`,
        buttons: ["Yes", "No"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: `Version ${info.version} has been downloaded. Do you want to install it now?`,
        buttons: ["Yes", "No"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  // 新增：设置 IPC 监听器来创建子窗口
  ipcMain.on("open-child-window", createChildWindow)

  // 新增：处理链接点击
  ipcMain.handle("open-external-link", (event, url) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url)
      return { success: true }
    }
    return { success: false, error: "Invalid URL" }
  })

  // 新增：初始化 electron-screenshots
  const screenshots = new Screenshots({
    singleWindow: true, // 使用单窗口模式以提高性能
    lang: {
      magnifier_position_label: "Position",
      operation_ok_title: "OK",
      operation_cancel_title: "Cancel",
      operation_save_title: "Save",
      operation_redo_title: "Redo",
      operation_undo_title: "Undo",
      operation_mosaic_title: "Mosaic",
      operation_text_title: "Text",
      operation_brush_title: "Brush",
      operation_arrow_title: "Arrow",
      operation_ellipse_title: "Ellipse",
      operation_rectangle_title: "Rectangle",
    },
  })

  // 设置截图快捷键
  globalShortcut.register("CommandOrControl+Shift+X", () => {
    screenshots.startCapture()
  })
  
  // 处理截图完成事件
  screenshots.on("ok", (event, buffer, bounds) => {
    log.info("Screenshot captured", bounds)
    // 这里可以处理截图结果，例如保存到文件或发送到渲染进程
  })

  screenshots.on("cancel", () => {
    log.info("Screenshot cancelled")
  })

  // 新增：处理截图请求
  ipcMain.handle("take-screenshot", async () => {
    try {
      await screenshots.startCapture()
      return { success: true }
    } catch (error) {
      log.error("Screenshot error:", error)
      return { success: false, error: error.message }
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on("quit", () => {
  if (staticServer) {
    staticServer.close()
  }
})

// 全局错误处理
process.on("uncaughtException", (error) => {
  log.error("Uncaught Exception:", error)
  dialog.showErrorBox("An error occurred", `An unexpected error occurred: ${error.message}`)
})

process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled Rejection at:", promise, "reason:", reason)
})

// Export necessary functions and variables for IPC handlers
export { port, isDev }
