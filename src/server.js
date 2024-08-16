const http = require("http")
const WebSocket = require("ws")
const fs = require("fs")
const path = require("path")
const net = require("net")
const figlet = require("figlet")
const chalk = require("chalk")
const logSymbols = require("log-symbols")
const { initializeWebSocketServer } = require("./wsServer")
const httpServer = require("./httpServer") // 新增：导入 httpServer

// 判断是否为开发环境
const isDevelopment = process.env.NODE_ENV === "development"

// 根据环境选择加载字体的方式
let fontData
if (isDevelopment) {
  // 开发环境：直接从文件系统加载字体
  fontData = fs.readFileSync(path.join(__dirname, "../node_modules/figlet/fonts/Standard.flf"), "utf8")
} else {
  // 生产环境：从 SEA 资源加载字体
  const { getAsset } = require("node:sea")
  fontData = getAsset("Standard.flf", "utf8")
}

figlet.parseFont("Standard", fontData)

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(startPort, () => {
      const port = server.address().port
      server.close(() => {
        resolve(port)
      })
    })
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        findAvailablePort(startPort + 1).then(resolve, reject)
      } else {
        reject(err)
      }
    })
  })
}

// 读取 mo.config.json
const moConfigPath = path.join(process.cwd(), "mo.config.json")
let moConfig = {}

try {
  if (fs.existsSync(moConfigPath)) {
    moConfig = JSON.parse(fs.readFileSync(moConfigPath, "utf8"))
  } else {
    // 如果文件不存在，使用默认模板初始化
    moConfig = {
      templates: {},
      port: 3000,
      isInitialized: true,
      startUrl: "http://localhost:5173/",
      agentType: "企业内部系统",
      includeList: ["src/**/*.js", "src/**/*.ts"],
      appId: "",
      organizationId: 1,
      ignoreList: [
        "#summary",
        ".npmrc",
        ".git",
        "node_modules",
        "public",
        "scripts",
        ".eslintrc.cjs",
        "components.json",
        "src/components/ui",
        ".gitignore",
        "package-lock.json",
        "README.md",
        "tsconfig.json",
        "vite.config.ts",
        "yarn.lock",
        "tsconfig.app.json",
        "tsconfig.node.json",
        "postcss.config.js",
        ".DS_Store",
        ".vscode",
      ],
    }
    fs.writeFileSync(moConfigPath, JSON.stringify(moConfig, null, 2))
    console.log(chalk.green(logSymbols.success, "Created mo.config.json with default template"))
  }
} catch (error) {
  console.error(chalk.red(logSymbols.error, "Error reading or creating mo.config.json:"), error.message)
  process.exit(1)
}

let PORT = moConfig.port || 3000

// 检查 includeList 是否有效
if (!moConfig.includeList || !Array.isArray(moConfig.includeList) || moConfig.includeList.length === 0) {
  console.error(chalk.red(logSymbols.error, "Error: includeList is required and must be a non-empty array"))
  process.exit(1)
}

// 显示炫酷的启动标题
console.log(
  chalk.cyan(
    figlet.textSync("Mo-2 Agent", {
      font: "Standard",
      horizontalLayout: "default",
      verticalLayout: "default",
    })
  )
)

console.log(chalk.green(logSymbols.info, "Starting Mo-2 Agent server..."))

findAvailablePort(PORT)
  .then((availablePort) => {
    PORT = availablePort
    const server = http.createServer(httpServer) // 修改：使用 httpServer 作为请求处理器
    const wss = new WebSocket.Server({ server })

    initializeWebSocketServer(wss, moConfig)

    server.listen(PORT, () => {
      console.log(chalk.green(logSymbols.success, `Mo-2 Agent Server running at http://localhost:${PORT}`))
    })
  })
  .catch((err) => {
    console.error(chalk.red(logSymbols.error, "Unable to find available port:"))
    console.error(chalk.red(err))
  })
