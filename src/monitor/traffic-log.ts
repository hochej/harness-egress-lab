import { appendFile } from "node:fs/promises";

export type BodyCaptureOptions = {
  hosts?: string[];
  paths?: string[];
};

function sanitizeHeaderValue(value: string): string {
  if (!value) return value;
  if (value.length <= 16) return "[redacted]";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function summarizeHeaders(headers: Headers): Record<string, string> {
  const summary: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    summary[key] =
      lower === "authorization" ||
      lower === "x-api-key" ||
      lower.includes("token") ||
      lower.includes("cookie")
        ? sanitizeHeaderValue(value)
        : value;
  });
  return summary;
}

function textPreview(value: string, maxChars = 400): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars)}…`;
}

function shouldCaptureFullBody(
  url: URL,
  options: BodyCaptureOptions | undefined,
): boolean {
  if (!options) return false;
  const hostMatch = options.hosts?.some((entry) => entry === url.hostname);
  const pathMatch = options.paths?.some((entry) => url.pathname === entry);
  return Boolean(hostMatch || pathMatch);
}

export function bodyPreview(
  contentType: string | null,
  body: string,
  url: URL,
  captureOptions?: BodyCaptureOptions,
): string | null {
  if (!body) return null;
  if (shouldCaptureFullBody(url, captureOptions)) return body;

  const normalized = contentType?.toLowerCase() ?? "";
  if (
    normalized.startsWith("text/") ||
    normalized.includes("json") ||
    normalized.includes("javascript") ||
    normalized.includes("xml") ||
    normalized.includes("x-www-form-urlencoded")
  ) {
    return textPreview(body);
  }
  return `[${body.length} bytes omitted for content-type ${contentType ?? "unknown"}]`;
}

export async function appendNdjson(
  logPath: string,
  entry: Record<string, unknown>,
): Promise<void> {
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}
