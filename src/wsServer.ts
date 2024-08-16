import fs from "fs";
import path from "path";
import { execSync, exec } from "child_process";
import glob from "glob";
import chalk from "chalk";
import logSymbols from "log-symbols";
import { WebSocket } from "ws";

interface DirectoryItem {
  name: string;
  type: "file" | "directory";
  content?: string;
  children?: DirectoryItem[];
}

interface MoConfig {
  includeList: string[];
  ignoreList: string[];
  port: number;
  isInitialized: boolean;
  agentType: string;
  startUrl: string;
  setting: any;
  git: boolean;
  cmd: boolean;
  appId?: string;
}

function getDirectoryStructure(rootDir: string, includeList: string[], ignoreList: string[]): DirectoryItem[] {
  let result: DirectoryItem[] = [];
  const matchedFiles = includeList.flatMap((pattern) =>
    glob.sync(pattern, { cwd: rootDir, ignore: ignoreList, nodir: true })
  );

  if (matchedFiles.length === 0) {
    console.warn(chalk.yellow(logSymbols.warning, "No files matched the include patterns"));
    return result;
  }

  matchedFiles.forEach((file) => {
    const parts = file.split(path.sep);
    let currentLevel = result;

    parts.forEach((part, index) => {
      let existingItem = currentLevel.find((item) => item.name === part);
      let isLastPart = index === parts.length - 1;

      if (!existingItem) {
        const newItem: DirectoryItem = {
          name: part,
          type: isLastPart ? "file" : "directory",
        };

        if (isLastPart) {
          newItem.content = fs.readFileSync(path.join(rootDir, file), "utf8");
        } else {
          newItem.children = [];
        }

        currentLevel.push(newItem);
        existingItem = newItem;
      }

      if (!isLastPart) {
        currentLevel = existingItem.children!;
      }
    });
  });

  return result;
}

function gitCommit(summary: string): boolean {
  try {
    execSync("git add .");
    execSync(`git commit -m "feat(mo-2): ${summary}"`);
    console.log(chalk.green(logSymbols.success, "Git commit successful"));
    return true;
  } catch (error) {
    console.error(chalk.red(logSymbols.error, "Git commit failed:"), error);
    return false;
  }
}

function gitRollback(): boolean {
  try {
    execSync("git reset --hard HEAD~1");
    console.log(chalk.green(logSymbols.success, "Git rollback successful"));
    return true;
  } catch (error) {
    console.error(chalk.red(logSymbols.error, "Git rollback failed:"), error);
    return false;
  }
}

function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`执行命令失败: ${error.message}`);
        return;
      }
      if (stderr) {
        reject(`命令执行出错: ${stderr}`);
        return;
      }
      resolve(stdout);
    });
  });
}

function restartServer(): void {
  console.log(chalk.yellow(logSymbols.info, "Restarting server..."));
  process.on("exit", function () {
    import("child_process").then(({ spawn }) => {
      spawn(process.argv.shift()!, process.argv, {
        cwd: process.cwd(),
        detached: true,
        stdio: "inherit",
      });
    });
  });
  process.exit();
}

