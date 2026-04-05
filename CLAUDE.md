# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Elastic Inference Endpoint 代理服务，将 OpenAI 和 Anthropic API 格式的请求转换为 Elastic 推理端点格式。支持多平台部署（Cloudflare Workers 和 Vercel Edge Runtime）。

**核心特性：**
- OpenAI Chat Completions 兼容端点 (`POST /v1/chat/completions`)
- Anthropic Messages 兼容端点 (`POST /v1/messages`)
- 流式响应（SSE）和完整响应支持
- 基于模型名称的自动端点路由
- 带身份验证的管理界面（`/admin`）用于配置端点
- 多种存储后端（Cloudflare KV / Upstash Redis / 内存）

## 常用命令

### 开发
```bash
npm run dev              # Cloudflare Workers 本地开发 (wrangler dev)
npm run dev:vercel       # Vercel Edge Runtime 本地开发
npm run typecheck        # TypeScript 类型检查
```

### 测试
```bash
npm test                 # 运行所有测试 (vitest run)
npm run test:watch       # 监听模式运行测试
```

### 构建与部署
```bash
npm run build:worker     # 构建 Cloudflare Workers 版本 (esbuild)
npm run deploy:cf        # 部署到 Cloudflare Workers
npm run deploy:vercel    # 部署到 Vercel
```

## 架构设计

### 双平台支持

项目支持两种部署目标，使用相同的核心代码：

1. **Cloudflare Workers**：入口为 `src/index.ts`，导出 Hono app
2. **Vercel Edge Runtime**：入口为 `api/index.ts`，使用 `hono/vercel` 的 `handle()` 包装

### 核心流程

**请求处理流程：**
```
客户端请求 (OpenAI/Anthropic 格式)
  ↓
代理认证中间件 (middleware/proxy-auth.ts)
  ↓
端点路由中间件 (middleware/auth.ts)
  - 根据请求中的 model 字段或 x-elastic-* 头查找端点配置
  - 从存储加载配置并注入 ElasticContext
  ↓
路由处理 (routes/openai.ts 或 routes/anthropic.ts)
  ↓
格式转换器 (converters/*)
  - openai-to-elastic.ts: OpenAI → Elastic
  - anthropic-to-elastic.ts: Anthropic → Elastic
  ↓
Elastic 客户端 (utils/elastic-client.ts)
  ↓
流式处理 (streaming/*)
  - elastic-reader.ts: 解析 Elastic SSE 响应
  - openai-writer.ts: 写入 OpenAI SSE 格式
  - anthropic-writer.ts: 写入 Anthropic SSE 格式
  ↓
返回客户端
```

### 存储抽象层

`storage/` 目录实现了配置存储的抽象接口（`interface.ts`），支持三种实现：

1. **KVStore** (`kv-store.ts`)：Cloudflare Workers KV（生产环境）
2. **UpstashStore** (`upstash-store.ts`)：Upstash Redis / Vercel KV（Vercel 部署）
3. **MemoryStore** (`memory-store.ts`)：内存存储（开发环境兜底，重启丢失）

`storage/index.ts` 中的 `createStore()` 按优先级自动选择合适的实现。

### 管理界面

`admin/` 目录包含完整的管理功能：

- **routes.ts**：管理 API 路由（登录、配置 CRUD）
- **auth-middleware.ts**：基于 Cookie 的 session 认证
- **page.ts**：内嵌的单文件 HTML 管理界面（包含 Vue.js）
- **session.ts**：会话令牌生成与验证（使用 Web Crypto API）

管理密码通过环境变量 `ADMIN_PASSWORD` 配置，默认为 `"admin"`。

### 类型定义

`types/` 目录包含所有类型定义：

- **config.ts**：代理配置类型（`EndpointGroup`、`ProxyConfig`）
- **openai.ts**：OpenAI API 类型
- **anthropic.ts**：Anthropic API 类型
- **elastic.ts**：Elastic Inference API 类型

### 认证机制

两层认证：

1. **代理认证**（`middleware/proxy-auth.ts`）：
   - 可选启用（通过管理界面配置 `requireProxyAuth`）
   - 客户端在 `Authorization: Bearer <token>` 中携带代理 API Key
   - 仅作用于 `/v1/*` 路由

2. **端点认证**（`middleware/auth.ts`）：
   - 两种模式：
     - **统一配置模式**：从存储加载配置，根据 `model` 字段自动路由
     - **透传模式**：客户端在请求头中传递 `x-elastic-api-key`、`x-elastic-base-url`、`x-elastic-inference-id`
   - 统一配置模式优先

## 配置说明

### Cloudflare Workers 配置

`wrangler.toml` 中需要配置：

- **KV Namespace**：`CONFIG_KV` 绑定，用于存储端点配置
  ```bash
  wrangler kv:namespace create "CONFIG_KV"
  ```
- **环境变量**：`ADMIN_PASSWORD`（建议通过 Cloudflare Dashboard 设置为 Secret）

### Vercel 配置

`vercel.json` 配置了：
- 所有请求路由到 `api/index.ts`
- 安全响应头（`X-Content-Type-Options`、`X-Frame-Options`）

需要在 Vercel 项目设置中添加环境变量：
- `ADMIN_PASSWORD`：管理界面密码
- `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`（可选，用于持久化存储）

### 透传模式使用示例

客户端可以不依赖服务端配置，直接在请求头中传递 Elastic 凭证：

```bash
curl https://your-proxy.vercel.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy" \
  -H "x-elastic-api-key: YOUR_KEY" \
  -H "x-elastic-base-url: https://YOUR_CLUSTER.elastic.cloud" \
  -H "x-elastic-inference-id: YOUR_INFERENCE_ID" \
  -d '{"model":"any","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

## 重要实现细节

### SSE 流式处理

- `utils/sse.ts` 实现了 SSE 解析器（处理不完整事件、跨 chunk 分片）
- Elastic 返回的 SSE 格式与 OpenAI 直接兼容（实测无需额外转换）
- 同时兼容文档中描述的 `{chat_completion: {...}}` 包装格式

### Token 限制处理

OpenAI API 有两个 token 参数：
- `max_tokens`（旧版）
- `max_completion_tokens`（新版）

转换器会优先使用 `max_completion_tokens`，回退到 `max_tokens`，最后使用端点配置的 `defaultMaxTokens`。

### Tool Calling 支持

OpenAI 和 Anthropic 的工具调用格式不同，转换器分别处理：
- OpenAI：`tools` 数组和 `tool_choice` 直接透传给 Elastic
- Anthropic：`tools` 格式转换，`tool_choice` 从 `{type, name}` 转为 Elastic 的字符串格式

### 错误处理

- 全局错误处理器（`app.onError`）根据路由返回不同格式
- Anthropic 路由返回 `{type: "error", error: {...}}` 格式
- OpenAI 路由返回 `{error: {...}}` 格式
- Elastic 上游错误在 `utils/elastic-client.ts` 中捕获并转换

## 依赖说明

- **Hono**：轻量级 Web 框架，支持多平台（Workers / Vercel / Node.js）
- **Wrangler**：Cloudflare Workers CLI 工具
- **esbuild**：构建 Cloudflare Workers 版本时使用
- **Vitest**：测试框架
