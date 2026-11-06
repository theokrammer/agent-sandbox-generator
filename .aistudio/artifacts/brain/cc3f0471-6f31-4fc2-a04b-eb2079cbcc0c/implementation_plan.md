# AgentSandbox: Hardened Lightweight MicroVM Isolation Manager & Secure Agent Workbench

A developer-grade workbench and configuration orchestrator for deploying throwaway, zero-persistence **Lightweight MicroVMs** on macOS, Linux, and Windows 11. Enables autonomous coding agents (Claude Code, Google Gemini CLI / Agy, OpenCode, Aider, OpenAI Codex, custom CLI tools) to have full sudo and system permissions inside an isolated hypervisor-backed virtual machine while strictly safeguarding host files, sensitive credentials, and local networks.

### User Review & Critical Decisions

> [!IMPORTANT]
> The plan includes support for current agent tooling including **Google AI Agent CLI (`gemini-cli` / `agy`)**, **OpenCode (`opencode`)**, **Claude Code (`@anthropic-ai/claude-code`)**, and **Aider / Codex**, with dedicated non-interactive PTY launchers, in-memory secret piping for `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and `OPENAI_API_KEY`, and automated network egress whitelisting for Google AI API endpoints.

- **Sandboxing Stack**: **Exclusively Lightweight MicroVMs** via hardware-assisted virtualization:
  - **macOS**: Lima with Apple's native `Virtualization.framework` (`vmType: "vz"`) and `virtiofs`.
  - **Linux**: Incus / native KVM MicroVM.
  - **Windows 11**: Dedicated isolated WSL2 instance with custom `.wslconfig` (hypervisor isolated, zero host drives mounted) or Hyper-V MicroVM.
  - *No host Docker runtime dependency is required.*
- **Supported Coding Agents & CLIs (Current Up-to-Date Versions)**:
  1. **Google AI Agent / Gemini CLI (`gemini-cli` / `agy`)**: Google's modern agent CLI with `GEMINI_API_KEY` in-memory piping and Google Generative Language API egress rules (`generativelanguage.googleapis.com`).
  2. **OpenCode (`opencode`)**: Fast, open-source terminal coding agent with multi-provider fallback.
  3. **Claude Code (`@anthropic-ai/claude-code`)**: Anthropic's autonomous terminal coding tool with PTY `-tt` allocation.
  4. **Aider (`aider-chat`)**: Git-native pairing agent supporting local and remote models.
  5. **Remote IDEs**: Cursor and VS Code Remote-SSH direct hypervisor connection.
- **Dual-Layer Storage Strategy (Zero Persistence + Fast Boot)**:
  - **Layer 1 (System Root & Workspace)**: Mounted strictly on `tmpfs` (RAM disk) or a non-persistent copy-on-write overlay. Every restart purges all agent artifacts, temporary packages, and memory state.
  - **Layer 2 (Immutable Base Image / Read-Only Nix Store)**: Core toolchains and runtimes are pre-baked into the read-only base layer, ensuring $<3$ second boots without multi-gigabyte re-download delays.
- **Explicit Zero-Mount Host Enforcement**: Manifests explicitly set `mounts: []` (Lima) and `[automount] enabled = false` (WSL2), completely isolating the host `$HOME`, `~/.ssh`, `~/.aws`, Keychain, and local storage drives.
- **Dual Guest OS Engines**:
  1. **Ubuntu LTS (Current Up-to-Date Release)**: Standard FHS/glibc environment with standard `apt` and pre-configured ephemeral overlayfs.
  2. **NixOS (Current Up-to-Date Release / Flakes)**: Pure `tmpfs` root ("erase-your-darlings"), read-only `/nix/store`, and `programs.nix-ld.enable = true` for unpatched dynamic binary execution.
- **Dynamic Toolchains (With Version Snapshot Lock)**:
  - Defaults to current stable channels: **PHP (Latest Stable + Composer + core extensions)**, **Node.js (Active LTS/Current + npm/pnpm)**, **Python (Latest Stable + venv)**, **Rust (Latest Stable)**, **Go (Latest Stable)**.
  - Includes a "Snapshot Lock" switch in the UI to pin exact verified versions when desired.
- **PTY-Aware Agent CLI & SSH Gateway**:
  - Configures forced pseudo-terminal allocation (`-tt`, `RequestTTY force`, `TERM=xterm-256color`) so interactive agents render cleanly without stdin errors.
  - Uses a **Transient Secret Pipe** (`/run/user/1000/agent.env` on tmpfs) to inject API keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) into the session without exposing them to host bash history or the host `ps aux` table.
- **Hardened Dual-Stack Egress Firewall**:
  - Drops 100% of IPv6 guest traffic (`ip6tables -P DROP`).
  - Drops RFC1918 private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and cloud metadata (`169.254.169.254`).
  - Restricts DNS traffic strictly to verified public resolvers (e.g. `1.1.1.1`, `8.8.8.8`) to eliminate local host DNS interception and tunneling risks.
  - Whitelists Google AI (`generativelanguage.googleapis.com`), Anthropic, OpenAI, GitHub, Packagist, npm, and PyPI.

---

### 1. Overview & Core Concept

**What It Delivers**:
AgentSandbox provides an interactive desktop command center and configuration generator designed to give autonomous coding agents complete freedom inside a virtual machine while making it physically impossible for them to compromise host data or private networks.

The application delivers:
1. **MicroVM Orchestrator & Configurator**: Generates battle-tested, copy-paste-ready MicroVM manifests (`lima.yaml`, `incus.yaml`, `wsl.conf` / `.wslconfig`) and 1-click startup scripts (`start-sandbox.sh`, `reset-sandbox.sh`).
2. **Dual-Layer Storage Architecture**: Balances lightning-fast boot ($<3$s) with zero disk residue by separating immutable toolchain layers from RAM-backed workspace layers.
3. **Dual Guest OS Architecture**:
   - **Ubuntu LTS Mode**: Familiar, standard Linux environment with automatic package cache and latest upstream toolchains.
   - **NixOS Mode**: Mathematical determinism, declarative `flake.nix`, read-only `/nix/store`, and root on `tmpfs` RAM disk.
4. **Comprehensive Dynamic Toolchains**: PHP + Composer, Node.js, Python, Rust, Go, Git, and developer CLI tools, all set to current stable versions with custom version override and snapshot locking.
5. **Universal Agent Launchers (Google AI, OpenCode, Claude Code, Aider, Codex)**: Pre-configured terminal allocation and transient secret pipes for all leading agent tools.
6. **Hardened Dual-Stack Network Firewall**: Deep egress filters dropping IPv6, blocking LAN/metadata access, and restricting outbound DNS.
7. **Interactive Security Audit & Escape Simulator**: 12 verification checkpoints validating hypervisor containment, host mount absence, and credential isolation.

---

### 2. MicroVM Architecture & Dual-Layer Storage

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
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
│  │  │ DUAL-LAYER STORAGE ENGINE:                                                       │  │  │
│  │  │ • Layer 1 (Active Root & Workspace): Volatile tmpfs RAM Disk (Discard on Exit)   │  │  │
│  │  │ • Layer 2 (Base OS & Runtimes): Immutable Read-Only Store (<3s Boot, No Redownload│  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                        │  │
│  │  ┌──────────────────────────────────────┬───────────────────────────────────────────┐  │  │
│  │  │ Engine A: Ubuntu LTS (Latest)        │ Engine B: NixOS (Latest + nix-ld)         │  │  │
│  │  │ • Standard FHS / glibc               │ • Pure tmpfs root ("erase-your-darlings") │  │  │
│  │  │ • apt-get standard agent flow        │ • Read-only /nix/store                    │  │  │
│  │  │ • Ephemeral RAM overlayfs            │ • programs.nix-ld.enable = true           │  │  │
│  │  └──────────────────────────────────────┴───────────────────────────────────────────┘  │  │
│  │                                                                                        │  │
│  │  SUPPORTED AGENT SUITE (PTY -tt + Transient Pipe):                                     │  │
│  │  • Google Gemini CLI / Agy (`gemini-cli` / `agy`) • OpenCode (`opencode`)              │  │
│  │  • Claude Code (`claude`)                         • Aider / Codex (`aider`)            │  │
│  │                                                                                        │  │
│  │  DYNAMIC UP-TO-DATE TOOLCHAINS (With Snapshot Lock):                                   │  │
│  │  • PHP: Latest Stable + Composer + Exts   • Node.js: Latest Current / Active LTS       │  │
│  │  • Python: Latest Stable                  • Rust: Latest Stable toolchain              │  │
│  │  • Go: Latest Stable                      • Git, ripgrep, fzf, jq, build-essential     │  │
│  │                                                                                        │  │
│  │  TRANSIENT SECRET PIPE:                                                                │  │
│  │  • In-Memory /run/user/1000/agent.env (GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY)│
│  │                                                                                        │  │
│  │  HARDENED DUAL-STACK EGRESS FIREWALL:                                                  │  │
│  │  • DROP All IPv6 Traffic (ip6tables -P DROP)                                           │  │
│  │  • DROP 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 169.254.169.254                    │  │
│  │  • RESTRICT DNS to 1.1.1.1 / 8.8.8.8 (Anti-tunneling)                                  │  │
│  │  • ACCEPT generativelanguage.googleapis.com, api.anthropic.com, api.openai.com,       │  │
│  │           github.com, packagist.org, npmjs.org, pypi.org                               │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. User Experience & Visual Design

#### Key User Flows
1. **Interactive MicroVM Configurator**:
   - Host Platform: **macOS (Lima / Apple VZ)**, **Linux (Incus / KVM)**, or **Windows 11 (Isolated WSL2)**.
   - Guest Engine: **Ubuntu LTS (Latest)** or **NixOS (Latest with Flakes)**.
   - Hardware Allocation: CPU cores (2–8), Memory allocation (2GB–16GB), and RAM disk size.
   - Dynamic Toolchains & Snapshot Lock:
     - [x] **PHP (Latest Stable + Composer)**
     - [x] **Node.js (Latest Stable / Active LTS)**
     - [x] **Python (Latest Stable + pip/venv)**
     - [x] **Rust (Latest Stable cargo/rustup)**
     - [x] **Go (Latest Stable)**
     - Toggle: *Version Snapshot Lock* (locks active stable versions into manifest).
2. **Live Configuration & Script Preview**:
   - Inspect dynamically generated manifests side-by-side with copy buttons and syntax highlighting:
     - `lima-sandbox.yaml` (macOS native virtualization with `mounts: []`)
     - `incus-sandbox.yaml` (Linux lightweight system container/VM)
     - `wsl-sandbox.conf` & `.wslconfig` (Windows 11 with `automount=false`)
     - `flake.nix` / `configuration.nix` (NixOS engine with `nix-ld` and `tmpfs` root)
     - `cloud-init.yaml` (Ubuntu engine with dual-layer overlay)
3. **Agent CLI & SSH Gateway (PTY-Aware + Transient Secret Pipe)**:
   - Generate ephemeral ed25519 SSH keypair with 1 click.
   - One-click copy for `~/.ssh/config` snippet configured with `RequestTTY force`.
   - Dedicated connection presets for:
     - **Google Gemini CLI / Agy (`agy` / `gemini-cli`)**: Single-line launcher passing `-tt` and streaming `GEMINI_API_KEY`.
     - **OpenCode (`opencode`)**: Terminal launcher with local provider setup and zero host leaks.
     - **Claude Code (`claude`)**: Single-line launcher passing `-tt` and streaming `ANTHROPIC_API_KEY`.
     - **Aider / Codex**: Dedicated command strings for `aider` with terminal ANSI support.
     - **Cursor / VS Code**: Remote-SSH URI connecting the editor directly to the isolated guest.
4. **Hardened Dual-Stack Network Firewall**:
   - Interactive toggles to block private LAN subnets and cloud metadata services.
   - Whitelist generator for Google AI, Anthropic, OpenAI, GitHub, packagist.org, npm, and PyPI.
   - Outputs complete `iptables` / `ip6tables` / `nftables` rules including IPv6 drop and DNS restriction.
5. **Security Hardening Audit Lab**:
   - 12-point interactive checklist verifying that the host cannot be compromised (verifying zero mounts, IPv6 disabled, and memory-only secrets).
   - Interactive safety simulator testing breakout commands (`cat ~/.ssh/id_rsa`, `ping 192.168.1.1`, `sudo rm -rf /`, `curl 169.254.169.254`).
6. **1-Click Export & Control Bundle**:
   - Download complete bundle with `launch.sh` (1-command launch) and `nuke-and-rebuild.sh` (instant zero-persistence wipe and recreate).

#### Visual Identity & Theme
- **Aesthetic Direction**: High-density developer console following `references/3_saas_dashboard.md`.
- **Color Palette**:
  - Neutral Canvas: Dark slate (`#0B0F17` / `#0F172A`)
  - Structural Surfaces: Hairline bordered cards (`#1E293B`, `border border-slate-800`)
  - Accent / Focus: Electric Cyan (`#06B6D4` / `#0EA5E9`)
  - Semantic Status: Emerald (`#10B981`) for verified isolation rules, Amber (`#F59E0B`) for warnings, Crimson (`#EF4444`) for high-risk misconfigurations
