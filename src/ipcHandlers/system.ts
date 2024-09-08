import { ipcMain, desktopCapturer, app } from "electron"
import path from "path"
import { exec } from "child_process"

export const setupSystemHandlers = (port: number) => {
  ipcMain.handle("getWsPort", () => {
    return port
  })

  ipcMain.handle("getSources", async () => {
    try {
      const sources = await desktopCapturer.getSources({ 
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 320 }  // 增加缩略图大小
      })
      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }))
    } catch (error) {
      console.error("Error getting sources:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("captureScreenshot", async (_, sourceId) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 1920, height: 1080 },
      })
      const source = sources.find((s) => s.id === sourceId)
      if (!source) {
        throw new Error("Source not found")
      }
      return source.thumbnail.toDataURL()
    } catch (error) {
      console.error("Error capturing screenshot:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("executePandoc", async (_, inputFile, outputFile, fromFormat, toFormat) => {
    const pandocPath = app.isPackaged
      ? path.join(process.resourcesPath, "pandoc")
      : path.join(__dirname, "..", "bin", "pandoc")

    const command = `"${pandocPath}" "${inputFile}" -f ${fromFormat} -t ${toFormat} -o "${outputFile}"`

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error)
        } else {
          resolve({ stdout, stderr })
        }
      })
    })
  })
}