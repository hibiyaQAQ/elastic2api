/**
 * SSE (Server-Sent Events) 工具函数
 * 全部使用 Web API，兼容 Vercel Edge Runtime 和 Cloudflare Workers
 */

// UTF-8 BOM 字符 (U+FEFF)，Elastic 在每个 SSE 事件前都会加上它
const BOM = "\uFEFF";

/** 去除字符串开头的 BOM 字符 */
function stripBOM(s: string): string {
  return s.startsWith(BOM) ? s.slice(1) : s;
}

/**
 * 解析 SSE 原始字节流，以异步生成器方式逐事件产出
 * 兼容：LF / CRLF / CR 行尾，以及每个事件前的 BOM 字符
 */
export async function* parseSSE(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<{ event?: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 统一将 CRLF / CR 转为 LF，再按双空行分割事件块
      const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const blocks = normalized.split(/\n\n/);

      // 最后一块可能不完整，保留
      buffer = blocks[blocks.length - 1] ?? "";

      for (let i = 0; i < blocks.length - 1; i++) {
        const block = blocks[i];
        if (!block) continue;
        const parsed = parseSSEBlock(block);
        if (parsed) yield parsed;
      }
    }

    // 处理流结束时缓冲区中的剩余数据
    if (buffer.trim()) {
      const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const parsed = parseSSEBlock(normalized);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSSEBlock(block: string): { event?: string; data: string } | null {
  // 去除整个 block 开头的 BOM（Elastic 在每个事件前插入）
  const cleanBlock = stripBOM(block.trimStart().startsWith(BOM)
    ? block.trimStart()
    : block);

  const lines = cleanBlock.split("\n");
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    // 去除每行的 BOM 和尾部 \r
    const clean = stripBOM(line).replace(/\r$/, "");

    if (clean.startsWith("event:")) {
      event = clean.slice(6).trim();
    } else if (clean.startsWith("data:")) {
      // data 冒号后有一个可选空格
      const val = clean.length > 5 && clean[5] === " "
        ? clean.slice(6)
        : clean.slice(5);
      dataLines.push(val);
    }
    // 忽略 id:、retry: 和注释行
  }

  const data = dataLines.join("\n");
  if (!data) return null;
  return { event, data };
}

/**
 * 格式化单条 SSE 事件为文本字符串
 */
export function formatSSE(data: string, event?: string): string {
  if (event) {
    return `event: ${event}\ndata: ${data}\n\n`;
  }
  return `data: ${data}\n\n`;
}
