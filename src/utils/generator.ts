import { SandboxConfig } from '../types/sandbox';

function getApprovedDomains(config: SandboxConfig): string[] {
  const fw = config.firewall;
  const domains: string[] = [];

  if (fw.whitelistGoogleApi) {
    domains.push('generativelanguage.googleapis.com', 'aistudio.googleapis.com');
  }
  if (fw.whitelistAnthropic) {
    domains.push('api.anthropic.com');
  }
  if (fw.whitelistOpenai) {
    domains.push('api.openai.com');
  }
  if (fw.whitelistGithub) {
    domains.push('github.com', 'api.github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com');
  }
  if (fw.whitelistPackagist) {
    domains.push('repo.packagist.org', 'packagist.org');
  }
  if (fw.whitelistNpm) {
    domains.push('registry.npmjs.org');
  }
  if (fw.whitelistPypi) {
    domains.push('pypi.org', 'files.pythonhosted.org');
  }

  return domains;
}

export function generateLimaManifest(config: SandboxConfig): string {
  const isNix = config.guestOs === 'nixos';
  const lock = config.snapshotLock;

  return `# AgentSandbox macOS Lima Configuration (Hardened Lightweight MicroVM)
# Hypervisor Engine: Apple Virtualization.framework (vz)
# Zero-Persistence, Zero Host Mounts, & Isolated Host Resolver Enforced

vmType: "vz"
rosetta:
  enabled: true
  binfmt: true

cpus: ${config.hardware.cpus}
memory: "${config.hardware.memoryGb}GiB"
disk: "${config.hardware.diskGb}GiB"

# CRITICAL HOST ISOLATION: Zero host mounts!
# Host ~/.ssh, ~/.aws, Keychain, and /Users are physically unreachable from guest.
mounts: []
mountType: "virtiofs"

# Disable host DNS resolver relay (prevents enumerating corporate/local .local DNS)
hostResolver:
  enabled: false

# Disable audio/video/clipboard host bridges
audio:
  device: "none"
video:
  display: "none"

networks:
  - vzNAT: true

ssh:
  localPort: 60022
  loadDotSSHPubKeys: false
  forwardAgent: false
  forwardX11: false

${isNix ? `# NixOS Engine: Flake-based with ephemeral tmpfs root and nix-ld
# Note: Build/import image from flake.nix or boot nixos-minimal and apply nixos-rebuild
images:
  - location: "https://channels.nixos.org/nixos-${lock ? '24.11' : 'unstable'}/latest-nixos-minimal-aarch64-linux.iso"
    arch: "aarch64"
  - location: "https://channels.nixos.org/nixos-${lock ? '24.11' : 'unstable'}/latest-nixos-minimal-x86_64-linux.iso"
    arch: "x86_64"
` : `# Ubuntu LTS Engine: Current release with RAM-disk /workspace & hardened sshd
images:
  - location: "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-arm64.img"
    arch: "aarch64"
  - location: "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img"
    arch: "x86_64"
`}
# Consolidated single provision list (prevents YAML key overwrite)
provision:
  - mode: system
    script: |
      #!/bin/bash
      set -euxo pipefail

      # 1. Create unprivileged guest user 'agent' with internal-only sudo
      if ! id -u agent &>/dev/null; then
        useradd -m -s /bin/bash -G sudo agent
        echo "agent ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-agent-sandbox
        chmod 0440 /etc/sudoers.d/90-agent-sandbox
      fi

      # 2. Layer 1 Storage: Mount volatile RAM-disk (tmpfs) for /workspace and /run/agent
      # Note: /home/agent stays outside /workspace so SSH keys are not masked by tmpfs
      mkdir -p /workspace /run/agent /etc/ssh/authorized_keys
      if ! mountpoint -q /workspace; then
        mount -t tmpfs -o size=${config.hardware.ramDiskSizeGb}G,noatime,nosuid,nodev tmpfs /workspace
      fi
      if ! mountpoint -q /run/agent; then
        mount -t tmpfs -o size=256M,mode=0700,nosuid,nodev,noexec tmpfs /run/agent
      fi
      chown -R agent:agent /workspace /run/agent

      # 3. Harden Guest SSHD (disable agent/port/X11 forwarding; isolate authorized_keys)
      cat << 'SSHEOF' > /etc/ssh/sshd_config.d/99-agent-sandbox.conf
      PasswordAuthentication no
      PermitRootLogin no
      AllowAgentForwarding no
      AllowTcpForwarding no
      X11Forwarding no
      PermitTunnel no
      AuthorizedKeysFile /etc/ssh/authorized_keys/%u
      AcceptEnv GEMINI_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY
      SSHEOF
      systemctl reload ssh || systemctl reload sshd || true

      # 4. Auto-cd into volatile /workspace on login
      grep -q 'cd /workspace' /home/agent/.bashrc || echo 'cd /workspace' >> /home/agent/.bashrc

  - mode: user
    script: |
      #!/bin/bash
      set -euxo pipefail
      echo "[AgentSandbox] MicroVM initialized with zero host mounts and RAM-disk /workspace."
`;
}

