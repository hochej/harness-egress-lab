const DEFAULT_GUEST_PATH =
  "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

export function parseBoolEnv(value: string | undefined): boolean {
  if (!value) return false;
  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    default:
      return false;
  }
}

export function defaultGuestPath(): string {
  return DEFAULT_GUEST_PATH;
}

export function mergeGuestEnv(
  ...sources: Array<Record<string, string | undefined> | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {
    PATH: DEFAULT_GUEST_PATH,
  };

  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) merged[key] = value;
    }
  }

  return merged;
}
