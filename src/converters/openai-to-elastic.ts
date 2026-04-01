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
export function openaiToElastic(req: OpenAIChatRequest): ElasticChatRequest {
  const result: ElasticChatRequest = {
    messages: req.messages.map(convertMessage),
  };

  // max_tokens 或 max_completion_tokens → Elastic 的 max_completion_tokens
  const maxTokens = req.max_completion_tokens ?? req.max_tokens;
  if (maxTokens !== undefined) {
    result.max_completion_tokens = maxTokens;
  }

  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;

  // stop: string | string[] → string[]
  if (req.stop !== undefined) {
    result.stop = Array.isArray(req.stop) ? req.stop : [req.stop];
  }

  // tools 格式与 Elastic 完全一致，直接透传
  if (req.tools && req.tools.length > 0) {
    result.tools = req.tools;
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
  const result: ElasticMessage = {
    role: msg.role,
    content: msg.content ?? null,
  };

  if (msg.tool_call_id) result.tool_call_id = msg.tool_call_id;
  if (msg.tool_calls && msg.tool_calls.length > 0) result.tool_calls = msg.tool_calls;

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
