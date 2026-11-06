import React, { useState } from 'react';
import { SandboxConfig, HostPlatform, GuestOs } from '../types/sandbox';
import {
  generateLimaManifest,
  generateIncusManifest,
  generateWslManifest,
  generateNixFlake,
  generateCloudInitUbuntu,
  generateLaunchScript,
  generateNukeScript,
} from '../utils/generator';
import {
  Check,
  Copy,
  Cpu,
  HardDrive,
  ShieldAlert,
  Sparkles,
  Layers,
  Terminal,
} from 'lucide-react';

interface ConfiguratorProps {
  config: SandboxConfig;
  onChange: (updated: Partial<SandboxConfig>) => void;
}

export const MicroVmConfigurator: React.FC<ConfiguratorProps> = ({ config, onChange }) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'manifest' | 'osConfig' | 'launch' | 'nuke'>('manifest');
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const currentManifest =
    config.hostPlatform === 'macos'
      ? generateLimaManifest(config)
      : config.hostPlatform === 'linux'
      ? generateIncusManifest(config)
      : generateWslManifest(config);

  const manifestFileName =
    config.hostPlatform === 'macos'
      ? 'lima-sandbox.yaml'
      : config.hostPlatform === 'linux'
      ? 'incus-sandbox.yaml'
      : '.wslconfig';

  const osConfig =
    config.guestOs === 'nixos' ? generateNixFlake(config) : generateCloudInitUbuntu(config);

  const osConfigFileName = config.guestOs === 'nixos' ? 'flake.nix' : 'cloud-init.yaml';
  const launchScript = generateLaunchScript(config);
  const nukeScript = generateNukeScript(config);

  const getActiveCode = () => {
    switch (activeCodeTab) {
      case 'manifest':
        return { code: currentManifest, name: manifestFileName };
      case 'osConfig':
        return { code: osConfig, name: osConfigFileName };
      case 'launch':
        return { code: launchScript, name: 'launch-sandbox.sh' };
      case 'nuke':
        return { code: nukeScript, name: 'nuke-and-rebuild.sh' };
    }
  };

  const activeSnippet = getActiveCode();

  return (
    <div className="space-y-6">
      {/* Overview & Security Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            Hardware Hypervisor
          </div>
          <p className="text-sm font-medium text-slate-200">Independent Guest Kernel</p>
          <p className="text-xs text-slate-400 mt-1">
            Ring -1 virtualization boundary. Zero shared host kernel vulnerabilities.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Layers className="w-4 h-4 text-emerald-400" />
            Dual-Layer Storage
          </div>
          <p className="text-sm font-medium text-slate-200">RAM-Disk /workspace</p>
          <p className="text-xs text-slate-400 mt-1">
            Immutable base runtimes + volatile tmpfs workspace. Zero disk state residue.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">
            <HardDrive className="w-4 h-4 text-purple-400" />
            Zero Host Mounts
          </div>
          <p className="text-sm font-medium text-slate-200">Host Files Physically Blocked</p>
          <p className="text-xs text-slate-400 mt-1">
            mounts: [] enforced. No access to ~/.ssh, ~/.aws, or host files.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Control Column (5 Cols) */}
        <div className="xl:col-span-5 space-y-5">
          {/* 1. Host Platform */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              1. Host Platform (Your Laptop)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'macos', label: 'macOS', desc: 'Lima (Apple VZ)' },
                { id: 'linux', label: 'Linux', desc: 'Incus / KVM' },
                { id: 'windows', label: 'Windows 11', desc: 'Isolated WSL2' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => onChange({ hostPlatform: p.id as HostPlatform })}
                  className={`p-2.5 text-left rounded-md border transition-all ${
                    config.hostPlatform === p.id
                      ? 'bg-slate-800 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold">{p.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Guest OS Engine */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                2. Guest OS Engine
              </label>
              <span className="text-[10px] text-cyan-400 font-mono">Dual-Engine Support</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onChange({ guestOs: 'ubuntu' })}
                className={`p-3 text-left rounded-md border transition-all ${
                  config.guestOs === 'ubuntu'
                    ? 'bg-slate-800 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold text-slate-100">Ubuntu LTS (Latest)</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Standard FHS & glibc. Agents run sudo apt-get without special wrappers.
                </div>
              </button>

              <button
                onClick={() => onChange({ guestOs: 'nixos' })}
                className={`p-3 text-left rounded-md border transition-all ${
                  config.guestOs === 'nixos'
                    ? 'bg-slate-800 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold text-slate-100">NixOS + nix-ld</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Erase-your-darlings tmpfs root + nix-ld for unpatched binaries.
                </div>
              </button>
            </div>
          </div>

          {/* 3. Hardware Resources */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              3. MicroVM Resources & RAM-Disk
            </label>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-mono">
                  <span>Virtual CPU Cores</span>
                  <span className="font-semibold text-cyan-400">{config.hardware.cpus} Cores</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="1"
                  value={config.hardware.cpus}
                  onChange={(e) =>
                    onChange({
                      hardware: { ...config.hardware, cpus: parseInt(e.target.value) },
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-mono">
                  <span>Dedicated RAM</span>
                  <span className="font-semibold text-cyan-400">{config.hardware.memoryGb} GB</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="2"
                  value={config.hardware.memoryGb}
                  onChange={(e) =>
                    onChange({
                      hardware: { ...config.hardware, memoryGb: parseInt(e.target.value) },
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-mono">
                  <span>RAM Scratchpad Size (/workspace)</span>
                  <span className="font-semibold text-emerald-400">
                    {config.hardware.ramDiskSizeGb} GB tmpfs
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={config.hardware.ramDiskSizeGb}
                  onChange={(e) =>
                    onChange({
                      hardware: { ...config.hardware, ramDiskSizeGb: parseInt(e.target.value) },
                    })
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500">
                  Backed by host memory; wipes completely on shutdown.
                </span>
              </div>
            </div>
          </div>

          {/* 4. Dynamic Toolchains */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                4. Pre-installed Toolchains
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Snapshot Lock</span>
                <button
                  onClick={() => onChange({ snapshotLock: !config.snapshotLock })}
                  className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    config.snapshotLock ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${
                      config.snapshotLock ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* PHP + Composer */}
              <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={config.toolchains.php}
                  onChange={(e) =>
                    onChange({
                      toolchains: {
                        ...config.toolchains,
                        php: e.target.checked,
                        phpComposer: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-medium text-slate-200">PHP & Composer</div>
                  <div className="text-[10px] text-slate-500">Latest 8.x + Core Exts</div>
                </div>
              </label>

              {/* Node.js */}
              <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={config.toolchains.node}
                  onChange={(e) =>
                    onChange({
                      toolchains: { ...config.toolchains, node: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-medium text-slate-200">Node.js & npm/pnpm</div>
                  <div className="text-[10px] text-slate-500">Current / Active LTS</div>
                </div>
              </label>

              {/* Python */}
              <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={config.toolchains.python}
                  onChange={(e) =>
                    onChange({
                      toolchains: { ...config.toolchains, python: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-medium text-slate-200">Python 3 + venv</div>
                  <div className="text-[10px] text-slate-500">Latest Stable + pip</div>
                </div>
              </label>

              {/* Rust */}
              <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={config.toolchains.rust}
                  onChange={(e) =>
                    onChange({
                      toolchains: { ...config.toolchains, rust: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-medium text-slate-200">Rust & Cargo</div>
                  <div className="text-[10px] text-slate-500">Stable channel</div>
                </div>
              </label>

              {/* Go */}
              <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={config.toolchains.go}
                  onChange={(e) =>
                    onChange({
                      toolchains: { ...config.toolchains, go: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-medium text-slate-200">Go Language</div>
                  <div className="text-[10px] text-slate-500">Latest Stable</div>
                </div>
              </label>

              {/* Git & CLI Tools */}
              <label className="flex items-center gap-2 p-2 rounded bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={config.toolchains.gitUtilities}
                  onChange={(e) =>
                    onChange({
                      toolchains: { ...config.toolchains, gitUtilities: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <div>
                  <div className="font-medium text-slate-200">Git, ripgrep, fzf</div>
                  <div className="text-[10px] text-slate-500">CLI developer tools</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Code Preview Column (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
          {/* Manifest Tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveCodeTab('manifest')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  activeCodeTab === 'manifest'
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {manifestFileName}
              </button>
              <button
                onClick={() => setActiveCodeTab('osConfig')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  activeCodeTab === 'osConfig'
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {osConfigFileName}
              </button>
              <button
                onClick={() => setActiveCodeTab('launch')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  activeCodeTab === 'launch'
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                launch-sandbox.sh
              </button>
              <button
                onClick={() => setActiveCodeTab('nuke')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  activeCodeTab === 'nuke'
                    ? 'bg-slate-800 text-rose-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                nuke-and-rebuild.sh
              </button>
            </div>

            <button
              onClick={() => handleCopy(activeSnippet.code, activeSnippet.name)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700 transition-colors cursor-pointer"
            >
              {copied === activeSnippet.name ? (
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

          {/* Code Viewer */}
          <div className="p-4 flex-1 overflow-x-auto font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/40">
            <pre className="whitespace-pre">{activeSnippet.code}</pre>
          </div>

          {/* Status footer inside code viewer */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Isolation: Hardware Hypervisor (ring -1)
            </span>
            <span className="text-slate-500">
              Ephemeral tmpfs · Zero Disk Persistence
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
