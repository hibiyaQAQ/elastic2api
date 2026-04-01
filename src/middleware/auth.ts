import type { Context, Next } from "hono";
import { createStore } from "../storage";

/**
 * Elastic 凭证上下文，注入到 Hono 请求上下文中
 */
export interface ElasticContext {
  apiKey: string;
  baseUrl: string;
  inferenceId: string;
}

/**
 * 双模式 Elastic 凭证解析中间件
 *
 * 优先级：
 *   1. 请求头模式（x-elastic-api-key / x-elastic-base-url / x-elastic-inference-id）
 *      → 向后兼容，原有行为完整保留
 *   2. 配置路由模式（读取请求体 model 字段，从管理后台配置查找匹配端点）
 *      → 无需在请求中携带任何 Elastic 凭证
 *
 * 注意：克隆请求体读取 model 字段时不消耗原始流，
 *       路由处理器中的 c.req.json() 仍可正常工作。
 */
export async function authMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header("x-elastic-api-key");
  const baseUrl = c.req.header("x-elastic-base-url");
  const inferenceId = c.req.header("x-elastic-inference-id");

  // ── 模式1：请求头模式（全部三个头都存在）──
  if (apiKey && baseUrl && inferenceId) {
    try {
      const parsed = new URL(baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Invalid x-elastic-base-url: must be a valid HTTP/HTTPS URL",
          },
        },
        400
      );
    }

    c.set("elastic", {
      apiKey,
      baseUrl: baseUrl.replace(/\/$/, ""),
      inferenceId,
    } satisfies ElasticContext);

    await next();
    return;
  }

  // ── 若只提供了部分请求头，报错避免混淆 ──
  if (apiKey || baseUrl || inferenceId) {
    const missing: string[] = [];
    if (!apiKey) missing.push("x-elastic-api-key");
    if (!baseUrl) missing.push("x-elastic-base-url");
    if (!inferenceId) missing.push("x-elastic-inference-id");

    return c.json(
      {
        error: {
          type: "authentication_error",
          message: `Missing required headers: ${missing.join(", ")}`,
        },
      },
      401
    );
  }

  // ── 模式2：配置路由模式 ──
  // 克隆请求体读取 model 字段（不消耗原始流）
  let model: string | undefined;
  try {
    const cloned = c.req.raw.clone();
    const body = await cloned.json() as { model?: unknown };
    if (typeof body.model === "string") {
      model = body.model;
    }
  } catch {
    // JSON 解析失败，继续走到下面的 401
  }

  if (!model) {
    return c.json(
      {
        error: {
          type: "authentication_error",
          message:
            "Provide x-elastic-* headers, or configure endpoints in the admin panel and include a model field in the request body",
        },
      },
      401
    );
  }

  // 从配置中查找匹配的已启用端点
  const store = createStore(c);
  const config = await store.getConfig();
  const endpoint = config.endpoints.find(
    (ep) => ep.enabled && ep.models.includes(model!)
  );

  if (!endpoint) {
    return c.json(
      {
        error: {
          type: "authentication_error",
          message: `No enabled endpoint configured for model: "${model}". Please add it in the admin panel.`,
        },
      },
      401
    );
  }

  c.set("elastic", {
    apiKey: endpoint.apiKey,
    baseUrl: endpoint.baseUrl,
    inferenceId: endpoint.inferenceId,
  } satisfies ElasticContext);

  await next();
}
