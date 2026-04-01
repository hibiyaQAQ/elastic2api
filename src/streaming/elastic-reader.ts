import type { ElasticChunk } from "../types/elastic";
import { parseSSE } from "../utils/sse";

/**
 * 解析 Elastic SSE 响应流，以异步生成器方式逐 chunk 产出
 * Elastic 的 SSE 格式:
 *   event: message
 *   data: {"chat_completion":{...}}
 *
 *   event: message
 *   data: [DONE]
 */
export async function* readElasticStream(
  responseBody: ReadableStream<Uint8Array>
): AsyncGenerator<ElasticChunk | "DONE"> {
  for await (const { data } of parseSSE(responseBody)) {
    if (data.trim() === "[DONE]") {
      yield "DONE";
      return;
    }

    // 跳过空行和注释行
    if (!data.trim() || data.startsWith(":")) {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as unknown;

      // 校验是否为有效的 Elastic chunk 格式
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "chat_completion" in parsed
      ) {
        yield parsed as ElasticChunk;
      }
    } catch {
      // 跳过无法解析的行 (Elastic 偶尔发送心跳或注释)
      continue;
    }
  }
}
