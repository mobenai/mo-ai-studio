import { ipcMain, BrowserWindow, dialog } from "electron"
import { exec } from "child_process"
import simpleGit from "simple-git"

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

export const setupGitHandlers = () => {
  ipcMain.handle("undoGitCommit", async () => {
    return new Promise((resolve, reject) => {
      exec("git reset --soft HEAD~1", (error, stdout, stderr) => {
        if (error) {
          reject({ success: false, error: error.message })
        } else {
          resolve({ success: true, message: "Git commit undone successfully" })
        }
      })
    })
  })

  ipcMain.handle("cloneGitRepository", async (_, repoUrl, targetPath, progressCallback) => {
    if (
      typeof repoUrl !== "string" ||
      repoUrl.trim() === "" ||
      typeof targetPath !== "string" ||
      targetPath.trim() === ""
    ) {
      return { success: false, error: "Invalid repository URL or target path" }
    }
    try {
      const isGitInstalled = await checkGitInstalled()
      if (!isGitInstalled) {
        return { success: false, error: "Git is not installed on your system" }
      }

      const git = simpleGit()
      await git.clone(repoUrl, targetPath, ["--progress"], (progress) => {
        const match = progress.match(/Receiving objects:\s+(\d+)%/)
        if (match) {
          const percent = parseInt(match[1], 10)
          progressCallback(percent)
        }
      })
      return { success: true, path: targetPath }
    } catch (error) {
      console.error("Error cloning repository:", error)
      return { success: false, error: error.message, details: JSON.stringify(error, null, 2) }
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
      return { success: true, url: result.inputValue }
    } else {
      return { success: false, url: null }
    }
  })

  ipcMain.handle("checkGitInstalled", async () => {
    const isGitInstalled = await checkGitInstalled()
    return { success: true, isInstalled: isGitInstalled }
  })
}