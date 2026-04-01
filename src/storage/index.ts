import type { Context } from "hono";
import type { ConfigStore } from "./interface";
import { KVStore } from "./kv-store";
import { globalMemoryStore } from "./memory-store";

/**
 * 根据运行环境返回合适的存储实现
 * - Cloudflare Workers: 使用 KVStore (env.CONFIG_KV)
 * - Vercel / 开发环境: 使用 MemoryStore
 */
export function createStore(c: Context): ConfigStore {
  // Cloudflare Workers 通过 c.env 暴露 KV binding
  const env = c.env as Record<string, unknown> | undefined;
  if (env && "CONFIG_KV" in env && env["CONFIG_KV"]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new KVStore(env["CONFIG_KV"] as any);
  }
  return globalMemoryStore;
}

export type { ConfigStore };
