import type { ProxyConfig } from "../types/config";

/**
 * 配置存储抽象接口
 * Cloudflare Workers 使用 KVStore，Vercel/开发环境使用 MemoryStore
 */
export interface ConfigStore {
  getConfig(): Promise<ProxyConfig>;
  setConfig(config: ProxyConfig): Promise<void>;
}
