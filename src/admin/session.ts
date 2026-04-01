/**
 * Session Token 生成与验证
 * 使用 Web Crypto API，兼容 Cloudflare Workers 和 Vercel Edge Runtime
 *
 * Token 格式: base64(timestamp_ms).base64(HMAC-SHA256(password+timestamp, derivedSecret))
 * Secret 派生: HMAC-SHA256(ADMIN_PASSWORD, "session-secret") — 无需存储，验证时实时派生
 */

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE = 86400; // 24 小时（秒）
const SESSION_VALIDITY_MS = 86400 * 1000;

/**
 * 从密码派生 HMAC 签名 Key
 */
async function deriveSigningKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();

  // Step 1: 将密码导入为 HMAC key
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Step 2: 签名固定字符串得到 32 字节随机材料
  const derivedBytes = await crypto.subtle.sign(
    "HMAC",
    passwordKey,
    enc.encode("session-secret-v1")
  );

  // Step 3: 将派生字节导入为最终签名 Key
  return crypto.subtle.importKey(
    "raw",
    derivedBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * 生成 Session Token
 */
export async function generateToken(password: string): Promise<string> {
  const ts = Date.now().toString();
  const key = await deriveSigningKey(password);
  const enc = new TextEncoder();

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password + ts));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const tsB64 = btoa(ts);

  return `${tsB64}.${sigB64}`;
}

/**
 * 验证 Session Token
 * 返回 true 表示 token 有效（签名正确且未过期）
 */
export async function verifyToken(token: string, password: string): Promise<boolean> {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return false;

  try {
    const tsB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);

    const ts = atob(tsB64);
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));

    // 验证时效（24小时内）
    const age = Date.now() - parseInt(ts, 10);
    if (isNaN(age) || age > SESSION_VALIDITY_MS || age < 0) return false;

    // 验证签名
    const key = await deriveSigningKey(password);
    const enc = new TextEncoder();
    return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(password + ts));
  } catch {
    return false;
  }
}
