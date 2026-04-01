/**
 * SSE (Server-Sent Events) 工具函数
 * 全部使用 Web API，兼容 Vercel Edge Runtime 和 Cloudflare Workers
 */

/**
 * 解析 SSE 原始字节流，以异步生成器方式逐事件产出
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

      // 按双换行分割 SSE 事件块
      const blocks = buffer.split(/\n\n/);
      // 最后一块可能不完整，保留到下次
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseSSEBlock(block);
        if (parsed) yield parsed;
      }
    }

    // 处理流结束时缓冲区中的剩余数据
    if (buffer.trim()) {
      const parsed = parseSSEBlock(buffer);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSSEBlock(block: string): { event?: string; data: string } | null {
  const lines = block.split("\n");
  let event: string | undefined;
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      data = line.slice(6);
    } else if (line.startsWith("data:")) {
      data = line.slice(5);
    }
  }

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