export function generateIncusManifest(config: SandboxConfig): string {
  const cloudInit = generateCloudInitUbuntu(config)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  return `# AgentSandbox Linux Incus / KVM Profile (Hardened Lightweight MicroVM)
# Pure Hardware-assisted KVM Boundary (--vm) - No Shared Host Kernel
# Launch with: incus launch --vm --ephemeral images:ubuntu/24.04 agent-sandbox -p default -p agent-sandbox

name: agent-sandbox
description: "Zero-persistence KVM MicroVM for autonomous AI coding agents"
config:
  limits.cpu: "${config.hardware.cpus}"
  limits.memory: "${config.hardware.memoryGb}GiB"
  security.secureboot: "false"
  user.user-data: |
${cloudInit}

devices:
  root:
    path: /
    pool: default
    type: disk
    size: "${config.hardware.diskGb}GiB"

  eth0:
    name: eth0
    network: incusbr0
    type: nic
`;
}

export function generateWslManifest(config: SandboxConfig): string {
  return `# AgentSandbox Windows 11 WSL2 Hardened Isolation Configuration
# ------------------------------------------------------------------------------
# PART 1: Host Hypervisor Config -> %USERPROFILE%\\.wslconfig
# Note: Use standard NAT (NOT mirrored) and disable localhostForwarding so the
# sandbox CANNOT probe localhost services, Docker sockets, or host VPNs.
# ------------------------------------------------------------------------------
[wsl2]
memory=${config.hardware.memoryGb}GB
processors=${config.hardware.cpus}
swap=0
networkingMode=nat
localhostForwarding=false
nestedVirtualization=false
firewall=true
dnsTunneling=false

# ------------------------------------------------------------------------------
# PART 2: Guest Isolation Config -> /etc/wsl.conf (inside AgentSandbox distro)
# CRITICAL: Disables Windows drive automount (/mnt/c) AND disables WSL Interop
# so an agent CANNOT execute powershell.exe, cmd.exe, or Windows binaries!
# ------------------------------------------------------------------------------
# [automount]
# enabled = false
# mountFsTab = false
#
# [interop]
# enabled = false
# appendWindowsPath = false
#
# [network]
# generateResolvConf = false
#
# [boot]
# systemd = true
`;
}

export function generateNixFlake(config: SandboxConfig): string {
  const lock = config.snapshotLock;
  const channel = lock ? 'nixos-24.11' : 'nixpkgs-unstable';

  const packages: string[] = [
    'pkgs.git',
    'pkgs.curl',
    'pkgs.jq',
    'pkgs.ripgrep',
    'pkgs.fzf',
    'pkgs.tmux',
    'pkgs.iptables',
    'pkgs.ipset',
  ];
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

  return `# Flake.nix for AgentSandbox NixOS MicroVM (aarch64-linux & x86_64-linux)
# Implements: "Erase-Your-Darlings" (tmpfs root) + nix-ld dynamic linker bridge
{
  description = "Isolated MicroVM for Autonomous AI Coding Agents";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/${channel}";
  };

  outputs = { self, nixpkgs }: let
    mkSandbox = system: let
      pkgs = import nixpkgs { inherit system; };
    in nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        ({ config, pkgs, ... }: {
          # 1. Ephemeral Root Storage (Pure RAM - wipes completely on reboot)
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

          # 5. Volatile /workspace & /run/agent directories
          systemd.tmpfiles.rules = [
            "d /workspace 0755 agent users -"
            "d /run/agent 0700 agent users -"
            "d /etc/ssh/authorized_keys 0755 root root -"
          ];

          # 6. Non-Interactive Sudo & Agent User (home outside /workspace)
          users.users.agent = {
            isNormalUser = true;
            extraGroups = [ "wheel" ];
            home = "/home/agent";
            createHome = true;
          };
          security.sudo.wheelNeedsPassword = false;

          # 7. Strict SSH Server configuration
          services.openssh = {
            enable = true;
            authorizedKeysFiles = [ "/etc/ssh/authorized_keys/%u" ];
            settings = {
              PasswordAuthentication = false;
              PermitRootLogin = "no";
              X11Forwarding = false;
              AllowAgentForwarding = false;
              AllowTcpForwarding = false;
            };
          };

          networking.useDHCP = true;
          system.stateVersion = "24.11";
        })
      ];
    };
  in {
    nixosConfigurations.agent-sandbox-arm64 = mkSandbox "aarch64-linux";
    nixosConfigurations.agent-sandbox-x86_64 = mkSandbox "x86_64-linux";
  };
}
`;
}

