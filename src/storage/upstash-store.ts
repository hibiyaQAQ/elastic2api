import type { ConfigStore } from "./interface";
import type { ProxyConfig } from "../types/config";
import { DEFAULT_CONFIG } from "../types/config";
import { getEnv } from "../utils/env";

const CONFIG_KEY = "proxy_config_v1";

/**
 * Upstash Redis REST API 存储实现
 * 兼容 Vercel KV（旧）和 Upstash Redis 集成（新）两种方式
 *
 * 环境变量（Vercel 连接存储后自动注入，二选一）：
 *   Vercel KV:      KV_REST_API_URL  + KV_REST_API_TOKEN
 *   Upstash Redis:  UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */
export class UpstashStore implements ConfigStore {
  private readonly url: string;
  private readonly token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(command: unknown[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upstash request failed ${res.status}: ${text}`);
    }

    const json = await res.json() as { result: T; error?: string };
    if (json.error) throw new Error(`Upstash error: ${json.error}`);
    return json.result;
  }

  async getConfig(): Promise<ProxyConfig> {
    const raw = await this.request<string | null>(["GET", CONFIG_KEY]);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    try {
      return JSON.parse(raw) as ProxyConfig;
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  async setConfig(config: ProxyConfig): Promise<void> {
    await this.request(["SET", CONFIG_KEY, JSON.stringify(config)]);
  }
}

/**
 * 检测当前环境是否有 Upstash/Vercel KV 配置
 * 返回实例，或 null（未配置）
 */
export function tryCreateUpstashStore(): UpstashStore | null {
  // 优先检测 Upstash Redis 集成（新）
  const upstashUrl = getEnv("UPSTASH_REDIS_REST_URL");
  const upstashToken = getEnv("UPSTASH_REDIS_REST_TOKEN");
  if (upstashUrl && upstashToken) {
    return new UpstashStore(upstashUrl, upstashToken);
  }

  // 回退到 Vercel KV（旧，已废弃但仍可用）
  const kvUrl = getEnv("KV_REST_API_URL");
  const kvToken = getEnv("KV_REST_API_TOKEN");
  if (kvUrl && kvToken) {
    return new UpstashStore(kvUrl, kvToken);
  }

  return null;
}
