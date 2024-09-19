import { ipcMain } from "electron"
import { exec, spawn } from "child_process"
import { log } from "electron-log"

// 新增：存储运行中的bash进程
const runningProcesses = new Map()

export const setupBashHandlers = () => {
  ipcMain.handle("executeBash", async (_, script: string) => {
    console.log("Executing bash script:", script)
    return new Promise((resolve) => {
      exec(script, { shell: '/bin/bash' }, (error, stdout, stderr) => {
        if (error) {
          console.log(`Error executing bash script: ${error.message}`)
          console.log(`Stderr: ${stderr}`)
          resolve({ success: false, error: error.message, stderr })
        } else {
          console.log(`Bash script executed successfully`)
          console.log(`Stdout: ${stdout}`)
          resolve({ success: true, stdout, stderr })
        }
      })
    })
  })

  ipcMain.handle("executeBashWithOutput", async (event, script: string) => {
    console.log("Executing bash script with output:", script)
    
    const process = spawn("bash", ["-c", script])
    const processId = Date.now().toString()
    runningProcesses.set(processId, process)

    process.stdout.on("data", (data) => {
      event.sender.send("bashOutput", { processId, type: "stdout", data: data.toString() })
    })

    process.stderr.on("data", (data) => {
      event.sender.send("bashOutput", { processId, type: "stderr", data: data.toString() })
    })

    return new Promise((resolve) => {
      process.on("close", (code) => {
        runningProcesses.delete(processId)
        resolve({ success: code === 0, processId })
      })
    })
  })

  ipcMain.handle("stopBashExecution", (_, processId: string) => {
    const process = runningProcesses.get(processId)
    if (process) {
      process.kill()
      runningProcesses.delete(processId)
      return true
    }
    return false
  })
}