export type RunModeDefinition = {
  name: string;
  description: string;
};

export type ProfileRunResolution = {
  mode: string;
  env: Record<string, string>;
  command: string[];
  providerHosts: string[];
  notes: string[];
};

export type ProfileRunInput = {
  mode?: string;
  command?: string[];
  extraEnv?: Record<string, string>;
};

export type EndpointCategory =
  | "provider"
  | "telemetry"
  | "update"
  | "security-metadata"
  | "git-fetch"
  | "package-registry"
  | "unknown";

export type EndpointClassification = {
  category: EndpointCategory;
  label: string;
};

export interface HarnessProfile {
  name: string;
  description: string;
  buildConfigPath?: string;
  defaultCommand: string[];
  defaultMode?: string;
  modes: RunModeDefinition[];
  resolveRun(hostEnv: NodeJS.ProcessEnv, input: ProfileRunInput): ProfileRunResolution;
  classifyUrl(url: URL): EndpointClassification;
  reportNotes?: string[];
}