export function generateCloudInitUbuntu(config: SandboxConfig): string {
  const pkgs = [
    'git',
    'curl',
    'jq',
    'ripgrep',
    'fzf',
    'build-essential',
    'tmux',
    'ca-certificates',
    'iptables',
    'ipset',
    'dnsutils',
    'overlayroot',
  ];

  if (config.toolchains.php) {
    pkgs.push('php-cli', 'php-mbstring', 'php-xml', 'php-curl', 'php-zip', 'php-sqlite3', 'composer');
  }
  if (config.toolchains.python) {
    pkgs.push('python3', 'python3-pip', 'python3-venv');
  }

  return `#cloud-config
# AgentSandbox Ubuntu LTS Dual-Layer Cloud-Init
# Storage: RAM-disk /workspace + overlayroot tmpfs with zero host persistence

users:
  - name: agent
    groups: sudo
    shell: /bin/bash
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    home: /home/agent
    lock_passwd: true

package_update: true
package_upgrade: false

packages:
  ${pkgs.map((p) => `- ${p}`).join('\n  ')}

write_files:
  - path: /etc/ssh/sshd_config.d/99-agent-sandbox.conf
    permissions: '0644'
    content: |
      PasswordAuthentication no
      PermitRootLogin no
      AllowAgentForwarding no
      AllowTcpForwarding no
      X11Forwarding no
      PermitTunnel no
      AuthorizedKeysFile /etc/ssh/authorized_keys/%u
      AcceptEnv GEMINI_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY

  - path: /etc/systemd/system/setup-tmpfs-workspace.service
    permissions: '0644'
    content: |
      [Unit]
      Description=Mount Volatile RAM Workspace for AI Agent
      Before=ssh.service

      [Service]
      Type=oneshot
      ExecStart=/bin/bash -c "mkdir -p /workspace /run/agent /etc/ssh/authorized_keys && mount -t tmpfs -o size=${config.hardware.ramDiskSizeGb}G,noatime,nosuid,nodev tmpfs /workspace && mount -t tmpfs -o size=256M,mode=0700,nosuid,nodev,noexec tmpfs /run/agent && chown -R agent:agent /workspace /run/agent"
      RemainAfterExit=true

      [Install]
      WantedBy=multi-user.target

runcmd:
  - systemctl daemon-reload
  - systemctl enable --now setup-tmpfs-workspace.service
  - systemctl reload ssh || systemctl reload sshd || true
  - echo 'cd /workspace' >> /home/agent/.bashrc
  - ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && GOARCH=amd64 || GOARCH=arm64
  ${config.toolchains.node ? '- curl -fsSL https://deb.nodesource.com/setup_current.x | bash - && apt-get install -y nodejs' : ''}
  ${config.toolchains.rust ? '- su - agent -c "curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"' : ''}
  ${config.toolchains.go ? '- GOVERSION=$(curl -fsSL "https://go.dev/VERSION?m=text" | head -n1); ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && GOARCH=amd64 || GOARCH=arm64; curl -fsSL "https://go.dev/dl/${GOVERSION}.linux-${GOARCH}.tar.gz" | tar -C /usr/local -xz && ln -sf /usr/local/go/bin/go /usr/bin/go' : ''}
  - echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/.cargo/bin' >> /home/agent/.bashrc
`;
}

