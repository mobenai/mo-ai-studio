import { app, BrowserWindow, ipcMain, dialog, desktopCapturer, Menu } from "electron"
import path from "path"
import http from "http"
import net from "net"
import { setupIpcHandlers } from "./ipcHandlers"
import { autoUpdater, UpdateInfo } from "electron-updater"
import { updateElectronApp } from "update-electron-app"

updateElectronApp()

if (require("electron-squirrel-startup")) {
  app.quit()
}

const isDev = process.argv.includes("--dev")
const isDebugger = process.argv.includes("--debugger")
let port = 3000
let staticServer: http.Server | null = null

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
    childWindow.loadURL(`http://www.mobenai.com.cn/mo`)
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

// Export necessary functions and variables for IPC handlers
export { port, isDev }
