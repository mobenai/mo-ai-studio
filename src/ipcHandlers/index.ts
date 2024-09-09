import { setupFileSystemHandlers } from "./fileSystem"
import { setupGitHandlers } from "./git"
import { setupSystemHandlers } from "./system"
import { setupUpdateHandlers } from "./updates"
import { setupBashHandlers } from "./bash"

export const setupIpcHandlers = (port: number, isDev: boolean) => {
  setupFileSystemHandlers()
  setupGitHandlers()
  setupSystemHandlers(port)
  setupUpdateHandlers(isDev)
  setupBashHandlers()
}