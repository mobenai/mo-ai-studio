/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

const loadingElement = document.getElementById("loading")
const contentElement = document.getElementById("content")

// 显示加载动画
function showLoading() {
  if (loadingElement) loadingElement.style.display = "flex"
  if (contentElement) contentElement.style.display = "none"
}

// 隐藏加载动画
function hideLoading() {
  if (loadingElement) loadingElement.style.display = "none"
  if (contentElement) contentElement.style.display = "block"
}

// 初始显示加载动画
showLoading()

// 监听页面加载完成事件
window.addEventListener("load", () => {
  hideLoading()
})

// 如果加载时间过长，可以设置一个超时
setTimeout(() => {
  hideLoading()
}, 10000) // 10秒后强制隐藏加载动画
