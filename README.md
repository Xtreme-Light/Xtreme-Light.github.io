# Xtreme Light

这是 [Xtreme Light](https://xtreme-light.github.io/) 个人博客的源码仓库。

站点基于 [AstroPaper](https://github.com/satnaing/astro-paper) 构建，使用 Astro、TypeScript、Tailwind CSS 和 Markdown/MDX，部署到 GitHub Pages。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
pnpm preview
```

构建产物位于 `dist/`，GitHub Actions 会将其发布到 GitHub Pages。

## 内容

- 文章目录：`src/content/posts/`
- 页面内容：`src/content/pages/`
- 站点配置：`astro-paper.config.ts`

## 致谢

博客模板来自 [AstroPaper](https://github.com/satnaing/astro-paper)。模板许可证见 `LICENSE`。
