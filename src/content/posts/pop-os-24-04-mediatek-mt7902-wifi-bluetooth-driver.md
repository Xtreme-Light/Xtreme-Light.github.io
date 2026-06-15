---
pubDatetime: 2026-06-15T00:00:00+08:00
title: "Pop!_OS 24.04 下为 MediaTek MT7902 网卡手动安装 Wi-Fi 与蓝牙驱动"
featured: false
draft: false
tags:
  - Linux
  - Pop!_OS
  - 驱动
  - MediaTek
  - 折腾笔记
description: "记录在 Pop!_OS 24.04 LTS 上为 MediaTek MT7902 无线网卡手动编译并安装 Wi-Fi 与蓝牙第三方驱动的完整过程。"
---

## 📌 前言

在安装 Linux 系统时，硬件驱动兼容性始终是一个绕不开的话题。尤其是网卡这类外设，若未能被内核原生支持，安装完成后可能会发现 Wi-Fi 和蓝牙均无法使用。

本文记录了在一台使用 MediaTek MT7902 无线网卡的电脑上，安装 Pop!_OS 24.04 LTS 后，通过手动编译第三方驱动解决 Wi-Fi 与蓝牙问题的完整过程。本文方法同样适用于 Ubuntu 24.04 LTS 及其衍生发行版。

## 💻 测试环境

| 项目     | 详细信息                                              |
| -------- | ----------------------------------------------------- |
| 操作系统 | Pop!_OS 24.04 LTS（基于 Ubuntu 24.04 Noble）          |
| 内核版本 | 7.0.11-76070011-generic（System76 自研内核）          |
| 主板     | ASUS TUF GAMING A620M-PLUS WIFI                       |
| CPU      | AMD Ryzen 5 7600 6-Core Processor（12 线程）          |
| 显卡     | AMD Radeon RX 6650 XT + AMD Radeon Raphael（核显）    |
| 问题网卡 | MEDIATEK Corp. Device 7902 (MT7902)                   |
| PCI 地址 | `0a:00.0` → `0000:0a:00.0`                            |

## ⚠️ 安装前准备

在开始任何操作之前，请务必完成以下两项准备工作。

### 1. 连接有线网络

由于需要下载源码和编译工具，必须保证电脑能够上网。建议使用以下任一方式：

- 网线直接连接路由器
- 手机 USB 网络共享（Android / iPhone 均可）
- 其他 USB 无线网卡（如有）

### 2. 关闭 Secure Boot

重启电脑，进入 BIOS/UEFI 设置，找到 **Secure Boot** 选项并设为 **Disable**。

> **原因**：本文使用的驱动是社区开发的第三方驱动，未经官方签名。若 Secure Boot 保持开启，Linux 内核会拒绝加载此类驱动。

## 📡 第一部分：Wi-Fi 驱动安装

### 第 1 步：安装编译依赖

```bash
sudo apt update
sudo apt install build-essential dkms git linux-headers-$(uname -r)
```

### 第 2 步：屏蔽冲突驱动

这一步可以防止系统自带的驱动干扰正常工作：

```bash
# 添加到黑名单
echo "blacklist mt7902" | sudo tee /etc/modprobe.d/blacklist-mt7902.conf
echo "blacklist mt7921e" | sudo tee -a /etc/modprobe.d/blacklist-mt7902.conf

# 更新 initramfs 并重启
sudo update-initramfs -u
sudo reboot
```

### 第 3 步：克隆并编译驱动源码

重启后，再次确认网络已连接：

```bash
# 克隆驱动仓库
git clone https://github.com/hmtheboy154/gen4-mt7902.git
cd gen4-mt7902

# 使用 DKMS 注册，便于内核更新后自动重建驱动
sudo cp -r . /usr/src/mt7902-1.0
sudo dkms add -m mt7902 -v 1.0
sudo dkms build -m mt7902 -v 1.0
sudo dkms install -m mt7902 -v 1.0

# 安装固件并更新模块依赖
sudo make install_fw
sudo depmod -a
```

### 第 4 步：加载驱动并绑定设备

