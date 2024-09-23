import { dialog } from "electron"
import log from "electron-log"

export function setupErrorHandlers() {
  process.on("uncaughtException", (error) => {
    log.error("Uncaught Exception:", error)
    dialog.showErrorBox("An error occurred", `An unexpected error occurred: ${error.message}`)
  })

  process.on("unhandledRejection", (reason, promise) => {
    log.error("Unhandled Rejection at:", promise, "reason:", reason)
  })
}