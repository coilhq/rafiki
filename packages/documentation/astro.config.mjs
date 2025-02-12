import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

import remarkMath from 'remark-math'
import rehypeMathjax from 'rehype-mathjax'
import GraphQL from 'astro-graphql-plugin'
import starlightLinksValidator from 'starlight-links-validator'
import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

// https://astro.build/config
export default defineConfig({
  site: 'https://rafiki.dev',
  outDir: './build',
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      rehypeMathjax,
      rehypeHeadingIds,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'wrap'
        }
      ]
    ]
  },
  integrations: [
    starlight({
      title: 'Rafiki',
      description:
        'Rafiki is open source software that allows an Account Servicing Entity to enable Interledger functionality on its users’ accounts.',
      customCss: [
        './node_modules/@interledger/docs-design-system/src/styles/orange-theme.css',
        './node_modules/@interledger/docs-design-system/src/styles/ilf-docs.css',
        './src/styles/rafiki.css'
      ],
      expressiveCode: {
        styleOverrides: {
          borderColor: 'transparent',
          borderRadius: 'var(--border-radius)'
        }
      },
      components: {
        Header: './src/components/Header.astro',
        PageSidebar: './src/components/PageSidebar.astro'
      },
      head: [
        {
          tag: 'script',
          attrs: {
            src: '/scripts.js',
            defer: true
          }
        },
        {
          tag: 'script',
          attrs: {
            defer: true,
            'data-website-id': '75fba178-7dca-4874-adc9-50cf85c83528',
            src: 'https://ilf-site-analytics.netlify.app/script.js',
            'data-domains': 'rafiki.dev'
          }
        }
      ],
      logo: {
        src: './public/img/icon.svg'
      },
      social: {
        github:
          'https://github.com/interledger/rafiki/tree/main/packages/documentation'
      },
      sidebar: [
        {
          label: 'Overview',
          items: [
            {
              label: 'Introducing Rafiki',
              link: '/overview/overview'
            },
            {
              label: 'Concepts',
              collapsed: true,
              items: [
                {
                  label: 'Accounting',
                  link: '/overview/concepts/accounting'
                },
                {
                  label: 'Interledger',
                  link: '/overview/concepts/interledger'
                },
                {
                  label: 'Open Payments',
                  link: '/overview/concepts/open-payments'
                },
                {
                  label: 'Telemetry',
                  link: '/overview/concepts/telemetry'
                }
              ]
            }
          ]
        },
        {
          label: 'Integration',
          collapsed: true,
          items: [
            {
              label: 'Requirements',
              collapsed: true,
              items: [
                {
                  label: 'Overview and checklist',
                  link: '/integration/requirements/overview'
                },
                {
                  label: 'Assets',
                  link: '/integration/requirements/assets'
                },
                {
                  label: 'Peers',
                  link: '/integration/requirements/peers'
                },
                {
                  label: 'Wallet addresses',
                  link: '/integration/requirements/wallet-addresses'
                },
                {
                  label: 'Webhook events',
                  link: '/integration/requirements/webhook-events'
                },
                {
                  label: 'Exchange rates',
                  link: '/integration/requirements/exchange-rates'
                },
                {
                  label: 'Sending fees',
                  link: '/integration/requirements/sending-fees'
                },
                {
                  label: 'Identity provider (IdP)',
                  link: '/integration/requirements/idp'
                }
              ]
            },
            {
              label: 'Test locally',
              collapsed: true,
              items: [
                {
                  label: 'Local playground',
                  link: '/integration/playground/overview'
                },
                {
                  label: 'Autopeering',
                  link: '/integration/playground/autopeering'
                },
                {
                  label: 'Test network',
                  link: '/integration/playground/testnet'
                }
              ]
            },
            {
              label: 'Deployment',
              collapsed: true,
              items: [
                {
                  label: 'Services',
                  collapsed: true,
                  items: [
                    {
                      label: 'Auth service',
                      link: '/integration/deployment/services/auth-service'
                    },
                    {
                      label: 'Backend service',
                      link: '/integration/deployment/services/backend-service'
                    },
                    {
                      label: 'Frontend service',
                      link: '/integration/deployment/services/frontend-service'
                    },
                    {
                      label: 'Token introspection',
                      link: '/integration/deployment/services/token-introspection'
                    }
                  ]
                },
                {
                  label: 'Docker Compose',
                  link: '/integration/deployment/docker-compose'
                },
                {
                  label: 'Helm and Kubernetes',
                  link: '/integration/deployment/helm-k8s'
                }
              ]
            }
          ]
        },
        {
          label: 'Administration',
          collapsed: true,
          items: [
            {
              label: 'Rafiki Admin',
              link: '/admin/admin-user-guide'
            },
            {
              label: 'Manage liquidity',
              collapsed: true,
              items: [
                {
                  label: 'Asset liquidity',
                  link: '/admin/liquidity/asset-liquidity'
                },
                {
                  label: 'Peer liquidity',
                  link: '/admin/liquidity/peer-liquidity'
                },
                {
                  label: 'Payment liquidity',
                  link: '/admin/liquidity/payment-liquidity'
                },
                {
                  label: 'Two-phase transfers',
                  link: '/admin/liquidity/two-phase-transfers'
                }
              ]
            }
          ]
        },
        {
          label: 'Resources',
          collapsed: true,
          items: [
            {
              label: 'Releases',
              link: '/resources/releases'
            },
            {
              label: 'Glossary',
              link: '/resources/glossary'
            },
            {
              label: 'Architecture',
              link: '/resources/architecture'
            },
            {
              label: 'Environment variables',
              link: '/resources/environment-variables'
            },
            {
              label: 'Webhook event types',
              link: '/resources/webhook-event-types'
            },
            {
              label: 'Get involved',
              link: '/resources/get-involved'
            }
          ]
        },
        {
          label: 'APIs',
          collapsed: true,
          items: [
            {
              label: 'GraphQL Admin APIs',
              link: '/apis/graphql/admin-api-overview'
            },
            {
              label: 'Backend Admin API',
              collapsed: true,
              autogenerate: {
                directory: 'apis/graphql/backend'
              }
            },
            {
              label: 'Auth Admin API',
              collapsed: true,
              autogenerate: {
                directory: 'apis/graphql/auth'
              }
            }
          ]
        }
      ],
      plugins: [
        starlightLinksValidator({
          errorOnLocalLinks: false
        })
      ]
    }),
    GraphQL({
      schema: '../backend/src/graphql/schema.graphql',
      output: './src/content/docs/apis/graphql/backend/',
      linkPrefix: '/apis/graphql/backend/'
    }),
    GraphQL({
      schema: '../auth/src/graphql/schema.graphql',
      output: './src/content/docs/apis/graphql/auth/',
      linkPrefix: '/apis/graphql/auth/'
    })
  ],
  server: {
    port: 1101
  }
})
