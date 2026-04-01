import type { Context, Next } from "hono";
import { createStore } from "../storage";

/**
 * 代理 API Key 认证中间件（仅对 /v1/* 路由生效）
 * 当配置中 requireProxyAuth=true 时，验证 Authorization: Bearer <key>
 * 配置中 requireProxyAuth=false 时，直接放行
 */
export async function proxyAuthMiddleware(c: Context, next: Next) {
  const store = createStore(c);
  const config = await store.getConfig();

  if (!config.requireProxyAuth) {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return c.json(
      { error: { type: "authentication_error", message: "Missing Bearer token" } },
      401
    );
  }

  const token = match[1]!;
  if (!config.proxyApiKeys.includes(token)) {
    return c.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      401
    );
  }

  await next();
}
