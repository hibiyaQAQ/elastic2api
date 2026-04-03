// ============================================================
// Elastic Inference Chat Completion API Types
// POST /_inference/chat_completion/{inference_id}/_stream
// ============================================================

export type ElasticRole = "user" | "assistant" | "system" | "tool";

/** 消息历史中的 tool_call（无 index） */
export interface ElasticToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/** 流式 delta 中的 tool_call（有 index，用于标识哪个工具调用的增量） */
export interface ElasticToolCallDelta extends ElasticToolCall {
  index?: number;
}

export interface ElasticContentPartText {
  type: "text";
  text: string;
}

export interface ElasticContentPartImage {
  type: "image_url";
  image_url: { url: string; detail?: string };
}

export type ElasticContentPart = ElasticContentPartText | ElasticContentPartImage;

export interface ElasticMessage {
  role: ElasticRole;
  /** tool_calls 存在时可省略 content */
  content?: string | ElasticContentPart[] | null;
  tool_call_id?: string;
  tool_calls?: ElasticToolCall[];
  reasoning?: string;
  reasoning_details?: ElasticReasoningDetail[];
}

export interface ElasticReasoningDetail {
  type: "reasoning.encrypted" | "reasoning.summary" | "reasoning.text";
  data?: string;
  summary?: string;
  text?: string;
  signature?: string;
}

export interface ElasticTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
}

export type ElasticToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

export interface ElasticReasoning {
  effort?: "high" | "xhigh" | "medium" | "low" | "minimal" | "none";
  max_tokens?: number;
  enabled?: boolean;
  summary?: "auto" | "concise" | "detailed";
  exclude?: boolean;
}

export interface ElasticChatRequest {
  messages: ElasticMessage[];
  model?: string;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  tools?: ElasticTool[];
  tool_choice?: ElasticToolChoice;
  reasoning?: ElasticReasoning;
}

// ── SSE 响应类型 ──

export interface ElasticChunk {
  chat_completion: {
    id: string;
    object: "chat.completion.chunk";
    model: string;
    choices: ElasticChoice[];
    usage?: ElasticUsage;
  };
}

export interface ElasticChoice {
  index: number;
  delta: {
    role?: ElasticRole;
    content?: string | null;
    tool_calls?: ElasticToolCallDelta[];
  };
  /** 思考内容（reasoning 与 delta 同级，不在 delta 内部） */
  reasoning?: string;
  reasoning_details?: ElasticReasoningDetail[];
  finish_reason?: string | null;
}

export interface ElasticUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}