export function generateFirewallScript(config: SandboxConfig): string {
  const fw = config.firewall;
  const approvedDomains = getApprovedDomains(config);
  const hasWhitelist = approvedDomains.length > 0;

  return `#!/bin/bash
# ==============================================================================
# AgentSandbox Hardened Dual-Stack Egress Firewall
# Enforces least-privilege outbound policy (OUTPUT DROP) + IPv6 blackhole +
# RFC1918 / CGNAT (Tailscale/VPN) / Link-Local / Cloud Metadata containment.
#
# SECURITY NOTE: Guest iptables prevents accidental/non-root exfiltration and
# compromised package scripts. Because 'agent' has sudo inside the VM, enforce
# the companion Host Hypervisor Bridge rules below on the host if untrusted code
# might intentionally flush guest netfilter rules.
# ==============================================================================
set -euo pipefail

echo "[AgentSandbox] Applying hardened dual-stack egress policy..."

# 1. DROP ALL IPv6 TRAFFIC (Prevents IPv6 router advertisement & LAN bypasses)
${fw.dropIpv6 ? `if command -v ip6tables &>/dev/null; then
  ip6tables -F
  ip6tables -X
  ip6tables -P INPUT DROP
  ip6tables -P FORWARD DROP
  ip6tables -P OUTPUT DROP
  echo "✓ IPv6: Completely Dropped"
fi` : '# IPv6 drop disabled'}

# 2. FLUSH EXISTING IPv4 RULES
iptables -F
iptables -X
iptables -P INPUT ACCEPT
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 3. INPUT CHAIN (Allow loopback, established sessions, DHCP, and incoming Host SSH)
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p udp --sport 67 --dport 68 -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -j ACCEPT
iptables -P INPUT DROP

# 4. OUTPUT LOOPBACK & ESTABLISHED CONNECTIONS
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 5. RESTRICT DNS TO TRUSTED RESOLVERS ONLY (Anti-DNS-tunneling lock)
${fw.restrictDns ? `iptables -A OUTPUT -p udp --dport 53 -d 1.1.1.1 -j ACCEPT
iptables -A OUTPUT -p udp --dport 53 -d 8.8.8.8 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -d 1.1.1.1 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -d 8.8.8.8 -j ACCEPT
iptables -A OUTPUT -p udp --dport 53 -j DROP
iptables -A OUTPUT -p tcp --dport 53 -j DROP
echo "✓ DNS: Locked strictly to 1.1.1.1 and 8.8.8.8"` : `iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT`}

# 6. BLOCK CLOUD METADATA & LINK-LOCAL SUBNET (169.254.0.0/16)
${fw.blockCloudMetadata ? `iptables -A OUTPUT -d 169.254.0.0/16 -j DROP
echo "✓ Link-Local & Cloud Metadata (169.254.0.0/16): Blocked"` : ''}

# 7. BLOCK PRIVATE RFC1918, CGNAT/TAILSCALE (100.64.0.0/10), & MULTICAST
${fw.blockRfc1918 ? `iptables -A OUTPUT -d 10.0.0.0/8 -j DROP
iptables -A OUTPUT -d 172.16.0.0/12 -j DROP
iptables -A OUTPUT -d 192.168.0.0/16 -j DROP
iptables -A OUTPUT -d 100.64.0.0/10 -j DROP
iptables -A OUTPUT -d 224.0.0.0/4 -j DROP
iptables -A OUTPUT -d 0.0.0.0/8 -j DROP
echo "✓ Private LAN, VPN/CGNAT (100.64/10), & Multicast: Blocked"` : ''}

# 8. APPROVED DOMAIN ALLOWLIST (Resolved via ipset when supported)
${hasWhitelist ? `APPROVED_DOMAINS=(
${approvedDomains.map((d) => `  "${d}"`).join('\n')}
)

if command -v ipset &>/dev/null; then
  ipset create agent_allowlist hash:ip -exist
  ipset flush agent_allowlist
  for domain in "\${APPROVED_DOMAINS[@]}"; do
    for ip in $(getent ahostsv4 "$domain" | awk '{print $1}' | sort -u); do
      ipset add agent_allowlist "$ip" -exist
    done
  done
  iptables -A OUTPUT -p tcp --dport 443 -m set --match-set agent_allowlist dst -j ACCEPT
  iptables -A OUTPUT -p tcp --dport 80 -m set --match-set agent_allowlist dst -j ACCEPT
  echo "✓ HTTPS/HTTP Allowlist: Restricted to \${#APPROVED_DOMAINS[@]} approved domains"
else
  echo "⚠️ ipset unavailable; falling back to port 443/80 egress"
  iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
  iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
fi` : `# No allowlist domains selected — blocking all external HTTP/HTTPS egress!
echo "✓ Strict Airgap: All outbound HTTP/HTTPS dropped"`}

# 9. DEFAULT OUTPUT POLICY: DROP ALL OTHER PORTS & DESTINATIONS
iptables -P OUTPUT DROP

echo "[AgentSandbox] Firewall active: Least-privilege OUTPUT DROP enforced."
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
    StrictHostKeyChecking accept-new
    UserKnownHostsFile ~/.ssh/agent_sandbox_known_hosts
    ForwardAgent no
    ForwardX11 no
    ClearAllForwardings yes
    PermitLocalCommand no
    ControlMaster no
    # Force pseudo-terminal allocation for interactive TUIs (Claude Code, Gemini, OpenCode)
    RequestTTY force
    ServerAliveInterval 30
`;
}

