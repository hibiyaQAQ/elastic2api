/**
 * Vercel Edge Runtime 入口
 * Hono 应用直接导出 default，Vercel Edge 会自动调用
 */
export { default } from "../src/index";

export const config = {
  runtime: "edge",
};
