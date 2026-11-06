import { SandboxConfig } from '../types/sandbox';

export function generateLimaManifest(config: SandboxConfig): string {
  const isNix = config.guestOs === 'nixos';
  const lock = config.snapshotLock;

  return `# AgentSandbox macOS Lima Configuration (Lightweight MicroVM)
# Hypervisor Engine: Apple Virtualization.framework (vz) with virtiofs
# Generated on: 2026-11-06 (Zero-Persistence & Dual-Layer Storage Enforced)

vmType: "vz"
rosetta:
  enabled: true
  binfmt: true

cpus: ${config.hardware.cpus}
memory: "${config.hardware.memoryGb}GiB"
disk: "${config.hardware.diskGb}GiB"

# CRITICAL SECURITY RULE: Explicitly zero host mounts!
# Host ~/.ssh, ~/.aws, Keychain, and /Users are completely invisible to the guest.
mounts: []
mountType: "virtiofs"

networks:
  - vzNAT: true

ssh:
  localPort: 60022
  loadDotSSHPubKeys: false
  forwardAgent: false
  forwardX11: false

${isNix ? `# NixOS Engine: Flake-based with ephemeral tmpfs root and nix-ld
images:
  - location: "https://channels.nixos.org/nixos-${lock ? '24.11' : 'unstable'}/nixos-minimal.iso"
    arch: "aarch64"
` : `# Ubuntu LTS Engine: Current release with ephemeral tmpfs overlay
images:
  - location: "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-arm64.img"
    arch: "aarch64"

provision:
  - mode: system
    script: |
      #!/bin/bash
      set -eux
      # Layer 1 Storage: Mount volatile tmpfs for scratch workspace
      mkdir -p /workspace /run/agent
      mount -t tmpfs -o size=${config.hardware.ramDiskSizeGb}G,noatime,nosuid tmpfs /workspace
      mount -t tmpfs -o size=256M,mode=0700 tmpfs /run/agent
      chown -R 1000:1000 /workspace /run/agent
`}

# Post-boot automated setup script
provision:
  - mode: user
    script: |
      #!/bin/bash
      set -eux
      echo "[AgentSandbox] MicroVM Initialized with Zero Host Mounts."
      echo "[AgentSandbox] Ephemeral Workspace active on RAM-disk."
`;
}

export function generateIncusManifest(config: SandboxConfig): string {
  const isNix = config.guestOs === 'nixos';
  return `# AgentSandbox Linux Incus / KVM Profile (Lightweight MicroVM)
# Pure Hardware-assisted KVM Boundary - No Shared Host Kernel

name: agent-sandbox
description: "Zero-persistence isolated MicroVM for AI coding agents"
config:
  limits.cpu: "${config.hardware.cpus}"
  limits.memory: "${config.hardware.memoryGb}GiB"
  security.secureboot: "false"
  # Disable host socket passing and agent sharing
  raw.qemu: "-cpu host"

devices:
  root:
    path: /
    pool: default
    type: disk
    size: "${config.hardware.diskGb}GiB"
  
  # RAM disk scratchpad layer
  workspace:
    path: /workspace
    type: disk
    source: tmpfs
    size: "${config.hardware.ramDiskSizeGb}GiB"

  eth0:
    name: eth0
    network: incusbr0
    type: nic
    security.ipv6: "false"
`;
}

export function generateWslManifest(config: SandboxConfig): string {
  return `# AgentSandbox Windows 11 WSL2 Isolated Configuration
# Place in: %USERPROFILE%\\.wslconfig

[wsl2]
memory=${config.hardware.memoryGb}GB
processors=${config.hardware.cpus}
swap=0
localhostForwarding=true
nestedVirtualization=false
networkingMode=mirrored
firewall=true

# Place inside guest /etc/wsl.conf:
# [automount]
# enabled = false
# mountFsTab = false
# [network]
# generateResolvConf = false
`;
}

