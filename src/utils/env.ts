/**
 * 安全读取 process.env 环境变量
 * Vercel Edge Runtime 和 Node.js 都支持 process.env，
 * 但 @cloudflare/workers-types 不包含 process 的类型定义
 */
export function getEnv(key: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any)?.process?.env?.[key] as string | undefined;
}