export function generateLaunchScript(config: SandboxConfig): string {
  const isMac = config.hostPlatform === 'macos';
  const isLinux = config.hostPlatform === 'linux';

  return `#!/bin/bash
# ==============================================================================
# AgentSandbox 1-Click Launch Script
# Usage: ./launch-sandbox.sh [--mount-type mirror|ro] [/path/to/project]
#   - No path:      Boots with ZERO host mounts and an empty RAM /workspace.
#   - mirror (def): Clones/copies project into volatile RAM /workspace (0 mounts).
#   - ro:           Mounts ONLY the target path read-only at /mnt/host-repo.
# Note: --mount-type only takes effect when a project path is provided.
# ==============================================================================
set -euo pipefail

SANDBOX_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SSH_KEY="$HOME/.ssh/agent_sandbox_ed25519"

TARGET_PATH=""
MOUNT_TYPE="mirror"
MOUNT_TYPE_SET=false

print_usage() {
  echo "Usage: $0 [--mount-type mirror|ro] [/path/to/project]"
  echo "  --mount-type mirror   Copy/clone project into RAM tmpfs (default when path given; zero active host mounts)"
  echo "  --mount-type ro       Attach target path read-only at /mnt/host-repo inside guest"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --mount-type)
      if [ $# -lt 2 ]; then
        echo "Error: --mount-type requires an argument (mirror or ro)." >&2
        exit 1
      fi
      MOUNT_TYPE="$2"
      MOUNT_TYPE_SET=true
      shift 2
      ;;
    --mount-type=*)
      MOUNT_TYPE="\${1#*=}"
      MOUNT_TYPE_SET=true
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      print_usage
      exit 1
      ;;
    *)
      if [ -n "$TARGET_PATH" ]; then
        echo "Error: Multiple paths specified ('$TARGET_PATH' and '$1'). Provide at most one project path." >&2
        exit 1
      fi
      TARGET_PATH="$1"
      shift
      ;;
  esac
done

if [ -n "$TARGET_PATH" ]; then
  if [ ! -d "$TARGET_PATH" ]; then
    echo "Error: Target path does not exist or is not a directory: $TARGET_PATH" >&2
    exit 1
  fi
  TARGET_PATH="$(cd "$TARGET_PATH" && pwd -P)"
  if [ "$MOUNT_TYPE" != "mirror" ] && [ "$MOUNT_TYPE" != "ro" ]; then
    echo "Error: Invalid --mount-type '$MOUNT_TYPE'. Must be 'mirror' or 'ro'." >&2
    exit 1
  fi
elif [ "$MOUNT_TYPE_SET" = true ]; then
  echo "Note: --mount-type '$MOUNT_TYPE' ignored because no project path was passed (keeping zero host mounts)."
fi

echo "=== [1/4] Checking Ephemeral SSH Keypair ==="
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
if [ ! -f "$SSH_KEY" ]; then
    echo "Generating new isolated ed25519 keypair for agent..."
    ssh-keygen -t ed25519 -N "" -C "agent-sandbox-ephemeral" -f "$SSH_KEY"
    chmod 600 "$SSH_KEY"
fi
PUB_KEY="$(cat "\${SSH_KEY}.pub")"

echo "=== [2/4] Starting Hardened MicroVM Instance ==="
${isMac ? `if ! command -v limactl &>/dev/null; then
    echo "Lima is not installed. Run: brew install lima"
    exit 1
fi

if limactl list -q | grep -q "^agent-sandbox$"; then
    echo "MicroVM already exists. Recreating cleanly for zero persistence..."
    limactl delete -f agent-sandbox
fi

LIMA_CONFIG="$SANDBOX_DIR/lima-sandbox.yaml"
RUNTIME_LIMA_YAML=""
cleanup_runtime_yaml() {
    if [ -n "\${RUNTIME_LIMA_YAML:-}" ] && [ -f "$RUNTIME_LIMA_YAML" ]; then
        rm -f "$RUNTIME_LIMA_YAML"
    fi
}
trap cleanup_runtime_yaml EXIT

if [ -n "$TARGET_PATH" ] && [ "$MOUNT_TYPE" = "ro" ]; then
    echo "Attaching scoped read-only mount at /mnt/host-repo -> $TARGET_PATH"
    RUNTIME_LIMA_YAML="$(mktemp "\${TMPDIR:-/tmp}/lima-sandbox.XXXXXX.yaml")"
    HOST_PATH="$TARGET_PATH" awk '
      /^mounts: \\[\\]/ {
        print "mounts:"
        print "  - location: \\"" ENVIRON["HOST_PATH"] "\\""
        print "    mountPoint: \\"/mnt/host-repo\\""
        print "    writable: false"
        next
      }
      { print }
    ' "$SANDBOX_DIR/lima-sandbox.yaml" > "$RUNTIME_LIMA_YAML"
    LIMA_CONFIG="$RUNTIME_LIMA_YAML"
fi

limactl start --tty=false --name=agent-sandbox "$LIMA_CONFIG"
echo "Installing ephemeral SSH public key into guest..."
printf '%s\\n' "$PUB_KEY" | limactl shell agent-sandbox sudo bash -c 'mkdir -p /etc/ssh/authorized_keys && cat > /etc/ssh/authorized_keys/agent && chmod 644 /etc/ssh/authorized_keys/agent'

if [ -n "$TARGET_PATH" ] && [ "$MOUNT_TYPE" = "mirror" ]; then
    echo "Mirroring '$TARGET_PATH' into volatile RAM /workspace (zero live host mounts)..."
    if git -C "$TARGET_PATH" rev-parse --verify HEAD &>/dev/null; then
        git -C "$TARGET_PATH" bundle create - HEAD | limactl shell agent-sandbox sudo -u agent bash -c '
          cat > /run/agent/repo.bundle
          git -C /workspace init -q
          git -C /workspace fetch -q /run/agent/repo.bundle HEAD
          git -C /workspace checkout -q -B main FETCH_HEAD
          rm -f /run/agent/repo.bundle
        '
    else
        tar --exclude='.env' --exclude='.env.*' --exclude='.git/hooks' --exclude='.git/config' --exclude='*.pem' --exclude='*.key' -C "$TARGET_PATH" -cf - . | \
          limactl shell agent-sandbox sudo -u agent bash -c 'tar -C /workspace -xf -'
    fi
fi

echo "=== [3/4] Applying Hardened Dual-Stack Egress Firewall ==="
limactl shell agent-sandbox sudo bash -s < "$SANDBOX_DIR/firewall.sh"
` : isLinux ? `if ! command -v incus &>/dev/null; then
    echo "Incus is not installed. Install incus and initialize KVM storage/network."
    exit 1
fi

incus profile show agent-sandbox &>/dev/null || incus profile create agent-sandbox
incus profile edit agent-sandbox < "$SANDBOX_DIR/incus-sandbox.yaml"

incus delete -f agent-sandbox &>/dev/null || true
incus launch --vm --ephemeral images:ubuntu/24.04 agent-sandbox -p default -p agent-sandbox
echo "Waiting for VM guest agent..."
sleep 6

if [ -n "$TARGET_PATH" ] && [ "$MOUNT_TYPE" = "ro" ]; then
    echo "Attaching scoped read-only mount at /mnt/host-repo -> $TARGET_PATH"
    incus config device add agent-sandbox host-repo disk source="$TARGET_PATH" path=/mnt/host-repo readonly=true
fi

printf '%s\\n' "$PUB_KEY" | incus exec agent-sandbox -- bash -c 'mkdir -p /etc/ssh/authorized_keys && cat > /etc/ssh/authorized_keys/agent && chmod 644 /etc/ssh/authorized_keys/agent'

if [ -n "$TARGET_PATH" ] && [ "$MOUNT_TYPE" = "mirror" ]; then
    echo "Mirroring '$TARGET_PATH' into volatile RAM /workspace (zero live host mounts)..."
    if git -C "$TARGET_PATH" rev-parse --verify HEAD &>/dev/null; then
        git -C "$TARGET_PATH" bundle create - HEAD | incus exec agent-sandbox -- su -s /bin/bash agent -c '
          cat > /run/agent/repo.bundle
          git -C /workspace init -q
          git -C /workspace fetch -q /run/agent/repo.bundle HEAD
          git -C /workspace checkout -q -B main FETCH_HEAD
          rm -f /run/agent/repo.bundle
        '
    else
        tar --exclude='.env' --exclude='.env.*' --exclude='.git/hooks' --exclude='.git/config' --exclude='*.pem' --exclude='*.key' -C "$TARGET_PATH" -cf - . | \
          incus exec agent-sandbox -- su -s /bin/bash agent -c 'tar -C /workspace -xf -'
    fi
fi

echo "=== [3/4] Applying Hardened Dual-Stack Egress Firewall ==="
incus exec agent-sandbox -- bash -s < "$SANDBOX_DIR/firewall.sh"
` : `# Windows 11 WSL2 (Run from Git Bash or WSL-capable shell)
echo "Ensure %USERPROFILE%\\.wslconfig contains the hardened settings from .wslconfig"
wsl.exe -d AgentSandbox -u root -- bash -c 'printf "[automount]\\nenabled = false\\nmountFsTab = false\\n\\n[interop]\\nenabled = false\\nappendWindowsPath = false\\n\\n[network]\\ngenerateResolvConf = false\\n\\n[boot]\\nsystemd = true\\n" > /etc/wsl.conf'
wsl.exe --terminate AgentSandbox
printf '%s\\n' "$PUB_KEY" | wsl.exe -d AgentSandbox -u root -- bash -c 'mkdir -p /etc/ssh/authorized_keys /workspace /run/agent && cat > /etc/ssh/authorized_keys/agent && chmod 644 /etc/ssh/authorized_keys/agent'

if [ -n "$TARGET_PATH" ]; then
    if [ "$MOUNT_TYPE" = "ro" ]; then
        echo "Attaching scoped read-only mount at /mnt/host-repo -> $TARGET_PATH"
        WIN_PATH="$TARGET_PATH"
        if command -v cygpath &>/dev/null; then
            WIN_PATH="$(cygpath -w "$TARGET_PATH")"
        elif command -v wslpath &>/dev/null; then
            WIN_PATH="$(wslpath -w "$TARGET_PATH")"
        fi
        printf '%s\\n' "$WIN_PATH" | wsl.exe -d AgentSandbox -u root -- bash -c 'read -r WP && mkdir -p /mnt/host-repo && mount -t drvfs "$WP" /mnt/host-repo -o ro'
    else
        echo "Mirroring '$TARGET_PATH' into volatile RAM /workspace (zero live host mounts)..."
        if git -C "$TARGET_PATH" rev-parse --verify HEAD &>/dev/null; then
            git -C "$TARGET_PATH" bundle create - HEAD | wsl.exe -d AgentSandbox -u agent -- bash -c '
              cat > /run/agent/repo.bundle
              git -C /workspace init -q
              git -C /workspace fetch -q /run/agent/repo.bundle HEAD
              git -C /workspace checkout -q -B main FETCH_HEAD
              rm -f /run/agent/repo.bundle
            '
        else
            tar --exclude='.env' --exclude='.env.*' --exclude='.git/hooks' --exclude='.git/config' --exclude='*.pem' --exclude='*.key' -C "$TARGET_PATH" -cf - . | \
              wsl.exe -d AgentSandbox -u agent -- bash -c 'tar -C /workspace -xf -'
        fi
    fi
fi

echo "=== [3/4] Applying Hardened Dual-Stack Egress Firewall ==="
wsl.exe -d AgentSandbox -u root -- bash -s < "$SANDBOX_DIR/firewall.sh"
`}

echo "=== [4/4] Sandbox Ready! ==="
if [ -n "$TARGET_PATH" ] && [ "$MOUNT_TYPE" = "mirror" ]; then
    echo "Project mirrored into RAM /workspace. Extract patches via: ssh agent-sandbox 'git -C /workspace diff' > changes.patch"
elif [ -n "$TARGET_PATH" ] && [ "$MOUNT_TYPE" = "ro" ]; then
    echo "Project mounted READ-ONLY at /mnt/host-repo (writable scratchpad at /workspace)."
fi
echo "Verify isolation: ./verify-sandbox.sh"
echo "Connect with:     ssh agent-sandbox"
echo "Launch Gemini:    ./launch-gemini.sh"
echo "Launch Claude:    ./launch-claude.sh"
echo "Launch OpenCode:  ./launch-opencode.sh"
echo "Launch Aider:     ./launch-aider.sh"
`;
}

