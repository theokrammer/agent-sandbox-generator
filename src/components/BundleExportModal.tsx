import React, { useState } from 'react';
import { SandboxConfig } from '../types/sandbox';
import {
  generateLimaManifest,
  generateIncusManifest,
  generateWslManifest,
  generateNixFlake,
  generateCloudInitUbuntu,
  generateFirewallScript,
  generateSshClientConfig,
  generateLaunchScript,
  generateNukeScript,
  generateAgentLauncher,
  generateVerifyScript,
} from '../utils/generator';
import {
  X,
  FileCode,
  Copy,
  Check,
  Download,
  Terminal,
  FolderArchive,
  BookOpen,
} from 'lucide-react';

interface BundleExportModalProps {
  config: SandboxConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const BundleExportModal: React.FC<BundleExportModalProps> = ({
  config,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const manifest =
    config.hostPlatform === 'macos'
      ? generateLimaManifest(config)
      : config.hostPlatform === 'linux'
      ? generateIncusManifest(config)
      : generateWslManifest(config);

  const manifestName =
    config.hostPlatform === 'macos'
      ? 'lima-sandbox.yaml'
      : config.hostPlatform === 'linux'
      ? 'incus-sandbox.yaml'
      : '.wslconfig';

  const osConfig =
    config.guestOs === 'nixos' ? generateNixFlake(config) : generateCloudInitUbuntu(config);

  const osConfigName = config.guestOs === 'nixos' ? 'flake.nix' : 'cloud-init.yaml';
  const firewallScript = generateFirewallScript(config);
  const sshConfig = generateSshClientConfig();
  const launchScript = generateLaunchScript(config);
  const nukeScript = generateNukeScript(config);
  const geminiLauncher = generateAgentLauncher('gemini');
  const claudeLauncher = generateAgentLauncher('claude');
  const opencodeLauncher = generateAgentLauncher('opencode');
  const aiderLauncher = generateAgentLauncher('aider');
  const verifyScript = generateVerifyScript(config);

  const readme = `# AgentSandbox Quickstart Guide
Generated on: 2026-11-13
Host: ${config.hostPlatform.toUpperCase()} | Guest: ${config.guestOs.toUpperCase()}

## 1. Setup SSH Keypair & Config
Copy the snippet in ssh-agent.conf into your laptop's ~/.ssh/config.
Make sure you have an isolated key generated:
  ssh-keygen -t ed25519 -N "" -f ~/.ssh/agent_sandbox_ed25519

## 2. Launch & Verify the MicroVM
Run the 1-click launch script (zero host mounts by default), then verify isolation:
  chmod +x launch-sandbox.sh nuke-and-rebuild.sh verify-sandbox.sh firewall.sh launch-*.sh
  ./launch-sandbox.sh
  # Optional: pass a project path (mirror into RAM tmpfs by default, or read-only mount):
  # ./launch-sandbox.sh /path/to/repo
  # ./launch-sandbox.sh --mount-type mirror /path/to/repo
  # ./launch-sandbox.sh --mount-type ro /path/to/repo
  ./verify-sandbox.sh

## 3. Launch Your Autonomous Agent
Launch with forced PTY and in-memory secret pipe:
  ./launch-gemini.sh
  # or
  ./launch-claude.sh
  # or
  ./launch-opencode.sh
  # or
  ./launch-aider.sh

## 4. Recreate Anytime (Zero Persistence)
If an agent breaks anything or you want a fresh scratchpad:
  ./nuke-and-rebuild.sh
`;

  const files = [
    { name: manifestName, content: manifest, type: 'manifest' },
    { name: osConfigName, content: osConfig, type: 'os' },
    { name: 'launch-sandbox.sh', content: launchScript, type: 'script' },
    { name: 'verify-sandbox.sh', content: verifyScript, type: 'script' },
    { name: 'nuke-and-rebuild.sh', content: nukeScript, type: 'script' },
    { name: 'firewall.sh', content: firewallScript, type: 'firewall' },
    { name: 'ssh-agent.conf', content: sshConfig, type: 'config' },
    { name: 'launch-gemini.sh', content: geminiLauncher, type: 'launcher' },
    { name: 'launch-claude.sh', content: claudeLauncher, type: 'launcher' },
    { name: 'launch-opencode.sh', content: opencodeLauncher, type: 'launcher' },
    { name: 'launch-aider.sh', content: aiderLauncher, type: 'launcher' },
    { name: 'README.md', content: readme, type: 'docs' },
  ];

  const [selectedFileName, setSelectedFileName] = useState(files[0].name);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const selectedFile = files.find((f) => f.name === selectedFileName) || files[0];

  const handleCopy = (text: string, name: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(name);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const handleDownloadAllAsInstaller = () => {
    // Generate a single self-extracting bootstrap script containing all files
    let shellInstaller = `#!/bin/bash
# ==============================================================================
# AgentSandbox MicroVM Self-Extracting Installer
# Generated: 2026-11-06
# ==============================================================================
set -euo pipefail

DEST_DIR="\${1:-$HOME/agent-sandbox}"
mkdir -p "$DEST_DIR"
cd "$DEST_DIR"
echo "[AgentSandbox] Unpacking configuration into $DEST_DIR..."

`;

    files.forEach((f) => {
      shellInstaller += `cat << '__AGENT_SANDBOX_FILE_EOF__' > "${f.name}"
${f.content}
__AGENT_SANDBOX_FILE_EOF__
`;
      if (f.name.endsWith('.sh')) {
        shellInstaller += `chmod +x "${f.name}"\n`;
      }
    });

    shellInstaller += `
echo "✓ All files unpacked successfully."
echo "Run: cd $DEST_DIR && ./launch-sandbox.sh"
`;

    const blob = new Blob([shellInstaller], { type: 'application/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setup-agent-sandbox.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-[85vh] rounded-xl bg-slate-900 border border-slate-800 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <FolderArchive className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">AgentSandbox Complete Bundle</h2>
              <p className="text-xs text-slate-400">
                All manifests, egress firewalls, and PTY agent launchers ready for your laptop.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllAsInstaller}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download setup-agent-sandbox.sh</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* File List (4 Cols) */}
          <div className="col-span-4 bg-slate-950/60 border-r border-slate-800 p-3 space-y-1 overflow-y-auto">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-1">
              Bundle Files ({files.length})
            </div>
            {files.map((file) => {
              const isSelected = selectedFileName === file.name;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileName(file.name)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs font-mono transition-colors ${
                    isSelected
                      ? 'bg-slate-800 text-cyan-400 font-medium border border-slate-700/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </button>
              );
            })}
          </div>

          {/* File Content Preview (8 Cols) */}
          <div className="col-span-8 flex flex-col bg-slate-950/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 text-xs">
              <span className="font-mono text-slate-200 font-medium">{selectedFile.name}</span>
              <button
                onClick={() => handleCopy(selectedFile.content, selectedFile.name)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700 transition-colors cursor-pointer"
              >
                {copiedFile === selectedFile.name ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy File</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/50">
              <pre className="whitespace-pre">{selectedFile.content}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
