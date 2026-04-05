import type {
  AnthropicStreamEvent,
  AnthropicContentBlockStartEvent,
} from "../types/anthropic";
import type { ElasticUsage } from "../types/elastic";
import { formatSSE } from "../utils/sse";
import { readElasticStream } from "./elastic-reader";

/**
 * 将 Elastic SSE 响应流转换为 Anthropic SSE 响应流
 *
 * Anthropic 流协议有严格的事件顺序要求:
 *   1. message_start
 *   2. content_block_start (index=0, type="text" 或 "thinking")
 *   3. content_block_delta* (text_delta 或 thinking_delta)
 *   4. content_block_stop
 *   [5. content_block_start (index=N, type="tool_use")]
 *   [6. content_block_delta* (input_json_delta)]
 *   [7. content_block_stop]
 *   8. message_delta (stop_reason)
 *   9. message_stop
 *
 * 转换策略:
 *   - reasoning → thinking content block (index=0)
 *   - content   → text content block (index = thinking存在?1:0)
 *   - tool_calls → tool_use content block (index = 基础索引 + tc.index)
 *   - 维护 openBlocks 状态机追踪已开启但未关闭的块
 */
export function elasticToAnthropicStream(
  elasticBody: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: AnthropicStreamEvent) =>
        controller.enqueue(
          encoder.encode(formatSSE(JSON.stringify(event), event.type))
        );

      // ── 流状态 ──
      let messageStartSent = false;
      let messageId = "";
      let model = "";
      let usage: ElasticUsage | undefined;
      let finalFinishReason = "end_turn";

      // content block 索引管理
      let nextContentIndex = 0;
      // 追踪已开启未关闭的 block: index → type
      const openBlocks = new Map<number, "text" | "tool_use" | "thinking">();

      // 思维链 block 的 content index (-1 表示未开启)
      let thinkingBlockIndex = -1;
      // 文本 block 是否已开启
      let textBlockIndex = -1;
      // 复合 key "${choice.index}:${tc.index}" → Anthropic content block index
      // 必须用复合 key，因为 Elastic 并行工具调用时每个 choice 都有独立的 tc.index=0
      const toolIndexMap = new Map<string, number>();

      try {
        for await (const chunk of readElasticStream(elasticBody)) {
          if (chunk === "DONE") break;

          const cc = chunk.chat_completion;

          // 保存元数据
          if (!messageId) messageId = cc.id;
          if (!model) model = cc.model;
          if (cc.usage) usage = cc.usage;

          // ── 发送 message_start (仅第一个有效 chunk)
          if (!messageStartSent) {
            messageStartSent = true;
            enqueue({
              type: "message_start",
              message: {
                id: cc.id,
                type: "message",
                role: "assistant",
                content: [],
                model: cc.model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 },
              },
            });
          }

          for (const choice of cc.choices) {
            const { delta, finish_reason, reasoning } = choice;
            if (finish_reason) {
              finalFinishReason = mapFinishReason(finish_reason);
            }

            // ── 处理思维链内容 → thinking block
            // reasoning 与 delta 同级，不在 delta 内部
            if (reasoning !== undefined && reasoning !== "") {
              if (thinkingBlockIndex === -1) {
                thinkingBlockIndex = nextContentIndex++;
                const startEvent: AnthropicContentBlockStartEvent = {
                  type: "content_block_start",
                  index: thinkingBlockIndex,
                  content_block: { type: "thinking", thinking: "" },
                };
                enqueue(startEvent);
                openBlocks.set(thinkingBlockIndex, "thinking");
              }
              enqueue({
                type: "content_block_delta",
                index: thinkingBlockIndex,
                delta: { type: "thinking_delta", thinking: reasoning },
              });
            }

            // ── 处理文本内容 → text block
            if (delta.content !== undefined && delta.content !== null && delta.content !== "") {
              // 如果 thinking block 还在开启状态，先关闭它
              if (thinkingBlockIndex !== -1 && openBlocks.has(thinkingBlockIndex)) {
                enqueue({ type: "content_block_stop", index: thinkingBlockIndex });
                openBlocks.delete(thinkingBlockIndex);
              }

              if (textBlockIndex === -1) {
                textBlockIndex = nextContentIndex++;
                const startEvent: AnthropicContentBlockStartEvent = {
                  type: "content_block_start",
                  index: textBlockIndex,
                  content_block: { type: "text", text: "" },
                };
                enqueue(startEvent);
                openBlocks.set(textBlockIndex, "text");
              }

              enqueue({
                type: "content_block_delta",
                index: textBlockIndex,
                delta: { type: "text_delta", text: delta.content },
              });
            }

            // ── 处理工具调用 → tool_use block
            if (delta.tool_calls && delta.tool_calls.length > 0) {
              for (const tc of delta.tool_calls) {
                const elasticToolIdx = tc.index ?? 0;
                // 复合 key：Elastic 并行调用时每个 choice 各自的 tc.index 都从 0 开始
                const mapKey = `${choice.index}:${elasticToolIdx}`;

                // 首次出现此工具调用：开启新的 tool_use block
                // 仅当 tc.id 和 tc.function?.name 都存在时才创建（Opus 的心跳 chunk 不含这些字段）
                if (!toolIndexMap.has(mapKey) && tc.id && tc.function?.name) {
                  // 关闭 thinking block (如果还开着)
                  if (thinkingBlockIndex !== -1 && openBlocks.has(thinkingBlockIndex)) {
                    enqueue({ type: "content_block_stop", index: thinkingBlockIndex });
                    openBlocks.delete(thinkingBlockIndex);
                  }
                  // 关闭 text block (如果还开着)
                  if (textBlockIndex !== -1 && openBlocks.has(textBlockIndex)) {
                    enqueue({ type: "content_block_stop", index: textBlockIndex });
                    openBlocks.delete(textBlockIndex);
                  }

                  const blockIdx = nextContentIndex++;
                  toolIndexMap.set(mapKey, blockIdx);

                  const startEvent: AnthropicContentBlockStartEvent = {
                    type: "content_block_start",
                    index: blockIdx,
                    content_block: {
                      type: "tool_use",
                      id: tc.id,
                      name: tc.function.name,
                      input: {},
                    },
                  };
                  enqueue(startEvent);
                  openBlocks.set(blockIdx, "tool_use");
                }

                // 追加工具参数 JSON 片段
                // Opus 有时发 {"index":0,"type":null} 不含 function 属性，需要安全访问
                if (tc.function?.arguments && toolIndexMap.has(mapKey)) {
                  const blockIdx = toolIndexMap.get(mapKey)!;
                  enqueue({
                    type: "content_block_delta",
                    index: blockIdx,
                    delta: {
                      type: "input_json_delta",
                      partial_json: tc.function.arguments,
                    },
                  });
                }
              }
            }
          }
        }

        // ── 确保 message_start 已发送 (空响应边界情况)
        if (!messageStartSent) {
          enqueue({
            type: "message_start",
            message: {
              id: messageId || "msg_unknown",
              type: "message",
              role: "assistant",
              content: [],
              model: model || "unknown",
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 0, output_tokens: 0 },
            },
          });
        }

        // ── 关闭所有仍然开启的 blocks (按 index 升序)
        const sortedOpenBlocks = [...openBlocks.entries()].sort(([a], [b]) => a - b);
        for (const [idx] of sortedOpenBlocks) {
          enqueue({ type: "content_block_stop", index: idx });
        }

        // ── message_delta (stop_reason)
        enqueue({
          type: "message_delta",
          delta: {
            stop_reason: finalFinishReason,
            stop_sequence: null,
          },
          usage: { output_tokens: usage?.completion_tokens ?? 0 },
        });

        // ── message_stop
        enqueue({ type: "message_stop" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream processing error";
        enqueue({
          type: "error",
          error: { type: "api_error", message },
        });
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * 将 Elastic/OpenAI finish_reason 映射为 Anthropic stop_reason
 */
function mapFinishReason(reason: string): string {
  const map: Record<string, string> = {
    stop: "end_turn",
    tool_calls: "tool_use",
    length: "max_tokens",
    content_filter: "stop_sequence",
    max_tokens: "max_tokens",
  };
  return map[reason] ?? "end_turn";
}
