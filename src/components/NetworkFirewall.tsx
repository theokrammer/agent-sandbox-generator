import React, { useState } from 'react';
import { SandboxConfig } from '../types/sandbox';
import { generateFirewallScript } from '../utils/generator';
import {
  ShieldAlert,
  Globe,
  Radio,
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
} from 'lucide-react';

interface NetworkFirewallProps {
  config: SandboxConfig;
  onChange: (updated: Partial<SandboxConfig>) => void;
}

export const NetworkFirewall: React.FC<NetworkFirewallProps> = ({ config, onChange }) => {
  const [copied, setCopied] = useState(false);
  const [probeLog, setProbeLog] = useState<{ target: string; status: 'dropped' | 'allowed'; time: string }[]>([]);

  const fw = config.firewall;

  const handleToggle = (key: keyof typeof fw) => {
    onChange({
      firewall: {
        ...fw,
        [key]: !fw[key],
      },
    });
  };

  const firewallScript = generateFirewallScript(config);

  const handleCopy = () => {
    navigator.clipboard.writeText(firewallScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runProbe = (destination: string, type: 'lan' | 'metadata' | 'cgnat' | 'ipv6' | 'api' | 'pkg') => {
    let status: 'dropped' | 'allowed' = 'dropped';

    if (type === 'lan') {
      status = fw.blockRfc1918 ? 'dropped' : 'allowed';
    } else if (type === 'cgnat') {
      status = fw.blockRfc1918 ? 'dropped' : 'allowed';
    } else if (type === 'metadata') {
      status = fw.blockCloudMetadata ? 'dropped' : 'allowed';
    } else if (type === 'ipv6') {
      status = fw.dropIpv6 ? 'dropped' : 'allowed';
    } else if (type === 'api') {
      status = fw.whitelistGoogleApi ? 'allowed' : 'dropped';
    } else if (type === 'pkg') {
      status = fw.whitelistPackagist ? 'allowed' : 'dropped';
    }

    setProbeLog((prev) => [
      {
        target: destination,
        status,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 5),
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1">
            <Radio className="w-4 h-4 text-rose-400" />
            IPv6 Blackhole (DROP)
          </div>
          <p className="text-sm font-medium text-slate-200">Anti-Bypass Shield</p>
          <p className="text-xs text-slate-400 mt-1">
            ip6tables drops all IPv6 packets, preventing router auto-discovery LAN bypasses.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            RFC1918 & Metadata Drop
          </div>
          <p className="text-sm font-medium text-slate-200">Host Network Barrier</p>
          <p className="text-xs text-slate-400 mt-1">
            Blocks 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12 and cloud metadata 169.254.169.254.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <Globe className="w-4 h-4 text-cyan-400" />
            DNS Tunneling Lock
          </div>
          <p className="text-sm font-medium text-slate-200">Strict Upstream Resolvers</p>
          <p className="text-xs text-slate-400 mt-1">
            UDP/TCP 53 restricted strictly to 1.1.1.1 and 8.8.8.8. Local DNS exfiltration blocked.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Policy Controls (5 Cols) */}
        <div className="xl:col-span-5 space-y-5">
          {/* Isolation Rules */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Hardware Egress Drop Rules
            </label>

            <div className="space-y-2">
              {[
                {
                  id: 'dropIpv6' as const,
                  title: 'Block All IPv6 Egress (ip6tables DROP)',
                  desc: 'Eliminates rogue local link discovery and IPv6 router advertisement bypasses.',
                  active: fw.dropIpv6,
                },
                {
                  id: 'blockRfc1918' as const,
                  title: 'Block RFC1918 Private LANs',
                  desc: 'Drops 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (printers, NAS, host services).',
                  active: fw.blockRfc1918,
                },
                {
                  id: 'blockCloudMetadata' as const,
                  title: 'Block Cloud Metadata (169.254.169.254)',
                  desc: 'Blocks AWS/GCP IAM role token theft if developing in cloud-connected environments.',
                  active: fw.blockCloudMetadata,
                },
                {
                  id: 'restrictDns' as const,
                  title: 'Lock DNS to Public Resolvers (1.1.1.1, 8.8.8.8)',
                  desc: 'Blocks arbitrary DNS exfiltration tunneling through unauthorized recursive nameservers.',
                  active: fw.restrictDns,
                },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggle(item.id)}
                  className={`flex items-start justify-between p-3 rounded-md border cursor-pointer transition-all ${
                    item.active
                      ? 'bg-slate-800/80 border-cyan-500/80 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="pr-3">
                    <div className="text-xs font-semibold text-slate-200">{item.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
                  </div>
                  <div
                    className={`relative inline-flex h-4 w-8 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-1 ${
                      item.active ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${
                        item.active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Whitelisted Development Endpoints */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Whitelisted API & Package Endpoints
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'whitelistGoogleApi' as const, label: 'Google AI APIs', domain: 'generativelanguage.googleapis.com' },
                { id: 'whitelistAnthropic' as const, label: 'Anthropic API', domain: 'api.anthropic.com' },
                { id: 'whitelistOpenai' as const, label: 'OpenAI API', domain: 'api.openai.com' },
                { id: 'whitelistGithub' as const, label: 'GitHub & Git', domain: 'github.com, raw.githubusercontent.com' },
                { id: 'whitelistPackagist' as const, label: 'PHP Packagist', domain: 'repo.packagist.org' },
                { id: 'whitelistNpm' as const, label: 'npm Registry', domain: 'registry.npmjs.org' },
                { id: 'whitelistPypi' as const, label: 'Python PyPI', domain: 'pypi.org, pythonhosted.org' },
              ].map((w) => (
                <div
                  key={w.id}
                  onClick={() => handleToggle(w.id)}
                  className={`p-2 rounded border cursor-pointer transition-all ${
                    fw[w.id]
                      ? 'bg-slate-800/80 border-emerald-500/60'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">{w.label}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        fw[w.id] ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    ></span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{w.domain}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Probe Tester */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Interactive Egress Probe Tester
            </label>
            <p className="text-xs text-slate-400">
              Simulate network traffic leaving the MicroVM to verify firewall containment:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => runProbe('192.168.1.1 (Home Router)', 'lan')}
                className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-left font-mono text-[11px] text-slate-300 hover:text-white cursor-pointer"
              >
                Probe 192.168.1.1 (LAN)
              </button>
              <button
                onClick={() => runProbe('100.64.0.1 (Tailscale/VPN)', 'cgnat')}
                className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-left font-mono text-[11px] text-slate-300 hover:text-white cursor-pointer"
              >
                Probe 100.64.0.1 (VPN)
              </button>
              <button
                onClick={() => runProbe('169.254.169.254 (Metadata)', 'metadata')}
                className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-left font-mono text-[11px] text-slate-300 hover:text-white cursor-pointer"
              >
                Probe 169.254.169.254
              </button>
              <button
                onClick={() => runProbe('fe80::1 (IPv6 Link-Local)', 'ipv6')}
                className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-left font-mono text-[11px] text-slate-300 hover:text-white cursor-pointer"
              >
                Probe fe80::1 (IPv6)
              </button>
              <button
                onClick={() => runProbe('generativelanguage.googleapis.com', 'api')}
                className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-left font-mono text-[11px] text-slate-300 hover:text-white cursor-pointer"
              >
                Probe Google AI API
              </button>
              <button
                onClick={() => runProbe('packagist.org (PHP Composer)', 'pkg')}
                className="p-2 rounded bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-left font-mono text-[11px] text-slate-300 hover:text-white cursor-pointer"
              >
                Probe Packagist (PHP)
              </button>
            </div>

            {probeLog.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                {probeLog.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[11px] font-mono p-1.5 rounded bg-slate-950/80 border border-slate-800/80"
                  >
                    <span className="text-slate-300 truncate max-w-[200px]">{log.target}</span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${
                        log.status === 'dropped' ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {log.status === 'dropped' ? (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>BLOCKED (DROP)</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ALLOWED</span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Code Column (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
            <span className="text-xs font-mono font-medium text-slate-200">
              firewall-egress.sh (iptables & ip6tables Rules)
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 flex-1 overflow-x-auto font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/40">
            <pre className="whitespace-pre">{firewallScript}</pre>
          </div>

          <div className="flex items-center justify-between px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Dual-Stack Egress Protection Active
            </span>
            <span className="text-slate-500">Zero LAN Probe Infiltration</span>
          </div>
        </div>
      </div>
    </div>
  );
};
