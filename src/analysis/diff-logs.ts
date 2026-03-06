import type { HarnessProfile } from "../profiles/types.js";
import type { HttpLogEvent, LogDiff } from "./types.js";
import { summarizeLog } from "./summarize-log.js";

function countMap(entries: Array<{ key: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
  }
  return counts;
}

function hostMap(events: HttpLogEvent[]): Map<string, number> {
  return countMap(
    events
      .filter((event) => event.type === "request")
      .map((event) => ({ key: new URL(event.url).hostname })),
  );
}

function endpointMap(events: HttpLogEvent[]): Map<string, number> {
  return countMap(
    events
      .filter((event) => event.type === "request")
      .map((event) => {
        const url = new URL(event.url);
        return { key: `${url.hostname}${url.pathname}` };
      }),
  );
}

function diffHostMaps(
  a: Map<string, number>,
  b: Map<string, number>,
): LogDiff["hostDeltas"] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys]
    .map((key) => ({
      host: key,
      a: a.get(key) ?? 0,
      b: b.get(key) ?? 0,
      delta: (b.get(key) ?? 0) - (a.get(key) ?? 0),
    }))
    .filter((row) => row.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

function diffEndpointMaps(
  a: Map<string, number>,
  b: Map<string, number>,
): LogDiff["endpointDeltas"] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys]
    .map((key) => ({
      endpoint: key,
      a: a.get(key) ?? 0,
      b: b.get(key) ?? 0,
      delta: (b.get(key) ?? 0) - (a.get(key) ?? 0),
    }))
    .filter((row) => row.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

export function diffLogs(
  aEvents: HttpLogEvent[],
  bEvents: HttpLogEvent[],
  profile?: HarnessProfile,
): LogDiff {
  const aHosts = hostMap(aEvents);
  const bHosts = hostMap(bEvents);
  const aSummary = summarizeLog(aEvents, profile);
  const bSummary = summarizeLog(bEvents, profile);

  return {
    onlyInAHosts: [...aHosts.keys()].filter((host) => !bHosts.has(host)).sort(),
    onlyInBHosts: [...bHosts.keys()].filter((host) => !aHosts.has(host)).sort(),
    hostDeltas: diffHostMaps(aHosts, bHosts),
    endpointDeltas: diffEndpointMaps(endpointMap(aEvents), endpointMap(bEvents)),
    telemetryInA: aSummary.telemetryUrls,
    telemetryInB: bSummary.telemetryUrls,
  };
}
