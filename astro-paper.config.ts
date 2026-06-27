import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://blog.light17.ccwu.cc/",
    title: "Xtreme Light",
    description: "个人技术博客，记录编程、折腾与思考。",
    author: "Xtreme Light",
    profile: "https://github.com/Xtreme-Light",
    ogImage: "default-og.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
    // Google Search Console 验证码（content 字段）。也可通过 PUBLIC_GOOGLE_SITE_VERIFICATION 环境变量覆盖。
    googleVerification: "",
    // 百度站长平台验证码（content 字段）。也可通过 PUBLIC_BAIDU_SITE_VERIFICATION 环境变量覆盖。
    baiduVerification: "",
  },
  posts: {
    perPage: 6,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: false,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/Xtreme-Light/Xtreme-Light.github.io/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    {
      name: "github",
      url: "https://github.com/Xtreme-Light",
      linkTitle: "Xtreme Light 的 GitHub 主页",
    },
    {
      name: "mail",
      url: "mailto:Xtreme-Light@users.noreply.github.com",
      linkTitle: "通过邮件联系 Xtreme Light",
    },
  ],
  shareLinks: [
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "mail", url: "mailto:?subject=推荐阅读&body=" },
  ],
  /**
   * 评论系统：基于 Giscus（GitHub OAuth 登录，评论以 GitHub Discussion 形式存储）。
   *
   * 启用步骤：
   * 1. 在 GitHub 仓库 Settings → Features 中开启 Discussions；
   * 2. 在 https://github.com/apps/giscus 为该仓库安装 giscus app；
   * 3. 打开 https://giscus.app/zh-CN ，按提示填写仓库后会生成 repo / repoId / category / categoryId；
   * 4. 把下方占位字段替换为生成的真实值，并确保 provider 为 "giscus"。
   */
  comments: {
    provider: "giscus",
    giscus: {
      repo: "Xtreme-Light/Xtreme-Light.github.io",
      repoId: "R_kgDOS7VgtQ",
      category: "Announcements",
      categoryId: "DIC_kwDOS7Vgtc4DAAKg",
      mapping: "pathname",
      reactionsEnabled: true,
      inputPosition: "bottom",
      lang: "zh-CN",
      loading: "lazy",
    },
  },
  /**
   * 访问统计。任一字段为空字符串即视为未启用，对应脚本不会被注入。
   * 也可通过 PUBLIC_GOOGLE_ANALYTICS_ID / PUBLIC_BAIDU_TONGJI_ID 环境变量覆盖。
   */
  analytics: {
    // Google Analytics 4 measurement id，例如 "G-XXXXXXXXXX"
    googleAnalyticsId: "",
    // 百度统计站点 id（hm.baidu.com/hm.js?xxxxx 中 ? 后那段）
    baiduTongjiId: "",
  },
});