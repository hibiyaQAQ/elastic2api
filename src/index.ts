import { Hono } from "hono";
import { cors } from "hono/cors";
import { openaiRouter } from "./routes/openai";
import { anthropicRouter } from "./routes/anthropic";
import { adminRouter } from "./admin/routes";
import { proxyAuthMiddleware } from "./middleware/proxy-auth";
import type { ElasticContext } from "./middleware/auth";

type Variables = { elastic: ElasticContext };
type AppEnv = { Variables: Variables };

const app = new Hono<AppEnv>();

// ── 全局 CORS 中间件 ──
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "anthropic-version",
      "x-elastic-api-key",
      "x-elastic-base-url",
      "x-elastic-inference-id",
    ],
    exposeHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

// 全局错误处理
app.onError((err, c) => {
  console.error("[proxy error]", err);
  const isAnthropicRoute = c.req.path.startsWith("/v1/messages");
  if (isAnthropicRoute) {
    return c.json(
      { type: "error", error: { type: "proxy_error", message: err.message } },
      500
    );
  }
  return c.json({ error: { type: "proxy_error", message: err.message } }, 500);
});

// ── 健康检查 ──
app.get("/health", (c) => {
  // 检测存储类型，帮助前端显示提示
  const env = c.env as Record<string, unknown> | undefined;
  const storage = env && "CONFIG_KV" in env ? "kv" : "memory";

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    storage,
    routes: [
      "POST /v1/chat/completions  — OpenAI Chat Completions → Elastic",
      "POST /v1/messages          — Anthropic Messages → Elastic",
      "GET  /admin                — Management UI",
    ],
  });
});

// ── 管理路由（不受代理认证影响）──
app.route("/", adminRouter);

// ── 代理认证（仅对 /v1/* 生效）──
app.use("/v1/*", proxyAuthMiddleware);

// ── 业务路由 ──
app.route("/", openaiRouter);
app.route("/", anthropicRouter);

// ── 404 fallback ──
app.notFound((c) =>
  c.json(
    {
      error: {
        type: "not_found",
        message: `Route ${c.req.method} ${c.req.path} not found. Available: POST /v1/chat/completions, POST /v1/messages, GET /admin`,
      },
    },
    404
  )
);

export default app;
