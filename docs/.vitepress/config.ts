import { defineConfig } from "vitepress";

const base = process.env.VITEPRESS_BASE ?? "/wetzler/";

export default defineConfig({
  title: "Wetzler",
  description:
    "Vale-backed, agent-guided writing voice tools for Markdown revision.",
  base,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg` }],
    ["meta", { name: "theme-color", content: "#F7F0E3" }],
    [
      "meta",
      {
        name: "color-scheme",
        content: "light dark",
      },
    ],
  ],
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    logo: "/favicon.svg",
    siteTitle: "Wetzler",
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Voice", link: "/voice-setup" },
      { text: "Agents", link: "/agentic-workflows" },
      { text: "Reference", link: "/reference/cli" },
    ],
    sidebar: [
      {
        text: "Start Here",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
          { text: "Installation", link: "/installation" },
        ],
      },
      {
        text: "Voice Workflows",
        items: [
          { text: "Set Up a Voice", link: "/voice-setup" },
          { text: "Agentic Workflows", link: "/agentic-workflows" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI", link: "/reference/cli" },
          { text: "MCP Server", link: "/reference/mcp" },
          { text: "Project Layout", link: "/reference/project-layout" },
        ],
      },
    ],
    search: {
      provider: "local",
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/glorioustephan/wetzler" },
    ],
    editLink: {
      pattern: "https://github.com/glorioustephan/wetzler/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "AI-assisted writing, grounded in inspectable rules.",
      copyright: "Copyright © 2026 James Baker",
    },
  },
});
