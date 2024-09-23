import { app, ipcMain, dialog, BrowserWindow } from "electron"
import http from "http"
import net from "net"
import { setupIpcHandlers } from "./ipcHandlers"
import { autoUpdater, UpdateInfo } from "electron-updater"
import { updateElectronApp } from "update-electron-app"
import log from "electron-log"
import { crashReporter } from "electron"
import Screenshots from "electron-screenshots"
import { windowManager } from "./windowManager"
import { createAppMenu } from "./appMenu"
import { registerGlobalShortcuts, unregisterAllShortcuts } from "./globalShortcut"
import { setupErrorHandlers } from "./errorHandler"

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

const createWindow = async () => {
  const mainWindow = windowManager.createMainWindow(isDev, isDebugger)
  windowManager.loadURL(isDev)
  windowManager.setupWindowBehavior(isDev, isDebugger)
}

app.on("ready", () => {
  createWindow()
  setupIpcHandlers(0, isDev)
  createAppMenu(app)

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
  ipcMain.on("open-child-window", () => {
    const childWindow = windowManager.createChildWindow()
    windowManager.loadURL(isDev)
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

  registerGlobalShortcuts(screenshots, windowManager.mainWindow)

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
  unregisterAllShortcuts()
})

// 设置全局错误处理
setupErrorHandlers()

// Export necessary functions and variables for IPC handlers
export { port, isDev }