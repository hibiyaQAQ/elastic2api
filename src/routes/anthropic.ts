import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { AnthropicRequest } from "../types/anthropic";
import { anthropicToElastic } from "../converters/anthropic-to-elastic";
import { callElastic, ElasticUpstreamError } from "../utils/elastic-client";
import { elasticToAnthropicStream } from "../streaming/anthropic-writer";
import { readElasticStream } from "../streaming/elastic-reader";
import type { ElasticContext } from "../middleware/auth";

type Env = { Variables: { elastic: ElasticContext } };

export const anthropicRouter = new Hono<Env>();

anthropicRouter.use("*", authMiddleware);

/**
 * Anthropic Messages API 兼容端点
 * POST /v1/messages
 *
 * 支持 stream: true (SSE) 和 stream: false (聚合响应)
 */
anthropicRouter.post("/v1/messages", async (c) => {
  const elastic = c.get("elastic");

  let body: AnthropicRequest;
  try {
    body = await c.req.json<AnthropicRequest>();
  } catch {
    return c.json(
      {
        type: "error",
        error: { type: "invalid_request_error", message: "Invalid JSON body" },
      },
      400
    );
  }

  // 参数校验
  if (!body.model) {
    return c.json(
      {
        type: "error",
        error: { type: "invalid_request_error", message: '"model" is required' },
      },
      400
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: '"messages" must be a non-empty array',
        },
      },
      400
    );
  }
  if (!body.max_tokens || body.max_tokens <= 0) {
    return c.json(
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: '"max_tokens" must be a positive integer',
        },
      },
      400
    );
  }

  // 转换请求格式
  const elasticBody = anthropicToElastic(body);

  // 调用 Elastic
  let elasticResp: Response;
  try {
    elasticResp = await callElastic(elastic, elasticBody);
  } catch (err) {
    if (err instanceof ElasticUpstreamError) {
      const status = err.status === 0 ? 502 : err.status;
      return c.json(
        {
          type: "error",
          error: { type: "api_error", message: err.body || err.message },
        },
        status as 400 | 401 | 403 | 404 | 429 | 500 | 502
      );
    }
    throw err;
  }

  // 流式响应
  if (body.stream !== false) {
    const outputStream = elasticToAnthropicStream(elasticResp.body!);
    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        // Anthropic SDK 需要的版本头
        "anthropic-version": "2023-06-01",
      },
    });
  }

  // 非流式响应: 聚合 Elastic 流后返回完整 Anthropic 响应
  try {
    const response = await aggregateAnthropicResponse(
      elasticResp.body!,
      body.model
    );
    return c.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process response";
    return c.json(
      { type: "error", error: { type: "api_error", message } },
      500
    );
  }
});

/**
 * 聚合 Elastic 流为完整的 Anthropic 非流式响应
 */
async function aggregateAnthropicResponse(
  body: ReadableStream<Uint8Array>,
  model: string
) {
  let id = "";
  let responseModel = model;
  let inputTokens = 0;
  let outputTokens = 0;
  let finalFinishReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" = "end_turn";

  let textContent = "";
  let reasoningContent = "";
  const toolCallMap = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  for await (const chunk of readElasticStream(body)) {
    if (chunk === "DONE") break;

    const cc = chunk.chat_completion;
    if (!id) id = cc.id;
    if (cc.model) responseModel = cc.model;

    if (cc.usage) {
      inputTokens = cc.usage.prompt_tokens;
      outputTokens = cc.usage.completion_tokens;
    }

    for (const choice of cc.choices) {
      if (choice.finish_reason) {
        finalFinishReason = mapFinishReason(
          choice.finish_reason
        ) as typeof finalFinishReason;
      }

      if (choice.delta.content) textContent += choice.delta.content;
      if (choice.delta.reasoning) reasoningContent += choice.delta.reasoning;

      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const tIdx = tc.index ?? 0;
          if (!toolCallMap.has(tIdx)) {
            toolCallMap.set(tIdx, { id: tc.id, name: tc.function.name, arguments: "" });
          }
          toolCallMap.get(tIdx)!.arguments += tc.function.arguments ?? "";
        }
      }
    }
  }

  // 构建 Anthropic content blocks
  const content: import("../types/anthropic").AnthropicContentBlock[] = [];

  if (reasoningContent) {
    content.push({ type: "thinking", thinking: reasoningContent });
  }

  if (textContent) {
    content.push({ type: "text", text: textContent });
  }

  if (toolCallMap.size > 0) {
    const sorted = [...toolCallMap.entries()].sort(([a], [b]) => a - b);
    for (const [, tc] of sorted) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.arguments) as Record<string, unknown>;
      } catch {
        // 参数解析失败时保留空对象
      }
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input,
      });
    }
  }

  return {
    id,
    type: "message",
    role: "assistant",
    model: responseModel,
    content,
    stop_reason: finalFinishReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

function mapFinishReason(reason: string): string {
  const map: Record<string, string> = {
    stop: "end_turn",
    tool_calls: "tool_use",
    length: "max_tokens",
    max_tokens: "max_tokens",
    content_filter: "stop_sequence",
  };
  return map[reason] ?? "end_turn";
}
