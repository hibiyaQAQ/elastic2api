import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { generateToken, SESSION_COOKIE, SESSION_MAX_AGE } from "./session";
import { adminAuthMiddleware } from "./auth-middleware";
import { createStore } from "../storage";
import { getAdminPage } from "./page";
import type { EndpointGroup } from "../types/config";

const adminApp = new Hono();

// ─────────────────────────────────────────────────
// 公开路由（不需要登录）
// ─────────────────────────────────────────────────

/** 管理页面 HTML */
adminApp.get("/admin", (c) => {
  return c.html(getAdminPage());
});

/** 登录 */
adminApp.post("/admin/login", async (c) => {
  let body: { password?: string };
  try {
    body = await c.req.json<{ password?: string }>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const env = c.env as Record<string, unknown> | undefined;
  const adminPassword =
    (typeof env?.["ADMIN_PASSWORD"] === "string" ? env["ADMIN_PASSWORD"] : undefined) ??
    "admin";

  if (body.password !== adminPassword) {
    return c.json({ error: "Invalid password" }, 401);
  }

  const token = await generateToken(adminPassword);

  // 判断是否 HTTPS（本地开发时 secure:false）
  const isSecure = c.req.url.startsWith("https://");

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return c.json({ ok: true });
});

/** 登出 */
adminApp.post("/admin/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────
// 需要鉴权的管理 API
// ─────────────────────────────────────────────────

const api = new Hono();
api.use("*", adminAuthMiddleware);

/** 获取端点列表（apiKey 脱敏） */
api.get("/endpoints", async (c) => {
  const store = createStore(c);
  const config = await store.getConfig();
  return c.json(
    config.endpoints.map((ep) => ({ ...ep, apiKey: maskSecret(ep.apiKey) }))
  );
});

/** 添加端点 */
api.post("/endpoints", async (c) => {
  let body: Partial<EndpointGroup>;
  try {
    body = await c.req.json<Partial<EndpointGroup>>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!body.name || !body.apiKey || !body.baseUrl || !body.inferenceId) {
    return c.json({ error: "Missing required fields: name, apiKey, baseUrl, inferenceId" }, 400);
  }

  // 校验 baseUrl 格式
  try {
    const u = new URL(body.baseUrl);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error();
  } catch {
    return c.json({ error: "Invalid baseUrl: must be a valid HTTP/HTTPS URL" }, 400);
  }

  const store = createStore(c);
  const config = await store.getConfig();

  const newEp: EndpointGroup = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    apiKey: body.apiKey.trim(),
    baseUrl: body.baseUrl.trim().replace(/\/$/, ""),
    inferenceId: body.inferenceId.trim(),
    models: Array.isArray(body.models)
      ? body.models.map((m) => m.trim()).filter(Boolean)
      : [],
    enabled: body.enabled !== false,
    createdAt: new Date().toISOString(),
  };

  config.endpoints.push(newEp);
  await store.setConfig(config);

  // 返回脱敏版本
  return c.json({ ...newEp, apiKey: maskSecret(newEp.apiKey) }, 201);
});

/** 更新端点 */
api.put("/endpoints/:id", async (c) => {
  const id = c.req.param("id");
  let body: Partial<EndpointGroup>;
  try {
    body = await c.req.json<Partial<EndpointGroup>>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const store = createStore(c);
  const config = await store.getConfig();
  const idx = config.endpoints.findIndex((ep) => ep.id === id);

  if (idx === -1) return c.json({ error: "Endpoint not found" }, 404);

  const existing = config.endpoints[idx]!;

  // 如果提交的 apiKey 是脱敏值，保留原始值
  const apiKey =
    body.apiKey && !isMasked(body.apiKey) ? body.apiKey.trim() : existing.apiKey;

  const baseUrl =
    body.baseUrl !== undefined
      ? body.baseUrl.trim().replace(/\/$/, "")
      : existing.baseUrl;

  // 校验 baseUrl（如果有更新）
  if (body.baseUrl !== undefined) {
    try {
      const u = new URL(baseUrl);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    } catch {
      return c.json({ error: "Invalid baseUrl: must be a valid HTTP/HTTPS URL" }, 400);
    }
  }

  config.endpoints[idx] = {
    ...existing,
    ...(body.name !== undefined && { name: body.name.trim() }),
    ...(body.inferenceId !== undefined && { inferenceId: body.inferenceId.trim() }),
    ...(body.models !== undefined && {
      models: body.models.map((m) => m.trim()).filter(Boolean),
    }),
    ...(body.enabled !== undefined && { enabled: body.enabled }),
    apiKey,
    baseUrl,
    id: existing.id,
    createdAt: existing.createdAt,
  };

  await store.setConfig(config);
  return c.json({ ...config.endpoints[idx]!, apiKey: maskSecret(apiKey) });
});

/** 删除端点 */
api.delete("/endpoints/:id", async (c) => {
  const id = c.req.param("id");
  const store = createStore(c);
  const config = await store.getConfig();
  const before = config.endpoints.length;
  config.endpoints = config.endpoints.filter((ep) => ep.id !== id);

  if (config.endpoints.length === before) {
    return c.json({ error: "Endpoint not found" }, 404);
  }

  await store.setConfig(config);
  return c.json({ ok: true });
});

/** 获取代理 API Key 列表（脱敏） + 认证状态 */
api.get("/proxy-keys", async (c) => {
  const store = createStore(c);
  const config = await store.getConfig();
  return c.json({
    requireProxyAuth: config.requireProxyAuth,
    keys: config.proxyApiKeys.map(maskSecret),
  });
});

/** 添加代理 API Key */
api.post("/proxy-keys", async (c) => {
  let body: { key?: string };
  try {
    body = await c.req.json<{ key?: string }>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!body.key || body.key.length < 8) {
    return c.json({ error: "Key must be at least 8 characters" }, 400);
  }

  const store = createStore(c);
  const config = await store.getConfig();

  if (config.proxyApiKeys.includes(body.key)) {
    return c.json({ error: "Key already exists" }, 409);
  }

  config.proxyApiKeys.push(body.key);
  await store.setConfig(config);

  return c.json({ key: maskSecret(body.key) }, 201);
});

/** 删除代理 API Key（body 中传原始 key） */
api.delete("/proxy-keys", async (c) => {
  let body: { key?: string };
  try {
    body = await c.req.json<{ key?: string }>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!body.key) return c.json({ error: "key is required" }, 400);

  const store = createStore(c);
  const config = await store.getConfig();
  const before = config.proxyApiKeys.length;
  config.proxyApiKeys = config.proxyApiKeys.filter((k) => k !== body.key);

  if (config.proxyApiKeys.length === before) {
    return c.json({ error: "Key not found" }, 404);
  }

  await store.setConfig(config);
  return c.json({ ok: true });
});

/** 切换代理认证开关 */
api.put("/proxy-auth", async (c) => {
  let body: { requireProxyAuth?: boolean };
  try {
    body = await c.req.json<{ requireProxyAuth?: boolean }>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (typeof body.requireProxyAuth !== "boolean") {
    return c.json({ error: "requireProxyAuth must be a boolean" }, 400);
  }

  const store = createStore(c);
  const config = await store.getConfig();
  config.requireProxyAuth = body.requireProxyAuth;
  await store.setConfig(config);

  return c.json({ requireProxyAuth: config.requireProxyAuth });
});

// 挂载带鉴权的 API 路由
adminApp.route("/admin/api", api);

export { adminApp as adminRouter };

// ─────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────

function maskSecret(s: string): string {
  if (!s) return "****";
  if (s.length <= 8) return "****";
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}

function isMasked(s: string): boolean {
  return s.includes("****");
}
