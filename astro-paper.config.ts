import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://xtreme-light.github.io/",
    title: "Xtreme Light",
    description: "个人技术博客，记录编程、折腾与思考。",
    author: "Xtreme Light",
    profile: "https://github.com/Xtreme-Light",
    ogImage: "default-og.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
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
});