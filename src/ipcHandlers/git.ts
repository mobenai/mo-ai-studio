import { ipcMain, dialog } from "electron"
import { exec } from "child_process"
import fs from "fs/promises"
import path from "path"
import simpleGit, { SimpleGit } from 'simple-git'

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
    console.error(`Git Operation: ${message}`, error)
  } else {
    console.info(`Git Operation: ${message}`)
  }
}

export const setupGitHandlers = () => {
  let git: SimpleGit

  ipcMain.handle("initGit", async (_, repoPath: string) => {
    try {
      git = simpleGit(repoPath)
      await git.init()
      logGitOperation(`Git repository initialized at ${repoPath}`)
      return { success: true, message: "Git repository initialized successfully" }
    } catch (error) {
      logGitOperation("Git init failed", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("gitStatus", async () => {
    try {
      const status = await git.status()
      return { success: true, status }
    } catch (error) {
      logGitOperation("Git status failed", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("gitAdd", async (_, files: string | string[]) => {
    try {
      await git.add(files)
      logGitOperation(`Files added to git: ${files}`)
      return { success: true, message: "Files added successfully" }
    } catch (error) {
      logGitOperation("Git add failed", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("gitCommit", async (_, message: string) => {
    try {
      const result = await git.commit(message)
      logGitOperation(`Git commit successful: ${message}`)
      return { success: true, result }
    } catch (error) {
      logGitOperation("Git commit failed", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("gitPush", async (_, remote: string = 'origin', branch: string = 'main') => {
    try {
      const result = await git.push(remote, branch)
      logGitOperation(`Git push successful to ${remote}/${branch}`)
      return { success: true, result }
    } catch (error) {
      logGitOperation("Git push failed", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("gitPull", async (_, remote: string = 'origin', branch: string = 'main') => {
    try {
      const result = await git.pull(remote, branch)
      logGitOperation(`Git pull successful from ${remote}/${branch}`)
      return { success: true, result }
    } catch (error) {
      logGitOperation("Git pull failed", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("undoGitCommit", async () => {
    try {
      await git.reset(["--soft", "HEAD~1"])
      logGitOperation("Undo commit successful")
      return { success: true, message: "Git commit undone successfully" }
    } catch (error) {
      logGitOperation("Undo commit failed", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("cloneGitRepository", async (_, repoUrl: string, targetPath: string) => {
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

      await simpleGit().clone(repoUrl, targetPath)
      logGitOperation(`Clone successful: ${repoUrl}`)
      return { success: true, path: targetPath }
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
      return { success: true, url: result.inputValue }
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

  ipcMain.handle("setGitConfig", async (_, username: string, email: string) => {
    if (!username || !email) {
      return { success: false, message: "Username and email are required" }
    }

    try {
      await git.addConfig('user.name', username)
      await git.addConfig('user.email', email)
      logGitOperation(`Git config set successfully for ${username} (${email})`)
      return { success: true, message: "Git configuration set successfully" }
    } catch (error) {
      logGitOperation("Failed to set Git config", error)
      return { success: false, message: "Failed to set Git configuration", error: error.message }
    }
  })

  ipcMain.handle("generateSSHKey", async () => {
    const homeDir = process.env.HOME || process.env.USERPROFILE
    const sshDir = path.join(homeDir, ".ssh")
    const keyPath = path.join(sshDir, "id_rsa")

    try {
      // Ensure .ssh directory exists
      await fs.mkdir(sshDir, { recursive: true })

      // Generate SSH key with force overwrite
      const sshKeygenCommand = `ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -f "${keyPath}" -N "" -q -y`
      await new Promise((resolve, reject) => {
        exec(sshKeygenCommand, (error, stdout, stderr) => {
          if (error) {
            console.error("Error generating SSH key:", error)
            reject(error)
          } else {
            console.log("SSH key generated successfully")
            resolve(null)
          }
        })
      })

      // Read public key
      const publicKey = await fs.readFile(`${keyPath}.pub`, "utf-8")

      logGitOperation("SSH key generated successfully")
      return { success: true, publicKey }
    } catch (error) {
      logGitOperation("Failed to generate SSH key", error)
      return { success: false, message: "Failed to generate SSH key", error: error.message }
    }
  })
}