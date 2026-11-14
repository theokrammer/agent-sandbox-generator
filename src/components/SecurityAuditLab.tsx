import React, { useState } from 'react';
import { SandboxConfig, SecurityAuditItem, BreakoutSimulationScenario } from '../types/sandbox';
import { generateVerifyScript } from '../utils/generator';
import {
  ShieldCheck,
  ShieldAlert,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Play,
  Lock,
  Layers,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';

interface SecurityAuditLabProps {
  config: SandboxConfig;
}

export const SecurityAuditLab: React.FC<SecurityAuditLabProps> = ({ config }) => {
  const [rightMode, setRightMode] = useState<'simulator' | 'verify-script'>('simulator');
  const [copiedVerify, setCopiedVerify] = useState(false);

  const auditItems: SecurityAuditItem[] = [
    {
      id: 'zero-mount',
      category: 'Isolation',
      title:
        config.hostPlatform === 'windows'
          ? 'WSL Automount & Interop Disabled'
          : 'Zero Host Directory Mounts (mounts: [])',
      description:
        config.hostPlatform === 'windows'
          ? 'Host C:\\ drive (/mnt/c) and Windows binary interop (powershell.exe/cmd.exe) are disabled in /etc/wsl.conf.'
          : 'Host ~/.ssh, ~/.aws, Keychain, and $HOME are physically not shared with the hypervisor.',
      status: config.zeroMountEnforced ? 'passed' : 'critical',
      mitigation:
        config.hostPlatform === 'windows'
          ? 'automount.enabled = false and interop.enabled = false enforced in launch-sandbox.sh.'
          : 'Verified in manifest (mounts: []). Guest filesystem is isolated on virtual disk.',
    },
    {
      id: 'hypervisor',
      category: 'Isolation',
      title: 'Hardware-Assisted Hypervisor (Ring -1)',
      description:
        config.hostPlatform === 'macos'
          ? 'Uses Apple Virtualization.framework (vz). No shared host kernel.'
          : config.hostPlatform === 'linux'
          ? 'Uses Incus KVM virtual machine (--vm --ephemeral). No shared host kernel.'
          : 'Uses Windows Hyper-V WSL2 VM with NAT networking and localhostForwarding=false.',
      status: 'passed',
      mitigation: 'Guest kernel panic or container escape inside guest cannot escape to host.',
    },
    {
      id: 'ram-disk',
      category: 'Storage',
      title: 'Volatile RAM Disk Workspace (tmpfs)',
      description: 'The agent workspace is mounted as tmpfs in volatile memory. Discarded automatically on exit.',
      status: 'passed',
      mitigation: `Layer 1 active: ${config.hardware.ramDiskSizeGb}GB tmpfs scratchpad with noatime,nosuid,nodev.`,
    },
    {
      id: 'dual-layer',
      category: 'Storage',
      title: 'Dual-Layer Hidden Persistence Barrier',
      description: 'Prevents workspace residues from surviving restarts while pre-baking runtimes for fast boot.',
      status: config.dualLayerStorage ? 'passed' : 'warning',
      mitigation:
        config.hostPlatform === 'linux'
          ? 'Incus --ephemeral destroys entire VM disk on stop.'
          : 'Base toolchains live in base layer; active /workspace and /run/agent live in tmpfs.',
    },
    {
      id: 'rfc1918',
      category: 'Network',
      title: 'RFC1918, VPN (100.64/10) & Multicast Block',
      description: 'Private LANs (10.0.0.0/8, 172.16/12, 192.168/16) and Tailscale/CGNAT (100.64.0.0/10) dropped.',
      status: config.firewall.blockRfc1918 ? 'passed' : 'critical',
      mitigation: config.firewall.blockRfc1918
        ? 'Enforced in firewall.sh (iptables OUTPUT DROP)'
        : 'Disabled: Agent can scan host LAN and VPN nodes! Re-enable in Egress Firewall.',
    },
    {
      id: 'metadata',
      category: 'Network',
      title: 'Link-Local & Cloud Metadata Blackhole (169.254.0.0/16)',
      description: 'Blocks entire link-local subnet including 169.254.169.254 to prevent credential exfiltration.',
      status: config.firewall.blockCloudMetadata ? 'passed' : 'warning',
      mitigation: config.firewall.blockCloudMetadata
        ? 'Enforced in firewall.sh (169.254.0.0/16 DROP)'
        : 'Disabled: Link-local and metadata endpoints are reachable.',
    },
    {
      id: 'ipv6',
      category: 'Network',
      title: 'Dual-Stack IPv6 Total Drop',
      description: 'ip6tables drops all IPv6 packets, preventing router auto-discovery LAN bypasses.',
      status: config.firewall.dropIpv6 ? 'passed' : 'warning',
      mitigation: config.firewall.dropIpv6
        ? 'ip6tables -P INPUT/FORWARD/OUTPUT DROP enforced'
        : 'Disabled: IPv6 traffic is unfiltered and may bypass IPv4 rules.',
    },
    {
      id: 'dns-lock',
      category: 'Network',
      title: 'DNS Tunneling & Host Resolver Lock',
      description: 'Port 53 outbound locked to 1.1.1.1 / 8.8.8.8; Lima hostResolver disabled.',
      status: config.firewall.restrictDns ? 'passed' : 'warning',
      mitigation: config.firewall.restrictDns
        ? 'DNS query lock active in firewall.sh & hostResolver.enabled: false'
        : 'Disabled: Unconstrained UDP/TCP 53 allows arbitrary DNS tunneling.',
    },
    {
      id: 'secret-pipe',
      category: 'Credentials',
      title: 'Transient In-Memory Secret Pipe',
      description: 'API keys stream via ssh -T into RAM tmpfs (/run/agent/agent.env) before PTY launch.',
      status: config.inMemorySecretPipe ? 'passed' : 'warning',
      mitigation: 'Keys are sourced and immediately unlinked; zero exposure in host ps aux or bash history.',
    },
    {
      id: 'agent-forwarding',
      category: 'Credentials',
      title: 'SSH Agent, X11 & Tunnel Forwarding Disabled',
      description: 'ForwardAgent no, ForwardX11 no, ClearAllForwardings yes, PermitLocalCommand no.',
      status: 'passed',
      mitigation: 'Guest cannot use host SSH keys or open reverse tunnels back to laptop.',
    },
    {
      id: 'sudo-confined',
      category: 'Agent Execution',
      title: 'Confined Guest Passwordless Sudo',
      description: 'Agent has root/sudo inside the guest VM without granting any host privileges.',
      status: 'passed',
      mitigation: 'Inside guest: uid 0 autonomy. Host laptop: strictly isolated.',
    },
    {
      id: 'nix-ld-bridge',
      category: 'Agent Execution',
      title: config.guestOs === 'nixos' ? 'NixOS nix-ld Dynamic Linker' : 'Ubuntu Standard glibc FHS',
      description:
        config.guestOs === 'nixos'
          ? 'programs.nix-ld intercepts unpatched binary execution, allowing Claude/Aider tools to run.'
          : 'Ubuntu standard /lib64 and /usr layout provides native binary compatibility.',
      status: 'passed',
      mitigation: 'Configured in guest OS profile; runtimes execute without ELF linker failures.',
    },
  ];

  const passedCount = auditItems.filter((i) => i.status === 'passed').length;
  const criticalCount = auditItems.filter((i) => i.status === 'critical').length;
  const warningCount = auditItems.filter((i) => i.status === 'warning').length;

  const simulationScenarios: BreakoutSimulationScenario[] = [
    {
      id: 'cred-theft',
      command: 'cat ~/.ssh/id_rsa || cat ~/.ssh/id_ed25519',
      targetRisk: 'Attempt to exfiltrate host SSH private keys',
      category: 'Credentials',
      resultBehavior: 'blocked',
      explanation:
        'Guest has zero mounts into host filesystem and SSH agent forwarding is disabled. Your personal host keys do not exist inside the guest.',
    },
    {
      id: 'fs-browse',
      command: 'ls /Users || ls /mnt/c/Users',
      targetRisk: 'Attempt to access host documents, codebases, or browser cookies',
      category: 'Host Leakage',
      resultBehavior: 'blocked',
      explanation:
        config.hostPlatform === 'windows'
          ? 'Because [automount] enabled = false and [interop] enabled = false are set in /etc/wsl.conf, /mnt/c and powershell.exe are unreachable.'
          : 'Because mounts: [] is configured, /Users does not exist in the guest. The agent only sees its local virtual disk and RAM scratchpad.',
    },
    {
      id: 'lan-probe',
      command: 'curl -m 2 http://192.168.1.1 || curl -m 2 http://100.64.0.1',
      targetRisk: 'Attempt to probe local router, NAS, or Tailscale/VPN nodes',
      category: 'Network',
      resultBehavior: config.firewall.blockRfc1918 ? 'blocked' : 'simulated-airgap',
      explanation: config.firewall.blockRfc1918
        ? 'The guest egress firewall drops all RFC1918 (192.168.0.0/16) and CGNAT/VPN (100.64.0.0/10) traffic before it leaves the VM.'
        : 'WARNING: RFC1918 blocking is currently DISABLED in Egress Firewall. An agent could probe your LAN and VPN nodes!',
    },
    {
      id: 'metadata-probe',
      command: 'curl -m 2 http://169.254.169.254/latest/meta-data/',
      targetRisk: 'Attempt to steal cloud IAM credentials via link-local address',
      category: 'Network',
      resultBehavior: config.firewall.blockCloudMetadata ? 'blocked' : 'simulated-airgap',
      explanation: config.firewall.blockCloudMetadata
        ? 'The entire 169.254.0.0/16 subnet is dropped in iptables. Requests time out immediately.'
        : 'WARNING: Cloud Metadata block is DISABLED in Egress Firewall.',
    },
    {
      id: 'rogue-rm',
      command: 'sudo rm -rf / --no-preserve-root',
      targetRisk: 'Catastrophic rogue agent destructive command',
      category: 'Filesystem',
      resultBehavior: 'trapped-in-ram',
      explanation:
        'The agent destroys only its internal RAM-disk and virtual guest disk. Your host laptop files remain 100% untouched; ./nuke-and-rebuild.sh respawns a clean VM.',
    },
    {
      id: 'kernel-probe',
      command: 'uname -a && cat /proc/version',
      targetRisk: 'Attempt to fingerprint or exploit host OS kernel',
      category: 'Isolation',
      resultBehavior: 'blocked',
      explanation:
        'The guest sees only its own virtualized Linux kernel running behind the hardware hypervisor boundary.',
    },
  ];

  const [activeScenarioId, setActiveScenarioId] = useState<string>(simulationScenarios[0].id);
  const [simulating, setSimulating] = useState(false);
  const [simOutput, setSimOutput] = useState<string | null>(null);

  const activeScenario =
    simulationScenarios.find((s) => s.id === activeScenarioId) || simulationScenarios[0];

  const verifyScript = generateVerifyScript(config);

  const handleCopyVerify = () => {
    navigator.clipboard.writeText(verifyScript);
    setCopiedVerify(true);
    setTimeout(() => setCopiedVerify(false), 2000);
  };

  const runSimulation = (scenario: BreakoutSimulationScenario) => {
    setActiveScenarioId(scenario.id);
    setSimulating(true);
    setSimOutput('[Policy Dry-Run] Evaluating configured manifest & firewall rules...');

    setTimeout(() => {
      setSimulating(false);
      switch (scenario.id) {
        case 'cred-theft':
          setSimOutput(
            `[SIMULATED OUTPUT — run ./verify-sandbox.sh on live VM for real probe]\n` +
              `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
              `cat: /home/agent/.ssh/id_rsa: No such file or directory\n` +
              `cat: /home/agent/.ssh/id_ed25519: No such file or directory\n` +
              `[RESULT]: Host laptop ~/.ssh is unmounted and SSH_AUTH_SOCK is unset.`
          );
          break;
        case 'fs-browse':
          setSimOutput(
            `[SIMULATED OUTPUT — run ./verify-sandbox.sh on live VM for real probe]\n` +
              `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
              `ls: cannot access '/Users': No such file or directory\n` +
              `ls: cannot access '/mnt/c/Users': No such file or directory\n` +
              `[RESULT]: ${
                config.hostPlatform === 'windows'
                  ? 'WSL automount=false & interop=false active.'
                  : 'mounts: [] enforced in hypervisor manifest.'
              }`
          );
          break;
        case 'lan-probe':
          setSimOutput(
            config.firewall.blockRfc1918
              ? `[SIMULATED OUTPUT — run ./verify-sandbox.sh on live VM for real probe]\n` +
                  `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
                  `curl: (28) Connection timed out after 2001 milliseconds\n` +
                  `[RESULT]: RFC1918 & 100.64.0.0/10 DROP rules block LAN and VPN access.`
              : `[SIMULATED OUTPUT — POLICY WARNING!]\n` +
                  `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
                  `HTTP/1.1 200 OK (192.168.1.1 reachable!)\n` +
                  `[FAILURE]: RFC1918 blocking is DISABLED in Egress Firewall.`
          );
          break;
        case 'metadata-probe':
          setSimOutput(
            config.firewall.blockCloudMetadata
              ? `[SIMULATED OUTPUT — run ./verify-sandbox.sh on live VM for real probe]\n` +
                  `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
                  `curl: (28) Connection timed out after 2001 milliseconds\n` +
                  `[RESULT]: 169.254.0.0/16 DROP rule blocks metadata endpoints.`
              : `[SIMULATED OUTPUT — POLICY WARNING!]\n` +
                  `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
                  `[FAILURE]: Cloud Metadata block is DISABLED in Egress Firewall.`
          );
          break;
        case 'rogue-rm':
          setSimOutput(
            `[SIMULATED OUTPUT — browser dry-run]\n` +
              `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
              `rm: wiping guest ${config.hardware.ramDiskSizeGb}GB tmpfs & virtual root...\n` +
              `[RESULT]: Contained inside guest VM. Host laptop untouched.\n` +
              `[RECOVERY]: Run ./nuke-and-rebuild.sh to recreate a fresh VM.`
          );
          break;
        case 'kernel-probe':
          setSimOutput(
            `[SIMULATED OUTPUT — browser dry-run]\n` +
              `agent@agent-sandbox:/workspace$ ${scenario.command}\n` +
              `Linux agent-sandbox 6.8.0-virt #1 SMP Linux\n` +
              `[RESULT]: Isolated guest kernel inside hypervisor boundary.`
          );
          break;
      }
    }, 350);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Policy Audit Score
            </span>
            <span
              className={`text-xs font-mono font-semibold ${
                criticalCount > 0
                  ? 'text-rose-400'
                  : warningCount > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {passedCount} / {auditItems.length} PASSED
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {criticalCount > 0 ? (
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            ) : warningCount > 0 ? (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            )}
            <span className="text-sm font-semibold text-white">
              {criticalCount > 0
                ? `${criticalCount} Critical Gap(s) Detected`
                : warningCount > 0
                ? `${warningCount} Policy Warning(s)`
                : 'Full MicroVM Jail Configured'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluated against your live config. Run <code className="text-cyan-300">./verify-sandbox.sh</code> on the VM for live proof.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Zero-Persistence Mode
            </span>
            <span className="text-xs font-mono text-cyan-400">{config.hardware.ramDiskSizeGb}GB tmpfs</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-cyan-400" />
            <span className="text-sm font-semibold text-white">RAM Scratchpad Active</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Workspace & secret pipe live in volatile memory; discarded on VM delete/reboot.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Network Confinement
            </span>
            <span
              className={`text-xs font-mono ${
                config.firewall.blockRfc1918 && config.firewall.dropIpv6
                  ? 'text-purple-400'
                  : 'text-amber-400'
              }`}
            >
              {config.firewall.blockRfc1918 && config.firewall.dropIpv6
                ? 'Dual-Stack Filter'
                : 'Reduced Isolation'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-400" />
            <span className="text-sm font-semibold text-white">
              {config.firewall.blockRfc1918 ? 'LAN & VPN Blocked' : 'LAN Exposed'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            RFC1918 + 100.64/10 {config.firewall.blockRfc1918 ? 'dropped' : 'unfiltered'}; IPv6{' '}
            {config.firewall.dropIpv6 ? 'blackholed' : 'open'}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 12-Checklist Column (6 Cols) */}
        <div className="xl:col-span-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Static Config Audit Checklist
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              {passedCount}/{auditItems.length} Passed
            </span>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {auditItems.map((item) => {
              const isCritical = item.status === 'critical';
              const isWarning = item.status === 'warning';

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg bg-slate-900 border space-y-1.5 ${
                    isCritical
                      ? 'border-rose-500/50'
                      : isWarning
                      ? 'border-amber-500/40'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isCritical ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 shrink-0">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-6">{item.description}</p>
                  <div
                    className={`text-[11px] font-mono pl-6 py-1 px-2 rounded border ${
                      isCritical
                        ? 'text-rose-300 bg-rose-950/30 border-rose-900/50'
                        : isWarning
                        ? 'text-amber-300 bg-amber-950/30 border-amber-900/50'
                        : 'text-emerald-400/90 bg-emerald-950/20 border-emerald-900/30'
                    }`}
                  >
                    {isCritical ? '✗ ' : isWarning ? '! ' : '✓ '}
                    {item.mitigation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Simulated Preview OR Live Verification Script (6 Cols) */}
        <div className="xl:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-md border border-slate-800">
              <button
                onClick={() => setRightMode('simulator')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  rightMode === 'simulator'
                    ? 'bg-slate-800 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Policy Simulator (Browser)
              </button>
              <button
                onClick={() => setRightMode('verify-script')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  rightMode === 'verify-script'
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live VM Probe (verify-sandbox.sh)
              </button>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {rightMode === 'simulator' ? 'Simulated Preview' : 'Real Executable Script'}
            </span>
          </div>

          {rightMode === 'simulator' ? (
            <>
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Browser-side policy dry-run reflecting your current settings. To run real probes inside the running MicroVM, switch to{' '}
                  <button
                    onClick={() => setRightMode('verify-script')}
                    className="text-emerald-400 underline cursor-pointer"
                  >
                    verify-sandbox.sh
                  </button>
                  .
                </p>

                <div className="space-y-2">
                  {simulationScenarios.map((sc) => {
                    const isSelected = activeScenario.id === sc.id;
                    return (
                      <button
                        key={sc.id}
                        onClick={() => runSimulation(sc)}
                        className={`w-full p-2.5 text-left rounded-md border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/20'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-slate-200 truncate">{sc.command}</span>
                          <span className="text-[10px] font-mono text-cyan-400 shrink-0">{sc.category}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{sc.targetRisk}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800">
                  <span className="text-[11px] font-mono text-slate-300">
                    Simulated Policy Dry-Run Output
                  </span>
                  <button
                    onClick={() => runSimulation(activeScenario)}
                    disabled={simulating}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Simulate</span>
                  </button>
                </div>

                <div className="p-4 font-mono text-xs leading-relaxed text-slate-300 min-h-40 bg-slate-950/60">
                  {simOutput ? (
                    <pre className="whitespace-pre-wrap">{simOutput}</pre>
                  ) : (
                    <div className="text-slate-500 italic">
                      Select a scenario above or click &quot;Simulate&quot; to preview how the configured policy handles it.
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-900/60 border-t border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-400">Policy Behavior: </span>
                    <span className="text-slate-300 leading-snug">{activeScenario.explanation}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-medium text-slate-200">
                    verify-sandbox.sh (Run on Host After ./launch-sandbox.sh)
                  </span>
                </div>
                <button
                  onClick={handleCopyVerify}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedVerify ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 max-h-[540px] overflow-auto font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/40">
                <pre className="whitespace-pre">{verifyScript}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