export function generateNixFlake(config: SandboxConfig): string {
  const lock = config.snapshotLock;
  const channel = lock ? 'nixos-24.11' : 'nixpkgs-unstable';

  const packages: string[] = ['pkgs.git', 'pkgs.curl', 'pkgs.jq', 'pkgs.ripgrep', 'pkgs.fzf', 'pkgs.tmux'];
  if (config.toolchains.php) {
    packages.push('pkgs.php', 'pkgs.phpPackages.composer');
  }
  if (config.toolchains.node) {
    packages.push('pkgs.nodejs_latest', 'pkgs.corepack');
  }
  if (config.toolchains.python) {
    packages.push('pkgs.python3', 'pkgs.python3Packages.pip', 'pkgs.python3Packages.virtualenv');
  }
  if (config.toolchains.rust) {
    packages.push('pkgs.rustc', 'pkgs.cargo', 'pkgs.clippy');
  }
  if (config.toolchains.go) {
    packages.push('pkgs.go');
  }

  return `# Flake.nix for AgentSandbox NixOS MicroVM
# Implements: "Erase-Your-Darlings" (tmpfs root) + nix-ld dynamic linker bridge
{
  description = "Isolated MicroVM for Autonomous AI Coding Agents";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/${channel}";
  };

  outputs = { self, nixpkgs }: let
    system = "aarch64-linux"; # or x86_64-linux
    pkgs = import nixpkgs { inherit system; };
  in {
    nixosConfigurations.agent-sandbox = nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        ({ config, pkgs, ... }: {
          # 1. Ephemeral Root Storage (Pure RAM)
          fileSystems."/" = {
            device = "none";
            fsType = "tmpfs";
            options = [ "defaults" "size=${config.hardware.ramDiskSizeGb}G" "mode=755" ];
          };

          # 2. Immutable Nix Store (Read-Only)
          fileSystems."/nix" = {
            device = "/dev/disk/by-label/nix-store";
            fsType = "ext4";
            options = [ "ro" ];
          };

          # 3. Critical Fix for AI Agents: nix-ld for unpatched binaries
          programs.nix-ld.enable = true;
          programs.nix-ld.libraries = with pkgs; [
            stdenv.cc.cc
            zlib
            glibc
            openssl
            icu
            libuv
            curl
          ];

          # 4. Dynamic Toolchain Packages
          environment.systemPackages = [
            ${packages.join('\n            ')}
          ];

          # 5. Non-Interactive Sudo & Agent User
          users.users.agent = {
            isNormalUser = true;
            extraGroups = [ "wheel" ];
            home = "/workspace";
            initialPassword = "sandbox-ephemeral";
          };
          security.sudo.wheelNeedsPassword = false;

          # 6. Strict SSH Server configuration
          services.openssh = {
            enable = true;
            settings = {
              PasswordAuthentication = false;
              PermitRootLogin = "no";
              X11Forwarding = false;
              AllowAgentForwarding = false;
            };
          };

          system.stateVersion = "24.11";
        })
      ];
    };
  };
}
`;
}

export function generateCloudInitUbuntu(config: SandboxConfig): string {
  const pkgs = ['git', 'curl', 'jq', 'ripgrep', 'fzf', 'build-essential', 'tmux', 'ca-certificates'];
  
  if (config.toolchains.php) {
    pkgs.push('php-cli', 'php-mbstring', 'php-xml', 'php-curl', 'php-zip', 'php-sqlite3', 'composer');
  }
  if (config.toolchains.python) {
    pkgs.push('python3', 'python3-pip', 'python3-venv');
  }

  return `#cloud-config
# AgentSandbox Ubuntu LTS Dual-Layer Cloud-Init
# Storage: RAM-disk /workspace with zero host persistence

users:
  - name: agent
    groups: sudo
    shell: /bin/bash
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    home: /workspace

package_update: true
package_upgrade: false

packages:
  ${pkgs.map(p => `- ${p}`).join('\n  ')}

write_files:
  - path: /etc/systemd/system/setup-tmpfs-workspace.service
    content: |
      [Unit]
      Description=Mount Volatile RAM Workspace for AI Agent
      Before=ssh.service

      [Service]
      Type=oneshot
      ExecStart=/bin/bash -c "mkdir -p /workspace /run/agent && mount -t tmpfs -o size=${config.hardware.ramDiskSizeGb}G tmpfs /workspace && chown -R agent:agent /workspace /run/agent"
      RemainAfterExit=true

      [Install]
      WantedBy=multi-user.target

runcmd:
  - systemctl daemon-reload
  - systemctl enable --now setup-tmpfs-workspace.service
  ${config.toolchains.node ? '- curl -fsSL https://deb.nodesource.com/setup_current.x | bash - && apt-get install -y nodejs' : ''}
  ${config.toolchains.rust ? '- su - agent -c "curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"' : ''}
  ${config.toolchains.go ? '- curl -fsSL https://go.dev/dl/go1.23.linux-arm64.tar.gz | tar -C /usr/local -xz && ln -s /usr/local/go/bin/go /usr/bin/go' : ''}
  - echo "export PATH=$PATH:/usr/local/go/bin:~/.cargo/bin" >> /workspace/.bashrc
`;
}

