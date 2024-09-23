const robot = require("robotjs")
const { ipcMain } = require("electron")

ipcMain.handle("simulate-shortcut", (event, shortcut) => {
  // 按住 "command" 和 "shift" 键
  robot.keyToggle("command", "down")
  robot.keyToggle("shift", "down")

  // 模拟按下 "a" 键
  robot.keyTap("a")

  // 松开 "command" 和 "shift" 键
  robot.keyToggle("shift", "up")
  robot.keyToggle("command", "up")
})
