import { readFile } from "node:fs/promises";

import type { HttpLogEvent } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpLogEvent(value: unknown): value is HttpLogEvent {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "request") {
    return typeof value.method === "string" && typeof value.url === "string";
  }
  if (value.type === "response") {
    return (
      typeof value.method === "string" &&
      typeof value.url === "string" &&
      typeof value.status === "number"
    );
  }
  return false;
}

export async function readHttpLog(logPath: string): Promise<HttpLogEvent[]> {
  const raw = await readFile(logPath, "utf8");
  const events: HttpLogEvent[] = [];

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Failed to parse NDJSON at line ${index + 1}: ${(error as Error).message}`);
    }

    if (!isHttpLogEvent(parsed)) {
      throw new Error(`Invalid log event at line ${index + 1}`);
    }

    events.push(parsed);
  }

  return events;
}