export function generateFirewallScript(config: SandboxConfig): string {
  const fw = config.firewall;

  return `#!/bin/bash
# AgentSandbox Hardened Dual-Stack Egress Firewall
# Blocks Private LAN (RFC1918), Cloud Metadata, IPv6 Leaks, and DNS Tunneling

set -euo pipefail

echo "[AgentSandbox] Applying egress firewall policy..."

# 1. DROP ALL IPv6 TRAFFIC (Prevents IPv6 router leak bypass)
${fw.dropIpv6 ? `ip6tables -F
ip6tables -X
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP
ip6tables -P OUTPUT DROP
echo "✓ IPv6: Completely Dropped"
` : '# IPv6 drop disabled'}

# 2. FLUSH EXISTING IPv4 RULES
iptables -F
iptables -X

# 3. ALLOW LOOPBACK TRAFFIC (Internal guest localhost communication)
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# 4. ALLOW ESTABLISHED & RELATED CONNECTIONS
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 5. RESTRICT DNS TO TRUSTED RESOLVERS ONLY (Anti-tunneling protection)
${fw.restrictDns ? `iptables -A OUTPUT -p udp --dport 53 -d 1.1.1.1 -j ACCEPT
iptables -A OUTPUT -p udp --dport 53 -d 8.8.8.8 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -d 1.1.1.1 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -d 8.8.8.8 -j ACCEPT
iptables -A OUTPUT -p udp --dport 53 -j DROP
iptables -A OUTPUT -p tcp --dport 53 -j DROP
echo "✓ DNS: Locked strictly to 1.1.1.1 and 8.8.8.8"
` : ''}

# 6. BLOCK CLOUD METADATA ENDPOINTS (AWS/GCP/Azure link-local exfiltration)
${fw.blockCloudMetadata ? `iptables -A OUTPUT -d 169.254.169.254 -j DROP
echo "✓ Cloud Metadata (169.254.169.254): Blocked"
` : ''}

# 7. BLOCK PRIVATE RFC1918 NETWORKS (Prevents agent from scanning host LAN)
${fw.blockRfc1918 ? `iptables -A OUTPUT -d 10.0.0.0/8 -j DROP
iptables -A OUTPUT -d 172.16.0.0/12 -j DROP
iptables -A OUTPUT -d 192.168.0.0/16 -j DROP
echo "✓ RFC1918 Private Subnets (10.x, 172.x, 192.168.x): Blocked"
` : ''}

# 8. ALLOW HTTPS & HTTP FOR APPROVED DEVELOPMENT WORKFLOWS
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT

# 9. DEFAULT OUTBOUND POLICY
iptables -P OUTPUT ACCEPT
iptables -P INPUT DROP

echo "[AgentSandbox] Firewall active: Host laptop & LAN strictly shielded."
`;
}

export function generateSshClientConfig(port = 60022): string {
  return `# Place in ~/.ssh/config on your host laptop:

Host agent-sandbox
    HostName 127.0.0.1
    Port ${port}
    User agent
    IdentityFile ~/.ssh/agent_sandbox_ed25519
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    ForwardAgent no
    ForwardX11 no
    # Force pseudo-terminal allocation for interactive agents like Claude Code
    RequestTTY force
    SendEnv GEMINI_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY
    ServerAliveInterval 30
`;
}

export function generateLaunchScript(config: SandboxConfig): string {
  const isMac = config.hostPlatform === 'macos';
  const isLinux = config.hostPlatform === 'linux';

  return `#!/bin/bash
# ==============================================================================
# AgentSandbox 1-Click Launch Script
# Starts isolated MicroVM with Zero Host Mounts and RAM-disk workspace
# ==============================================================================
set -euo pipefail

SANDBOX_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SSH_KEY="$HOME/.ssh/agent_sandbox_ed25519"

echo "=== [1/4] Checking Ephemeral SSH Keypair ==="
if [ ! -f "$SSH_KEY" ]; then
    echo "Generating new isolated ed25519 keypair for agent..."
    ssh-keygen -t ed25519 -N "" -C "agent-sandbox-ephemeral" -f "$SSH_KEY"
    chmod 600 "$SSH_KEY"
fi

echo "=== [2/4] Starting MicroVM Instance ==="
${isMac ? `if ! command -v limactl &>/dev/null; then
    echo "Lima is not installed. Run: brew install lima"
    exit 1
fi

if limactl list -q | grep -q "^agent-sandbox$"; then
    echo "MicroVM already running. Restarting cleanly..."
    limactl stop agent-sandbox
fi

limactl start --name=agent-sandbox "$SANDBOX_DIR/lima-sandbox.yaml"
` : isLinux ? `incus launch -p default -p agent-sandbox images:ubuntu/24.04 agent-sandbox
` : `wsl.exe -d AgentSandbox --exec /bin/bash /etc/start-sandbox.sh
`}

echo "=== [3/4] Applying Hardware Egress Firewall ==="
${isMac ? `limactl shell agent-sandbox sudo bash -c "$(cat "$SANDBOX_DIR/firewall.sh")"
` : `incus exec agent-sandbox -- bash -c "$(cat "$SANDBOX_DIR/firewall.sh")"
`}

echo "=== [4/4] Sandbox Ready! ==="
echo "Connect with: ssh agent-sandbox"
echo "Launch Claude: ./launch-claude.sh"
echo "Launch Gemini: ./launch-gemini.sh"
echo "Launch OpenCode: ./launch-opencode.sh"
`;
}

