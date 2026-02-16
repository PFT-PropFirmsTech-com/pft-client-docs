import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  title: 'PropFirmsTech',
  description: 'Official documentation for PropFirmsTech platform',
  base: '/pft-client-docs/',
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Client Docs', link: '/client/' },
      { text: 'Admin', link: '/admin/' }
    ],

    sidebar: {
      '/client/': [
        {
          text: 'Client Documentation',
          items: [
            { text: 'Overview', link: '/client/' },
            { text: 'User Journey', link: '/client/user-journey' },
            { text: 'Account Purchase', link: '/client/account-purchase' },
            { text: 'Trading Experience', link: '/client/trading-experience' },
            { text: 'Account Outcomes', link: '/client/account-outcomes' },
            { text: 'Withdrawal Process', link: '/client/withdrawal-process' },
            { text: 'Email Notifications', link: '/client/email-notifications' },
            { text: 'Reward Rejected vs Cancelled', link: '/client/reward-rejected-vs-cancelled' }
          ]
        }
      ],

      '/admin/': [
        {
          text: 'Admin Documentation',
          items: [
            { text: 'Overview', link: '/admin/' },
            { text: 'Master User Flow', link: '/admin/master-user-flow' },
            { text: 'Registration & Payment', link: '/admin/registration-payment' },
            { text: 'Trading & Monitoring', link: '/admin/trading-monitoring' },
            { text: 'Breach Detection', link: '/admin/breach-detection' },
            { text: 'Pass & Progression', link: '/admin/pass-progression' },
            { text: 'Withdrawal Flow', link: '/admin/withdrawal-flow' },
            { text: 'Contract Submission', link: '/admin/contract-submission' },
            { text: 'Email Flows', link: '/admin/email-flows' }
          ]
        }
      ]
    },

    search: {
      provider: 'local',
      options: {
        _render(src, env, md) {
          const html = md.render(src, env)
          if (env.relativePath?.startsWith('admin/')) return ''
          return html
        }
      }
    },

    footer: {
      message: 'PropFirmsTech Documentation',
      copyright: 'Copyright © 2026 PropFirmsTech'
    }
  }
})
