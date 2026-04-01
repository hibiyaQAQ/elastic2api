/**
 * Vercel Edge Runtime 入口
 * 必须使用 hono/vercel 的 handle 包装，否则 Vercel 无法正确调用 Hono 应用
 */
import { handle } from "hono/vercel";
import app from "../src/index";

export const config = {
  runtime: "edge",
};

export default handle(app);
