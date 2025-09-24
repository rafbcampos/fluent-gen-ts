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
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Core Concepts', link: '/guide/core-concepts' },
          { text: 'CLI Commands', link: '/guide/cli-commands' },
          { text: 'Advanced Usage', link: '/guide/advanced-usage' },
          { text: 'Plugins', link: '/guide/plugins' },
        ],
      },
      {
        text: 'Examples',
        items: [{ text: 'Examples', link: '/examples/' }],
      },
      {
        text: 'API Reference',
        items: [{ text: 'API Reference', link: '/api/reference' }],
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