export function generateNukeScript(config: SandboxConfig): string {
  const isMac = config.hostPlatform === 'macos';
  const isLinux = config.hostPlatform === 'linux';

  return `#!/bin/bash
# ==============================================================================
# AgentSandbox Instant Nuke & Rebuild Script
# Wipes all RAM disks, clears ephemeral known_hosts, deletes the MicroVM,
# and respawns a pristine environment.
# ==============================================================================
set -euo pipefail

SANDBOX_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

echo "⚠️  [AgentSandbox] Destroying sandbox and purging all memory state..."
rm -f "$HOME/.ssh/agent_sandbox_known_hosts"

${isMac ? `limactl delete -f agent-sandbox || true
echo "✓ MicroVM completely wiped."
echo "Spawning fresh sandbox..."
"$SANDBOX_DIR/launch-sandbox.sh"
` : isLinux ? `incus delete -f agent-sandbox || true
echo "✓ KVM MicroVM completely wiped."
echo "Spawning fresh sandbox..."
"$SANDBOX_DIR/launch-sandbox.sh"
` : `wsl.exe --terminate AgentSandbox || true
wsl.exe --unregister AgentSandbox || true
echo "✓ WSL2 Sandbox unregistered and wiped."
`}
`;
}

export function generateAgentLauncher(agent: 'gemini' | 'opencode' | 'claude' | 'aider' | 'cursor'): string {
  switch (agent) {
    case 'gemini':
      return `#!/bin/bash
# Launch Google Gemini CLI / Agy inside isolated MicroVM
# 1. Pipes GEMINI_API_KEY via non-TTY SSH into volatile /run/agent/agent.env (no host ps/history leak)
# 2. Attaches a real interactive PTY (-tt) without heredoc stdin collision

set -euo pipefail

if [ -z "\${GEMINI_API_KEY:-}" ]; then
  read -rsp "Enter GEMINI_API_KEY: " KEY_INPUT
  echo ""
  export GEMINI_API_KEY="$KEY_INPUT"
fi

# Step 1: Stream secret into guest RAM tmpfs via stdin before starting PTY
printf 'GEMINI_API_KEY=%q\\n' "$GEMINI_API_KEY" | ssh -T agent-sandbox \\
  'umask 077 && mkdir -p /run/agent && cat > /run/agent/agent.env'

# Step 2: Launch agent with clean interactive keyboard PTY (-tt)
ssh -tt agent-sandbox '
  set -a
  source /run/agent/agent.env
  set +a
  rm -f /run/agent/agent.env
  cd /workspace
  export TERM=xterm-256color
  if command -v agy &>/dev/null; then
    exec agy
  elif command -v gemini &>/dev/null; then
    exec gemini
  else
    exec npx -y @google/gemini-cli
  fi
'
`;

    case 'opencode':
      return `#!/bin/bash
# Launch OpenCode inside isolated MicroVM with interactive PTY (-tt)
set -euo pipefail

ssh -tt agent-sandbox '
  cd /workspace
  export TERM=xterm-256color
  if command -v opencode &>/dev/null; then
    exec opencode
  else
    exec npx -y opencode-ai
  fi
'
`;

    case 'claude':
      return `#!/bin/bash
# Launch Claude Code inside isolated MicroVM
# 1. Pipes ANTHROPIC_API_KEY via non-TTY SSH into volatile /run/agent/agent.env
# 2. Attaches interactive PTY (-tt) with real keyboard stdin

set -euo pipefail

if [ -z "\${ANTHROPIC_API_KEY:-}" ]; then
  read -rsp "Enter ANTHROPIC_API_KEY: " KEY_INPUT
  echo ""
  export ANTHROPIC_API_KEY="$KEY_INPUT"
fi

printf 'ANTHROPIC_API_KEY=%q\\n' "$ANTHROPIC_API_KEY" | ssh -T agent-sandbox \\
  'umask 077 && mkdir -p /run/agent && cat > /run/agent/agent.env'

ssh -tt agent-sandbox '
  set -a
  source /run/agent/agent.env
  set +a
  rm -f /run/agent/agent.env
  cd /workspace
  export TERM=xterm-256color
  if command -v claude &>/dev/null; then
    exec claude
  else
    exec npx -y @anthropic-ai/claude-code
  fi
'
`;

    case 'aider':
      return `#!/bin/bash
# Launch Aider pairing agent inside isolated MicroVM with interactive PTY (-tt)
set -euo pipefail

ssh -tt agent-sandbox '
  cd /workspace
  export TERM=xterm-256color
  if command -v aider &>/dev/null; then
    exec aider
  else
    python3 -m pip install --user aider-chat
    exec python3 -m aider
  fi
'
`;

    case 'cursor':
      return `# Connect Cursor or VS Code to isolated MicroVM via Remote SSH:
# 1. Install "Remote - SSH" extension
# 2. Press Cmd/Ctrl+Shift+P -> "Remote-SSH: Connect to Host..."
# 3. Enter: agent-sandbox
# 4. Open folder: /workspace
# Note: Disable SSH Agent Forwarding (already enforced in ssh-agent.conf)
# so the remote IDE cannot access your host laptop SSH keys!
`;
  }
}

