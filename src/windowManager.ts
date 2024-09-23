import { BrowserWindow, shell } from "electron"
import path from "path"

export class WindowManager {
  mainWindow: BrowserWindow | null = null

  createMainWindow(isDev: boolean, isDebugger: boolean) {
    this.mainWindow = new BrowserWindow({
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

    return this.mainWindow
  }

  setupWindowBehavior(isDev: boolean, isDebugger: boolean) {
    if (!this.mainWindow) return

    this.mainWindow.show()

    if (isDev || isDebugger) {
      this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.webContents.on("before-input-event", (event, input) => {
        const isRefresh = (input.key.toLowerCase() === "r" && (input.control || input.meta)) || input.key === "F5"
        const isDevTools = input.key.toLowerCase() === "i" && input.control && input.shift
        if (isRefresh || isDevTools) {
          event.preventDefault()
        }
      })
    }

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("http:") || url.startsWith("https:")) {
        shell.openExternal(url)
        return { action: "deny" }
      }
      return { action: "allow" }
    })
  }

  loadURL(isDev: boolean) {
    if (!this.mainWindow) return

    if (isDev) {
      this.mainWindow.loadURL(`http://localhost:8080/mo`)
    } else {
      this.mainWindow.loadURL(`https://www.moben.cloud/mo`)
    }
  }

  createChildWindow() {
    const childWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: BrowserWindow.getFocusedWindow(),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        webSecurity: false,
        preload: path.join(__dirname, "preload.js"),
        devTools: true,
      },
    })

    return childWindow
  }
}

export const windowManager = new WindowManager()