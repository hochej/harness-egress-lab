export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );

  const formatRow = (row: string[]) =>
    row
      .map((value, index) => value.padEnd(widths[index] ?? value.length))
      .join("  ");

  return [
    formatRow(headers),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(formatRow),
  ].join("\n");
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