export function generateVerifyScript(config: SandboxConfig): string {
  const fw = config.firewall;

  return `#!/bin/bash
# ==============================================================================
# AgentSandbox Live Isolation Verification Script
# Executes real containment probes inside the running 'agent-sandbox' MicroVM
# and exits non-zero if any critical host-isolation boundary is exposed.
# ==============================================================================
set -euo pipefail

echo "=== [AgentSandbox] Running Live MicroVM Isolation Verification ==="

STATUS=0
ssh -T agent-sandbox 'bash -s' << '__VERIFY_EOF__' || STATUS=$?
set -u

FAIL_COUNT=0

# 1. Verify zero host directory mounts (/Users, /mnt/c)
if [ -d /Users ] || [ -d /mnt/c/Users ]; then
  echo "  [FAIL] host_mount_detected"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "  [PASS] no_host_mounts"
fi

# 2. Verify host SSH keys & AWS creds are absent from guest
if [ -f "$HOME/.ssh/id_rsa" ] || [ -f "$HOME/.ssh/id_ed25519" ] || [ -d "$HOME/.aws" ]; then
  echo "  [FAIL] host_credentials_present"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "  [PASS] no_host_credentials"
fi

# 3. Verify SSH Agent Forwarding is disabled
if [ -n "\${SSH_AUTH_SOCK:-}" ]; then
  echo "  [FAIL] ssh_agent_forwarded"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "  [PASS] no_ssh_agent_forwarding"
fi

# 4. Verify /workspace and /run/agent are volatile RAM tmpfs
if findmnt -n -o FSTYPE /workspace 2>/dev/null | grep -q "^tmpfs$"; then
  echo "  [PASS] workspace_tmpfs"
else
  echo "  [FAIL] workspace_not_tmpfs"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 5. Verify WSL interop disabled (if running under WSL2)
if grep -qi microsoft /proc/version 2>/dev/null; then
  if command -v powershell.exe &>/dev/null || command -v cmd.exe &>/dev/null; then
    echo "  [FAIL] wsl_interop_exposed"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "  [PASS] wsl_interop_disabled"
  fi
fi

${fw.blockRfc1918 ? `# 6. Verify RFC1918 private LAN & CGNAT/VPN (100.64.0.0/10) egress is blocked
if curl -fsS --connect-timeout 2 http://192.168.1.1 &>/dev/null || curl -fsS --connect-timeout 2 http://100.64.0.1 &>/dev/null; then
  echo "  [FAIL] private_lan_reachable"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "  [PASS] private_lan_blocked"
fi` : `echo "  [SKIP] rfc1918_disabled_in_config"`}

${fw.blockCloudMetadata ? `# 7. Verify Cloud Metadata (169.254.169.254) is blackholed
if curl -fsS --connect-timeout 2 http://169.254.169.254/latest/meta-data/ &>/dev/null; then
  echo "  [FAIL] cloud_metadata_reachable"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "  [PASS] cloud_metadata_blocked"
fi` : `echo "  [SKIP] metadata_block_disabled_in_config"`}

${fw.dropIpv6 ? `# 8. Verify IPv6 egress is dropped
if ping6 -c 1 -W 2 2606:4700:4700::1111 &>/dev/null; then
  echo "  [FAIL] ipv6_reachable"
  FAIL_COUNT=$((FAIL_COUNT + 1))
else
  echo "  [PASS] ipv6_dropped"
fi` : `echo "  [SKIP] ipv6_drop_disabled_in_config"`}

exit "$FAIL_COUNT"
__VERIFY_EOF__

if [ "$STATUS" -eq 0 ]; then
  echo "✓ All live sandbox isolation probes passed!"
  exit 0
else
  echo "✗ $STATUS isolation probe(s) failed! Review firewall.sh or mounts immediately."
  exit 1
fi
`;
}

