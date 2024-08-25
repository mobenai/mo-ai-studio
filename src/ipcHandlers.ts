
import { ipcMain, dialog, desktopCapturer, app } from "electron"
import fs from "fs/promises"
import path from "path"
import { exec } from "child_process"
import { port, isDev } from "./main"

const shouldIgnore = (name: string): boolean => {
  const ignoredDirs = ["node_modules", ".git", "build", "dist", ".DS_Store"]
  return ignoredDirs.includes(name) || name.startsWith(".")
}

const getDirectoryStructure = async (dirPath: string): Promise<any[]> => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const structure = []

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue

    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      structure.push({
        name: entry.name,
        type: "directory",
        children: await getDirectoryStructure(fullPath),
      })
    } else {
      structure.push({
        name: entry.name,
        type: "file",
        path: fullPath,
      })
    }
  }

  return structure
}

const readDirectoryRecursive = async (dirPath: string): Promise<any[]> => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        return {
          path: fullPath,
          name: entry.name,
          type: "directory",
          children: await readDirectoryRecursive(fullPath),
        }
      } else {
        const content = await fs.readFile(fullPath, "utf-8")
        return {
          path: fullPath,
          name: entry.name,
          type: "file",
          content,
        }
      }
    })
  )
  return files
}

export const setupIpcHandlers = () => {
  ipcMain.handle("readFiles", async (_, filePaths) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { success: false, error: "Invalid file paths" }
    }
    try {
      const contents = await Promise.all(
        filePaths.map(async (filePath) => {
          if (typeof filePath !== "string" || filePath.trim() === "") {
            throw new Error(`Invalid file path: ${filePath}`)
          }

          const stats = await fs.stat(filePath)
          if (stats.isDirectory()) {
            return { path: filePath, isDirectory: true }
          }

          const content = await fs.readFile(filePath, "utf-8")
          return { path: filePath, content, isDirectory: false }
        })
      )

      const fileContents = contents.filter((item) => !item.isDirectory)

      return { success: true, contents: fileContents }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("writeFile", async (_, filePath, content) => {
    if (typeof filePath !== "string" || filePath.trim() === "") {
      return { success: false, error: "Invalid file path" }
    }
    if (typeof content !== "string") {
      return { success: false, error: "Invalid content" }
    }
    try {
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(filePath, content, "utf-8")
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("readFile", async (_, filePath) => {
    if (typeof filePath !== "string" || filePath.trim() === "") {
      return { success: false, error: "Invalid file path" }
    }
    try {
      const content = await fs.readFile(filePath, "utf-8")
      return { success: true, content }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("readDir", async (_, dirPath) => {
    if (typeof dirPath !== "string" || dirPath.trim() === "") {
      return { success: false, error: "Invalid directory path" }
    }
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true })
      const result = files.map((file) => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        path: path.join(dirPath, file.name),
      }))
      return { success: true, files: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("renameFile", async (_, oldPath, newPath) => {
    if (typeof oldPath !== "string" || oldPath.trim() === "" || typeof newPath !== "string" || newPath.trim() === "") {
      return { success: false, error: "Invalid file paths" }
    }
    try {
      await fs.rename(oldPath, newPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("getWsPort", () => {
    return port
  })

  ipcMain.handle("selectDirectory", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      })

      if (result.canceled) {
        return { success: false, error: "用户取消了选择" }
      }

      const directoryPath = result.filePaths[0]
      const directoryStructure = await getDirectoryStructure(directoryPath)

      return { success: true, path: directoryPath, structure: directoryStructure }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("selectFiles", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
      })

      if (result.canceled) {
        return { success: false, error: "用户取消了选择" }
      }

      return { success: true, paths: result.filePaths }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("getDirectoryStructure", async (_, dirPath) => {
    try {
      const structure = await getDirectoryStructure(dirPath)
      return { success: true, structure }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("getAbsolutePath", (_, filePath) => {
    return path.resolve(filePath)
  })

  ipcMain.handle("getSources", async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen", "window"] })
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

  ipcMain.handle("readDirectoryRecursive", async (_, dirPath) => {
    try {
      const files = await readDirectoryRecursive(dirPath)
      return { success: true, files }
    } catch (error) {
      console.error("Error reading directory recursively:", error)
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
      