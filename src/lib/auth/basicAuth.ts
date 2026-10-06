function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);

  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

export function isAuthorized(
  authHeader: string | null,
  expectedPassword: string | undefined
): boolean {
  if (!expectedPassword) return false;
  if (!authHeader?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice("Basic ".length), "base64").toString("utf-8");
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const suppliedPassword = decoded.slice(separatorIndex + 1);
  return constantTimeEqual(suppliedPassword, expectedPassword);
}
