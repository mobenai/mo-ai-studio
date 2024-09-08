import { ipcMain, dialog } from "electron"
import { autoUpdater } from "electron-updater"

export const setupUpdateHandlers = (isDev: boolean) => {
  ipcMain.handle("check-for-updates", async () => {
    if (isDev) {
      return { success: true, updateAvailable: false, message: "Updates are not checked in development mode" }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo) {
        return { 
          success: true, 
          updateAvailable: true, 
          version: result.updateInfo.version,
          releaseNotes: result.updateInfo.releaseNotes,
          message: `A new version (${result.updateInfo.version}) is available.`
        }
      } else {
        return { 
          success: true, 
          updateAvailable: false,
          message: "You are using the latest version."
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("download-update", async () => {
    if (isDev) {
      return { success: false, message: "Updates cannot be downloaded in development mode" }
    }
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("quit-and-install", () => {
    autoUpdater.quitAndInstall()
  })
}