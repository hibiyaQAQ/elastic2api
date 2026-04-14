import type {
  AnthropicRequest,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicToolChoice,
} from "../types/anthropic";
import type {
  ElasticChatRequest,
  ElasticMessage,
  ElasticTool,
  ElasticToolChoice,
  ElasticReasoning,
} from "../types/elastic";

/**
 * 将 Anthropic Messages 请求转换为 Elastic 推理请求
 *
 * 关键差异:
 *   - system: string (顶层字段) → system role 消息注入到 messages 首位
 *   - stop_sequences → stop
 *   - tool.input_schema → tool.function.parameters
 *   - tool_choice 格式不同 (type:"any" → "required", type:"tool" → {type:"function",...})
 *   - assistant 消息中的 tool_use block → tool_calls 数组
 *   - user 消息中的 tool_result block → 独立的 role:"tool" 消息
 *   - thinking block → reasoning 字段
 */
export function anthropicToElastic(
  req: AnthropicRequest,
  defaultMaxTokens?: number
): ElasticChatRequest {
  const messages: ElasticMessage[] = [];

  // 1. system 字段提取为第一条 system 消息
  // Claude Code 会把 system 以数组形式发送（带 cache_control），需要提取纯文本
  if (req.system) {
    const systemText = extractSystemText(req.system);
    if (systemText) {
      messages.push({ role: "system", content: systemText });
    }
  }

  // 2. 转换 messages 数组
  for (const msg of req.messages) {
    const converted = convertAnthropicMessage(msg);
    messages.push(...converted);
  }

  const result: ElasticChatRequest = {
    messages,
    // 优先使用请求中的值，否则用端点配置的默认值
    max_completion_tokens: req.max_tokens ?? defaultMaxTokens,
  };

  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;

  // stop_sequences → stop
  if (req.stop_sequences && req.stop_sequences.length > 0) {
    result.stop = req.stop_sequences;
  }

  // 工具定义转换
  if (req.tools && req.tools.length > 0) {
    result.tools = req.tools.map(convertTool);
  }

  if (req.tool_choice) {
    result.tool_choice = convertToolChoice(req.tool_choice);
  }

  // Anthropic thinking → Elastic reasoning (effort 格式)
  // 注意：Elastic 不支持 {enabled, max_tokens} 格式，只支持 {effort: "..."}
  // 根据 budget_tokens 大小映射到对应的 effort 级别
  if (req.thinking?.type === "enabled") {
    const budget = req.thinking.budget_tokens;
    const effort: ElasticReasoning["effort"] =
      budget >= 10000 ? "xhigh" :
      budget >= 5000  ? "high"  :
      budget >= 1000  ? "medium":
      budget >= 200   ? "low"   : "minimal";
    result.reasoning = { effort };
  }

  return result;
}

/**
 * 转换单条 Anthropic 消息
 * 一条 Anthropic 消息可能拆分为多条 Elastic 消息 (例如 tool_result)
 */
function convertAnthropicMessage(msg: AnthropicMessage): ElasticMessage[] {
  // 纯文本内容直接转换
  if (typeof msg.content === "string") {
    return [{ role: msg.role as "user" | "assistant" | "system", content: msg.content }];
  }

  const blocks = msg.content;

  if (msg.role === "assistant") {
    return convertAssistantBlocks(blocks);
  }

  if (msg.role === "user") {
    return convertUserBlocks(blocks);
  }

  return [];
}

/**
 * 转换 assistant 消息的内容块
 * text → content 字段
 * tool_use → tool_calls 数组
 * thinking → reasoning 字段
 */
function convertAssistantBlocks(blocks: AnthropicContentBlock[]): ElasticMessage[] {
  const textParts: string[] = [];
  const toolCalls: NonNullable<ElasticMessage["tool_calls"]> = [];
  const reasoningParts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "text":
        textParts.push(block.text);
        break;

      case "tool_use":
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
        break;

      case "thinking":
        reasoningParts.push(block.thinking);
        break;

      case "redacted_thinking":
        // 忽略加密的思维链
        break;
    }
  }

  const text = textParts.join("");
  const message: ElasticMessage = {
    role: "assistant",
    // 有文本内容时才设置 content；
    // tool_calls 存在或只有 thinking block 时省略 content（Elastic 不接受 null，Opus 遇到 null 会 400）
    ...(text ? { content: text } : {}),
  };

  if (toolCalls.length > 0) message.tool_calls = toolCalls;
  if (reasoningParts.length > 0) message.reasoning = reasoningParts.join("\n");

  return [message];
}

/**
 * 转换 user 消息的内容块
 * tool_result → 独立的 role:"tool" 消息
 * text + image → user 消息
 */
function convertUserBlocks(blocks: AnthropicContentBlock[]): ElasticMessage[] {
  const toolResultMessages: ElasticMessage[] = [];
  const userContentParts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "tool_result": {
        // 提取 tool_result 中的文本内容
        let toolContent: string;
        if (typeof block.content === "string") {
          toolContent = block.content;
        } else if (Array.isArray(block.content)) {
          toolContent = block.content
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => b.text)
            .join("");
        } else {
          toolContent = "";
        }

        toolResultMessages.push({
          role: "tool",
          content: toolContent,
          tool_call_id: block.tool_use_id,
        });
        break;
      }

      case "text":
        userContentParts.push(block.text);
        break;

      case "image":
        // 图片内容直接保留为 Elastic 支持的格式
        // Elastic 的 content 支持数组格式，但我们简化处理
        // 只传递文本部分，图片暂不支持
        break;
    }
  }

  const results: ElasticMessage[] = [...toolResultMessages];

  if (userContentParts.length > 0) {
    results.push({ role: "user", content: userContentParts.join("") });
  }

  return results;
}

/**
 * 转换工具定义
 * Anthropic: { name, description, input_schema }
 * Elastic:   { type:"function", function: { name, description, parameters } }
 */
function convertTool(tool: import("../types/anthropic").AnthropicTool): ElasticTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      ...(tool.description && { description: tool.description }),
      parameters: tool.input_schema,
    },
  };
}

/**
 * 转换工具选择方式
 * Anthropic auto  → Elastic "auto"
 * Anthropic any   → Elastic "required" (必须使用某个工具)
 * Anthropic tool  → Elastic { type:"function", function:{name} }
 */
function convertToolChoice(tc: AnthropicToolChoice): ElasticToolChoice {
  switch (tc.type) {
    case "auto":
      return "auto";
    case "any":
      return "required";
    case "tool":
      return { type: "function", function: { name: tc.name } };
  }
}

/**
 * 从 system 字段提取纯文本
 * Claude Code 等客户端会把 system 以数组形式发送，每个 block 带有 cache_control 等额外字段
 * Elastic 只接受纯字符串，需要提取 text 部分并拼接
 */
function extractSystemText(
  system: string | Array<{ type: string; text?: string; [key: string]: unknown }>
): string {
  if (typeof system === "string") return system;
  return system
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}
