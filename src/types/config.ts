// ============================================================
// 代理配置类型定义
// ============================================================

/**
 * Elastic 推理端点组
 * 一组凭证对应一个 Elastic Inference Endpoint，
 * 可以配置多个模型名称，请求时根据 model 字段自动路由
 */
export interface EndpointGroup {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  inferenceId: string;
  /** 该端点支持的模型名称列表，如 ["gpt-4o", "gpt-4-turbo"] */
  models: string[];
  /** 请求未指定 max_tokens 时使用的默认值，不填则由 Elastic 端点决定 */
  defaultMaxTokens?: number;
  enabled: boolean;
  createdAt: string;
}

/**
 * 完整代理配置
 */
export interface ProxyConfig {
  endpoints: EndpointGroup[];
  /** 代理 API Key 列表，requireProxyAuth=true 时必须携带其中一个 */
  proxyApiKeys: string[];
  /** 是否要求客户端携带代理 API Key */
  requireProxyAuth: boolean;
}

export const DEFAULT_CONFIG: ProxyConfig = {
  endpoints: [],
  proxyApiKeys: [],
  requireProxyAuth: false,
};
