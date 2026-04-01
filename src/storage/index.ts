import type { Context } from "hono";
import type { ConfigStore } from "./interface";
import { KVStore } from "./kv-store";
import { globalMemoryStore } from "./memory-store";
import { tryCreateUpstashStore } from "./upstash-store";

/**
 * 根据运行环境返回合适的存储实现（优先级从高到低）：
 *   1. Cloudflare Workers KV  (env.CONFIG_KV binding)
 *   2. Upstash Redis / Vercel KV  (UPSTASH_REDIS_REST_URL 或 KV_REST_API_URL)
 *   3. 内存存储  (开发环境 / 未配置任何持久化时的兜底，重启后丢失)
 */
export function createStore(c: Context): ConfigStore {
  // 1. Cloudflare Workers KV
  const env = c.env as Record<string, unknown> | undefined;
  if (env && "CONFIG_KV" in env && env["CONFIG_KV"]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new KVStore(env["CONFIG_KV"] as any);
  }

  // 2. Upstash Redis / Vercel KV (通过 process.env)
  const upstash = tryCreateUpstashStore();
  if (upstash) return upstash;

  // 3. 内存存储（兜底）
  return globalMemoryStore;
}

export type { ConfigStore };