```bash
# 加载驱动模块
sudo modprobe cfg80211
sudo modprobe mt7902

# 清除驱动覆盖并绑定设备（请将地址替换为你自己的 PCI 地址）
echo "" | sudo tee /sys/bus/pci/devices/0000:0a:00.0/driver_override
echo "0000:0a:00.0" | sudo tee /sys/bus/pci/drivers/wlan/bind
```

> 💡 若执行第二条命令时提示 **"设备或资源忙"**，这通常表示驱动已成功加载。请运行 `ip a` 或 `iwconfig` 确认无线网卡是否出现。

### 第 5 步：修复休眠/唤醒崩溃问题

MT7902 驱动存在一个已知问题：电脑合盖休眠或睡眠后唤醒时，可能会导致系统死机。创建以下脚本可自动规避：

```bash
sudo nano /lib/systemd/system-sleep/rmmod-mt7902
```

在编辑器中粘贴以下内容：

```bash
#!/bin/sh
case "$1" in
  pre)
    modprobe -r mt7902 2>/dev/null || true
    ;;
esac
```

保存（`Ctrl+X` → `Y` → `Enter`）后，赋予执行权限：

```bash
sudo chmod +x /lib/systemd/system-sleep/rmmod-mt7902
```

## 🎧 第二部分：蓝牙驱动安装

Wi-Fi 驱动安装成功后，蓝牙仍无法使用，需要单独安装蓝牙专用驱动。

### 第 1 步：克隆蓝牙专用分支

```bash
git clone https://github.com/hmtheboy154/mt7902 -b bluetooth_backport btusb_mt7902
```

### 第 2 步：编译并安装

```bash
cd btusb_mt7902
make -j8
sudo make install
sudo make install_fw
```

### 第 3 步：加载蓝牙驱动

```bash
# 移除冲突驱动
sudo rmmod btusb
sudo rmmod btmtk

# 加载新驱动
sudo modprobe btusb_mt7902
```

### 第 4 步：永久屏蔽冲突驱动

如果不执行这一步，重启电脑后 `btusb` 和 `btmtk` 会自动加载回来，与 `btusb_mt7902` 产生冲突：

```bash
# 创建黑名单配置文件
echo "blacklist btusb" | sudo tee -a /etc/modprobe.d/blacklist-bluetooth.conf
echo "blacklist btmtk" | sudo tee -a /etc/modprobe.d/blacklist-bluetooth.conf

# 更新 initramfs
sudo update-initramfs -u
```

完成后重启电脑，蓝牙应能自动生效。

### 第 5 步：验证蓝牙功能

```bash
# 查看蓝牙服务状态
sudo systemctl status bluetooth

# 列出蓝牙设备
hcitool dev
# 或使用
bluetoothctl list
```

若输出中包含 `hci0` 等设备，说明蓝牙已成功加载。

## 🧪 验证结果

### Wi-Fi 验证

```bash
# 查看无线网卡是否出现
ip a | grep -E "^[0-9]+:"
# 预期输出应包含 wlan0 或 wlp* 等无线设备

# 查看驱动加载情况
sudo lshw -C network | grep -A 5 "MEDIATEK"
```

### 蓝牙验证

```bash
# 扫描蓝牙设备（需先进入蓝牙控制台）
bluetoothctl scan on
```

若能在系统设置中打开蓝牙并成功配对设备，则说明一切正常。

## ⚠️ 已知限制与注意事项

| 问题               | 说明                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------- |
| 5GHz Wi-Fi 不稳定  | 目前该驱动对 5GHz 频段的支持尚不完善，建议优先连接 2.4GHz 网络                               |
| 休眠唤醒可能崩溃   | 已通过 `system-sleep` 脚本修复，测试正常                                                     |
| 内核更新后需重装？ | 由于使用了 DKMS，内核更新后驱动应自动重建。若出现问题，可手动重新执行 `dkms install`         |
| 仅适用于 MT7902    | 本文方法仅适用于 MediaTek MT7902 芯片，其他网卡请勿照搬                                      |

## 📚 参考资料

- [hmtheboy154/gen4-mt7902 - Wi-Fi 驱动源码](https://github.com/hmtheboy154/gen4-mt7902)
- [hmtheboy154/mt7902 (bluetooth_backport) - 蓝牙驱动源码](https://github.com/hmtheboy154/mt7902/tree/bluetooth_backport)
