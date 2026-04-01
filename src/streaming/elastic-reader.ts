import type { ElasticChunk } from "../types/elastic";
import { parseSSE } from "../utils/sse";

// UTF-8 BOM
const BOM = "\uFEFF";

/**
 * 解析 Elastic SSE 响应流，以异步生成器方式逐 chunk 产出
 *
 * 经实测，Elastic 返回的是直接 OpenAI chunk 格式（无 chat_completion 包装）：
 *   data: {"id":"...","choices":[{"delta":{"content":"..."},"index":0}],"model":"...","object":"chat.completion.chunk"}
 *
 * 同时兼容文档中描述的包装格式：
 *   data: {"chat_completion":{"id":"...","choices":[...]}}
 */
export async function* readElasticStream(
  responseBody: ReadableStream<Uint8Array>
): AsyncGenerator<ElasticChunk | "DONE"> {
  for await (const { data } of parseSSE(responseBody)) {
    // 去除 BOM 和首尾空白
    const trimmed = data.replace(/^\uFEFF/, "").trim();

    if (trimmed === "[DONE]") {
      yield "DONE";
      return;
    }

    if (!trimmed || trimmed.startsWith(":")) {
      continue;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // JSON 解析失败，跳过（心跳、注释行等）
      continue;
    }

    if (parsed === null || typeof parsed !== "object") continue;

    // 格式1（文档）：{"chat_completion": {...}}
    if ("chat_completion" in parsed) {
      yield parsed as unknown as ElasticChunk;
      continue;
    }

    // 格式2（实测）：直接的 OpenAI chunk 格式
    // {"id":"...","object":"chat.completion.chunk","choices":[...],"model":"..."}
    if ("choices" in parsed) {
      yield { chat_completion: parsed } as unknown as ElasticChunk;
      continue;
    }
  }
}
