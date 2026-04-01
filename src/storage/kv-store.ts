import type { KVNamespace } from "@cloudflare/workers-types";
import type { ConfigStore } from "./interface";
import type { ProxyConfig } from "../types/config";
import { DEFAULT_CONFIG } from "../types/config";

const CONFIG_KEY = "proxy_config_v1";

/**
 * Cloudflare Workers KV 存储实现
 * 将完整配置序列化为 JSON 存储在单个 KV key 下
 */
export class KVStore implements ConfigStore {
  constructor(private readonly kv: KVNamespace) {}

  async getConfig(): Promise<ProxyConfig> {
    const raw = await this.kv.get(CONFIG_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    try {
      return JSON.parse(raw) as ProxyConfig;
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  async setConfig(config: ProxyConfig): Promise<void> {
    await this.kv.put(CONFIG_KEY, JSON.stringify(config));
  }
}
