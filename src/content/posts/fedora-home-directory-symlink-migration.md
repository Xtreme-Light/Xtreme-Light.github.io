---
pubDatetime: 2026-06-27T00:00:00+08:00
title: "Fedora 家目录大扫除：用软链接将 .cache、.docker 等迁移到数据盘"
featured: false
draft: false
tags:
  - Fedora
  - Linux
  - 软链接
  - 磁盘管理
  - 脚本
  - 折腾笔记
description: "通过软链接将家目录下的 .cache、.docker、.npm 等缓存目录迁移到数据盘，释放系统盘空间，附自动化 migrate.sh 脚本。"
---

## 前言

之前我把 `~/Documents` 和 `~/Downloads` 挂载到了两块独立硬盘上，系统盘的空间一下宽裕了很多。但很快发现，真正占地方的其实不止是 `Downloads`，**家目录里的各种隐藏缓存目录（`.cache`、`.docker`、`.npm` 等）才是隐藏的空间杀手**。

这篇文章分享我是如何把这些目录迁移到数据盘，以及一个自动化脚本，方便其他人复用这个思路。

## 现状分析

先看看家目录里有哪些"大户"：

```bash
du -sh ~/.cache ~/.docker ~/.npm ~/.cargo ~/.rustup ~/.pyenv ~/.nvm ~/.java ~/.local
```

在我的环境下，这些目录加起来占了 20+ GB 的系统盘空间。它们的共同特点是：

| 目录     | 用途                          | 增长速度           |
| -------- | ----------------------------- | ------------------ |
| `.cache` | 软件缓存                      | 几乎每天增长       |
| `.docker`| Docker 镜像/容器              | 拉取镜像即增长     |
| `.npm`   | npm 包缓存                    | 依赖更新即增长     |
| `.cargo` | Rust 依赖缓存                 | 编译即增长         |
| `.rustup`| Rust 工具链                   | 版本更新即增长     |
| `.pyenv` | Python 版本管理               | 安装新版本即增长   |
| `.nvm`   | Node.js 版本管理              | 安装新版本即增长   |
| `.java`  | Java 缓存                     | 使用 Java 工具即增长 |
| `.local` | 用户级安装的软件/pip 包       | 不定期增长         |

## 解决方案：软链接

核心思路很简单：

1. 在数据盘（挂载在 `~/Documents`）上创建对应的目录
2. 将家目录中的原目录移动到备份位置
3. 创建一个软链接，指向数据盘上的新位置

迁移后的访问路径：

```text
~/.cache  ──软链接──>  ~/Documents/.cache  ──实际数据──>  第二块硬盘
```

这样做的好处：

- **透明迁移**：应用程序完全无感知，依然是访问 `~/.cache`
- **随时可撤销**：删除软链接，把备份移回来即可
- **无需修改配置**：不需要修改任何环境变量或配置文件

## 迁移前的重要准备

### 1. 确保数据盘已挂载

执行 `df -h ~/Documents` 确认输出是独立硬盘而非系统盘。

### 2. 查看各目录大小

```bash
du -sh ~/.cache ~/.docker ~/.npm 2>/dev/null | sort -hr
```

### 3. 备份重要数据（可选但建议）

虽然迁移过程中不会删除数据，但保险起见可以做一个额外备份。

## 手动迁移示例

以迁移 `.cache` 为例：

```bash
# 1. 在数据盘创建目标目录
mkdir -p ~/Documents/.cache

# 2. 备份原目录（实质是重命名）
mv ~/.cache ~/.cache_backup

# 3. 创建软链接
ln -s ~/Documents/.cache ~/.cache

# 4. 将数据复制到新位置（如果备份中有数据）
cp -r ~/.cache_backup/* ~/Documents/.cache/

# 5. 验证迁移结果
ls -la ~/.cache   # 应显示为软链接
df -h ~/.cache    # 应显示挂载在数据盘

# 6. 确认无误后删除备份
rm -rf ~/.cache_backup
```

## 自动化脚本：migrate.sh

为了提升效率，我写了一个脚本，将上述过程自动化。

### 脚本功能

- `./migrate.sh add <目录列表>`：迁移指定目录
- `./migrate.sh status`：查看迁移状态
- `./migrate.sh list`：列出建议迁移的目录
- `./migrate.sh clean`：清理迁移后的备份文件
- 自动记录迁移历史，保存在 `~/.migrate_history.log`

### 完整脚本

