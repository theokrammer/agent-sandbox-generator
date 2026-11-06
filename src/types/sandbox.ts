export type HostPlatform = 'macos' | 'linux' | 'windows';
export type GuestOs = 'ubuntu' | 'nixos';
export type ActiveTab = 'configurator' | 'gateway' | 'firewall' | 'audit' | 'architecture';

export type AgentTool = 'gemini' | 'opencode' | 'claude' | 'aider' | 'cursor';

export interface ToolchainConfig {
  php: boolean;
  phpComposer: boolean;
  node: boolean;
  python: boolean;
  rust: boolean;
  go: boolean;
  gitUtilities: boolean;
}

export interface HardwareSpecs {
  cpus: number;
  memoryGb: number;
  diskGb: number;
  ramDiskSizeGb: number;
}

export interface FirewallSettings {
  dropIpv6: boolean;
  blockRfc1918: boolean;
  blockCloudMetadata: boolean;
  restrictDns: boolean;
  whitelistGoogleApi: boolean;
  whitelistAnthropic: boolean;
  whitelistOpenai: boolean;
  whitelistGithub: boolean;
  whitelistPackagist: boolean;
  whitelistNpm: boolean;
  whitelistPypi: boolean;
}

export interface SandboxConfig {
  hostPlatform: HostPlatform;
  guestOs: GuestOs;
  hardware: HardwareSpecs;
  toolchains: ToolchainConfig;
  snapshotLock: boolean;
  activeAgent: AgentTool;
  firewall: FirewallSettings;
  zeroMountEnforced: boolean;
  dualLayerStorage: boolean;
  ptyAllocated: boolean;
  inMemorySecretPipe: boolean;
}

export interface SecurityAuditItem {
  id: string;
  category: 'Storage' | 'Isolation' | 'Network' | 'Credentials' | 'Agent Execution';
  title: string;
  description: string;
  status: 'passed' | 'warning' | 'critical';
  mitigation: string;
}

export interface BreakoutSimulationScenario {
  id: string;
  command: string;
  targetRisk: string;
  category: 'Credentials' | 'Network' | 'Filesystem' | 'Host Leakage' | 'Isolation';
  resultBehavior: 'blocked' | 'trapped-in-ram' | 'simulated-airgap';
  explanation: string;
}
