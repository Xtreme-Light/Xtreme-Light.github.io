---
pubDatetime: 2026-06-23T12:00:00+08:00
title: "Fedora 配置 keyd 键盘映射完全指南"
featured: false
draft: false
tags:
  - Fedora
  - Linux
  - keyd
  - 键盘映射
  - 折腾笔记
description: "在 Fedora 上安装配置 keyd 键盘映射守护进程，实现 Caps Lock 短按为 ESC、长按进入导航层的完整教程，附调试技巧与常见问题。"
---

## 什么是 keyd？

keyd 是一个轻量级、高性能的键盘映射守护进程，支持 Wayland 和 X11。它可以在系统层面自定义按键行为，实现诸如"短按为 ESC，长按为方向键层"这样的高级功能。

## 为什么选择 keyd？

- ✅ 支持 Wayland（Fedora 默认使用 Wayland）
- ✅ 低延迟，性能优秀
- ✅ 配置文件简单直观
- ✅ 支持按键层（Layer）和宏（Macro）
- ✅ 可针对不同键盘单独配置

## 安装 keyd

### 方法一：通过 Copr 仓库安装（推荐）

```bash
# 启用 Copr 仓库
sudo dnf copr enable alternateved/keyd

# 安装 keyd
sudo dnf install keyd
```

### 方法二：从源码编译安装

```bash
# 安装编译依赖
sudo dnf install git make gcc libevdev-devel systemd-devel

# 克隆源码
git clone https://github.com/rvaiya/keyd.git
cd keyd

# 编译安装
make
sudo make install
```

## 配置 keyd

### 1. 创建配置文件

```bash
sudo mkdir -p /etc/keyd
sudo vim /etc/keyd/default.conf
```

### 2. 我的完整配置

这个配置实现了以下功能：

**Caps Lock 键**：短按为 ESC，长按（250ms）进入导航层（nav）

**导航层（按住 Caps Lock 时）**：

- `h/j/k/l` → 方向键（左/下/上/右）
- `a/e` → Home/End
- `d` → Delete
- `u` → 删除整行（Home → Shift+End → Delete）
- `space` → Backspace
- `f/b` → Ctrl+右/左（跳单词）
- `z/x/c/v` → 对应 Ctrl 快捷键

```ini
[ids]
*

[main]

# 设置超时时间为250ms
capslock = timeout(esc)
capslock = layer(nav)

timeout = 250

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
```

### 3. 配置说明

| 配置项                          | 说明                          |
| ------------------------------- | ----------------------------- |
| `[ids] *`                       | 对所有键盘设备生效            |
| `[main]`                        | 默认层配置                    |
| `capslock = timeout(esc)`       | 短按 Caps Lock 触发 ESC       |
| `capslock = layer(nav)`         | 长按 Caps Lock 进入 nav 层    |
| `timeout = 250`                 | 长按判定时间（250ms）         |
| `[nav]`                         | 自定义导航层                  |
| `macro(home S-end delete)`      | 宏：Home → Shift+End → Delete |

## 启动 keyd

```bash
# 启动服务并设置开机自启
sudo systemctl enable --now keyd

# 查看服务状态
sudo systemctl status keyd

# 重新加载配置（修改配置后执行）
sudo keyd reload
# 或重启服务
sudo systemctl restart keyd
```

## 调试与测试

### 实时监控按键

```bash
sudo keyd monitor
```

运行后按下键盘，会实时显示按键事件，方便调试。

### 检查配置语法

```bash
sudo keyd check /etc/keyd/default.conf
```

### 查看服务日志

```bash
sudo journalctl -u keyd -f
```

## 常见问题

### Q: 服务启动失败，提示找不到 keyd 可执行文件？

A: 可能是源码和 dnf 混装导致路径混乱。彻底卸载后重新安装：

```bash
sudo dnf remove keyd
sudo rm -f /usr/local/bin/keyd /usr/bin/keyd
sudo systemctl daemon-reload
sudo dnf install keyd
```

### Q: keyd monitor 有输出但按键映射无效？

A: 检查配置文件语法，确保 `timeout` 放在 `[main]` 区块内，且没有语法错误。

### Q: 如何让配置只对特定键盘生效？

A: 在 `[ids]` 中指定设备 ID：

```bash
# 查看设备 ID
sudo keyd monitor
```

```ini
[ids]
05ac:0343:89b7fedc  # 你的键盘 ID

[main]
# 你的映射...
```

### Q: 修改配置后如何生效？

A: 执行 `sudo keyd reload` 或 `sudo systemctl restart keyd`。

## 进阶技巧

### 自定义超时时间

```ini
[main]
capslock = timeout(esc)
capslock = layer(nav)
timeout = 300    # 调整到 300ms，适合反应较慢的用户
```

### 添加更多按键层

```ini
# 按 Caps Lock + 数字键切换到其他层
[nav]
1 = layer(symbols)
2 = layer(numbers)

[symbols]
! = exclam
@ = at
# = hash
```

### 键盘布局切换（Mac 用户）

```ini
[main]
# 交换 Command 和 Option
leftmeta = leftalt
leftalt = leftmeta
```

## 参考资源

- [keyd GitHub 仓库](https://github.com/rvaiya/keyd)
- [keyd 官方文档](https://github.com/rvaiya/keyd/blob/master/docs/)

## 总结

keyd 是 Fedora 系统上非常强大的键盘映射工具。通过本文的配置，你可以将 Caps Lock 键变成"短按 ESC、长按方向键层"的高效工具，大幅提升输入效率。

如果遇到问题，记得使用 `sudo keyd monitor` 来实时调试，这是排查问题最有效的方法。
