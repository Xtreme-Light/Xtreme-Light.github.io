/**
 * Fedora 初始化脚本模块数据
 *
 * 用于 Fedora 初始化脚本生成工具。每个模块可独立勾选，最终组合为单一可执行脚本。
 *
 * 注意：脚本代码使用模板字面量存储，其中
 *  - bash 的 ${VAR} 写作 \${VAR} 以避免 JS 插值
 *  - bash 的反斜杠（如 \033、\K、\.、\n）写作 \\ 以保留字面量
 */
export type FedoraModuleCategory =
  | "system"
  | "devtools"
  | "apps"
  | "keyd"
  | "env";

export interface FedoraModule {
  /** 模块唯一标识，例如 system-mirror */
  id: string;
  /** 显示名称 */
  name: string;
  /** 功能描述 */
  description: string;
  /** 所属分类 */
  category: FedoraModuleCategory;
  /** 依赖的其他模块 id 列表（用于前端联动提示） */
  deps: string[];
  /** 模块脚本代码（不含函数包裹，生成时由调用方包裹为 func_xxx 函数） */
  script: string;
}

/**
 * 公共库代码（所有生成脚本都必须包含的头部）
 *
 * 包含：shebang + set -euo pipefail + config.sh + lib/common.sh + lib/check.sh
 * + lib/mirror.sh + sudo 预检。生成器可在 shebang 之后插入生成时间、模块列表等注释。
 */