```bash
#!/bin/bash
# ============================================
# 脚本名称: migrate.sh
# 功能: 将家目录中的配置/缓存目录迁移到 Documents 盘
# 用法:
#   ./migrate.sh list                    # 列出所有可迁移的目录
#   ./migrate.sh add <dir1> <dir2> ...   # 迁移指定目录
#   ./migrate.sh clean                   # 清理已迁移的目录（恢复软链接）
#   ./migrate.sh status                  # 查看迁移状态
# ============================================

set -e

# ---------- 配置区域 ----------
DOCS_DIR="$HOME/Documents"
BACKUP_SUFFIX="_backup"
HISTORY_FILE="$HOME/.migrate_history.log"
LOG_FILE="$HOME/.migrate_$(date +%Y%m%d_%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------- 函数定义 ----------

# 日志记录
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# 检查 Documents 目录是否存在
check_docs_dir() {
    if [ ! -d "$DOCS_DIR" ]; then
        log "${RED}错误: $DOCS_DIR 不存在，请先挂载 Documents 盘${NC}"
        exit 1
    fi
}

# 检查目标目录是否存在（迁移前）
check_target_exists() {
    local dir="$1"
    if [ ! -d "$HOME/$dir" ]; then
        return 1
    fi
    return 0
}

# 检查是否已迁移（软链接）
is_migrated() {
    local dir="$1"
    if [ -L "$HOME/$dir" ] && [ -d "$HOME/$dir" ]; then
        return 0
    fi
    return 1
}

# 记录迁移历史
record_migration() {
    local dir="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp | $dir | migrated to $DOCS_DIR/$dir" >> "$HISTORY_FILE"
}

# 记录清理历史
record_clean() {
    local dir="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp | $dir | cleaned (restored from backup)" >> "$HISTORY_FILE"
}

# ---------- 子命令: list ----------
cmd_list() {
    echo -e "${BLUE}可迁移的目录列表（建议优先迁移大体积目录）:${NC}"
    echo ""
    echo -e "${GREEN}高优先级（体积大，强烈推荐）:${NC}"
    echo "  .cache    - 软件缓存（浏览器、包管理器等）"
    echo "  .docker   - Docker 镜像和容器数据"
    echo "  .npm      - npm 包缓存"
    echo "  .cargo    - Rust cargo 缓存"
    echo "  .rustup   - Rust 工具链"
    echo "  .pyenv    - Python 版本管理"
    echo "  .nvm      - Node.js 版本管理"
    echo "  .java     - Java 缓存"
    echo "  .local    - 用户安装的软件和 pip 包"
    echo ""
    echo -e "${YELLOW}中等优先级（看使用习惯）:${NC}"
    echo "  .m2       - Maven 本地仓库（已迁移则跳过）"
    echo "  .claude   - Claude CLI 缓存"
    echo "  .xwechat  - 微信缓存"
    echo "  docker_data - 自定义 Docker 数据目录"
    echo ""
    echo -e "${BLUE}当前已迁移的目录:${NC}"
    cmd_status
}

# ---------- 子命令: status ----------
cmd_status() {
    local migrated=0
    if [ -f "$HISTORY_FILE" ]; then
        echo -e "${GREEN}迁移历史记录:${NC}"
        cat "$HISTORY_FILE"
        echo ""
    else
        echo -e "${YELLOW}暂无迁移记录${NC}"
    fi

    echo -e "${BLUE}当前软链接状态:${NC}"
    local dirs=".cache .docker .npm .cargo .rustup .pyenv .nvm .java .local .m2 .claude .xwechat docker_data"
    for dir in $dirs; do
        if [ -L "$HOME/$dir" ] && [ -d "$HOME/$dir" ]; then
            local target=$(readlink "$HOME/$dir")
            local size=$(du -sh "$HOME/$dir" 2>/dev/null | cut -f1)
            echo -e "  ${GREEN}✓${NC} $dir -> $target ($size)"
        elif [ -d "$HOME/$dir" ]; then
            local size=$(du -sh "$HOME/$dir" 2>/dev/null | cut -f1)
            echo -e "  ${YELLOW}○${NC} $dir (普通目录, $size)"
        fi
    done
}

# ---------- 子命令: add ----------
cmd_add() {
    if [ $# -eq 0 ]; then
        echo -e "${RED}错误: 请指定要迁移的目录${NC}"
        echo "用法: ./migrate.sh add <dir1> <dir2> ..."
        echo "示例: ./migrate.sh add .cache .docker .npm"
        echo "提示: 运行 ./migrate.sh list 查看所有可迁移目录"
        exit 1
    fi

    check_docs_dir

    local dirs_to_migrate=()
    local dirs_skipped=()

    # 收集需要迁移的目录
    for dir in "$@"; do
        # 去掉开头的 .（如果有）
        dir=$(echo "$dir" | sed 's/^\.//')
        dir=".$dir"

        if [ "$dir" = "." ]; then
            echo -e "${RED}错误: 无效的目录名${NC}"
            continue
        fi

        # 检查是否存在
        if ! check_target_exists "$dir"; then
            echo -e "${YELLOW}跳过 $dir: 目录不存在${NC}"
            dirs_skipped+=("$dir")
            continue
        fi

        # 检查是否已经迁移
        if is_migrated "$dir"; then
            echo -e "${YELLOW}跳过 $dir: 已经是软链接${NC}"
            dirs_skipped+=("$dir")
            continue
        fi

        dirs_to_migrate+=("$dir")
    done

    if [ ${#dirs_to_migrate[@]} -eq 0 ]; then
        echo -e "${YELLOW}没有需要迁移的目录${NC}"
        exit 0
    fi

    # 确认迁移
    echo -e "${BLUE}准备迁移以下目录:${NC}"
    for dir in "${dirs_to_migrate[@]}"; do
        local size=$(du -sh "$HOME/$dir" 2>/dev/null | cut -f1)
        echo -e "  - $dir (大小: $size)"
    done
    echo ""
    read -p "确认迁移？(y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi

    # 执行迁移
    echo "" >> "$LOG_FILE"
    log "${BLUE}========== 开始迁移 $(date) ==========${NC}"

    for dir in "${dirs_to_migrate[@]}"; do
        log "${BLUE}>> 正在迁移 $dir ...${NC}"

        # 在 Documents 下创建目标目录
        mkdir -p "$DOCS_DIR/$dir"

        # 检查目标目录是否为空（如果非空，提示用户）
        if [ -n "$(ls -A "$DOCS_DIR/$dir" 2>/dev/null)" ]; then
            log "${YELLOW}  警告: $DOCS_DIR/$dir 已有内容，将跳过该目录的迁移${NC}"
            continue
        fi

        # 备份原目录
        local backup_dir="$HOME/${dir}${BACKUP_SUFFIX}"
        if [ -d "$backup_dir" ]; then
            log "${YELLOW}  警告: 备份目录 $backup_dir 已存在，将被覆盖${NC}"
            rm -rf "$backup_dir"
        fi
        mv "$HOME/$dir" "$backup_dir"
        log "  ✅ 已备份到 $backup_dir"

        # 创建软链接
        ln -s "$DOCS_DIR/$dir" "$HOME/$dir"
        log "  ✅ 已创建软链接: $HOME/$dir -> $DOCS_DIR/$dir"

        # 复制数据到新位置
        log "  📦 正在复制数据（可能需要较长时间）..."
        cp -r "$backup_dir/"* "$DOCS_DIR/$dir/" 2>/dev/null || true
        log "  ✅ 数据已复制到 $DOCS_DIR/$dir"

        # 记录迁移历史
        record_migration "$dir"

        log "${GREEN}  ✅ $dir 迁移完成！${NC}"
        echo ""
    done

    log "${GREEN}========== 迁移完成！==========${NC}"
    echo ""
    echo -e "${GREEN}迁移日志已保存到: $LOG_FILE${NC}"
    echo -e "${YELLOW}提示: 请手动检查迁移结果，确认无误后执行 './migrate.sh clean' 清理备份${NC}"
    echo -e "${YELLOW}提示: 执行 './migrate.sh status' 查看迁移状态${NC}"
}

# ---------- 子命令: clean ----------
cmd_clean() {
    echo -e "${RED}⚠️  警告: 此操作将删除所有迁移目录的备份文件！${NC}"
    echo -e "${RED}⚠️  请确认数据已成功迁移到 Documents 盘！${NC}"
    echo ""

    # 显示将要删除的备份
    local has_backup=0
    for dir in .cache .docker .npm .cargo .rustup .pyenv .nvm .java .local .m2 .claude .xwechat; do
        local backup_dir="$HOME/${dir}${BACKUP_SUFFIX}"
        if [ -d "$backup_dir" ]; then
            local size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
            echo -e "  - ${dir}${BACKUP_SUFFIX} ($size)"
            has_backup=1
        fi
    done
    # 特殊处理 docker_data
    if [ -d "$HOME/docker_data_backup" ]; then
        local size=$(du -sh "$HOME/docker_data_backup" 2>/dev/null | cut -f1)
        echo -e "  - docker_data_backup ($size)"
        has_backup=1
    fi

    if [ $has_backup -eq 0 ]; then
        echo -e "${YELLOW}没有找到任何备份目录${NC}"
        exit 0
    fi

    echo ""
    read -p "确认删除以上所有备份？(y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi

    # 删除备份
    local deleted_count=0
    for dir in .cache .docker .npm .cargo .rustup .pyenv .nvm .java .local .m2 .claude .xwechat; do
        local backup_dir="$HOME/${dir}${BACKUP_SUFFIX}"
        if [ -d "$backup_dir" ]; then
            rm -rf "$backup_dir"
            record_clean "$dir"
            echo -e "  ✅ 已删除 ${dir}${BACKUP_SUFFIX}"
            deleted_count=$((deleted_count + 1))
        fi
    done
    # 特殊处理 docker_data
    if [ -d "$HOME/docker_data_backup" ]; then
        rm -rf "$HOME/docker_data_backup"
        record_clean "docker_data"
        echo -e "  ✅ 已删除 docker_data_backup"
        deleted_count=$((deleted_count + 1))
    fi

    echo ""
    echo -e "${GREEN}✅ 已删除 $deleted_count 个备份目录${NC}"
    echo -e "${GREEN}系统盘空间已释放！${NC}"
}

# ---------- 子命令: help ----------
cmd_help() {
    cat << EOF
${BLUE}migrate.sh - 家目录目录迁移工具${NC}

${YELLOW}用法:${NC}
  ./migrate.sh list                    列出所有可迁移的目录
  ./migrate.sh add <dir1> <dir2> ...   迁移指定目录到 Documents
  ./migrate.sh clean                   删除所有迁移后的备份目录
  ./migrate.sh status                  查看迁移状态
  ./migrate.sh help                    显示此帮助信息

${YELLOW}示例:${NC}
  ./migrate.sh list
  ./migrate.sh add .cache .docker .npm
  ./migrate.sh add .cache .docker .npm .cargo .rustup .pyenv .nvm .java .local
  ./migrate.sh status
  ./migrate.sh clean

${YELLOW}说明:${NC}
  - 迁移前会自动备份原目录（添加 _backup 后缀）
  - 迁移记录保存在 ~/.migrate_history.log
  - 操作日志保存在 ~/.migrate_*.log
  - 执行 clean 前请确认数据已成功迁移
EOF
}

# ---------- 主逻辑 ----------
main() {
    case "$1" in
        list)
            cmd_list
            ;;
        add)
            shift
            cmd_add "$@"
            ;;
        clean)
            cmd_clean
            ;;
        status)
            cmd_status
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            echo -e "${RED}未知命令: $1${NC}"
            cmd_help
            exit 1
            ;;
    esac
}

# ---------- 执行入口 ----------
main "$@"
```

