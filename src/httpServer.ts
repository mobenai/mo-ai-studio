import express, { Request, Response } from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

interface ChatRequest {
  messages: any[];
  temperature?: number;
  max_tokens?: number;
  model?: string;
  apiKey?: string;
  system?: string;
}

app.post("/chat-gpt-4o-mini", async (req: Request<{}, {}, ChatRequest>, res: Response) => {
  console.log("收到请求：", JSON.stringify(req.body, null, 2));

  try {
    const { messages, temperature, max_tokens } = req.body;
    const apiUrl =
      "https://ai-mobenai8960581934921621.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": "9db95e44f0b64295b12fb832e06c9fe3",
        "User-Agent": "curl/7.64.1", // 模拟 curl 的 User-Agent
      },
      body: JSON.stringify({
        messages,
        temperature: temperature || 0,
        max_tokens: max_tokens || 4096,
        stream: true,
      }),
    });

    // 直接将 API 响应的状态码和头部转发给客户端
    res.writeHead(response.status, response.headers as any);

    // 将 API 响应体直接pipe到客户端响应中
    response.body?.pipe(res);

    // 当 API 响应结束时，结束客户端响应
    response.body?.on("end", () => {
      res.end();
    });
  } catch (error) {
    console.error("服务器错误:", error);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

app.post("/chat-deepseek", async (req: Request<{}, {}, ChatRequest>, res: Response) => {
  try {
    const { messages, temperature, max_tokens, model } = req.body;
    const apiUrl = "https://api.deepseek.com/chat/completions";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer sk-8fd8cf54afab428fb99a323571bd9992`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature || 0,
        max_tokens: max_tokens || 4096,
        stream: true,
      }),
    });

    // 直接将 API 响应的状态码和头部转发给客户端
    res.writeHead(response.status, response.headers as any);

    // 将 API 响应体直接pipe到客户端响应中
    response.body?.pipe(res);

    // 当 API 响应结束时，结束客户端响应
    response.body?.on("end", () => {
      res.end();
    });
  } catch (error) {
    console.error("服务器错误:", error);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

app.post("/chat-claude", async (req: Request<{}, {}, ChatRequest>, res: Response) => {
  try {
    const { messages, temperature, max_tokens, model, apiKey, system } = req.body;
    const apiUrl = "https://service-fpf07h2s-1259692580.usw.apigw.tencentcs.com/release/chat-claude-office";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature || 0,
        max_tokens: max_tokens || 4096,
        stream: true,
        apiKey,
        system,
      }),
    });

    // 直接将 API 响应的状态码和头部转发给客户端
    res.writeHead(response.status, response.headers as any);

    // 将 API 响应体直接pipe到客户端响应中
    response.body?.pipe(res);

    // 当 API 响应结束时，结束客户端响应
    response.body?.on("end", () => {
      res.end();
    });
  } catch (error) {
    console.error("服务器错误:", error);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

export default app;