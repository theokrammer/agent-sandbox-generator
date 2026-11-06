import React, { useState } from 'react';
import { SandboxConfig, AgentTool } from '../types/sandbox';
import { generateAgentLauncher, generateSshClientConfig } from '../utils/generator';
import {
  Key,
  Terminal,
  ShieldCheck,
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Cpu,
  Lock,
} from 'lucide-react';

interface AgentGatewayProps {
  config: SandboxConfig;
  onChange: (updated: Partial<SandboxConfig>) => void;
}

export const AgentGateway: React.FC<AgentGatewayProps> = ({ config, onChange }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentTool>(config.activeAgent || 'gemini');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [isSimulatingRun, setIsSimulatingRun] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '[Host] Ready to launch agent inside isolated MicroVM.',
    'Host files (~/.ssh, ~/.aws, Keychain) are physically inaccessible to the guest.',
  ]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const agentLauncherCode = generateAgentLauncher(selectedAgent);
  const sshConfigCode = generateSshClientConfig();

  const handleSimulateRun = () => {
    setIsSimulatingRun(true);
    setTerminalOutput([
      `[Host] Executing: ssh -tt agent-sandbox (Forced PTY Allocation)...`,
      `[Guest Hypervisor] Allocating virtual TTY (TERM=xterm-256color)...`,
      `[Guest] Checking /workspace... Mounted on tmpfs RAM-disk (${config.hardware.ramDiskSizeGb}GB volatile).`,
      `[Guest] Streaming API key to /run/agent/agent.env (in-memory secret pipe, 0 host disk leaks)...`,
      `[Guest] Launching agent: ${selectedAgent.toUpperCase()}...`,
      `[${selectedAgent.toUpperCase()}] Connected. Toolchains active: PHP/Composer, Node, Python, Rust, Go.`,
      `[${selectedAgent.toUpperCase()}] Ready for autonomous commands inside sandbox jail.`,
    ]);
  };

  const handleResetTerminal = () => {
    setIsSimulatingRun(false);
    setTerminalOutput([
      '[Host] Ready to launch agent inside isolated MicroVM.',
      'Host files (~/.ssh, ~/.aws, Keychain) are physically inaccessible to the guest.',
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <Terminal className="w-4 h-4 text-cyan-400" />
            PTY-Aware Launchers (-tt)
          </div>
          <p className="text-sm font-medium text-slate-200">Interactive TTY Terminal</p>
          <p className="text-xs text-slate-400 mt-1">
            Forces pseudo-terminal allocation so Claude Code, Gemini CLI, & Aider render rich ANSI UIs.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Lock className="w-4 h-4 text-emerald-400" />
            Transient Secret Pipe
          </div>
          <p className="text-sm font-medium text-slate-200">Memory-Only API Keys</p>
          <p className="text-xs text-slate-400 mt-1">
            Streams keys via RAM tmpfs. Zero exposure in host bash history or process tables (ps aux).
          </p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            ForwardAgent: No
          </div>
          <p className="text-sm font-medium text-slate-200">Host Keys Untouchable</p>
          <p className="text-xs text-slate-400 mt-1">
            SSH agent forwarding disabled. Guest agent cannot use host credentials to git push.
          </p>
        </div>
      </div>

      {/* Main Agent Selector Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Agent Profile Selector (4 Cols) */}
        <div className="xl:col-span-4 space-y-4">
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select AI Agent Tool
            </label>

            <div className="space-y-2">
              {[
                {
                  id: 'gemini',
                  name: 'Google Gemini CLI / Agy',
                  tag: 'Google AI Generative Language API',
                  desc: 'Modern Google AI terminal agent with in-memory GEMINI_API_KEY injection.',
                },
                {
                  id: 'opencode',
                  name: 'OpenCode CLI',
                  tag: 'Multi-Model Open Agent',
                  desc: 'Fast, open-source terminal coding agent with provider fallbacks.',
                },
                {
                  id: 'claude',
                  name: 'Claude Code CLI',
                  tag: 'Anthropic Autonomous Agent',
                  desc: '@anthropic-ai/claude-code with forced PTY and tmpfs workspace.',
                },
                {
                  id: 'aider',
                  name: 'Aider Pairing Agent',
                  tag: 'Git-Native Coding CLI',
                  desc: 'aider-chat terminal pair programming with git history isolation.',
                },
                {
                  id: 'cursor',
                  name: 'Cursor / VS Code Remote',
                  tag: 'IDE Hypervisor Tunnel',
                  desc: 'Connect Cursor editor directly to MicroVM via Remote-SSH.',
                },
              ].map((agent) => {
                const isSelected = selectedAgent === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgent(agent.id as AgentTool);
                      onChange({ activeAgent: agent.id as AgentTool });
                    }}
                    className={`w-full p-3 text-left rounded-md border transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/20'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-100">{agent.name}</span>
                      <span className="text-[10px] text-cyan-400 font-mono">{agent.tag}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{agent.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ephemeral Keypair Info */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                Ephemeral SSH Keypair
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">ed25519</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Never use your personal <code className="text-cyan-300">~/.ssh/id_ed25519</code>. The launch script automatically provisions a dedicated, throwaway key at <code className="text-cyan-300">~/.ssh/agent_sandbox_ed25519</code>.
            </p>
          </div>
        </div>

        {/* Script & Terminal Simulator (8 Cols) */}
        <div className="xl:col-span-8 space-y-5">
          {/* Launcher Script Box */}
          <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-medium text-slate-200">
                  launch-{selectedAgent}.sh (PTY-Aware + Transient Secret Pipe)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSimulateRun}
                  disabled={isSimulatingRun}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Test Run</span>
                </button>

                <button
                  onClick={() => handleCopy(agentLauncherCode, 'launcher')}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedSnippet === 'launcher' ? (
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
            </div>

            <div className="p-4 max-h-56 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/40">
              <pre className="whitespace-pre">{agentLauncherCode}</pre>
            </div>
          </div>

          {/* Interactive MicroVM Terminal Sandbox Simulation */}
          <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 ml-2">
                  guest@agent-sandbox: /workspace (tmpfs)
                </span>
              </div>

              <button
                onClick={handleResetTerminal}
                className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="p-4 font-mono text-xs leading-relaxed space-y-1 text-slate-300 min-h-36">
              {terminalOutput.map((line, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-cyan-400 select-none">&gt;</span>
                  <span
                    className={
                      line.includes('Host files')
                        ? 'text-emerald-400'
                        : line.includes('tmpfs') || line.includes('RAM')
                        ? 'text-cyan-300'
                        : line.includes('Connected')
                        ? 'text-emerald-300 font-semibold'
                        : 'text-slate-300'
                    }
                  >
                    {line}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-cyan-400 animate-pulse select-none pt-1">
                <span>&gt;</span>
                <span className="w-2 h-4 bg-cyan-400"></span>
              </div>
            </div>
          </div>

          {/* SSH Client Config Box */}
          <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
              <span className="text-xs font-mono font-medium text-slate-300">
                Host SSH Config Snippet (~/.ssh/config)
              </span>
              <button
                onClick={() => handleCopy(sshConfigCode, 'ssh')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700 transition-colors cursor-pointer"
              >
                {copiedSnippet === 'ssh' ? (
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
            <div className="p-4 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/40">
              <pre className="whitespace-pre">{sshConfigCode}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
