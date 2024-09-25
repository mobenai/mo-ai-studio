import { globalShortcut, BrowserWindow } from "electron"
import Screenshots from "electron-screenshots"

export function registerGlobalShortcuts(screenshots: Screenshots, mainWindow: BrowserWindow | null) {
  globalShortcut.register("CommandOrControl+I", () => {
    if (mainWindow) {
      mainWindow.setSize(1024, 768)
      mainWindow.show()
    }
  })

  globalShortcut.register("esc", () => {
    if (screenshots.$win?.isFocused()) {
      screenshots.endCapture()
    }
  })

  globalShortcut.register("CommandOrControl+Shift+X", () => {
    screenshots.startCapture()
  })
}

export function unregisterAllShortcuts() {
  globalShortcut.unregisterAll()
}
