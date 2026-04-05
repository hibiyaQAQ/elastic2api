import type { ElasticChunk } from "../types/elastic";
import type { OpenAIChatChunk } from "../types/openai";
import { formatSSE } from "../utils/sse";
import { readElasticStream } from "./elastic-reader";

/**
 * 将 Elastic SSE 响应流转换为 OpenAI SSE 响应流
 *
 * 字段映射:
 *   Elastic: chat_completion.choices[n].delta.reasoning   → OpenAI: choices[n].delta.reasoning_content
 *   Elastic: chat_completion.choices[n].delta.content     → OpenAI: choices[n].delta.content
 *   Elastic: chat_completion.choices[n].delta.tool_calls  → OpenAI: choices[n].delta.tool_calls
 *   Elastic: chat_completion.usage                        → OpenAI: usage
 *
 * 其余字段基本一致，直接映射。
 */
export function elasticToOpenAIStream(
  elasticBody: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (text: string) =>
        controller.enqueue(encoder.encode(text));

      try {
        for await (const chunk of readElasticStream(elasticBody)) {
          if (chunk === "DONE") {
            enqueue(formatSSE("[DONE]"));
            break;
          }

          const cc = chunk.chat_completion;
          const openaiChunk: OpenAIChatChunk = {
            id: cc.id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: cc.model,
            choices: cc.choices.map((choice) => ({
              index: choice.index,
              delta: {
                // role 仅在第一个 chunk 中出现
                ...(choice.delta.role !== undefined && { role: choice.delta.role }),
                // content: null 也需要透传 (finish_reason chunk 中 content 为 null)
                ...(choice.delta.content !== undefined && { content: choice.delta.content }),
                // Elastic reasoning (与 delta 同级) → OpenAI reasoning_content (兼容 o 系列)
                ...(choice.reasoning !== undefined && {
                  reasoning_content: choice.reasoning,
                }),
                // tool_calls 格式与 OpenAI 一致，直接透传
                ...(choice.delta.tool_calls !== undefined && {
                  tool_calls: choice.delta.tool_calls,
                }),
              },
              finish_reason: choice.finish_reason ?? null,
            })),
            // usage 仅在最后一个 chunk 中出现
            ...(cc.usage !== undefined && { usage: cc.usage }),
          };

          enqueue(formatSSE(JSON.stringify(openaiChunk)));
        }
      } catch (err) {
        // 向客户端发送错误信息后关闭流
        const message = err instanceof Error ? err.message : "Stream processing error";
        const errorChunk = {
          error: { type: "proxy_error", message },
        };
        enqueue(formatSSE(JSON.stringify(errorChunk)));
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * 将 Elastic SSE 响应流聚合为完整的 OpenAI 非流式响应
 * 用于 stream: false 的情况
 */
export async function elasticToOpenAIComplete(
  elasticBody: ReadableStream<Uint8Array>
): Promise<import("../types/openai").OpenAIChatCompletion> {
  let id = "";
  let model = "";
  let usage: ElasticChunk["chat_completion"]["usage"] | undefined;

  // 累积每个 choice 的内容
  const choiceMap = new Map<
    number,
    {
      content: string;
      reasoning: string;
      toolCallMap: Map<
        number,
        {
          id: string;
          name: string;
          arguments: string;
        }
      >;
      finishReason: string;
    }
  >();

  const getOrCreateChoice = (index: number) => {
    if (!choiceMap.has(index)) {
      choiceMap.set(index, {
        content: "",
        reasoning: "",
        toolCallMap: new Map(),
        finishReason: "stop",
      });
    }
    return choiceMap.get(index)!;
  };

  for await (const chunk of readElasticStream(elasticBody)) {
    if (chunk === "DONE") break;

    const cc = chunk.chat_completion;
    if (!id) id = cc.id;
    if (!model) model = cc.model;
    if (cc.usage) usage = cc.usage;

    for (const choice of cc.choices) {
      const c = getOrCreateChoice(choice.index);

      if (choice.delta.content) c.content += choice.delta.content;
      if (choice.reasoning) c.reasoning += choice.reasoning;
      if (choice.finish_reason) c.finishReason = choice.finish_reason;

      if (choice.delta.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const tIdx = tc.index ?? 0;
          // Opus 心跳 chunk 可能不含 function：{"index":0,"type":null}
          if (!c.toolCallMap.has(tIdx) && tc.id && tc.function?.name) {
            c.toolCallMap.set(tIdx, {
              id: tc.id,
              name: tc.function.name,
              arguments: "",
            });
          }
          if (tc.function?.arguments && c.toolCallMap.has(tIdx)) {
            c.toolCallMap.get(tIdx)!.arguments += tc.function.arguments;
          }
        }
      }
    }
  }

  const choices = [...choiceMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, c]) => {
      const toolCalls =
        c.toolCallMap.size > 0
          ? [...c.toolCallMap.entries()]
              .sort(([a], [b]) => a - b)
              .map(([, tc]) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              }))
          : undefined;

      return {
        index,
        message: {
          role: "assistant" as const,
          content: c.content || null,
          ...(toolCalls && { tool_calls: toolCalls }),
          ...(c.reasoning && { reasoning_content: c.reasoning }),
        },
        finish_reason: c.finishReason,
      };
    });

  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices,
    ...(usage !== undefined && {
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    }),
  };
}