export function initializeWebSocketServer(wss: WebSocket.Server, moConfig: MoConfig): void {
  wss.on("connection", (ws: WebSocket) => {
    const rootDir = process.cwd();
    let directoryStructure: DirectoryItem[] = [];

    try {
      directoryStructure = getDirectoryStructure(rootDir, moConfig.includeList, moConfig.ignoreList);
    } catch (error) {
      console.error(chalk.red(logSymbols.error, "Error getting directory structure:"), (error as Error).message);
      ws.send(JSON.stringify({ success: false, message: (error as Error).message }));
      return;
    }

    const serverAddress = `http://localhost:${moConfig.port}`;

    ws.send(
      JSON.stringify({
        isInitialized: moConfig.isInitialized,
        directoryStructure,
        serverAddress,
        agentType: moConfig.agentType,
        startUrl: moConfig.startUrl,
        success: true,
        setting: moConfig.setting,
      })
    );

    let pendingChanges: { filePath: string; content: string }[] = [];

    ws.on("message", async (message: WebSocket.Data) => {
      const data = JSON.parse(message.toString());
      const { action, filePath, content, projectPath, templateName, appId, summary, command } = data;

      if (action === "writeFile") {
        const absolutePath = path.join(rootDir, filePath);
        if (!absolutePath.startsWith(rootDir)) {
          ws.send(JSON.stringify({ success: false, message: "无法访问项目根目录之外的文件", filePath }));
          return;
        }

        const dirPath = path.dirname(absolutePath);

        try {
          await fs.promises.mkdir(dirPath, { recursive: true });

          let cleanedContent = content;
          if (content.startsWith("`") && content.endsWith("`")) {
            cleanedContent = content.slice(1, -1);
          }

          await fs.promises.writeFile(absolutePath, cleanedContent);
          const fileContent = await fs.promises.readFile(absolutePath, "utf8");

          directoryStructure = getDirectoryStructure(rootDir, moConfig.includeList, moConfig.ignoreList);
          pendingChanges.push({ filePath, content: fileContent });

          console.log(chalk.green(logSymbols.success, `File modified successfully: ${filePath}`));
          ws.send(
            JSON.stringify({
              success: true,
              message: "文件修改成功",
              content: fileContent,
              filePath: filePath,
              directoryStructure: directoryStructure,
            })
          );
        } catch (err) {
          console.error(chalk.red(logSymbols.error, `File operation failed: ${filePath}`), err);
          ws.send(JSON.stringify({ success: false, message: "文件操作失败", error: (err as Error).message, filePath }));
        }
      } else if (action === "commitChanges") {
        if (moConfig.git !== true) {
          console.warn(chalk.yellow(logSymbols.warning, "Git operations are disabled in mo.config.json"));
          ws.send(JSON.stringify({ success: false, message: "Git操作在配置中被禁用" }));
          return;
        }

        if (pendingChanges.length > 0 && summary) {
          const commitSuccess = gitCommit(summary);
          if (commitSuccess) {
            console.log(chalk.green(logSymbols.success, "All changes committed to Git"));
            ws.send(JSON.stringify({ success: true, message: "所有更改已成功提交到Git", summary: summary }));
            pendingChanges = [];
          } else {
            console.error(chalk.red(logSymbols.error, "Git commit failed"));
            ws.send(JSON.stringify({ success: false, message: "Git提交失败" }));
          }
        } else if (pendingChanges.length === 0) {
          console.warn(chalk.yellow(logSymbols.warning, "No pending changes to commit"));
          ws.send(JSON.stringify({ success: false, message: "没有待处理的更改" }));
        } else {
          console.warn(chalk.yellow(logSymbols.warning, "Missing commit summary"));
          ws.send(JSON.stringify({ success: false, message: "缺少提交摘要" }));
        }
      } else if (action === "initializationComplete") {
        try {
          moConfig.isInitialized = true;
          fs.writeFileSync(path.join(rootDir, "mo.config.json"), JSON.stringify(moConfig, null, 2));
          console.log(chalk.green(logSymbols.success, "Project initialization status updated"));
        } catch (err) {
          console.error(chalk.red(logSymbols.error, "Failed to update project initialization status or appId"), err);
          ws.send(JSON.stringify({ success: false, message: "更新项目初始化状态或appId失败", error: (err as Error).message }));
        }
      } else if (action === "sendAppId") {
        moConfig.appId = appId;
        moConfig.isInitialized = true;
        fs.writeFileSync(path.join(rootDir, "mo.config.json"), JSON.stringify(moConfig, null, 2));
        console.log(
          chalk.green(logSymbols.success, "Project initialization marked as complete, appId written to config")
        );
        ws.send(JSON.stringify({ success: true, message: "项目初始化成功标记已更新，appId已写入配置" }));
      } else if (action === "rollback") {
        if (moConfig.git !== true) {
          console.warn(chalk.yellow(logSymbols.warning, "Git operations are disabled in mo.config.json"));
          ws.send(JSON.stringify({ success: false, message: "Git操作在配置中被禁用" }));
          return;
        }

        const rollbackSuccess = gitRollback();
        if (rollbackSuccess) {
          console.log(chalk.green(logSymbols.success, "Successfully rolled back to the previous commit"));
        } else {
          console.error(chalk.red(logSymbols.error, "Rollback failed"));
        }
        ws.send(
          JSON.stringify({ success: rollbackSuccess, message: rollbackSuccess ? "成功回滚到上一个提交" : "回滚失败" })
        );
      } else if (action === "executeCommand") {
        if (moConfig.cmd !== true) {
          console.warn(chalk.yellow(logSymbols.warning, "Command execution is disabled in mo.config.json"));
          ws.send(JSON.stringify({ success: false, message: "命令执行在配置中被禁用" }));
          return;
        }

        if (!command) {
          console.warn(chalk.yellow(logSymbols.warning, "Missing command parameter"));
          ws.send(JSON.stringify({ success: false, message: "缺少命令参数" }));
          return;
        }

        try {
          const output = await executeCommand(command);
          console.log(chalk.green(logSymbols.success, `Command executed successfully: ${command}`));
          ws.send(JSON.stringify({ success: true, message: "命令执行成功", output: output }));
        } catch (error) {
          console.error(chalk.red(logSymbols.error, `Command execution failed: ${command}`), error);
          ws.send(JSON.stringify({ success: false, message: "命令执行失败", error: error }));
        }
      } else if (action === "refreshFileTree") {
        try {
          directoryStructure = getDirectoryStructure(rootDir, moConfig.includeList, moConfig.ignoreList);
          if (directoryStructure.length === 0) {
            console.warn(
              chalk.yellow(logSymbols.warning, "No files or directories found matching the include patterns")
            );
            ws.send(JSON.stringify({ success: false, message: "没有找到匹配的文件或目录", directoryStructure: [] }));
          } else {
            console.log(chalk.green(logSymbols.success, "File tree refreshed successfully"));
            ws.send(
              JSON.stringify({ success: true, message: "文件目录刷新成功", directoryStructure: directoryStructure })
            );
          }
        } catch (error) {
          console.error(chalk.red(logSymbols.error, "Failed to refresh file tree:"), (error as Error).message);
          ws.send(JSON.stringify({ success: false, message: "刷新文件目录失败", error: (error as Error).message }));
        }
      } else if (action === "restartServer") {
        console.log(chalk.yellow(logSymbols.info, "Restarting server..."));
        ws.send(JSON.stringify({ success: true, message: "服务器正在重启" }));
        restartServer();
      } else if (action === "updateMoConfig") {
        try {
          const updatedConfig = JSON.parse(content);
          moConfig = { ...moConfig, ...updatedConfig };
          fs.writeFileSync(path.join(rootDir, "mo.config.json"), JSON.stringify(moConfig, null, 2));
          console.log(chalk.green(logSymbols.success, "mo.config.json updated successfully"));
          ws.send(JSON.stringify({ success: true, message: "mo.config.json 更新成功" }));
          restartServer();
        } catch (error) {
          console.error(chalk.red(logSymbols.error, "Failed to update mo.config.json:"), (error as Error).message);
          ws.send(JSON.stringify({ success: false, message: "更新 mo.config.json 失败", error: (error as Error).message }));
        }
      } else if (action === "fetchLatestContent") {
        try {
          directoryStructure = getDirectoryStructure(rootDir, moConfig.includeList, moConfig.ignoreList);
          console.log(chalk.green(logSymbols.success, "Latest content fetched successfully"));
          ws.send(
            JSON.stringify({ success: true, message: "成功获取最新内容", directoryStructure: directoryStructure })
          );
        } catch (error) {
          console.error(chalk.red(logSymbols.error, "Failed to fetch latest content:"), (error as Error).message);
          ws.send(JSON.stringify({ success: false, message: "获取最新内容失败", error: (error as Error).message }));
        }
      }
    });
  });
}