## 使用示例

### 1. 查看可迁移的目录

```bash
chmod +x migrate.sh
./migrate.sh list
```

### 2. 迁移单个目录

```bash
./migrate.sh add .cache
```

### 3. 批量迁移

```bash
./migrate.sh add .cache .docker .npm .cargo .rustup .pyenv .nvm .java .local
```

### 4. 查看状态

```bash
./migrate.sh status
```

输出示例：

```text
迁移历史记录:
2026-06-27 20:30:15 | .cache | migrated to /home/dev/Documents/.cache
2026-06-27 20:30:20 | .docker | migrated to /home/dev/Documents/.docker

当前软链接状态:
  ✓ .cache -> /home/dev/Documents/.cache (2.3G)
  ✓ .docker -> /home/dev/Documents/.docker (5.1G)
  ○ .npm (普通目录, 456M)
```

### 5. 确认迁移成功后清理备份

```bash
./migrate.sh clean
```

## 验证迁移效果

迁移完成后，可以用以下命令确认：

```bash
# 查看系统盘可用空间是否增加
df -h /

# 查看各软链接的真实路径
ls -la ~ | grep "->"

# 验证应用程序是否正常工作
docker --version   # 如果迁移了 .docker
npm --version      # 如果迁移了 .npm
cargo --version    # 如果迁移了 .cargo
```

