import type { EndpointCategory } from "../profiles/types.js";

export type RequestLogEvent = {
  type: "request";
  startedAt: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  bodyPreview?: string | null;
};

export type ResponseLogEvent = {
  type: "response";
  finishedAt: string;
  method: string;
  url: string;
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  bodyPreview?: string | null;
};

export type HttpLogEvent = RequestLogEvent | ResponseLogEvent;

export type HostCount = {
  host: string;
  count: number;
};

export type EndpointCount = {
  endpoint: string;
  count: number;
};

export type StatusCount = {
  status: number;
  count: number;
};

export type Non200Response = {
  method: string;
  url: string;
  status: number;
  statusText?: string;
};

export type SummaryCategoryCount = {
  category: EndpointCategory;
  count: number;
};

export type LogSummary = {
  requestCount: number;
  responseCount: number;
  hosts: HostCount[];
  endpoints: EndpointCount[];
  uniqueUrls: string[];
  statuses: StatusCount[];
  non200: Non200Response[];
  telemetryUrls: string[];
  providerUrls: string[];
  categoryCounts: SummaryCategoryCount[];
  providerRequestRatio: number;
};

export type LogDiff = {
  onlyInAHosts: string[];
  onlyInBHosts: string[];
  hostDeltas: Array<{ host: string; a: number; b: number; delta: number }>;
  endpointDeltas: Array<{ endpoint: string; a: number; b: number; delta: number }>;
  telemetryInA: string[];
  telemetryInB: string[];
};
