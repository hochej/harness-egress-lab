export type ParsedCli = {
  positionals: string[];
  options: Map<string, string[]>;
};

export function parseCliArgs(argv: string[]): ParsedCli {
  const positionals: string[] = [];
  const options = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const trimmed = token.slice(2);
    const equals = trimmed.indexOf("=");
    let key = trimmed;
    let value = "true";

    if (equals >= 0) {
      key = trimmed.slice(0, equals);
      value = trimmed.slice(equals + 1);
    } else {
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        index += 1;
      }
    }

    const existing = options.get(key) ?? [];
    existing.push(value);
    options.set(key, existing);
  }

  return { positionals, options };
}

export function getOption(
  parsed: ParsedCli,
  key: string,
): string | undefined {
  return parsed.options.get(key)?.at(-1);
}

export function getOptionValues(parsed: ParsedCli, key: string): string[] {
  return parsed.options.get(key) ?? [];
}

export function hasFlag(parsed: ParsedCli, key: string): boolean {
  return parsed.options.has(key);
}

export function parseKeyValue(entries: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const equals = entry.indexOf("=");
    if (equals <= 0) {
      throw new Error(`Expected KEY=VALUE, received '${entry}'`);
    }
    result[entry.slice(0, equals)] = entry.slice(equals + 1);
  }
  return result;
}
