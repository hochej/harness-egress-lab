import type { HarnessProfile } from "../profiles/types.js";
import type { LogSummary } from "./types.js";

function markdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return [head, divider, body].filter(Boolean).join("\n");
}

export function renderMarkdownReport(
  profile: HarnessProfile,
  logPath: string,
  summary: LogSummary,
): string {
  const hostRows = summary.hosts.slice(0, 12).map((entry) => [entry.host, String(entry.count)]);
  const categoryRows = summary.categoryCounts.map((entry) => [entry.category, String(entry.count)]);
  const statusRows = summary.statuses.map((entry) => [String(entry.status), String(entry.count)]);

  const pieLines = summary.hosts
    .slice(0, 6)
    .map((entry) => `  "${entry.host}" : ${entry.count}`)
    .join("\n");

  const telemetrySection =
    summary.telemetryUrls.length > 0
      ? summary.telemetryUrls.map((url) => `- Observed telemetry endpoint: \`${url}\``).join("\n")
      : "- No direct telemetry endpoints detected";

  const nonProviderHosts = summary.hosts.filter((entry) => entry.host !== "openrouter.ai");
  const nonProviderSection = nonProviderHosts.length
    ? nonProviderHosts.map((entry) => `- ${entry.host} (${entry.count} requests)`).join("\n")
    : "- No non-provider hosts observed";

  return `# ${profile.name} traffic report

## Run metadata
- profile: ${profile.name}
- log: ${logPath}
- requests: ${summary.requestCount}
- responses: ${summary.responseCount}
- provider request ratio: ${summary.providerRequestRatio.toFixed(2)}

## Host counts
${markdownTable(["host", "count"], hostRows)}

## Endpoint categories
${markdownTable(["category", "count"], categoryRows)}

## Response statuses
${markdownTable(["status", "count"], statusRows)}

## Telemetry findings
${telemetrySection}

## Non-provider traffic
${nonProviderSection}

## Notable profile notes
${(profile.reportNotes ?? []).map((note) => `- ${note}`).join("\n")}

## Visualization
\`\`\`mermaid
pie title ${profile.name} host distribution
${pieLines}
\`\`\`
`;
}
