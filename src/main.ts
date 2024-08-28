import { app, BrowserWindow, ipcMain, dialog, desktopCapturer } from "electron"
import path from "path"
import http from "http"
import fs from "fs/promises"
import WebSocket from "ws"
import net from "net"
import express from "express"
import httpServer from "./httpServer"
import { initializeWebSocketServer } from "./wsServer"
import { exec } from "child_process"
import { setupIpcHandlers } from "./ipcHandlers"

if (require("electron-squirrel-startup")) {
  app.quit()
}

const isDev = process.argv.includes("--dev")
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

const initializeServer = async (port: number) => {
  const server = http.createServer(httpServer)
  const wss = new WebSocket.Server({ server })
  initializeWebSocketServer(wss, { port })

  return new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Mo-2 Agent Server running at http://localhost:${port}`)
      resolve()
    })
  })
}

const createStaticServer = (port: number) => {
  const app = express()
  const staticPath = path.join(__dirname, "../../../", "dist")
  app.use(express.static(staticPath))

  // Handle 404 errors by redirecting to index.html
  app.use((req, res, next) => {
    res.sendFile(path.join(staticPath, "index.html"))
  })

  return new Promise<void>((resolve) => {
    staticServer = app.listen(port, () => {
      console.log(`Static server running at http://localhost:${port}`)
      resolve()
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
      // devTools: isDev,
      partition: "persist:main",
    },
  })

  return mainWindow
}

const setupWindowBehavior = (mainWindow: BrowserWindow) => {
  mainWindow.show()

  if (isDev) {
    mainWindow.webContents.openDevTools()
  } else {
    // mainWindow.webContents.on("before-input-event", (event, input) => {
    //   const isRefresh = (input.key.toLowerCase() === "r" && (input.control || input.meta)) || input.key === "F5"
    //   const isDevTools = input.key.toLowerCase() === "i" && input.control && input.shift
    //   if (isRefresh || isDevTools) {
    //     event.preventDefault()
    //   }
    // })
  }
}

const createWindow = async () => {
  const mainWindow = createMainWindow()

  // port = await findAvailablePort(3000)
  // await initializeServer(port)

  // mainWindow.webContents.send("ws-server-started", port)

  if (isDev) {
    mainWindow.loadURL(`http://localhost:8080/mo`)
  } else {
    // const staticPort = await findAvailablePort(8080)
    // await createStaticServer(staticPort)
    // mainWindow.loadURL(`http://localhost:${staticPort}/mo`)
    // mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))

    mainWindow.loadURL(`http://www.mobenai.com.cn/mo`)
  }

  setupWindowBehavior(mainWindow)
}

app.on("ready", () => {
  createWindow()
  setupIpcHandlers()
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
