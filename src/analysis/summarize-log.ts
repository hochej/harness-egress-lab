import type { HarnessProfile } from "../profiles/types.js";
import type {
  EndpointCount,
  HostCount,
  HttpLogEvent,
  LogSummary,
  Non200Response,
  ResponseLogEvent,
  StatusCount,
  SummaryCategoryCount,
} from "./types.js";

function sortCounts<T extends { count: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.count - a.count);
}

function toSortedHostCounts(counts: Map<string, number>): HostCount[] {
  return sortCounts([...counts.entries()].map(([host, count]) => ({ host, count })));
}

function toSortedEndpointCounts(counts: Map<string, number>): EndpointCount[] {
  return sortCounts(
    [...counts.entries()].map(([endpoint, count]) => ({ endpoint, count })),
  );
}

function toSortedStatusCounts(counts: Map<number, number>): StatusCount[] {
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status - b.status);
}

function toSortedCategoryCounts(counts: Map<string, number>): SummaryCategoryCount[] {
  return sortCounts(
    [...counts.entries()].map(([category, count]) => ({
      category: category as SummaryCategoryCount["category"],
      count,
    })),
  );
}

function endpointKey(url: URL): string {
  return `${url.hostname}${url.pathname}`;
}

function asResponse(event: HttpLogEvent): event is ResponseLogEvent {
  return event.type === "response";
}

export function summarizeLog(
  events: HttpLogEvent[],
  profile?: HarnessProfile,
): LogSummary {
  const requestEvents = events.filter((event) => event.type === "request");
  const responseEvents = events.filter(asResponse);

  const hostCounts = new Map<string, number>();
  const endpointCounts = new Map<string, number>();
  const statusCounts = new Map<number, number>();
  const categoryCounts = new Map<string, number>();
  const uniqueUrls = new Set<string>();
  const telemetryUrls = new Set<string>();
  const providerUrls = new Set<string>();

  for (const event of requestEvents) {
    const url = new URL(event.url);
    uniqueUrls.add(event.url);
    hostCounts.set(url.hostname, (hostCounts.get(url.hostname) ?? 0) + 1);
    endpointCounts.set(endpointKey(url), (endpointCounts.get(endpointKey(url)) ?? 0) + 1);

    const classification = profile?.classifyUrl(url) ?? { category: "unknown", label: "unknown" };
    categoryCounts.set(
      classification.category,
      (categoryCounts.get(classification.category) ?? 0) + 1,
    );
    if (classification.category === "telemetry") telemetryUrls.add(event.url);
    if (classification.category === "provider") providerUrls.add(event.url);
  }

  const non200: Non200Response[] = [];
  for (const event of responseEvents) {
    statusCounts.set(event.status, (statusCounts.get(event.status) ?? 0) + 1);
    if (event.status < 200 || event.status >= 300) {
      const entry: Non200Response = {
        method: event.method,
        url: event.url,
        status: event.status,
      };
      if (event.statusText !== undefined) {
        entry.statusText = event.statusText;
      }
      non200.push(entry);
    }
  }

  const providerRequestRatio = requestEvents.length
    ? providerUrls.size / requestEvents.length
    : 0;

  return {
    requestCount: requestEvents.length,
    responseCount: responseEvents.length,
    hosts: toSortedHostCounts(hostCounts),
    endpoints: toSortedEndpointCounts(endpointCounts),
    uniqueUrls: [...uniqueUrls].sort(),
    statuses: toSortedStatusCounts(statusCounts),
    non200,
    telemetryUrls: [...telemetryUrls].sort(),
    providerUrls: [...providerUrls].sort(),
    categoryCounts: toSortedCategoryCounts(categoryCounts),
    providerRequestRatio,
  };
}
