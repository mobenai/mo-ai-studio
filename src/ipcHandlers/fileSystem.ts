import { ipcMain, dialog } from "electron"
import fs from "fs/promises"
import path from "path"

const shouldIgnore = (name: string): boolean => {
  const ignoredDirs = ["node_modules", ".git", "build", "dist"]
  return ignoredDirs.includes(name)
}

const getDirectoryStructure = async (dirPath: string, processedPaths = new Set<string>()): Promise<any[]> => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const structure = []

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue

    const fullPath = path.join(dirPath, entry.name)

    // Check if this path has already been processed
    if (processedPaths.has(fullPath)) continue
    processedPaths.add(fullPath)

    if (entry.isDirectory()) {
      const children = await getDirectoryStructure(fullPath, processedPaths)
      if (children.length > 0) {
        structure.push({
          name: entry.name,
          type: "directory",
          children: children,
        })
      }
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
      if (shouldIgnore(entry.name)) return null
      if (entry.isDirectory()) {
        const children = await readDirectoryRecursive(fullPath)
        if (children.length > 0) {
          return {
            path: fullPath,
            name: entry.name,
            type: "directory",
            children: children,
          }
        }
        return null
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
  return files.filter(Boolean)
}

export const setupFileSystemHandlers = () => {
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
      const result = files
        .filter((file) => !shouldIgnore(file.name))
        .map((file) => ({
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

  ipcMain.handle("selectDirectory", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "showHiddenFiles"],
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
        properties: ["openFile", "multiSelections", "showHiddenFiles"],
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

  ipcMain.handle("readDirectoryRecursive", async (_, dirPath) => {
    try {
      const files = await readDirectoryRecursive(dirPath)
      return { success: true, files }
    } catch (error) {
      console.error("Error reading directory recursively:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("getFileStats", async (_, filePath) => {
    if (typeof filePath !== "string" || filePath.trim() === "") {
      return { success: false, error: "Invalid file path" }
    }
    try {
      const stats = await fs.stat(filePath)
      return {
        success: true,
        stats: {
          size: stats.size,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          accessedAt: stats.atime,
        },
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("createDirectory", async () => {
    try {
      const result = await dialog.showSaveDialog({
        title: "Create New Directory",
        buttonLabel: "Create",
        properties: ["createDirectory", "showHiddenFiles"],
      })

      if (result.canceled) {
        return { success: false, error: "User cancelled the operation" }
      }

      const dirPath = result.filePath
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true, path: dirPath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}