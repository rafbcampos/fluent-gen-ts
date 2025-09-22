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
      { text: 'API', link: '/api/overview' },
      { text: 'Examples', link: '/examples/basic' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'CLI Usage', link: '/guide/cli' },
          { text: 'Programmatic API', link: '/guide/api' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Basic Usage', link: '/examples/basic' },
          { text: 'Nested Builders', link: '/examples/nested' },
          { text: 'Generic Types', link: '/examples/generics' },
          { text: 'Advanced Patterns', link: '/examples/advanced' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api/overview' },
          { text: 'Generator Functions', link: '/api/generator' },
          { text: 'Type Resolution', link: '/api/resolver' },
          { text: 'Plugin System', link: '/api/plugins' },
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
