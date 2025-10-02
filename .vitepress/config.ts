import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: 'docs',
  base: '/fluent-gen-ts/',

  title: 'Fluent Gen',
  description: 'Generate fluent builders from TypeScript interfaces',

  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Fluent Gen' }],
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/reference' },
      { text: 'Examples', link: '/examples/' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Quick Start', link: '/guide/quick-start' },
          { text: 'Installation & Setup', link: '/guide/getting-started' },
          { text: 'Core Concepts', link: '/guide/core-concepts' },
        ],
      },
      {
        text: 'CLI & Configuration',
        collapsed: false,
        items: [
          { text: 'CLI Commands', link: '/guide/cli-commands' },
          { text: 'CLI Cheat Sheet', link: '/guide/cli-cheat-sheet' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Config Recipes', link: '/guide/config-recipes' },
          { text: 'Workflows', link: '/guide/workflows' },
        ],
      },
      {
        text: 'Plugin System',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/guide/plugins/' },
          { text: 'Getting Started', link: '/guide/plugins/getting-started' },
          { text: 'Best Practices ⚠️', link: '/guide/plugins/best-practices' },
          { text: 'Cookbook', link: '/guide/plugins/cookbook' },
          { text: 'API Reference', link: '/guide/plugins/api-reference' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Advanced Usage', link: '/guide/advanced-usage' },
          { text: 'Examples', link: '/examples/' },
        ],
      },
      {
        text: 'Help',
        items: [
          { text: 'FAQ', link: '/guide/faq' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          { text: 'API Reference', link: '/api/reference' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/rafbcampos/fluent-gen-ts' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/fluent-gen-ts' },
    ],

    editLink: {
      pattern: 'https://github.com/rafbcampos/fluent-gen-ts/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Rafael Campos',
    },

    search: {
      provider: 'local',
    },
  },
});
