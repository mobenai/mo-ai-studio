import { ipcMain, BrowserWindow, dialog } from "electron"
import { exec } from "child_process"
import log from "electron-log/main"

// Optional, initialize the logger for any renderer process
log.initialize()

const checkGitInstalled = (): Promise<boolean> => {
  return new Promise((resolve) => {
    exec("git --version", (error) => {
      if (error) {
        console.error("Git is not installed:", error)
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

const logGitOperation = (message: string, error?: any) => {
  if (error) {
    log.error(`Git Operation: ${message}`, error)
  } else {
    log.info(`Git Operation: ${message}`)
  }
}

export const setupGitHandlers = () => {
  ipcMain.handle("undoGitCommit", async () => {
    return new Promise((resolve, reject) => {
      exec("git reset --soft HEAD~1", (error, stdout, stderr) => {
        if (error) {
          logGitOperation("Undo commit failed", error)
          reject({ success: false, error: error.message })
        } else {
          logGitOperation("Undo commit successful")
          resolve({ success: true, message: "Git commit undone successfully" })
        }
      })
    })
  })

  ipcMain.handle("cloneGitRepository", async (_, repoUrl, targetPath) => {
    if (
      typeof repoUrl !== "string" ||
      repoUrl.trim() === "" ||
      typeof targetPath !== "string" ||
      targetPath.trim() === ""
    ) {
      logGitOperation("Clone failed: Invalid repository URL or target path")
      return { success: false, error: "Invalid repository URL or target path" }
    }
    try {
      logGitOperation(`Starting clone of repository: ${repoUrl} to ${targetPath}`)
      const isGitInstalled = await checkGitInstalled()
      if (!isGitInstalled) {
        logGitOperation("Clone failed: Git is not installed")
        return { success: false, error: "Git is not installed on your system" }
      }

      return new Promise((resolve, reject) => {
        const gitCommand = `git clone ${repoUrl} ${targetPath}`
        const childProcess = exec(gitCommand)

        childProcess.stdout.on("data", (data) => {
          log.info(`Git clone stdout: ${data}`)
          // Parse progress from stdout if possible
          const match = data.match(/Receiving objects:\s+(\d+)%/)
          if (match) {
            const percent = parseInt(match[1], 10)
            console.log(percent)
          }
        })

        childProcess.stderr.on("data", (data) => {
          log.error(`Git clone stderr: ${data}`)
        })

        childProcess.on("close", (code) => {
          if (code === 0) {
            logGitOperation(`Clone successful: ${repoUrl}`)
            resolve({ success: true, path: targetPath })
          } else {
            const errorMessage = `Git clone failed with code ${code}`
            logGitOperation(errorMessage)
            reject({ success: false, error: errorMessage })
          }
        })
      })
    } catch (error) {
      logGitOperation(`Clone failed: ${error.message}`, error)
      console.error("Error cloning repository:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("promptGitRepoUrl", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showInputBox(win, {
      title: "Clone Git Repository",
      message: "Enter Git repository URL:",
      buttons: ["OK", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      type: "question",
      inputLabel: "Repository URL",
      inputValue: "",
    })

    if (result.response === 0 && result.inputValue) {
      logGitOperation(`Repository URL provided: ${result.inputValue}`)
      return{ success: true, url: result.inputValue }
    } else {
      logGitOperation("User cancelled repository URL input")
      return { success: false, url: null }
    }
  })

  ipcMain.handle("checkGitInstalled", async () => {
    const isGitInstalled = await checkGitInstalled()
    logGitOperation(`Git installation check: ${isGitInstalled ? "Installed" : "Not installed"}`)
    return { success: true, isInstalled: isGitInstalled }
  })
}