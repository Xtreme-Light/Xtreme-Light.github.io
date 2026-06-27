---
name: "blog-publish"
description: "整理 Markdown 草稿并发布为博客文章。当用户提供草稿文件路径、要求发布博客、或提到整理/发布文章时调用。"
---

# 博客草稿发布

将用户提供的粗糙 Markdown 草稿整理为符合项目规范的博客文章，提交并推送到远端触发部署。

## 草稿位置

草稿统一放在 `src/content/posts/_drafts/` 目录（下划线前缀，Astro 会忽略不发布）。
用户也可能直接给出项目内任意路径的草稿文件（如 `src/temp.md`、`tmp.md`）。

## 处理流程

### 1. 读取草稿

读取用户指定的草稿文件。如果用户未指定路径，检查 `src/content/posts/_drafts/` 下是否有 `.md` 文件。

### 2. 整理 Markdown

草稿通常存在以下问题，需逐项修复：

#### 2.1 Frontmatter 替换

草稿的 frontmatter 往往不符合项目 schema。必须替换为以下格式：

```yaml
---
pubDatetime: 2026-06-27T00:00:00+08:00
title: "文章标题"
featured: false
draft: false
tags:
  - 标签1
  - 标签2
description: "SEO 描述"
---
```

- `pubDatetime`：ISO 8601 格式带 `+08:00` 时区。如草稿中有 `date` 字段则转换；否则用当天日期
- `title`：从草稿标题提取
- `tags`：从草稿 `tags` 字段提取，或根据内容推断。常见标签见下方参考
- `description`：根据文章内容撰写一句话摘要
- `featured`：默认 `false`
- `draft`：默认 `false`

#### 2.2 代码块修复

草稿常见问题：代码块缺少闭合围栏（```）。表现如下：

```
bash
sudo dnf install keyd
这段文字应该是代码块外的内容，但因为没有闭合围栏，被混在了一起
```

修复规则：
- 每个语言标记（`bash`、`text`、`ini`、`conf`、`python` 等）如果单独成行且后面跟着命令，说明是一个代码块开头，需补上 ` ``` `
- 代码块结束时（下一段文字不是命令/代码），需补上闭合 ` ``` `
- 纯文本输出示例用 ` ```text `
- 配置文件用 ` ```ini ` 或 ` ```text `

#### 2.3 标题层级修复

草稿中标题常被写成纯文本（如"第一步：xxx"没有 `##`）。修复规则：
- 文章主标题已在 frontmatter `title` 中，正文不再重复 H1
- 章节用 `##`
- 子章节用 `###`
- 更深层用 `####`

#### 2.4 其他格式修复

- 表格：确保有表头分隔行（`|---|---|`）
- 列表：确保有正确的 `-` 或 `1.` 前缀和缩进
- 引用：确保 `>` 前缀正确
- 行内代码：命令、文件路径、变量名用反引号包裹
- 删除草稿中多余的空行（超过 2 个连续空行）
- 删除草稿末尾的 `---` 分隔符

### 3. 生成正式文件

- 文件名：根据标题生成 kebab-case 文件名（如 `Fedora 配置 keyd` → `fedora-keyd-keyboard-mapping.md`）
- 输出路径：`src/content/posts/<filename>.md`
- 删除原草稿文件

### 4. 提交并推送

```bash
git add src/content/posts/<filename>.md
git commit -m "docs(posts): 新增 <简短描述> 文章"
```

推送（沙箱 SSH 绕过）：
```bash
GIT_SSH_COMMAND="ssh -F /dev/null -o IdentitiesOnly=yes -o IdentityFile=$HOME/.ssh/id_ed25519 -o IdentityFile=$HOME/.ssh/id_rsa -o StrictHostKeyChecking=accept-new" git push origin main
```

> 如果原草稿文件是 git 跟踪文件，`git add` 时也需加上删除路径。如果草稿是未跟踪文件（如 `_drafts/` 下的新文件），则只需 add 新文件。

## 标签参考

根据文章主题选择合适的标签：

| 主题     | 常用标签                                           |
| -------- | -------------------------------------------------- |
| Linux    | `Linux`、`Fedora`、`折腾笔记`                      |
| 驱动     | `驱动`、`MediaTek`、`硬件`                         |
| 键盘     | `键盘映射`、`keyd`                                 |
| 系统配置 | `fstab`、`故障排除`                                |
| 开发     | `编程`、`工具`                                     |
| 随笔     | `随笔`、`博客`                                     |

## 文件名命名参考

- `fedora-mediatek-mt7902-driver-and-git-proxy.md`
- `fedora-keyd-keyboard-mapping.md`
- `fedora-multi-disk-mount-fstab.md`
- `pop-os-24-04-mediatek-mt7902-wifi-bluetooth-driver.md`

格式：`<系统/主题>-<具体内容>.md`，全小写 kebab-case。

## 质量检查清单

发布前确认：
- [ ] Frontmatter 包含所有必须字段且格式正确
- [ ] 所有代码块都有正确的开头和闭合围栏
- [ ] 标题层级正确（无 H1，从 H2 开始）
- [ ] 表格格式正确
- [ ] 无多余的纯文本标题
- [ ] 文件名是 kebab-case
- [ ] 草稿原文件已删除
- [ ] git commit 信息符合 Conventional Commits 风格

## 示例

用户说："`src/content/posts/_drafts/my-draft.md` 发布这个草稿"

执行：
1. 读取 `src/content/posts/_drafts/my-draft.md`
2. 整理 Markdown（修复 frontmatter、代码块、标题等）
3. 写入 `src/content/posts/<proper-name>.md`
4. 删除 `src/content/posts/_drafts/my-draft.md`
5. `git add` + `git commit` + `git push`
