import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  title: 'PropFirmsTech',
  description: 'Official documentation for PropFirmsTech platform',
  base: '/pft-client-docs/',
  ignoreDeadLinks: false,

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Client Docs', link: '/client/' },
      { text: 'Firm Admin Guide', link: '/admin/' }
    ],

    sidebar: {
      '/client/': [
        {
          text: 'Client Documentation',
          items: [
            { text: 'Overview', link: '/client/' },
            { text: 'Programs', link: '/client/programs' },
            { text: 'Free Trial Accounts', link: '/client/free-trial' },
            { text: 'User Journey', link: '/client/user-journey' },
            { text: 'Account Purchase', link: '/client/account-purchase' },
            { text: 'Trading Experience', link: '/client/trading-experience' },
            { text: 'Account Outcomes', link: '/client/account-outcomes' },
            { text: 'Reset a Breached Account', link: '/client/reset-breached-account' },
            { text: 'Withdrawal Process', link: '/client/withdrawal-process' },
            { text: 'Email Notifications', link: '/client/email-notifications' },
            { text: 'Payout Rejected vs Cancelled', link: '/client/reward-rejected-vs-cancelled' },
            { text: "What's New and Navigation", link: '/client/whats-new' }
          ]
        }
      ],

      '/admin/': [
        {
          text: 'Firm Admin Guide',
          items: [
            { text: 'Overview', link: '/admin/' },
            { text: 'Master User Flow', link: '/admin/master-user-flow' },
            { text: 'Registration & Payment', link: '/admin/registration-payment' },
            { text: 'Trading & Monitoring', link: '/admin/trading-monitoring' },
            { text: 'Breach Detection', link: '/admin/breach-detection' },
            { text: 'Pass & Progression', link: '/admin/pass-progression' },
            { text: 'Withdrawal Flow', link: '/admin/withdrawal-flow' },
            { text: 'Paid Reset', link: '/admin/paid-reset' },
            { text: 'Contract Submission', link: '/admin/contract-submission' },
            { text: 'Email Flows', link: '/admin/email-flows' },
            { text: 'Trustpilot Reviews', link: '/admin/trustpilot-reviews' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    footer: {
      message: 'PropFirmsTech Documentation',
      copyright: 'Copyright © 2026 PropFirmsTech'
    }
  }
})
