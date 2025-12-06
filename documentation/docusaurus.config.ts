import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

// Load environment variables using dotenv
require('dotenv').config();

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Supernal Coding',
  tagline:
    'AI-powered development workflow system that enables coding agents to deliver higher quality, compliant code faster through automated task management, requirement validation, and intelligent handoffs.',
  favicon: 'img/favicon.ico',

  // Custom fields for client-side access to environment variables
  customFields: {
    GTM_CONTAINER_ID:
      process.env.GTM_CONTAINER_ID || process.env.REACT_APP_GTM_CONTAINER_ID,
    HUBSPOT_PORTAL_ID: process.env.HUBSPOT_PORTAL_ID || '46224345',
    HUBSPOT_FORM_ID:
      process.env.HUBSPOT_FORM_ID || '8f9b35de-f230-430c-ab8e-062afd49fed3'
  },

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://code.supernal.ai',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'supernalintelligence', // GitHub org/user name.
  projectName: 'supernal-coding', // GitHub repo name.

  // Warn on broken links instead of failing build (temporary during migration to Next.js)
  // Note: Run 'sc docs links --fix' to auto-fix broken relative paths
  // Set SKIP_LINK_CHECK=true in build.sh to bypass pre-build validation
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs', // Point to consolidated docs directory
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          // Edit URLs disabled - documentation is auto-generated from CLI system
          editUrl: undefined,
          // Exclude only internal/archived files, keep user-facing docs visible
          // - archive/deprecated: old documentation
          // - features: internal feature development tracking
          // - planning: internal project management
          // - handoffs: internal agent communication
          // - repo/prs: auto-synced PR files with raw HTML that breaks MDX
          // Note: workflow/sops are PUBLIC and should be visible
          exclude: [
            '**/archive/**',
            '**/deprecated/**',
            '**/features/**',
            '**/planning/**',
            '**/handoffs/**',
            '**/repo/prs/**'
          ],
          // Use robust markdown parsing with proper MDX configuration
          remarkPlugins: [
            // GitHub Flavored Markdown support
            require('remark-gfm')
          ],
          rehypePlugins: []
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true
          },
          // Blog editing handled through standard development workflow
          editUrl: undefined,
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn'
        },
        theme: {
          customCss: ['./src/css/custom.css', './src/css/mobile-navbar-fix.css']
        },
        // Google Analytics 4 tracking (only if tracking ID is provided)
        ...(process.env.GTAG_TRACKING_ID && {
          gtag: {
            trackingID: process.env.GTAG_TRACKING_ID,
            anonymizeIP: true
          }
        })
      } satisfies Preset.Options
    ]
  ],

  plugins: [
    [
      require.resolve('./plugins/cli-docs-generator'),
      {
        // Plugin options can be added here if needed
      }
    ],
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: true,
        indexPages: true,
        docsRouteBasePath: '/',
        searchBarShortcut: true,
        searchBarShortcutHint: true
      }
    ],
    // Preprocess markdown to escape comparison operators before MDX parsing
    require.resolve('./plugins/mdx-preprocess-plugin')
  ],

  // Enable Mermaid diagrams
  themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true
  },

  themeConfig: {
    // Enhanced Open Graph configuration for better social sharing
    metadata: [
      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Supernal Coding' },
      { property: 'og:locale', content: 'en_US' },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@SupernalAI' },
      { name: 'twitter:creator', content: '@SupernalAI' },
      // Additional
      { name: 'author', content: 'Supernal Intelligence' },
      { name: 'theme-color', content: '#667eea' }
    ],
    // Project social card - using custom Supernal Coding documentation image
    image: 'img/documentation.png',
    navbar: {
      title: 'Supernal Coding',
      logo: {
        alt: 'Supernal AI Logo (@i)',
        src: 'img/supernal-logo.svg'
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation'
        },
        {
          to: '/docs/guides/cli-commands',
          label: 'CLI Commands',
          position: 'left'
        },
        {
          to: '/dashboard-live',
          label: 'Dashboard',
          position: 'left'
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          href: 'https://github.com/supernalintelligence/supernal-coding',
          label: 'GitHub',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/'
            },
            {
              label: 'CLI Commands',
              to: '/docs/guides/cli-commands'
            },
            {
              label: 'Workflow Commands',
              to: '/docs/cli-commands/workflow'
            }
          ]
        },
        {
          title: 'Project',
          items: [
            {
              label: 'Supernal Intelligence',
              href: 'https://supernal.ai'
            },
            {
              label: 'Ian Derrington',
              href: 'https://ian.ceo'
            },
            {
              label: 'Issues & Support',
              href: 'https://github.com/supernalintelligence/supernal-coding/issues'
            }
          ]
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Blog',
              to: '/blog'
            },
            {
              label: 'Dashboard',
              to: '/dashboard-live'
            },
            {
              label: 'GitHub Repository',
              href: 'https://github.com/supernalintelligence/supernal-coding'
            },
            {
              label: 'Requirements CLI',
              to: '/docs/cli-commands/requirement'
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://supernal.ai">Supernal Intelligence</a>.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  } satisfies Preset.ThemeConfig
};

export default config;
