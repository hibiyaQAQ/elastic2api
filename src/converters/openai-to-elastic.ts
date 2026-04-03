import type { OpenAIChatRequest } from "../types/openai";
import type {
  ElasticChatRequest,
  ElasticMessage,
  ElasticToolChoice,
  ElasticReasoning,
} from "../types/elastic";

/**
 * 将 OpenAI Chat Completions 请求转换为 Elastic 推理请求
 *
 * 关键差异:
 *   - max_tokens → max_completion_tokens
 *   - stop: string | string[] → stop: string[]
 *   - tools / tool_choice 格式完全相同，直接透传
 *   - messages 格式基本相同，内容字段直接透传
 */
export function openaiToElastic(
  req: OpenAIChatRequest,
  defaultMaxTokens?: number
): ElasticChatRequest {
  const result: ElasticChatRequest = {
    messages: req.messages.map(convertMessage),
  };

  // 优先使用请求中的值，否则用端点配置的默认值
  const maxTokens = req.max_completion_tokens ?? req.max_tokens ?? defaultMaxTokens;
  if (maxTokens !== undefined) {
    result.max_completion_tokens = maxTokens;
  }

  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;

  // stop: string | string[] → string[]
  if (req.stop !== undefined) {
    result.stop = Array.isArray(req.stop) ? req.stop : [req.stop];
  }

  if (req.tools && req.tools.length > 0) {
    result.tools = req.tools.map((tool) => ({
      type: tool.type,
      function: {
        name: tool.function.name,
        // 过滤空 description（Elastic/Anthropic 要求 description 长度 ≥ 1）
        ...(tool.function.description ? { description: tool.function.description } : {}),
        ...(tool.function.parameters !== undefined && { parameters: tool.function.parameters }),
        ...(tool.function.strict !== undefined && { strict: tool.function.strict }),
      },
    }));
  }

  if (req.tool_choice !== undefined) {
    result.tool_choice = req.tool_choice as ElasticToolChoice;
  }

  // 透传思维链配置
  if (req.reasoning) {
    result.reasoning = convertReasoning(req.reasoning);
  }

  return result;
}

function convertMessage(msg: OpenAIChatRequest["messages"][number]): ElasticMessage {
  const hasTool_calls = !!(msg.tool_calls && msg.tool_calls.length > 0);
  const content = msg.content ?? null;

  const result: ElasticMessage = {
    role: msg.role,
    // tool_calls 存在且 content 为 null 时省略 content 字段（Elastic 不接受 null）
    ...(content !== null ? { content } : !hasTool_calls ? { content: null } : {}),
  };

  if (msg.tool_call_id) result.tool_call_id = msg.tool_call_id;
  if (hasTool_calls) {
    // 剥掉 index 字段：index 只在流式 delta 里有效，放进消息历史 Elastic 会报 parse error
    result.tool_calls = msg.tool_calls!.map(({ id, type, function: fn }) => ({
      id,
      type,
      function: fn,
    }));
  }

  return result;
}

function convertReasoning(
  r: NonNullable<OpenAIChatRequest["reasoning"]>
): ElasticReasoning {
  const result: ElasticReasoning = {};
  if (r.effort !== undefined) result.effort = r.effort as ElasticReasoning["effort"];
  if (r.max_tokens !== undefined) result.max_tokens = r.max_tokens;
  if (r.enabled !== undefined) result.enabled = r.enabled;
  if (r.summary !== undefined) result.summary = r.summary as ElasticReasoning["summary"];
  if (r.exclude !== undefined) result.exclude = r.exclude;
  return result;
}
