/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SandboxConfig, ActiveTab } from './types/sandbox';
import { TopBar } from './components/TopBar';
import { MicroVmConfigurator } from './components/MicroVmConfigurator';
import { AgentGateway } from './components/AgentGateway';
import { NetworkFirewall } from './components/NetworkFirewall';
import { SecurityAuditLab } from './components/SecurityAuditLab';
import { ArchitectureStorageView } from './components/ArchitectureStorageView';
import { BundleExportModal } from './components/BundleExportModal';
import { ShieldCheck, Layers, Terminal } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('configurator');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [config, setConfig] = useState<SandboxConfig>({
    hostPlatform: 'macos',
    guestOs: 'ubuntu',
    hardware: {
      cpus: 4,
      memoryGb: 4,
      diskGb: 20,
      ramDiskSizeGb: 4,
    },
    toolchains: {
      php: true,
      phpComposer: true,
      node: true,
      python: true,
      rust: true,
      go: true,
      gitUtilities: true,
    },
    snapshotLock: false,
    activeAgent: 'gemini',
    firewall: {
      dropIpv6: true,
      blockRfc1918: true,
      blockCloudMetadata: true,
      restrictDns: true,
      whitelistGoogleApi: true,
      whitelistAnthropic: true,
      whitelistOpenai: true,
      whitelistGithub: true,
      whitelistPackagist: true,
      whitelistNpm: true,
      whitelistPypi: true,
    },
    zeroMountEnforced: true,
    dualLayerStorage: true,
    ptyAllocated: true,
    inMemorySecretPipe: true,
  });

  const handleConfigChange = (updated: Partial<SandboxConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 3-Zone Top Bar */}
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* Contextual Sub-bar */}
      <div className="bg-slate-900/40 border-b border-slate-800/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3 text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Host: <span className="text-white capitalize">{config.hostPlatform}</span>
          </span>
          <span className="text-slate-600">/</span>
          <span>
            Guest: <span className="text-cyan-400 font-medium">{config.guestOs === 'nixos' ? 'NixOS + nix-ld' : 'Ubuntu LTS (Latest)'}</span>
          </span>
          <span className="text-slate-600">/</span>
          <span>
            Workspace: <span className="text-emerald-400 font-medium">{config.hardware.ramDiskSizeGb}GB RAM (tmpfs)</span>
          </span>
          <span className="text-slate-600">/</span>
          <span>
            Mounts: <span className="text-purple-400 font-medium">0 Host Folders</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Hypervisor Ring -1
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Dual-Layer Storage
          </span>
        </div>
      </div>

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {activeTab === 'configurator' && (
          <MicroVmConfigurator config={config} onChange={handleConfigChange} />
        )}

        {activeTab === 'gateway' && (
          <AgentGateway config={config} onChange={handleConfigChange} />
        )}

        {activeTab === 'firewall' && (
          <NetworkFirewall config={config} onChange={handleConfigChange} />
        )}

        {activeTab === 'audit' && (
          <SecurityAuditLab config={config} />
        )}

        {activeTab === 'architecture' && (
          <ArchitectureStorageView config={config} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>AgentSandbox Orchestrator</span>
          <span>·</span>
          <span>Zero-Persistence MicroVM Engine</span>
          <span>·</span>
          <span>Hardware Hypervisor Boundary</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <button
            onClick={() => setActiveTab('audit')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Audit Checklist (12/12)
          </button>
          <span>·</span>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Export Scripts
          </button>
        </div>
      </footer>

      {/* Export Bundle Modal */}
      <BundleExportModal
        config={config}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
