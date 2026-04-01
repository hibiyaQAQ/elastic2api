import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { OpenAIChatRequest } from "../types/openai";
import { openaiToElastic } from "../converters/openai-to-elastic";
import { callElastic, ElasticUpstreamError } from "../utils/elastic-client";
import {
  elasticToOpenAIStream,
  elasticToOpenAIComplete,
} from "../streaming/openai-writer";
import type { ElasticContext } from "../middleware/auth";

type Env = { Variables: { elastic: ElasticContext } };

export const openaiRouter = new Hono<Env>();

openaiRouter.use("*", authMiddleware);

/**
 * OpenAI Chat Completions 兼容端点
 * POST /v1/chat/completions
 *
 * 支持 stream: true (SSE) 和 stream: false (聚合响应)
 */
openaiRouter.post("/v1/chat/completions", async (c) => {
  const elastic = c.get("elastic");

  let body: OpenAIChatRequest;
  try {
    body = await c.req.json<OpenAIChatRequest>();
  } catch {
    return c.json(
      { error: { type: "invalid_request_error", message: "Invalid JSON body" } },
      400
    );
  }

  // 参数校验
  if (!body.model) {
    return c.json(
      { error: { type: "invalid_request_error", message: '"model" is required' } },
      400
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json(
      {
        error: {
          type: "invalid_request_error",
          message: '"messages" must be a non-empty array',
        },
      },
      400
    );
  }

  // 转换请求格式
  const elasticBody = openaiToElastic(body, elastic.defaultMaxTokens);

  // 调用 Elastic
  let elasticResp: Response;
  try {
    elasticResp = await callElastic(elastic, elasticBody);
  } catch (err) {
    if (err instanceof ElasticUpstreamError) {
      const status = err.status === 0 ? 502 : err.status;
      return c.json(
        { error: { type: "upstream_error", message: err.body || err.message } },
        status as 400 | 401 | 403 | 404 | 429 | 500 | 502
      );
    }
    throw err;
  }

  // 流式响应
  if (body.stream !== false) {
    const outputStream = elasticToOpenAIStream(elasticResp.body!);
    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 非流式响应: 聚合 Elastic 流后返回完整 JSON
  try {
    const completion = await elasticToOpenAIComplete(elasticResp.body!);
    return c.json(completion);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process response";
    return c.json(
      { error: { type: "proxy_error", message } },
      500
    );
  }
});
