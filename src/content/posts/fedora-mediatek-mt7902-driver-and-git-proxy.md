---
pubDatetime: 2026-06-23T00:00:00+08:00
title: "Fedora 下 MediaTek MT7902 无线网卡驱动折腾记：从编译到代理"
featured: false
draft: false
tags:
  - Fedora
  - Linux
  - MediaTek
  - 驱动
  - 折腾笔记
description: "在 Fedora 上手动编译并安装 MediaTek MT7902 无线网卡 Wi-Fi 与蓝牙驱动的完整过程，附 Git 代理配置和常见坑点解决方案。"
---

## 缘起

最近给一台笔记本装上了 Fedora，却发现板载的 MediaTek MT7902 无线网卡无法正常工作——Wi-Fi 搜索不到网络，蓝牙更是影儿都没有。这就很尴尬了，毕竟"没有网络的 Linux 寸步难行"。

一番搜索后发现，这颗芯片的驱动尚未进入主线内核，需要手动从第三方仓库编译安装。整个过程虽然不算复杂，但涉及驱动编译、固件安装、代理配置等环节，值得记录下来。

## 第一步：寻找可用的驱动仓库

GitHub 上关于 MT7902 的驱动仓库不少，但很多已经不再维护。经过筛选，锁定了一个被社区验证过的仓库：[hmtheboy154/mt7902](https://github.com/hmtheboy154/mt7902)。

> **注意**：原本计划使用 `gen4-mt7902` 分支，但经查该分支在 Fedora 上的可用性存疑。更稳妥的选择是 `backport` 分支（Wi-Fi）和 `bluetooth_backport` 分支（蓝牙），这两个分支都有成功案例。

## 第二步：安装编译依赖

在开始之前，需要安装必要的编译工具和内核头文件：

```bash
sudo dnf install -y git make gcc kernel-devel kernel-headers dkms
```

这些工具是编译内核模块的基础，缺一不可。

## 第三步：编译安装 Wi-Fi 驱动

克隆 Wi-Fi 驱动源码仓库，切换到 `backport` 分支：

```bash
git clone https://github.com/hmtheboy154/mt7902 -b backport mt7902_wifi
cd mt7902_wifi
```

然后开始编译和安装：

```bash
make -j$(nproc)   # 利用全部 CPU 核心加速编译
sudo make install
sudo make install_fw   # 安装固件文件
```

编译过程会花费几分钟，取决于机器性能。如果一切顺利，驱动模块和固件就会被安装到系统相应目录。

## 第四步：编译安装蓝牙驱动

蓝牙驱动的安装过程类似，只是分支不同：

```bash
git clone https://github.com/hmtheboy154/mt7902 -b bluetooth_backport btusb_mt7902
cd btusb_mt7902
make -j$(nproc)
sudo make install
sudo make install_fw
```

注意这里克隆到不同目录是为了避免覆盖 Wi-Fi 驱动的文件。

## 第五步：加载驱动模块

有两种方式加载驱动：重启系统或手动加载模块。

### 方式一：重启系统（推荐）

```bash
sudo reboot
```

系统启动时会自动尝试加载新安装的驱动模块。

### 方式二：手动加载（不重启）

按顺序执行以下命令：

```bash
# 加载 Wi-Fi 驱动
sudo modprobe mt7902e

# 加载蓝牙驱动（先卸载旧模块以避免冲突）
sudo rmmod btusb btmtk 2>/dev/null
sudo modprobe btusb_mt7902
```

## 第六步：验证驱动是否生效

- 检查 Wi-Fi：`nmcli device status` 应该能看到新出现的 Wi-Fi 设备。
- 检查网络接口：`ip link show` 可以查看所有网络接口。
- 检查蓝牙：系统设置中的蓝牙开关应该变为可用状态。

## 遇到的坑 & 解决方案

### 坑一：代理问题导致克隆缓慢

由于众所周知的原因，从 GitHub 克隆代码可能非常慢甚至失败。此时需要为 Git 配置代理。

我的代理运行在本地 `12334` 端口，类型是 SOCKS5。临时为一次克隆设置代理：

```bash
git -c http.proxy="socks5://127.0.0.1:12334" \
    -c https.proxy="socks5://127.0.0.1:12334" \
    clone https://github.com/hmtheboy154/mt7902.git
```

也可以全局配置（仅对 GitHub 生效）：

```bash
git config --global http.https://github.com.proxy socks5://127.0.0.1:12334
```

### 坑二：蓝牙重启后失效

有用户反馈，蓝牙在重启后会失效。如果遇到此情况，可以创建一个 systemd 服务来确保每次启动时正确加载蓝牙模块。

创建服务文件 `/etc/systemd/system/mt7902-bluetooth.service`：

```ini
[Unit]
After=systemd-modules-load.service
Before=bluetooth.service

[Service]
ExecStart=/bin/sh -c 'rmmod btusb btmtk 2>/dev/null; insmod /lib/modules/$(uname -r)/kernel/drivers/bluetooth/btusb_mt7902.ko'
Type=oneshot
RemainAfterExit=yes

[Install]
WantedBy=bluetooth.target
```

然后启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable mt7902-bluetooth.service
```

### 坑三：Wi-Fi 与蓝牙共存干扰

部分用户反馈同时开启 Wi-Fi 和蓝牙时，Wi-Fi 速度会严重下降。这似乎是驱动共存机制的已知问题，目前暂无完美解决方案，只能关注上游更新。

## 一点好消息：固件已进入 linux-firmware

最新的 `linux-firmware` 包已经包含了 MT7902 的固件文件。这意味着在未来，我们或许只需要安装驱动模块即可，甚至当驱动进入主线内核后，这些手动操作都将成为历史。

查看当前系统的固件版本：

```bash
dmesg | grep -i firmware
```

## 写在最后

整个折腾过程虽然看起来步骤不少，但实际执行下来并不复杂。核心要点就是：

1. 确认正确的驱动仓库和分支
2. 安装编译依赖
3. 编译并安装驱动与固件
4. 加载模块并验证

对于那些遇到网络问题的朋友，提前配置好 Git 代理可以节省大量时间。

如果你也遇到了类似问题，希望这篇文章能帮到你。如果有其他问题，欢迎留言交流。

> 本文基于 Fedora 发行版编写，其他发行版（如 Ubuntu、Arch）的包管理命令和部分目录路径可能有所不同，请酌情调整。