export const COMMON_HEADER = `#!/bin/bash
# Fedora 开发环境初始化脚本（按需生成）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

# ---- config.sh ----
PROXY_HOST="127.0.0.1"
PROXY_PORT="12334"
PROXY_URL="http://\${PROXY_HOST}:\${PROXY_PORT}"
APPIMAGE_DIR="\${HOME}/Applications"
MIRROR_SITES=(
    "mirrors.tuna.tsinghua.edu.cn"
    "mirrors.ustc.edu.cn"
    "mirrors.zju.edu.cn"
    "repo.huaweicloud.com"
    "mirrors.aliyun.com"
    "mirrors.163.com"
    "mirrors.bfsu.edu.cn"
)
GITHUB_PROXIES=(
    "https://ghfast.top/"
    "https://fastgit.cc/"
    "https://ghproxylist.com/"
    "https://gh-proxy.com/"
    "https://ghproxy.net/"
    "https://ghproxy.homeboyc.cn/"
    "http://toolwa.com/github/"
    "https://gh.meali.top/"
    "https://g.z321.cc.cd/"
    "https://777.z321.cc.cd/"
)
BASE_PKGS=(
    "webkit2gtk4.1-devel" "openssl-devel" "curl" "wget" "file"
    "libappindicator-gtk3-devel" "librsvg2-devel" "libxdo-devel"
    "git" "patch" "vim" "nano" "htop" "fastfetch" "gnome-tweaks"
    "jq" "bc" "make" "gcc" "zlib-devel" "bzip2" "bzip2-devel"
    "readline-devel" "sqlite" "sqlite-devel" "tk-devel" "libffi-devel"
    "xz-devel" "fuse" "fuse-libs"
)

# ---- lib/common.sh ----
RED='\\033[0;31m'; GREEN='\\033[0;32m'; YELLOW='\\033[1;33m'; BLUE='\\033[0;34m'; NC='\\033[0m'
print_info()    { echo -e "\${GREEN}[INFO]\${NC} $1" >&2; }
print_warning() { echo -e "\${YELLOW}[WARN]\${NC} $1" >&2; }
print_error()   { echo -e "\${RED}[ERROR]\${NC} $1" >&2; }
print_skip()    { echo -e "\${BLUE}[SKIP]\${NC} $1 已安装，跳过" >&2; }
print_banner() { echo >&2; print_info "=========================================="; print_info "$1"; print_info "=========================================="; }
command_exists() { command -v "$1" >/dev/null 2>&1; }
curl_proxy() { curl -sSL -x "\${PROXY_URL}" "$@"; }

# ---- lib/check.sh ----
is_dnf_installed() { local pkg=$1; rpm -qa --qf '%{NAME}\\n' | grep -qi "^\${pkg}$"; }
is_flatpak_installed() { local app=$1; flatpak list --app | grep -q "$app"; }
is_command_installed() { command_exists "$1"; }
is_path_installed() { local path=$1; [ -e "$path" ]; }
check_and_install() {
    local check_type=$1 check_target=$2 install_cmd=$3 pkg_name=$4
    case "$check_type" in
        dnf) is_dnf_installed "$check_target" && { print_skip "$pkg_name"; return 0; } ;;
        flatpak) is_flatpak_installed "$check_target" && { print_skip "$pkg_name"; return 0; } ;;
        command) is_command_installed "$check_target" && { print_skip "$pkg_name"; return 0; } ;;
        path) is_path_installed "$check_target" && { print_skip "$pkg_name"; return 0; } ;;
        *) print_error "未知检查类型: $check_type"; return 1 ;;
    esac
    print_info "安装 $pkg_name..."; eval "$install_cmd"; return 0
}

# ---- lib/mirror.sh ----
test_mirror_latency() {
    local mirror=$1
    local test_url="https://\${mirror}/fedora/linux/releases/$(rpm -E %fedora)/Everything/x86_64/os/repodata/repomd.xml"
    local result http_code latency
    result=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" --connect-timeout 5 --max-time 10 "\${test_url}" 2>/dev/null)
    http_code=$(echo "$result" | awk '{print $1}'); latency=$(echo "$result" | awk '{print $2}')
    if [ "$http_code" = "200" ] && [ -n "$latency" ] && [ "$(echo "$latency < 30" | bc)" -eq 1 ]; then echo "$latency"; else echo "999"; fi
}
select_best_mirror() {
    local best_mirror="" best_latency=999
    print_info "正在测试国内镜像源延迟（约需 10-20 秒）..."
    local mirror latency
    for mirror in "\${MIRROR_SITES[@]}"; do
        latency=$(test_mirror_latency "\${mirror}")
        if [ "$(echo "$latency < $best_latency" | bc)" -eq 1 ]; then best_latency=$latency; best_mirror=$mirror; print_info "  ✅ \${mirror} - \${latency}s (当前最优)"; else print_info "  ⏳ \${mirror} - \${latency}s"; fi
    done
    if [ -n "$best_mirror" ]; then print_info "选择最快镜像源: \${best_mirror} (延迟: \${best_latency}s)"; echo "$best_mirror"; else print_warning "所有镜像源均不可用，使用默认清华源"; echo "mirrors.tuna.tsinghua.edu.cn"; fi
}
test_proxy_latency() { local proxy=$1 latency; latency=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 --max-time 5 "\${proxy}" 2>/dev/null); if [ -n "$latency" ] && [ "$(echo "$latency < 10" | bc)" -eq 1 ]; then echo "$latency"; else echo "999"; fi; }
select_best_proxy() {
    local best_proxy="" best_latency=999
    print_info "正在测试 GitHub 代理延迟..."
    local proxy latency
    for proxy in "\${GITHUB_PROXIES[@]}"; do
        latency=$(test_proxy_latency "\${proxy}")
        if [ "$(echo "$latency < $best_latency" | bc)" -eq 1 ]; then best_latency=$latency; best_proxy=$proxy; print_info "  ✅ \${proxy} - \${latency}s (当前最优)"; else print_info "  ⏳ \${proxy} - \${latency}s"; fi
    done
    if [ -n "$best_proxy" ]; then print_info "选择最优代理: \${best_proxy} (延迟: \${best_latency}s)"; echo "$best_proxy"; else print_warning "所有代理均不可用，将使用本地代理直连"; echo ""; fi
}
_BEST_GITHUB_PROXY=""
github_download() {
    local url=$1 output=$2
    if [ -z "$_BEST_GITHUB_PROXY" ]; then _BEST_GITHUB_PROXY=$(select_best_proxy); fi
    _is_html_file() { local f=$1; [ -f "$f" ] && head -c 20 "$f" | grep -qi '<!DOCTYPE\\|<html'; }
    if [ -n "$_BEST_GITHUB_PROXY" ]; then
        local proxy_url="\${_BEST_GITHUB_PROXY}\${url}"
        print_info "通过代理下载: \${proxy_url}"
        curl -sSL -x "\${PROXY_URL}" -o "\${output}" "\${proxy_url}"
        if ! _is_html_file "\${output}"; then return 0; fi
        print_warning "代理返回 HTML 而非文件，尝试其他代理..."; rm -f "\${output}"
    fi
    local proxy
    for proxy in "\${GITHUB_PROXIES[@]}"; do
        [ "$proxy" = "$_BEST_GITHUB_PROXY" ] && continue
        local proxy_url="\${proxy}\${url}"
        print_info "尝试代理: \${proxy_url}"
        curl -sSL -x "\${PROXY_URL}" -o "\${output}" "\${proxy_url}"
        if ! _is_html_file "\${output}"; then print_info "代理 \${proxy} 下载成功"; return 0; fi
        rm -f "\${output}"
    done
    print_warning "所有代理均失败，直连下载: \${url}"
    curl -sSL -x "\${PROXY_URL}" -o "\${output}" "\${url}"
}

# ---- sudo 预检 ----
SUDO_CHECKED=0
check_sudo() {
    [ "$SUDO_CHECKED" -eq 1 ] && return 0
    if ! sudo -v 2>/dev/null; then
        print_error "sudo 不可用，本脚本需要 root 权限安装系统包"
        exit 1
    fi
    SUDO_CHECKED=1
}
`;

