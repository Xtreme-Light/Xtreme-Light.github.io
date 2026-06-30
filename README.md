# Xtreme Light

这是 [Xtreme Light](https://xtreme-light.github.io/) 个人博客的源码仓库。

站点基于 [AstroPaper](https://github.com/satnaing/astro-paper) 构建，使用 Astro、TypeScript、Tailwind CSS 和 Markdown/MDX，部署到 GitHub Pages。

## 环境要求

- **Node.js**: >= 22.12.0（推荐使用 nvm 管理版本）
- **包管理器**: pnpm（项目使用 pnpm 作为包管理器，请勿混用 npm/yarn）

## 快速开始

### 1. 安装 Node.js（使用 nvm）

```bash
# 安装 nvm（若未安装）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# 安装并使用指定版本的 Node.js
nvm install 22.12.0
nvm use 22.12.0
```

### 2. 安装 pnpm

```bash
npm install -g pnpm
```

### 3. 配置国内源（可选，加速安装）

```bash
pnpm config set registry https://registry.npmmirror.com/
```

### 4. 安装依赖

```bash
pnpm install
```

### 5. 本地开发

```bash
pnpm dev
```

访问 `http://localhost:4321` 查看站点。

### 6. 构建

```bash
pnpm build
pnpm preview
```

构建产物位于 `dist/`，GitHub Actions 会将其发布到 GitHub Pages。

## 内容管理

- **文章目录**: `src/content/posts/` - 博客文章以 Markdown 格式存放
- **页面内容**: `src/content/pages/` - 静态页面（如 About）
- **站点配置**: `astro-paper.config.ts` - 站点标题、描述、社交链接等

## 常见问题

### Q: `pnpm install` 时报错 `ERR_PNPM_OUTDATED_LOCKFILE`？

A: 说明 `pnpm-lock.yaml` 与 `package.json` 不匹配。执行以下命令更新锁文件：

```bash
pnpm install --no-frozen-lockfile
```

### Q: 构建时报错 `@tailwindcss/vite` 插件类型不兼容？

A: 可能是 `@tailwindcss/vite` 版本与 Astro 内置的 Vite 版本不兼容。当前项目锁定版本为 `4.1.18`，请勿随意升级。

### Q: 国内安装依赖很慢？

A: 配置国内源后重试：

```bash
pnpm config set registry https://registry.npmmirror.com/
pnpm install
```

### Q: 提交代码后 GitHub Pages 构建失败？

A: 确保提交了 `pnpm-lock.yaml`，且未提交 `package-lock.json`（项目使用 pnpm）。

## 部署

项目通过 GitHub Actions 自动部署到 GitHub Pages，每次推送到 `main` 分支会触发构建和部署流程。

## 致谢

博客模板来自 [AstroPaper](https://github.com/satnaing/astro-paper)。模板许可证见 `LICENSE`。
