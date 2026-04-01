import type { ConfigStore } from "./interface";
import type { ProxyConfig } from "../types/config";
import { DEFAULT_CONFIG } from "../types/config";

/**
 * 内存存储实现（Vercel / 开发环境）
 * 使用模块级单例，进程内所有请求共享同一份状态
 * 注意：进程重启后数据丢失，适合开发调试或 Vercel 临时使用
 */
let memoryConfig: ProxyConfig = structuredClone(DEFAULT_CONFIG);

export class MemoryStore implements ConfigStore {
  async getConfig(): Promise<ProxyConfig> {
    return structuredClone(memoryConfig);
  }

  async setConfig(config: ProxyConfig): Promise<void> {
    memoryConfig = structuredClone(config);
  }
}

// 模块级单例，避免每次请求创建新实例
export const globalMemoryStore = new MemoryStore();
