import { Menu, dialog } from "electron"
import { autoUpdater } from "electron-updater"

export function createAppMenu(app: Electron.App) {
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates",
          click: async () => {
            try {
              const result = await autoUpdater.checkForUpdates()
              if (result && result.updateInfo) {
                dialog
                  .showMessageBox({
                    type: "info",
                    title: "Update Available",
                    message: `A new version (${result.updateInfo.version}) is available. Do you want to download it now?`,
                    buttons: ["Yes", "No"],
                  })
                  .then((response) => {
                    if (response.response === 0) {
                      autoUpdater.downloadUpdate()
                    }
                  })
              } else {
                dialog.showMessageBox({
                  type: "info",
                  title: "No Updates",
                  message: "You are using the latest version.",
                  buttons: ["OK"],
                })
              }
            } catch (error) {
              dialog.showErrorBox("Update Error", `An error occurred while checking for updates: ${error.message}`)
            }
          },
        },
        {
          label: "About",
          click: async () => {
            const { response } = await dialog.showMessageBox({
              type: "info",
              title: "About",
              message: "Mo AI Application",
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${
                process.versions.chrome
              }\nNode.js: ${process.versions.node}`,
              buttons: ["OK"],
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}