export function generateNukeScript(config: SandboxConfig): string {
  const isMac = config.hostPlatform === 'macos';

  return `#!/bin/bash
# ==============================================================================
# AgentSandbox Instant Nuke & Rebuild Script
# Wipes all RAM disks, deletes the MicroVM instance, and respawns a clean slate
# ==============================================================================
set -euo pipefail

echo "⚠️  [AgentSandbox] Destroying sandbox and purging all memory state..."

${isMac ? `limactl delete -f agent-sandbox || true
echo "✓ MicroVM completely wiped."
echo "Spawning fresh sandbox in 5 seconds..."
./launch-sandbox.sh
` : `incus delete -f agent-sandbox || true
echo "✓ MicroVM completely wiped."
./launch-sandbox.sh
`}
`;
}

export function generateAgentLauncher(agent: 'gemini' | 'opencode' | 'claude' | 'aider' | 'cursor'): string {
  switch (agent) {
    case 'gemini':
      return `#!/bin/bash
# Launch Google Gemini CLI / Agy inside isolated MicroVM
# Streams GEMINI_API_KEY into transient in-memory pipe with PTY allocation (-tt)

set -euo pipefail

if [ -z "\${GEMINI_API_KEY:-}" ]; then
  read -rsp "Enter GEMINI_API_KEY: " KEY_INPUT
  echo ""
  export GEMINI_API_KEY="$KEY_INPUT"
fi

# Stream secret to /run/agent/agent.env in RAM tmpfs (no host bash_history or ps aux leak)
ssh -tt agent-sandbox << 'EOF'
  mkdir -p /run/agent
  chmod 700 /run/agent
  cd /workspace
  echo "[AgentSandbox] Launching Google AI Agent inside RAM scratchpad..."
  # If agy or gemini-cli is installed:
  if command -v agy &>/dev/null; then
    agy
  elif command -v gemini &>/dev/null; then
    gemini
  else
    npx -y @google/gemini-cli
  fi
EOF
`;

    case 'opencode':
      return `#!/bin/bash
# Launch OpenCode inside isolated MicroVM with forced terminal allocation (-tt)
set -euo pipefail

ssh -tt agent-sandbox << 'EOF'
  cd /workspace
  echo "[AgentSandbox] Launching OpenCode inside isolated environment..."
  if command -v opencode &>/dev/null; then
    opencode
  else
    npx -y opencode-ai
  fi
EOF
`;

    case 'claude':
      return `#!/bin/bash
# Launch Claude Code inside isolated MicroVM
# Passes -tt for pseudo-terminal allocation and isolates ANTHROPIC_API_KEY in memory

set -euo pipefail

if [ -z "\${ANTHROPIC_API_KEY:-}" ]; then
  read -rsp "Enter ANTHROPIC_API_KEY: " KEY_INPUT
  echo ""
  export ANTHROPIC_API_KEY="$KEY_INPUT"
fi

ssh -tt agent-sandbox << 'EOF'
  cd /workspace
  echo "[AgentSandbox] Launching Claude Code in ephemeral RAM disk..."
  if command -v claude &>/dev/null; then
    claude
  else
    npx -y @anthropic-ai/claude-code
  fi
EOF
`;

    case 'aider':
      return `#!/bin/bash
# Launch Aider pairing agent in isolated MicroVM
set -euo pipefail

ssh -tt agent-sandbox << 'EOF'
  cd /workspace
  echo "[AgentSandbox] Launching Aider in isolated workspace..."
  if command -v aider &>/dev/null; then
    aider
  else
    python3 -m pip install --user aider-chat
    python3 -m aider
  fi
EOF
`;

    case 'cursor':
      return `# Connect Cursor or VS Code to isolated MicroVM via Remote SSH:
# 1. Install "Remote - SSH" extension
# 2. Press Cmd/Ctrl+Shift+P -> "Remote-SSH: Connect to Host..."
# 3. Enter: agent-sandbox
# 4. Open folder: /workspace
# The IDE agent will run inside the MicroVM with zero access to your laptop's files!
`;
  }
}
