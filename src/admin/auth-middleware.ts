import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken, SESSION_COOKIE } from "./session";

/**
 * 管理路由鉴权中间件
 * 验证请求中的 admin_session Cookie
 */
export async function adminAuthMiddleware(c: Context, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return c.json({ error: "Unauthorized: no session" }, 401);
  }

  const env = c.env as Record<string, unknown> | undefined;
  const password = (typeof env?.["ADMIN_PASSWORD"] === "string"
    ? env["ADMIN_PASSWORD"]
    : undefined) ?? "admin";

  const valid = await verifyToken(token, password);
  if (!valid) {
    return c.json({ error: "Session expired or invalid, please login again" }, 401);
  }

  await next();
}
