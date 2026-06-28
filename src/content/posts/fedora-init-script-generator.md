---
title: "Fedora 开发环境一键初始化：模块化脚本生成器"
pubDatetime: 2026-06-27T15:00:00Z
modDatetime: 2026-06-27T15:00:00Z
featured: true
draft: false
tags:
  - Fedora
  - Linux
  - 脚本
  - 自动化
  - 工具
description: "一个交互式的 Fedora 初始化脚本生成器，支持按需勾选功能模块（换源、开发工具、桌面应用等），自动处理依赖关系，生成可一键执行的组合脚本。"
---

## 为什么需要这个工具

每次重装 Fedora 后，配置开发环境是一件耗时的事：换源、安装基础包、配置开发工具链、安装桌面应用、设置键盘映射……手动执行这些步骤既繁琐又容易遗漏。

虽然我之前写了一个[模块化的 Fedora 初始化脚本](https://github.com/Xtreme-Light/fedora_init)，支持 `./fedora_init.sh system devtools` 这样的选择性执行，但有时你只需要其中几个小功能——比如只换源和配置 dnf.conf，不需要安装全套开发工具。

于是我做了一个**交互式脚本生成器**，让你像点菜一样勾选需要的功能，自动生成一份精简的可执行脚本。

> **工具地址**：[Fedora 初始化脚本生成器](/tools/fedora-init)

## 功能概览

### 35 个原子功能模块

生成器将初始化流程拆分为 35 个可独立勾选的功能单元，按 5 大分类组织：

| 分类 | 模块数 | 包含功能 |
|------|--------|---------|
| **系统配置** | 8 | 卸载 LibreOffice、镜像源优选换源、dnf.conf 优化、RPM Fusion、系统更新、基础包、C 工具组、SSH 服务 |
| **开发工具** | 8 | Rust + cargo 镜像、Tauri CLI、pip 清华镜像、NVM + Node.js、Claude Code、CC Switch、Codex、Starship |
| **桌面应用** | 12 | Brave、Multica、IDEA、Zed、AppImageLauncher、Hiddify、Trae-CN、WeChat、WPS、Docker Desktop + 配置 |
| **键盘映射** | 3 | keyd 编译安装、配置写入、服务启用 |
| **环境变量** | 4 | Maven、Shell 汇总、dnf 清理、版本验证 |

### 自动依赖处理

勾选模块时，生成器会自动检查依赖关系并补充：

- 勾选 **Tauri CLI** → 自动补充 **Rust**
- 勾选 **Codex CLI** → 自动补充 **NVM + Node.js**
- 勾选 **Docker 配置** → 自动补充 **Docker Desktop**
- 勾选 **keyd 配置** → 自动补充 **keyd 安装**
- 勾选 **Maven 环境变量** → 自动补充 **IntelliJ IDEA**

### 快捷配置

- **推荐配置**：一键勾选最常用的 13 个模块（换源、基础包、SSH、Rust、Node.js、Starship 等）
- **全选**：勾选全部 35 个模块
- **清空**：清除所有勾选

## 生成的脚本特点

### 幂等安全

所有功能都使用前置检查（`is_dnf_installed` / `is_command_installed` / `is_path_installed`），已安装则自动跳过，可安全重复执行。

### 镜像优选

换源功能不是写死某个镜像，而是**自动测速**7 个国内镜像（清华、USTC、浙大、华为云、阿里云、网易、北外），选择延迟最低的。

GitHub 下载同样支持代理优选：自动测试 10 个 GitHub 加速代理，选择最快的进行下载。

### 内置代理支持

脚本默认配置了本地 HTTP 代理（`127.0.0.1:12334`），用于加速 GitHub 等海外资源下载。如果你的代理端口不同，下载后修改脚本头部的 `PROXY_PORT` 即可。

### 完整的自包含脚本

生成的脚本是**单一文件**，不需要额外下载任何依赖文件。所有公共函数（日志、检查、镜像优选、GitHub 下载）都内联在脚本头部，拷贝到任何 Fedora 机器上都能直接运行。

## 使用方法

### 第一步：生成脚本

1. 打开 [脚本生成器](/tools/fedora-init)
2. 勾选你需要的功能模块
3. 点击"下载脚本"或"复制脚本"

### 第二步：执行脚本

```bash
# 赋予执行权限
chmod +x fedora-init.sh

# 执行（需要 sudo 权限）
./fedora-init.sh
```

### 第三步：生效环境变量

```bash
source ~/.bashrc
```

## 脚本结构示例

以"换源 + 基础包 + Rust + Starship"为例，生成的脚本结构如下：

```bash
#!/bin/bash
# Fedora 开发环境初始化脚本（按需生成）
set -euo pipefail

# ---- 公共库（config + common + check + mirror）----
# 颜色输出、日志函数、安装检查、镜像优选...

# ---- 功能函数 ----

func_system_mirror() {
    # 自动测速并换源
}

func_system_basepkgs() {
    # 安装 28 个基础包
}

func_devtools_rust() {
    # 安装 Rust + cargo 镜像
}

func_devtools_starship() {
    # 安装 Starship + bashrc 配置
}

# ---- 执行 ----

check_sudo
print_banner "Fedora 开发环境初始化"

func_system_mirror
func_system_basepkgs
func_devtools_rust
func_devtools_starship

print_banner "完成！"
```

## 与原始项目的关系

这个工具是基于我的 [fedora_init](https://github.com/Xtreme-Light/fedora_init) 项目构建的。原始项目是一个完整的模块化脚本，支持命令行参数选择模块执行：

```bash
# 原始项目的用法
./fedora_init.sh              # 全量执行
./fedora_init.sh system apps  # 选择性执行
```

而本工具进一步将模块拆分为**原子功能**（如把 system 拆为换源、dnf.conf、RPM Fusion 等 8 个独立项），让你可以更精细地选择需要的功能，并生成一个自包含的单一脚本。

## 技术实现

工具页面使用 Astro + Tailwind CSS 构建，完全在**客户端**运行（无需后端）：

1. 35 个模块的脚本代码以 TypeScript 数据文件存储
2. 用户勾选后，JavaScript 在浏览器中拼接生成脚本
3. 通过 Blob URL 实现下载功能

这意味着生成脚本的过程不需要网络请求，速度快且隐私安全。

## 适用场景

- **Fedora 新装系统**：一键配置开发环境
- **部分功能更新**：只换源或只安装某个应用
- **批量部署**：生成脚本后可在多台机器上执行
- **学习参考**：了解 Fedora 初始化的各个步骤

## 相关链接

- [脚本生成器工具](/tools/fedora-init)
- [原始项目仓库](https://github.com/Xtreme-Light/fedora_init)
- [Fedora 官方文档](https://docs.fedoraproject.org/)

---

如果你在使用过程中遇到问题，或有新的功能建议，欢迎在下方评论区留言。
