---
pubDatetime: 2026-06-27T00:00:00+08:00
title: "Fedora 多硬盘挂载踩坑实录：从 Emergency Mode 到完美解决"
featured: false
draft: false
tags:
  - Fedora
  - Linux
  - fstab
  - 故障排除
  - 折腾笔记
description: "在 Fedora 上为两块数据盘配置 fstab 自动挂载时，因 ext4 误用 uid/gid 参数导致进入 Emergency Mode 的完整排查与修复过程，附避坑指南。"
---

## 前言

最近给电脑加了两块大容量固态硬盘，想把 `~/Documents` 和 `~/Downloads` 分别迁移到这两块盘上，释放系统盘空间。本以为只是个简单的 `fstab` 配置，结果却踩了一连串的坑，甚至一度进不了系统。这篇文章记录了我的完整操作过程、遇到的坑以及最终的解决方案，希望能帮到有类似需求的同学。

## 环境信息

- **系统**：Fedora Workstation 44
- **内核**：6.14.x
- **桌面环境**：GNOME 47
- **文件系统**：系统盘 btrfs，数据盘 ext4

## 磁盘规划

| 磁盘     | 容量    | 用途             | 挂载点            |
| -------- | ------- | ---------------- | ----------------- |
| nvme0n1  | 953.9G  | 系统盘（btrfs）  | `/` + `/home`     |
| nvme1n1  | 1.9T    | 数据盘           | `~/Documents`     |
| sda      | 931.5G  | 数据盘           | `~/Downloads`     |

## 正确的配置流程（最终版）

### 第一步：查看磁盘信息

```bash
lsblk -o NAME,UUID,FSTYPE,MOUNTPOINT,SIZE
```

输出示例：

```text
NAME        UUID                                 FSTYPE MOUNTPOINT              SIZE
sda         685d3e88-654c-4b2e-a92f-453586fe9624 ext4                         931.5G
nvme1n1     8d5f6c50-9415-47b2-8a54-49777b1dc2b4 ext4   /home/light/Documents   1.9T
```

> **关键点**：记下目标分区的 UUID，而不是设备名（如 `/dev/sda1`），因为 UUID 是固定不变的，设备名可能随硬件变化而改变。

### 第二步：创建挂载点

```bash
mkdir -p ~/Documents
mkdir -p ~/Downloads
```

### 第三步：临时挂载测试

```bash
sudo mount /dev/nvme1n1p1 ~/Documents
sudo mount /dev/sda1 ~/Downloads
```

测试读写是否正常：

```bash
touch ~/Documents/test.txt
touch ~/Downloads/test.txt
ls ~/Documents ~/Downloads
```

### 第四步：设置目录权限

挂载后的硬盘默认属于 root，普通用户无法写入：

```bash
sudo chown -R $USER:$USER ~/Documents
sudo chown -R $USER:$USER ~/Downloads
```

### 第五步：配置 /etc/fstab（关键！）

```bash
sudo nano /etc/fstab
```

添加以下两行：

```text
UUID=8d5f6c50-9415-47b2-8a54-49777b1dc2b4 /home/light/Documents ext4 defaults 0 2
UUID=685d3e88-654c-4b2e-a92f-453586fe9624 /home/light/Downloads ext4 defaults 0 2
```

> ⚠️ 千万别写成这样（会报错）：
>
> ```text
> # 错误示例 - ext4 不支持 uid/gid 参数
> UUID=... /home/light/Documents ext4 defaults,uid=1000,gid=1000 0 2
> ```

### 第六步：测试 fstab 配置

```bash
sudo mount -a
```

没有任何输出 = 成功！如果有报错，`mount -a` 会立即提示。

### 第七步：确认挂载结果

```bash
df -h ~/Documents ~/Downloads
```

预期输出：

```text
文件系统           容量  已用  可用 已用% 挂载点
/dev/nvme1n1p1     1.9T   ...   ...   ...  /home/light/Documents
/dev/sda1          932G   ...   ...   ...  /home/light/Downloads
```

## 我踩过的坑

### 坑一：在 fstab 中给 ext4 加了 uid/gid 参数

错误配置：

```text
UUID=... /home/light/Documents ext4 defaults,uid=1000,gid=1000 0 2
```

报错信息：

```text
mount: /home/light/Documents: fsconfig() failed: ext4: Unknown parameter 'uid'.
```

**原因**：`uid` 和 `gid` 是 ntfs-3g、vfat 等文件系统的挂载参数，ext4 不支持。

**正确做法**：先用 `defaults` 挂载，再用 `chown` 设置权限。

### 坑二：配置错误后直接重启，导致进入 Emergency Mode

错误配置写入 fstab 后，直接 `sudo reboot`，结果系统启动失败，进入 emergency mode：

```text
You are in emergency mode. After logging in, type "journalctl -xb" to view system logs,
"systemctl reboot" to reboot, or "exit" to continue bootup.

Cannot open access to console, the root account is locked.
See sulogin man page for more details. Press Enter to continue.
```

**原因**：

1. fstab 配置有语法错误，系统无法挂载关键分区。
2. Fedora 默认 root 账户是锁定的，无法直接登录修复。

### 坑三：尝试用 GRUB 进入救援模式失败

网上很多教程说可以在 GRUB 启动时加 `init=/bin/bash` 或 `systemd.unit=rescue.target` 进入救援模式，但实际尝试后发现：

