import type { ElasticContext } from "../middleware/auth";
import type { ElasticChatRequest } from "../types/elastic";

/**
 * 构建 Elastic 推理端点 URL
 */
export function buildElasticUrl(ctx: ElasticContext): string {
  return `${ctx.baseUrl}/_inference/chat_completion/${ctx.inferenceId}/_stream`;
}

/**
 * 向 Elastic 发起流式请求
 * 成功时返回原始 Response，失败时抛出 ElasticUpstreamError
 */
export async function callElastic(
  ctx: ElasticContext,
  body: ElasticChatRequest
): Promise<Response> {
  const url = buildElasticUrl(ctx);

  const bodyJson = JSON.stringify(body);

  // ── 临时调试：检查发给 Elastic 的每条消息是否含有非法字段（确认后删除）──
  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];
    const keys = Object.keys(msg);
    const hasReasoning = "reasoning" in msg || "reasoning_details" in msg;
    if (hasReasoning) {
      console.error(`[DEBUG] messages[${i}] 含非法字段! keys=${keys.join(",")}`);
      console.error(`[DEBUG] messages[${i}] 内容:`, JSON.stringify(msg).slice(0, 500));
    }
  }
  // ── end debug ──

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${ctx.apiKey}`,
        Accept: "text/event-stream",
      },
      body: bodyJson,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ElasticUpstreamError(0, `Network error: ${message}`);
  }

  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {
      // 忽略读取错误体时的异常
    }
    throw new ElasticUpstreamError(response.status, errorText);
  }

  return response;
}

/**
 * Elastic 上游错误，携带 HTTP 状态码和响应体
 */
export class ElasticUpstreamError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Elastic upstream error ${status}: ${body}`);
    this.name = "ElasticUpstreamError";
  }
}
