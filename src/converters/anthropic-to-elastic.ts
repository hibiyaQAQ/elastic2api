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
  if (req.system) {
    messages.push({ role: "system", content: req.system });
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

  // thinking 配置 → reasoning
  if (req.thinking?.type === "enabled") {
    result.reasoning = {
      enabled: true,
      max_tokens: req.thinking.budget_tokens,
    };
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

  let toolCallIndex = 0;

  for (const block of blocks) {
    switch (block.type) {
      case "text":
        textParts.push(block.text);
        break;

      case "tool_use":
        toolCalls.push({
          id: block.id,
          type: "function",
          index: toolCallIndex++,
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

  const message: ElasticMessage = {
    role: "assistant",
    content: textParts.join("") || null,
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