## 关于 ~/.local 迁移的特别说明

很多读者可能会担心迁移 `~/.local` 后，`pip install --user` 安装的命令或自定义脚本会失效。实际上在 Fedora 默认配置下不会，因为：

- `PATH` 环境变量中通常写的是 `~/.local/bin`（相对路径）
- 软链接会自动解析到真实路径
- 只有使用绝对路径 `/home/username/.local/bin` 时才需要更新

如果不确定，迁移后执行：

```bash
echo $PATH | grep local
which <你常用的用户级命令>
```

如果命令能找到，说明一切正常。

## 迁移历史与回滚

所有迁移操作都会记录在 `~/.migrate_history.log` 中：

```text
2026-06-27 20:30:15 | .cache | migrated to /home/dev/Documents/.cache
2026-06-27 20:35:22 | .docker | migrated to /home/dev/Documents/.docker
```

如果需要回滚某个目录：

```bash
# 删除软链接
rm ~/.cache

# 恢复备份
mv ~/.cache_backup ~/.cache
```

## 总结

通过这次迁移，我的系统盘释放了约 25 GB 空间，同时所有应用程序依然正常工作。这个方案的优点是：

- **低风险**：备份先行，随时可回滚
- **透明**：应用程序无感知
- **自动化**：脚本简化了重复操作
- **可追溯**：迁移历史记录完整

如果你也有类似的需求，不妨试试这个方案。脚本可以根据自己的环境稍作修改，比如将 `Documents` 换成其他挂载点。

## 相关资源

- [Linux 软链接完全指南（GNU coreutils 官方文档）](https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html)