/**
 * 全部可选功能模块。
 *
 * 依赖关系（前端联动提示用）：
 *  - devtools-tauri → devtools-rust
 *  - devtools-codex → devtools-nvm-node
 *  - apps-docker-config → apps-docker
 *  - apps-docker-group → apps-docker
 *  - keyd-config → keyd-install
 *  - keyd-service → keyd-config
 *  - env-maven → apps-idea
 */
export const MODULES: FedoraModule[] = [
  // ============ system 模块 ============
  {
    id: "system-libreoffice",
    name: "卸载 LibreOffice",
    description: "检测并卸载 LibreOffice 套件以释放空间",
    category: "system",
    deps: [],
    script: `# 卸载 LibreOffice
print_info "卸载 LibreOffice..."
if is_dnf_installed "libreoffice-core"; then
    if sudo dnf remove -y libreoffice*; then
        print_info "LibreOffice 已卸载"
    else
        print_warning "LibreOffice 卸载失败，请手动检查"
    fi
else
    print_info "LibreOffice 未安装，跳过"
fi
`,
  },
  {
    id: "system-mirror",
    name: "配置最快镜像源",
    description:
      "测试国内镜像延迟，选择并切换至最快 dnf 镜像源（依赖 mirror.sh）",
    category: "system",
    deps: [],
    script: `# 选择最快镜像源并换源
print_info "选择并配置最快镜像源..."
local best_mirror
best_mirror=$(select_best_mirror)
[ -z "$best_mirror" ] && best_mirror="mirrors.tuna.tsinghua.edu.cn"
sudo mkdir -p /etc/yum.repos.d/backup
if [ ! -f /etc/yum.repos.d/backup/fedora.repo.bak ]; then
    sudo cp /etc/yum.repos.d/fedora.repo /etc/yum.repos.d/backup/fedora.repo.bak 2>/dev/null || true
fi
if [ ! -f /etc/yum.repos.d/backup/fedora-updates.repo.bak ]; then
    sudo cp /etc/yum.repos.d/fedora-updates.repo /etc/yum.repos.d/backup/fedora-updates.repo.bak 2>/dev/null || true
fi
sudo cp /etc/yum.repos.d/backup/fedora.repo.bak /etc/yum.repos.d/fedora.repo 2>/dev/null || true
sudo cp /etc/yum.repos.d/backup/fedora-updates.repo.bak /etc/yum.repos.d/fedora-updates.repo 2>/dev/null || true
sudo sed -e "s|^metalink=|#metalink=|g" \\
         -e "s|^#baseurl=http://download.example/pub/fedora/linux|baseurl=https://\${best_mirror}/fedora/linux|g" \\
         -i.bak \\
         /etc/yum.repos.d/fedora.repo \\
         /etc/yum.repos.d/fedora-updates.repo
print_info "系统已切换至最快镜像源: \${best_mirror}"
`,
  },
  {
    id: "system-dnfconf",
    name: "优化 dnf.conf",
    description: "为 /etc/dnf/dnf.conf 添加 fastestmirror 与并行下载配置",
    category: "system",
    deps: [],
    script: `# 配置 dnf.conf
print_info "配置 /etc/dnf/dnf.conf..."
local dnf_conf="/etc/dnf/dnf.conf"
if ! sudo grep -q "^fastestmirror=" "$dnf_conf"; then
    echo "fastestmirror=true" | sudo tee -a "$dnf_conf" > /dev/null
    print_info "  已添加 fastestmirror=true"
else
    print_skip "fastestmirror"
fi
if ! sudo grep -q "^max_parallel_downloads=" "$dnf_conf"; then
    echo "max_parallel_downloads=10" | sudo tee -a "$dnf_conf" > /dev/null
    print_info "  已添加 max_parallel_downloads=10"
else
    print_skip "max_parallel_downloads"
fi
`,
  },
  {
    id: "system-rpmfusion",
    name: "启用 RPM Fusion",
    description: "安装 RPM Fusion 自由/非自由软件源",
    category: "system",
    deps: [],
    script: `# 启用 RPM Fusion
print_info "启用 RPM Fusion 源..."
if ! is_dnf_installed "rpmfusion-free-release"; then
    local fedora_ver
    fedora_ver=$(rpm -E %fedora)
    sudo env http_proxy="\${PROXY_URL}" https_proxy="\${PROXY_URL}" dnf install -y \\
        "https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-\${fedora_ver}.noarch.rpm" \\
        "https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-\${fedora_ver}.noarch.rpm"
    print_info "RPM Fusion 已启用"
else
    print_skip "RPM Fusion"
fi
`,
  },
  {
    id: "system-update",
    name: "系统更新",
    description: "执行 dnf update 更新所有系统软件包",
    category: "system",
    deps: [],
    script: `# 系统更新
print_info "更新系统软件包..."
sudo dnf update -y
`,
  },
  {
    id: "system-basepkgs",
    name: "安装基础包",
    description: "安装 BASE_PKGS 列表中的开发与系统基础依赖",
    category: "system",
    deps: [],
    script: `# 安装基础依赖
print_info "安装系统基础依赖..."
local pkg
for pkg in "\${BASE_PKGS[@]}"; do
    check_and_install dnf "$pkg" "sudo dnf install -y $pkg" "$pkg"
done
`,
  },
  {
    id: "system-cdevtools",
    name: "C 开发工具组",
    description: "安装 dnf 组 C Development Tools and Libraries",
    category: "system",
    deps: [],
    script: `# C 开发工具组
if ! sudo dnf group list installed "C Development Tools and Libraries" &>/dev/null; then
    print_info "安装 C Development Tools and Libraries..."
    sudo dnf group install -y "C Development Tools and Libraries"
else
    print_skip "C Development Tools and Libraries"
fi
`,
  },
  {
    id: "system-ssh",
    name: "SSH 服务",
    description: "安装 openssh-server 并启用 sshd 服务与防火墙规则",
    category: "system",
    deps: [],
    script: `# SSH 服务
print_info "配置 SSH 服务..."
if ! is_dnf_installed "openssh-server"; then
    sudo dnf install -y openssh-server
else
    print_skip "openssh-server"
fi
sudo systemctl enable sshd 2>/dev/null || true
sudo systemctl start sshd 2>/dev/null || true
sudo firewall-cmd --add-service=ssh --permanent 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true
`,
  },

  // ============ devtools 模块 ============
  {
    id: "devtools-rust",
    name: "Rust + cargo 镜像",
    description: "通过 rustup 安装 Rust，并配置 rsproxy.cn 镜像源",
    category: "devtools",
    deps: [],
    script: `# Rust
print_info "安装 Rust..."
if ! is_command_installed "rustc"; then
    export RUSTUP_DIST_SERVER="https://rsproxy.cn"
    export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
    curl --proto '=https' --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh -s -- -y
    mkdir -p ~/.cargo
    cat > ~/.cargo/config.toml << 'RUSTEOF'
[source.crates-io]
replace-with = 'rsproxy-sparse'
[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"
[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"
[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"
[net]
git-fetch-with-cli = true
RUSTEOF
    source ~/.cargo/env
else
    print_skip "Rust"
fi
`,
  },
  {
    id: "devtools-tauri",
    name: "Tauri CLI",
    description: "通过 cargo install 安装 Tauri CLI",
    category: "devtools",
    deps: ["devtools-rust"],
    script: `# Tauri CLI
if ! is_command_installed "tauri"; then
    cargo install tauri-cli
else
    print_skip "Tauri CLI"
fi
`,
  },
  {
    id: "devtools-pip",
    name: "pip 清华镜像",
    description: "写入 ~/.config/pip/pip.conf 配置清华 PyPI 镜像",
    category: "devtools",
    deps: [],
    script: `# pip 国内镜像
print_info "配置 pip 国内镜像..."
local pip_config_dir="\${HOME}/.config/pip"
mkdir -p "$pip_config_dir"
if [ ! -f "$pip_config_dir/pip.conf" ]; then
    cat > "$pip_config_dir/pip.conf" << 'PIPEOF'
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
timeout = 120
PIPEOF
    print_info "已写入 ~/.config/pip/pip.conf"
else
    print_skip "pip 镜像配置"
fi
`,
  },
  {
    id: "devtools-nvm-node",
    name: "NVM + Node.js LTS",
    description: "安装 NVM 与 Node.js LTS，并配置 npmmirror 镜像",
    category: "devtools",
    deps: [],
    script: `# NVM 和 Node.js
print_info "安装 NVM..."
if ! is_path_installed "$HOME/.nvm/nvm.sh"; then
    curl_proxy -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
else
    print_skip "NVM"
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
if ! grep -q "NVM_NODEJS_ORG_MIRROR" ~/.bashrc; then
    echo 'export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node' >> ~/.bashrc
    echo 'export NVM_NPM_MIRROR=https://npmmirror.com/mirrors/npm' >> ~/.bashrc
fi
if ! is_command_installed "node"; then
    nvm install --lts
    nvm use --lts
else
    print_skip "Node.js"
fi
`,
  },
  {
    id: "devtools-claude",
    name: "Claude Code CLI",
    description: "安装 Claude Code CLI 并配置环境变量",
    category: "devtools",
    deps: [],
    script: `# Claude Code CLI
print_info "安装 Claude Code CLI..."
if ! is_command_installed "claude"; then
    curl_proxy -fsSL https://claude.ai/install.sh | bash
else
    print_skip "Claude Code"
fi
if ! grep -q "CLAUDE_CODE_ATTRIBUTION_HEADER" ~/.bashrc; then
    echo 'export CLAUDE_CODE_ATTRIBUTION_HEADER=0' >> ~/.bashrc
fi
`,
  },
  {
    id: "devtools-ccswitch",
    name: "CC Switch CLI",
    description: "从 GitHub 安装 CC Switch CLI",
    category: "devtools",
    deps: [],
    script: `# CC Switch CLI
print_info "安装 CC Switch..."
if ! is_command_installed "cc-switch"; then
    curl -fsSL -x "\${PROXY_URL}" \\
        https://github.com/SaladDay/cc-switch-cli/releases/latest/download/install.sh | bash
else
    print_skip "CC Switch"
fi
`,
  },
  {
    id: "devtools-codex",
    name: "Codex CLI",
    description: "通过 npm 全局安装 OpenAI Codex CLI",
    category: "devtools",
    deps: ["devtools-nvm-node"],
    script: `# Codex CLI
print_info "安装 Codex CLI..."
mkdir -p ~/.local/bin
export PATH="$HOME/.local/bin:$PATH"
if ! is_command_installed "codex"; then
    npm install -g @openai/codex --prefix "$HOME/.local"
else
    print_skip "Codex"
fi
`,
  },
  {
    id: "devtools-starship",
    name: "Starship 提示符",
    description: "安装 Starship 并写入 bashrc 与默认配置",
    category: "devtools",
    deps: [],
    script: `# Starship 提示符
print_info "安装 Starship..."
if ! is_command_installed "starship"; then
    curl -sSL -x "\${PROXY_URL}" https://starship.rs/install.sh \\
        | env http_proxy="\${PROXY_URL}" https_proxy="\${PROXY_URL}" sh -s -- -y
else
    print_skip "Starship"
fi
if ! grep -q 'starship init' ~/.bashrc; then
    print_info "配置 Starship 到 ~/.bashrc..."
    cat >> ~/.bashrc << 'STAREOF'

# Starship 提示符
eval "$(starship init bash)"
STAREOF
else
    print_skip "Starship bashrc 配置"
fi
local starship_config_dir="\${HOME}/.config"
mkdir -p "$starship_config_dir"
if [ ! -f "$starship_config_dir/starship.toml" ]; then
    print_info "写入默认 starship.toml..."
    cat > "$starship_config_dir/starship.toml" << 'TOMLEOF'
# Starship 配置 - https://starship.rs/config/
[package]
disabled = true
[directory]
truncation_length = 3
truncate_to_repo = true
[cmd_duration]
min_time = 2_000
TOMLEOF
else
    print_skip "starship.toml"
fi
`,
  },

  // ============ apps 模块 ============
  {
    id: "apps-brave",
    name: "Brave 浏览器",
    description: "添加 Brave 官方仓库并安装 Brave 浏览器",
    category: "apps",
    deps: [],
    script: `# Brave 浏览器
print_info "安装 Brave 浏览器..."
if ! is_command_installed "brave-browser"; then
    sudo env http_proxy="\${PROXY_URL}" https_proxy="\${PROXY_URL}" \\
        dnf config-manager addrepo --from-repofile=https://brave-browser-rpm-release.s3.brave.com/brave-browser.repo || true
    sudo env http_proxy="\${PROXY_URL}" https_proxy="\${PROXY_URL}" dnf install -y brave-browser
else
    print_skip "brave-browser"
fi
`,
  },
  {
    id: "apps-multica",
    name: "Multica Desktop",
    description: "从 GitHub 下载 Multica Desktop 最新版 RPM 并安装",
    category: "apps",
    deps: [],
    script: `# Multica Desktop
print_info "安装 Multica Desktop..."
if ! is_command_installed "multica"; then
    local latest_version rpm_url rpm_file
    latest_version=$(curl -s -x "\${PROXY_URL}" \\
        https://api.github.com/repos/multica-ai/multica/releases/latest | \\
        grep -oP '"tag_name": "\\K(.*?)(?=")' | sed 's/^v//') || latest_version="0.3.26"
    rpm_url="https://github.com/multica-ai/multica/releases/download/v\${latest_version}/multica-desktop-\${latest_version}-linux-x86_64.rpm"
    rpm_file="/tmp/multica-desktop-\${latest_version}.rpm"
    github_download "\${rpm_url}" "\${rpm_file}"
    sudo dnf install -y "\${rpm_file}"
    rm -f "\${rpm_file}"
else
    print_skip "Multica Desktop"
fi
`,
  },
  {
    id: "apps-idea",
    name: "IntelliJ IDEA Community",
    description:
      "下载并安装 IntelliJ IDEA Community 至 /opt/idea，创建桌面图标",
    category: "apps",
    deps: [],
    script: `# IntelliJ IDEA Community
print_info "安装 IntelliJ IDEA..."
if ! is_path_installed "/opt/idea/bin/idea.sh"; then
    local latest_idea_info idea_version idea_download_url idea_tar
    latest_idea_info=$(curl -s -x "\${PROXY_URL}" \\
        "https://data.services.jetbrains.com/products/releases?code=IIC&latest=true&type=release")
    if command_exists jq; then
        idea_version=$(echo "$latest_idea_info" | jq -r '.IIC[0].version')
        idea_download_url=$(echo "$latest_idea_info" | jq -r '.IIC[0].downloads.linux.link')
    else
        idea_version=$(echo "$latest_idea_info" | grep -oP '"version":"\\K[^"]+' | head -1)
        idea_download_url=$(echo "$latest_idea_info" | grep -oP '"linux":{"link":"\\K[^"]+' | head -1)
    fi
    print_info "最新 IDEA 版本: \${idea_version}"
    idea_tar="/tmp/ideaIC.tar.gz"
    curl -L -x "\${PROXY_URL}" -o "\${idea_tar}" "\${idea_download_url}"
    sudo tar -xzf "\${idea_tar}" -C /opt --transform='s/^[^/]*/idea/'
    mkdir -p ~/.local/share/applications
    cat > ~/.local/share/applications/jetbrains-idea.desktop << 'IDEAEOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=IntelliJ IDEA Community
Exec=/opt/idea/bin/idea.sh
Icon=/opt/idea/bin/idea.png
Terminal=false
Categories=Development;IDE;
IDEAEOF
    rm -f "\${idea_tar}"
else
    print_skip "IntelliJ IDEA"
fi
`,
  },
  {
    id: "apps-zed",
    name: "Zed 编辑器",
    description: "通过官方安装脚本安装 Zed 编辑器",
    category: "apps",
    deps: [],
    script: `# Zed 编辑器
print_info "安装 Zed 编辑器..."
if ! is_command_installed "zed"; then
    curl -f https://zed.dev/install.sh | ZED_CHANNEL=stable sh
else
    print_skip "Zed"
fi
`,
  },
  {
    id: "apps-appimagelauncher",
    name: "AppImageLauncher",
    description: "从 GitHub 下载 AppImageLauncher 最新 RPM 并安装",
    category: "apps",
    deps: [],
    script: `# AppImageLauncher
print_info "安装 AppImageLauncher..."
if ! is_command_installed "appimagelauncherd"; then
    local ail_rpm_url
    ail_rpm_url=$(curl -s -x "\${PROXY_URL}" \\
        https://api.github.com/repos/TheAssassin/AppImageLauncher/releases/latest \\
        | grep -oP '"browser_download_url": "\\K[^"]+x86_64\\.rpm' | head -1)
    if [ -z "$ail_rpm_url" ]; then
        print_warning "未找到 AppImageLauncher 最新 RPM 下载地址，跳过"
    else
        github_download "\${ail_rpm_url}" "/tmp/appimagelauncher.rpm"
        sudo dnf install -y "/tmp/appimagelauncher.rpm"
        rm -f "/tmp/appimagelauncher.rpm"
    fi
else
    print_skip "AppImageLauncher"
fi
`,
  },
  {
    id: "apps-hiddify",
    name: "Hiddify AppImage",
    description: "下载 Hiddify AppImage 到 ~/Applications 目录",
    category: "apps",
    deps: [],
    script: `# Hiddify AppImage
print_info "下载 Hiddify AppImage..."
mkdir -p "\${APPIMAGE_DIR}"
if ! ls "\${APPIMAGE_DIR}" 2>/dev/null | grep -qi "hiddify"; then
    local hiddify_url="https://github.com/hiddify/hiddify-app/releases/download/v4.1.1/Hiddify-Linux-x64-AppImage.AppImage"
    github_download "\${hiddify_url}" "\${APPIMAGE_DIR}/Hiddify.AppImage"
    chmod +x "\${APPIMAGE_DIR}/Hiddify.AppImage"
else
    print_skip "Hiddify AppImage"
fi
`,
  },
  {
    id: "apps-trae-cn",
    name: "Trae-CN",
    description: "仅提示从官网手动下载 RPM 安装 Trae-CN",
    category: "apps",
    deps: [],
    script: `# Trae-CN
print_info "安装 Trae-CN..."
if ! is_command_installed "trae-cn"; then
    print_warning "Trae-CN 需从官网下载 RPM 手动安装"
    print_warning "请访问 https://www.trae.cn/ide/download 下载 .rpm 包后执行:"
    print_warning "  sudo dnf install /path/to/trae-cn-*.rpm"
else
    print_skip "Trae-CN"
fi
`,
  },
  {
    id: "apps-wechat",
    name: "WeChat",
    description: "下载并安装 WeChat Linux RPM 及其依赖字体",
    category: "apps",
    deps: [],
    script: `# WeChat
print_info "安装 WeChat..."
if ! is_command_installed "wechat"; then
    sudo dnf install -y libatomic xcb-util-wm xcb-util-image xcb-util-renderutil xcb-util-keysyms google-noto-sans-cjk-fonts 2>/dev/null || true
    local wechat_rpm="/tmp/wechat-linux-x86_64.rpm"
    local wechat_url="https://dldir1v6.qq.com/weixin/StaticFiles/WeChatLinux_x86_64.rpm"
    curl -L -o "\${wechat_rpm}" "\${wechat_url}"
    if file "\${wechat_rpm}" | grep -q "RPM"; then
        sudo dnf install -y "\${wechat_rpm}"
    else
        print_warning "WeChat RPM 下载失败，请访问 https://linux.weixin.qq.com/ 手动下载"
    fi
    rm -f "\${wechat_rpm}"
else
    print_skip "WeChat"
fi
`,
  },
  {
    id: "apps-wps",
    name: "WPS Office",
    description: "下载并安装 WPS Office RPM",
    category: "apps",
    deps: [],
    script: `# WPS Office
print_info "安装 WPS Office..."
if ! is_command_installed "wps"; then
    local wps_url="https://wdl1.pcfg.cache.wpscdn.com/wpsdl/wpsoffice/download/linux/11664/wps-office-11.1.0.11664-1.x86_64.rpm"
    wget -x "\${PROXY_URL}" -O "/tmp/wps-office.rpm" "\${wps_url}"
    sudo dnf install -y "/tmp/wps-office.rpm"
    rm -f "/tmp/wps-office.rpm"
else
    print_skip "WPS Office"
fi
`,
  },
  {
    id: "apps-docker",
    name: "Docker Desktop",
    description: "添加 docker-ce 仓库并安装 Docker Desktop",
    category: "apps",
    deps: [],
    script: `# Docker Desktop
print_info "安装 Docker Desktop..."
if ! is_command_installed "docker"; then
    sudo tee /etc/yum.repos.d/docker-ce.repo > /dev/null << 'DOCKERREPO'
[docker-ce-stable]
name=Docker CE Stable - $basearch
baseurl=https://download.docker.com/linux/fedora/$releasever/$basearch/stable
enabled=1
gpgcheck=1
gpgkey=https://download.docker.com/linux/fedora/gpg
DOCKERREPO
    local docker_rpm="/tmp/docker-desktop-x86_64.rpm"
    local docker_url="https://desktop.docker.com/linux/main/amd64/docker-desktop-x86_64.rpm"
    curl -L -x "\${PROXY_URL}" -o "\${docker_rpm}" "\${docker_url}"
    sudo env http_proxy="\${PROXY_URL}" https_proxy="\${PROXY_URL}" dnf install -y "\${docker_rpm}"
    rm -f "\${docker_rpm}"
else
    print_skip "Docker Desktop"
fi
`,
  },
  {
    id: "apps-docker-config",
    name: "Docker daemon.json",
    description: "写入 /etc/docker/daemon.json 配置国内镜像加速与日志限制",
    category: "apps",
    deps: ["apps-docker"],
    script: `# Docker daemon.json
print_info "配置 Docker daemon.json..."
sudo mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
    sudo tee /etc/docker/daemon.json > /dev/null << 'DOCKERJSON'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io",
    "https://hub.rat.dev"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DOCKERJSON
    print_info "已写入 /etc/docker/daemon.json"
else
    print_skip "daemon.json"
fi
`,
  },
  {
    id: "apps-docker-group",
    name: "Docker 用户组",
    description: "将当前用户加入 docker 组并启用 docker-desktop 服务",
    category: "apps",
    deps: ["apps-docker"],
    script: `# Docker 用户组
print_info "配置 Docker 用户组..."
if ! groups "$(whoami)" | grep -qw docker; then
    sudo usermod -aG docker "$(whoami)"
    print_info "已将 $(whoami) 加入 docker 组（需重新登录生效）"
else
    print_skip "docker 用户组"
fi
if is_command_installed "docker"; then
    sudo systemctl enable --now docker-desktop 2>/dev/null || true
fi
`,
  },

  // ============ keyd 模块 ============
  {
    id: "keyd-install",
    name: "编译安装 keyd",
    description: "从 GitHub 克隆 keyd 源码并编译安装",
    category: "keyd",
    deps: [],
    script: `# 安装 keyd
print_info "安装 keyd..."
if ! is_command_installed "keyd"; then
    local keyd_src="/tmp/keyd-src"
    rm -rf "$keyd_src"
    git clone https://github.com/rvaiya/keyd.git "$keyd_src"
    cd "$keyd_src"
    make
    sudo make install
    cd - >/dev/null
    rm -rf "$keyd_src"
else
    print_skip "keyd"
fi
`,
  },
  {
    id: "keyd-config",
    name: "写入 keyd 配置",
    description: "写入 /etc/keyd/default.conf（capslock→esc/nav 层映射）并校验",
    category: "keyd",
    deps: ["keyd-install"],
    script: `# 写入 keyd 配置
print_info "写入 keyd 配置 /etc/keyd/default.conf..."
sudo mkdir -p /etc/keyd
sudo tee /etc/keyd/default.conf > /dev/null << 'KEYDEOF'
[ids]
*

[main]
# capslock: 短按(<250ms)为 esc, 250ms 内按其他键则进入 nav 层
capslock = timeout(esc, 250, layer(nav))

[nav]
h = left
j = down
k = up
l = right
a = home
e = end
d = delete
u = macro(home S-end delete)
space = backspace
f = C-right
b = C-left
z = C-z
x = C-x
c = C-c
v = C-v
KEYDEOF
print_info "keyd 配置已写入"
if sudo keyd check 2>/dev/null; then
    print_info "keyd 配置语法校验通过"
else
    print_warning "keyd 配置校验失败，请检查 /etc/keyd/default.conf"
fi
`,
  },
  {
    id: "keyd-service",
    name: "启用 keyd 服务",
    description: "启用并重启 keyd systemd 服务",
    category: "keyd",
    deps: ["keyd-config"],
    script: `# 启用 keyd 服务
print_info "启用 keyd 服务..."
sudo systemctl enable keyd 2>/dev/null || true
sudo systemctl restart keyd 2>/dev/null || true
sudo systemctl --no-pager status keyd 2>/dev/null | head -n5 || true
`,
  },

  // ============ env 模块 ============
  {
    id: "env-maven",
    name: "Maven 环境变量",
    description: "将 IDEA 内置 Maven 写入 ~/.bashrc 的 MAVEN_HOME/PATH",
    category: "env",
    deps: ["apps-idea"],
    script: `# Maven 环境变量
print_info "配置 Maven 环境变量..."
if [ -d "/opt/idea/plugins/maven/lib/maven3" ] && ! grep -q "MAVEN_HOME" ~/.bashrc; then
    echo 'export MAVEN_HOME=/opt/idea/plugins/maven/lib/maven3' >> ~/.bashrc
    echo 'export PATH=$MAVEN_HOME/bin:$PATH' >> ~/.bashrc
fi
`,
  },
  {
    id: "env-shell",
    name: "Shell 环境变量汇总",
    description: "将代理、Rust、NVM、Claude、Maven、PATH 等汇总写入 ~/.bashrc",
    category: "env",
    deps: [],
    script: `# Shell 环境变量汇总
print_info "配置 Shell 环境变量..."
if ! grep -q "# Fedora 开发环境配置" ~/.bashrc; then
    cat >> ~/.bashrc << 'SHELLEOF'

# ==================== Fedora 开发环境配置 ====================
# 代理（按需启用）
# export http_proxy=http://127.0.0.1:12334
# export https_proxy=http://127.0.0.1:12334

# Rust 镜像
export RUSTUP_DIST_SERVER="https://rsproxy.cn"
export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"

# NVM 镜像
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
export NVM_NPM_MIRROR=https://npmmirror.com/mirrors/npm

# Claude Code
export CLAUDE_CODE_ATTRIBUTION_HEADER=0

# Maven
export MAVEN_HOME=/opt/idea/plugins/maven/lib/maven3
export PATH=$MAVEN_HOME/bin:$PATH

# 用户本地 bin & AppImage
export PATH="$HOME/.local/bin:$PATH"
export PATH="\${HOME}/Applications:$PATH"
SHELLEOF
fi
`,
  },
  {
    id: "env-clean",
    name: "dnf 清理",
    description: "执行 dnf clean all 清理缓存",
    category: "env",
    deps: [],
    script: `# 清理
print_info "清理 dnf 缓存..."
sudo dnf clean all
`,
  },
  {
    id: "env-verify",
    name: "版本验证",
    description: "打印 Rust/Python/Node/Maven/Brave/Zed 版本并输出完成横幅",
    category: "env",
    deps: [],
    script: `# 版本验证
print_banner "验证关键工具版本"
echo "  Rust:     $(rustc --version 2>/dev/null || echo '未安装')"
echo "  Python:   $(python --version 2>/dev/null || echo '未安装')"
echo "  Node.js:  $(node --version 2>/dev/null || echo '未安装')"
echo "  Maven:    $(mvn -version 2>/dev/null | head -n1 || echo '未安装')"
echo "  Brave:    $(brave-browser --version 2>/dev/null || echo '未安装')"
echo "  Zed:      $(zed --version 2>/dev/null || echo '未安装')"
print_banner "Fedora 开发环境初始化完成！"
print_warning "请执行 'source ~/.bashrc' 使环境变量生效"
`,
  },
];