- 添加 `init=/bin/bash` 后依然报错 `root account is locked`。
- 即使能进入 shell，也因 root 锁定无法执行修复操作。

**结论**：在 root 锁定的情况下，GRUB 救援方式无法生效，必须用其他手段。

## 最终解决方法：使用 Fedora 安装 U 盘

### 步骤一：从 U 盘启动 Live 系统

插入 Fedora 安装 U 盘，重启电脑，选择从 U 盘启动，进入 Try Fedora 模式（Live 桌面环境）。

### 步骤二：挂载系统根分区

在 Live 终端中执行：

```bash
# 查看分区
lsblk

# 挂载根分区（注意：你的分区可能不同）
sudo mkdir -p /mnt/root
sudo mount /dev/nvme0n1p3 /mnt/root

# 确认挂载成功
ls /mnt/root  # 应该能看到 etc, home, boot 等目录
```

### 步骤三：编辑 fstab 修复错误

```bash
sudo nano /mnt/root/etc/fstab
```

在错误行前加 `#` 注释掉，或者直接修正配置：

```text
# 错误行 - 先注释掉，等系统启动后再重新配置
# UUID=8d5f6c50-... /home/light/Documents ext4 defaults,uid=1000,gid=1000 0 2
# UUID=685d3e88-... /home/light/Downloads ext4 defaults,uid=1000,gid=1000 0 2

# 正确写法
UUID=8d5f6c50-9415-47b2-8a54-49777b1dc2b4 /home/light/Documents ext4 defaults 0 2
UUID=685d3e88-654c-4b2e-a92f-453586fe9624 /home/light/Downloads ext4 defaults 0 2
```

### 步骤四：重启进入系统

```bash
sudo umount /mnt/root
sudo reboot
```

拔掉 U 盘，正常启动。

### 步骤五：设置 root 密码（建议）

进入系统后，解锁 root 账户，方便下次救援：

```bash
sudo passwd root
# 设置一个你能记住的密码
```

这样下次如果再次进入 emergency mode，就可以用 root 密码直接登录修复，不用依赖 U 盘了。

## 事后总结与避坑指南

### 1. 修改 fstab 前，一定要先 `sudo mount -a` 测试

这条命令会模拟启动时的挂载过程，在不重启的情况下检测 fstab 配置是否有语法错误。这是最有效的预防手段，能避免 90% 的启动故障。

### 2. 千万不要在 ext4 挂载参数中使用 uid/gid

记住：`uid` 和 `gid` 是给 ntfs-3g、vfat、exfat 等文件系统用的。对于 ext4，用 `defaults` 挂载后用 `chown` 设置权限。

### 3. 建议提前设置 root 密码

Fedora 默认锁定 root 账户。如果你会经常折腾系统配置（比如挂载硬盘、修改系统文件），建议主动设置 root 密码，这样万一出问题可以快速进入救援模式。

```bash
sudo passwd root
```

### 4. 准备一个 Fedora 安装 U 盘

Live USB 是最后的救命稻草。当系统完全无法启动、且 root 被锁定时，只有 Live 环境能救你。建议每个 Linux 用户都备一个。

### 5. 善用软链接迁移配置目录

如果你想把 `~/.m2`、`~/.npm`、`~/.cache` 等配置目录也迁移到数据盘，强烈推荐用软链接而非挂载：

```bash
# 示例：迁移 .m2 到 Documents 盘
mkdir -p ~/Documents/.m2
mv ~/.m2 ~/.m2_backup
ln -s ~/Documents/.m2 ~/.m2
cp -r ~/.m2_backup/* ~/Documents/.m2/
rm -rf ~/.m2_backup
```

这样做的好处是：

- 不需要额外修改 fstab，降低出错风险。
- 随时可以撤销，只需删除软链接、恢复备份。

## 最终配置效果

现在我的系统：

- **系统盘（953G）**：只装系统和应用程序，空间充裕。
- **Documents（1.9T）**：存放个人文档、项目代码、Maven 仓库等。
- **Downloads（931G）**：存放下载文件、安装包、临时文件等。

`df -h` 输出：

```text
文件系统           容量  已用  可用 已用% 挂载点
/dev/nvme0n1p3     952G   49G  899G    6% /
/dev/nvme1n1p1     1.9T   28G  1.8T    2% /home/light/Documents
/dev/sda1          932G  1.2G  891G    1% /home/light/Downloads
```

## 相关命令速查

| 操作               | 命令                                                    |
| ------------------ | ------------------------------------------------------- |
| 查看磁盘分区       | `lsblk -o NAME,UUID,FSTYPE,MOUNTPOINT,SIZE`            |
| 查看分区 UUID      | `sudo blkid /dev/sdX`                                   |
| 测试 fstab         | `sudo mount -a`                                         |
| 查看挂载情况       | `df -h`                                                 |
| 设置 root 密码     | `sudo passwd root`                                      |
| 查看软链接真实路径 | `ls -l ~/.xxx` 或 `readlink ~/.xxx`                     |

## 结语

这次经历让我深刻体会到一个道理：Linux 的问题往往很小，但一个小错误引发的连锁反应可能会让人焦头烂额。好在 Fedora 社区提供了丰富的工具（Live USB、`mount -a`、emergency mode 等），只要善用这些工具，再大的坑也能爬出来。

希望这篇文章能帮你避免我踩过的坑。如果你有更好的方案或建议，欢迎交流讨论！
