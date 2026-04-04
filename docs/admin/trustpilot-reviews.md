# Trustpilot Reviews Integration

Automatically request Trustpilot reviews from traders after positive events like payouts, challenge completions, and funded account milestones.

**Dashboard Location:** `Admin > Trustpilot Settings`

---

## Overview

The Trustpilot integration sends automated review invitations to traders when positive events occur. This helps build social proof and collect genuine reviews from satisfied traders.

The page has three tabs:
- **Settings** — Configure the integration, API credentials, trigger events, and timing
- **Invitations** — View invitation history, resend failed ones, and send test invitations
- **Analytics** — See stats by event type, success rate, and delivery method

---

## Setup Guide

### Step 1: Get Your Trustpilot Credentials

1. Log in to your [Trustpilot Business Dashboard](https://businessapp.b2b.trustpilot.com)
2. Navigate to **Get Reviews > Invitation Settings**
3. Copy your **BCC Invite Email** — it looks like `yourcompany+XXXXXXX@invite.trustpilot.com`
4. *(Optional)* For API method, go to **Integrations > API** and copy your **Business Unit ID**, **API Key**, and **API Secret**

### Step 2: Configure General Settings

| Setting | Description | Recommended |
|---------|-------------|-------------|
| **Enable Integration** | Master toggle to turn on/off automatic invitations | On |
| **Invitation Method** | How invitations are sent (see below) | BCC Email |
| **BCC Invite Email** | Your Trustpilot BCC email address | Required for BCC method |
| **Locale** | Language for the review invitation | Match your audience |

#### Invitation Methods

| Method | How It Works | Requirements |
|--------|-------------|--------------|
| **BCC Email** (Recommended) | Adds the Trustpilot BCC email to system emails sent to the trader. Simple, no API needed. | BCC Invite Email only |
| **Trustpilot API** | Sends invitations directly via Trustpilot's API for more control. | Business Unit ID + API Key + API Secret |
| **Both** | Uses both methods for maximum coverage. | All credentials |

::: tip Recommendation
Start with **BCC Email** — it's the easiest to set up and doesn't require API credentials. You only need your BCC invite email from the Trustpilot dashboard.
:::

### Step 3: Configure API (Optional)

Only needed if using **API** or **Both** invitation method:

| Field | Where to Find It |
|-------|-------------------|
| **Business Unit ID** | Your Trustpilot business dashboard URL (the ID in the URL) |
| **API Key** | Trustpilot Business > Integrations > API |
| **API Secret** | Trustpilot Business > Integrations > API |
| **Redirect URL** | *(Optional)* Where users go after submitting a review (e.g. your thank-you page) |

After entering your API credentials, click **Test API Connection** to verify everything works.

### Step 4: Choose Trigger Events

Select which positive events should trigger a review invitation:

| Event | When It Triggers |
|-------|-----------------|
| **Payout Completed** | When a trader's payout is processed and paid |
| **Payout Approved** | When a trader's payout request is approved |
| **Challenge Passed** | When a trader passes their challenge/evaluation |
| **Funded Achieved** | When a trader reaches funded account status |
| **Funded Validation** | When a funded account validation is completed |
| **Program Progression** | When a trader progresses to the next phase |
| **Support Resolved** | When a support ticket is resolved positively |

::: tip
**Payout Completed** and **Funded Achieved** are the best events to enable — traders are happiest right after getting paid or reaching funded status.
:::

### Step 5: Set Timing & Thresholds

| Setting | Description | Recommended |
|---------|-------------|-------------|
| **Cooldown Period (Days)** | Minimum days between invitations to the same trader. Prevents spamming. | 30 days |
| **Delay After Event (Hours)** | How long to wait after the event before sending the invitation. Gives the trader time to appreciate the moment. | 24 hours |
| **Minimum Payout Amount ($)** | Only send invitations for payouts above this amount. Filters out small payouts. | $100 |
| **Include Order Reference** | Adds the transaction/account ID to the review for verification. | On |

### Step 6: Save & Test

1. Click **Save Configuration** to save all settings
2. Go to the **Invitations** tab
3. Click **Send Test Invitation**
4. Enter a test email, name, and select an event type
5. Verify the invitation arrives correctly

---

## Managing Invitations

### Invitations Tab

The Invitations tab shows all sent review invitations with:
- **User** — Trader name and email
- **Event** — What triggered the invitation
- **Method** — BCC or API
- **Status** — Sent (green) or Failed (red)
- **Date** — When it was sent
- **Actions** — Resend failed invitations or delete records

### Filters

Use the dropdown filters to narrow by:
- **Event type** — Show only invitations for a specific event
- **Status** — Show only sent or failed invitations

### Resending Failed Invitations

If an invitation failed, click the refresh icon to resend it. This is useful if there was a temporary email issue.

---

## Analytics

The Analytics tab shows:
- **Invitations by Event** — Bar chart showing which events generate the most invitations
- **Success Rate** — Circular chart showing the percentage of successfully sent invitations
- **Invitations by Method** — Breakdown of BCC vs API vs Both delivery methods

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Invitations not sending | Check that **Enable Integration** is turned on and at least one event is selected |
| BCC method not working | Verify the BCC email matches exactly what's in your Trustpilot dashboard |
| API connection failing | Double-check your Business Unit ID, API Key, and API Secret. Use the **Test API Connection** button. |
| Too many invitations | Increase the **Cooldown Period** or reduce the number of enabled events |
| Invitations too frequent | Increase the **Delay After Event** value |
| Not seeing invitations for small payouts | Lower the **Minimum Payout Amount** threshold |