- **Typography**:
  - Display & Headings: `Plus Jakarta Sans`
  - Body Text: `DM Sans` / `Public Sans`
  - Code & Telemetry: `JetBrains Mono` with strict `tabular-nums`

---

### 4. Technical Architecture & System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AgentSandbox MicroVM Workbench                        │
│                                                                             │
│  ┌───────────────────────┐  ┌────────────────────────────────────────────┐  │
│  │ Host Platform         │  │ Guest Engine Selector                      │  │
│  │ [macOS (Lima)]        │  │ [Ubuntu LTS (Latest)]  [NixOS (Latest)]    │  │
│  │ [Linux (Incus/KVM)]   │  │                                            │  │
│  │ [Windows 11 (WSL2)]   │  │ Up-to-Date Toolchains:                     │  │
│  └──────────┬────────────┘  │  PHP+Composer, Node, Python, Rust, Go      │  │
│             │               │  [Snapshot Lock: Active/Flexible]          │  │
│             │               └─────────────────────┬──────────────────────┘  │
│             ▼                                     ▼                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ MicroVM Specification & Configuration Generator                       │  │
│  │  - Hypervisor.framework (vz) / KVM / Hyper-V Engine                   │  │
│  │  - Zero-Mount Host Isolation (mounts: [] / automount = false)         │  │
│  │  - Dual-Layer Storage (tmpfs workspace + immutable base runtimes)     │  │
│  │  - Dual-Stack Firewall (IPv6 drop + RFC1918 block + DNS proxy lock)   │  │
│  └──────────┬───────────────────────────────┬────────────────────────────┘  │
│             │                               │                               │
│             ▼                               ▼                               │
│  ┌───────────────────────────┐ ┌──────────────────────────────────────────┐ │
│  │ Agent SSH & CLI Bridge    │ │ Security Hardening Audit & Test Lab      │ │
│  │  - Google AI (Gemini/Agy) │ │  - 12 Verification Security Checkpoints  │ │
│  │  - OpenCode / Claude Code │ │  - Interactive Exploit/Breakout Simulator│ │
│  │  - Aider / Codex / Cursor │ │  - Network Egress Containment Inspector  │ │
│  │  - PTY Allocation (-tt)   │ └──────────────────────────────────────────┘ │
│  │  - In-Memory Secret Pipe  │                                              │
│  └──────────┬────────────────┘                                              │
│             │                                                               │
│             ▼                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Exportable MicroVM Artifacts & Bundle Generator                       │  │
│  │  - macOS: lima.yaml (Apple VZ) & launch-lima.sh                       │  │
│  │  - Linux: incus-profile.yaml & launch-incus.sh                        │  │
│  │  - Windows 11: wsl-sandbox.conf, .wslconfig & launch-wsl.bat          │  │
│  │  - Guest OS: flake.nix (NixOS) / cloud-init.yaml (Ubuntu)             │  │
│  │  - Network: egress-firewall.sh & ssh_config                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Core Components & Interactive Views:
1. `MicroVmConfiguratorView`: Real-time interactive configurator for Host (macOS Lima, Linux Incus, Windows WSL2), Guest OS (Ubuntu LTS vs NixOS), CPU/RAM slider, and up-to-date dynamic toolchain toggles (including PHP + Composer and Version Snapshot Lock).
2. `ManifestPreviewView`: Live syntax-highlighted code viewers for `lima.yaml`, `flake.nix`, `cloud-init.yaml`, `.wslconfig`, and launch scripts, with 1-click clipboard copy.
3. `AgentSshGatewayView`: Specific bridge setups for Google Gemini CLI / Agy (`agy` / `gemini-cli`), OpenCode (`opencode`), Claude Code (`claude`), Aider/Codex, and Cursor/VS Code SSH tunneling, complete with one-click key generation, sandbox SSH server configs, PTY terminal setup, and transient secret pipes.
4. `NetworkFirewallView`: Dual-stack egress policy generator with interactive toggle switches for blocking LAN and metadata endpoints, IPv6 dropping, DNS restriction, and whitelisting Google AI/Packagist/npm/PyPI/GitHub/Anthropic/OpenAI.
5. `SecurityAuditLabView`: 12-point security checklist and an interactive breakout simulator demonstrating how dangerous commands are trapped safely inside the MicroVM.
6. `BundleExportModal`: One-click copy or download of the complete MicroVM sandbox package and quickstart guide.
