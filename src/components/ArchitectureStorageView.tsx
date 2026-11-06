import React from 'react';
import { SandboxConfig } from '../types/sandbox';
import {
  Layers,
  HardDrive,
  Cpu,
  ShieldCheck,
  Zap,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface ArchitectureStorageViewProps {
  config: SandboxConfig;
}

export const ArchitectureStorageView: React.FC<ArchitectureStorageViewProps> = ({ config }) => {
  return (
    <div className="space-y-6">
      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Hardware Hypervisor (Ring -1)
          </div>
          <p className="text-sm font-medium text-slate-200">Independent Memory Pages</p>
          <p className="text-xs text-slate-400 mt-1">
            Uses native CPU hardware virtualization. No host kernel syscalls are shared.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Layers className="w-4 h-4 text-emerald-400" />
            Dual-Layer Storage Strategy
          </div>
          <p className="text-sm font-medium text-slate-200">Zero State Residue + Fast Boot</p>
          <p className="text-xs text-slate-400 mt-1">
            Separates volatile agent scratchpads (RAM tmpfs) from immutable base runtimes.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">
            <RotateCcw className="w-4 h-4 text-purple-400" />
            5-Second Nuke & Rebuild
          </div>
          <p className="text-sm font-medium text-slate-200">Instant Recreation</p>
          <p className="text-xs text-slate-400 mt-1">
            Whenever anything breaks or an agent corrupts files, one command respawns a pristine VM.
          </p>
        </div>
      </div>

      {/* Visual System Diagram */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          System Isolation & Storage Layout
        </h3>

        <div className="p-4 rounded-md bg-slate-950 border border-slate-800 font-mono text-xs leading-relaxed text-slate-300 overflow-x-auto">
          <pre className="whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       HARDENED LIGHTWEIGHT MICROVM ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  HOST LAPTOP (macOS / Linux / Windows 11)                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Host Protected Space: ~/.ssh, ~/.aws, Keychain, Browser Sessions, Host LAN            │  │
│  │ ZERO MOUNT ENFORCEMENT: mounts: [] (Lima) | automount = false (WSL2)                  │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                                 │
│                     HARDWARE HYPERVISOR BOUNDARY (VT-x / AMD-V / ARM EL2)                   │
│                     (Apple Virtualization.framework / Linux KVM / Windows Hyper-V)          │
│                                           │                                                 │
│  ┌────────────────────────────────────────▼──────────────────────────────────────────────┐  │
│  │ GUEST MICROVM (Isolated RAM & CPU Cores, Ephemeral Disks, No Host Mounts)              │  │
│  │                                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ LAYER 1: ACTIVE SCRATCHPAD (Volatile tmpfs RAM Disk on /workspace)               │  │  │
│  │  │ • 100% in RAM · Ephemeral · Auto-purged upon shutdown · Zero host disk residue    │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ LAYER 2: IMMUTABLE BASE OS & RUNTIMES (<3s Boot, Read-Only /nix or /usr)         │  │  │
│  │  │ • PHP + Composer, Node.js, Python, Rust, Go pre-baked into base image             │  │  │
│  │  │ • Eliminates multi-gigabyte re-download delays while preventing state pollution  │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘`}
          </pre>
        </div>
      </div>

      {/* Dual Storage Deep Dive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Layer 1 */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-xs">
              L1
            </span>
            <h4 className="text-sm font-semibold text-slate-100">
              Layer 1: Volatile Workspace Scratchpad (tmpfs)
            </h4>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            The agent operates exclusively inside a RAM-disk mounted at <code className="text-cyan-300">/workspace</code> with flags <code className="text-cyan-300">noatime,nosuid</code>.
          </p>

          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Pure RAM performance</strong>: Compilation, tests, and temporary file churn happen directly in memory without wearing out your laptop&apos;s SSD.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Absolute zero-persistence</strong>: If an agent writes sensitive data, clones a repository, or catches malware, shutting down the VM instantly purges all memory sectors.</span>
            </li>
          </ul>
        </div>

        {/* Layer 2 */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-xs">
              L2
            </span>
            <h4 className="text-sm font-semibold text-slate-100">
              Layer 2: Immutable Base Image & Runtimes
            </h4>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Eliminates the &quot;hidden persistence trap&quot; where package caches accumulate, or the opposite trap where every restart takes 10 minutes to download compilers.
          </p>

          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span><strong>Instant &lt;3s startup</strong>: Core runtimes (PHP, Composer, Node, Python, Rust, Go) are already present in the read-only base layer.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span><strong>NixOS &quot;Erase-Your-Darlings&quot;</strong>: Root (/) is mounted on tmpfs; only the cryptographic, immutable /nix/store is mounted read-only.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Ubuntu vs NixOS Comparison Table */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Guest OS Engine Deep-Dive: Ubuntu LTS vs. NixOS
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="pb-2.5 font-medium">Evaluation Criterion</th>
                <th className="pb-2.5 font-medium text-cyan-400">Ubuntu LTS (Latest Noble)</th>
                <th className="pb-2.5 font-medium text-purple-400">NixOS + nix-ld (Latest Flake)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Filesystem Layout</td>
                <td className="py-2.5">Standard FHS (/usr, /lib64, /bin, /etc)</td>
                <td className="py-2.5">Non-FHS; symlinked /nix/store with tmpfs root</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Agent Compatibility</td>
                <td className="py-2.5 text-emerald-400 font-medium">100% Native (Out of the box)</td>
                <td className="py-2.5 text-cyan-300">Requires nix-ld for unpatched binaries</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Package Management</td>
                <td className="py-2.5">Standard apt-get install (universally understood by LLMs)</td>
                <td className="py-2.5">Declarative flake.nix / nix-shell</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Zero-Persistence Mechanism</td>
                <td className="py-2.5">Ephemeral RAM overlayfs on /workspace</td>
                <td className="py-2.5 text-emerald-400 font-medium">Native tmpfs root (&quot;erase-your-darlings&quot;)</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Determinism & Rollback</td>
                <td className="py-2.5">Image snapshot rollback</td>
                <td className="py-2.5 text-emerald-400 font-medium">Mathematical bit-for-bit reproducibility</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Best Suited For</td>
                <td className="py-2.5">Frictionless agent development with standard apt packages</td>
                <td className="py-2.5">Maximum immutability, tamper-resistance, and clean rebuilds</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
