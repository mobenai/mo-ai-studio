import { ipcMain } from "electron"
import { exec } from "child_process"

export const setupBashHandlers = () => {
  ipcMain.handle("executeBash", async (_, script: string) => {
    return new Promise((resolve, reject) => {
      exec(script, (error, stdout, stderr) => {
        if (error) {
          reject({ success: false, error: error.message, stderr })
        } else {
          resolve({ success: true, stdout, stderr })
        }
      })
    })
  })
}