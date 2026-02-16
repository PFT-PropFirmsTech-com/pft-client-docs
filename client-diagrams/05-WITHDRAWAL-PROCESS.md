# Withdrawal Process

## Getting Your Profits Paid Out

```mermaid
flowchart TD
    Start([Funded Account Trading]) --> CheckEligible[Check Withdrawal Eligibility]

    CheckEligible --> Requirements[Review Requirements:<br/>- Funded account status<br/>- Minimum trading days met<br/>- Waiting period satisfied<br/>- Positive profit balance]

    Requirements --> Eligible{Are You Eligible?}

    Eligible -->|Not Yet| SeeWhy[See Why Not Eligible:<br/>- Days remaining<br/>- Waiting period left<br/>- Requirements needed]

    SeeWhy --> KeepTrading[Continue Trading]
    KeepTrading --> CheckEligible

    Eligible -->|Yes| RequestWithdrawal[Request Withdrawal]

    RequestWithdrawal --> EnterAmount[Enter Withdrawal Amount]
    EnterAmount --> ValidAmount{Amount Valid?}

    ValidAmount -->|No| AmountError[Amount Issue:<br/>- Too high<br/>- Too low<br/>- Exceeds profit]
    AmountError --> EnterAmount

    ValidAmount -->|Yes| ChooseMethod[Choose Payment Method]

    ChooseMethod --> MethodOptions{Select Method}

    MethodOptions -->|Cryptocurrency| CryptoSetup[Enter Crypto Wallet Address]
    MethodOptions -->|Bank Transfer| BankSetup[Enter Bank Details]
    MethodOptions -->|PayPal| PayPalSetup[Enter PayPal Email]

    CryptoSetup --> ReviewRequest
    BankSetup --> ReviewRequest
    PayPalSetup --> ReviewRequest

    ReviewRequest[Review Your Request:<br/>- Withdrawal amount<br/>- Your share percentage<br/>- Payment method<br/>- Estimated payout]

    ReviewRequest --> AddNotes{Add Notes?}
    AddNotes -->|Yes| EnterNotes[Add Comments or Instructions]
    AddNotes -->|No| SubmitRequest

    EnterNotes --> SubmitRequest[Submit Request]

    SubmitRequest --> Confirmation[Request Submitted Successfully]

    Confirmation --> Notify[You'll Receive:<br/>- Email confirmation<br/>- Request reference number<br/>- Expected timeline<br/>- Dashboard notification]

    Notify --> AdminReview[Request Under Review]

    AdminReview --> ReviewProcess[Review Process:<br/>- Account verification<br/>- Trading review<br/>- Compliance check<br/>- Amount validation]

    ReviewProcess --> Decision{Review Decision}

    Decision -->|Approved| Approved[Withdrawal Approved]
    Decision -->|Needs Info| MoreInfo[Additional Information Needed]
    Decision -->|Declined| Declined[Request Declined]

    MoreInfo --> ProvideInfo[Provide Requested Information]
    ProvideInfo --> AdminReview

    Declined --> Reason[See Decline Reason:<br/>- Explanation provided<br/>- Next steps<br/>- Contact support option]

    Reason --> ContactSupport{Contact Support?}
    ContactSupport -->|Yes| Support[Speak with Support Team]
    ContactSupport -->|No| KeepTrading

    Support --> Resolution{Issue Resolved?}
    Resolution -->|Yes| RequestWithdrawal
    Resolution -->|No| KeepTrading

    Approved --> Processing[Processing Your Payout]

    Processing --> PaymentMethod{Payment Method}

    PaymentMethod -->|Cryptocurrency| CryptoPayout[Crypto Transfer Initiated:<br/>- Sent to your wallet<br/>- Usually 10-60 minutes]

    PaymentMethod -->|Bank Transfer| BankPayout[Bank Transfer Initiated:<br/>- Sent to your bank<br/>- Usually 3-5 business days]

    PaymentMethod -->|PayPal| PayPalPayout[PayPal Transfer Initiated:<br/>- Sent to your PayPal<br/>- Usually 1-2 business days]

    CryptoPayout --> Complete
    BankPayout --> Complete
    PayPalPayout --> Complete

    Complete[Payout Completed]

    Complete --> FinalNotify[You'll Receive:<br/>- Completion email<br/>- Transaction details<br/>- Updated balance<br/>- Receipt available]

    FinalNotify --> BalanceUpdated[Account Balance Updated]

    BalanceUpdated --> NextWithdrawal{Request Another Withdrawal?}

    NextWithdrawal -->|Yes| WaitPeriod[Wait for Next Eligibility Period]
    WaitPeriod --> CheckEligible

    NextWithdrawal -->|No| ContinueTrading[Continue Trading]
    ContinueTrading --> End([Keep Earning])

    style Eligible fill:#ccffcc
    style Approved fill:#ccffcc
    style Complete fill:#99ff99
    style Declined fill:#ffcccc
    style End fill:#e1f5e1
```

## Eligibility Requirements

### What You Need

```mermaid
graph TD
    subgraph Requirements["Withdrawal Requirements"]
        A[Funded Account<br/>Must be funded stage]
        B[Trading Days<br/>Minimum days met]
        C[Waiting Period<br/>Time since last withdrawal]
        D[Profit Balance<br/>Positive profits available]
    end

    style A fill:#ccffcc
    style B fill:#ccffcc
    style C fill:#ccffcc
    style D fill:#ccffcc
```

#### Typical Requirements
- **Account Status**: Must be in funded stage
- **Trading Days**: Usually 5-10 days of trading
- **Waiting Period**: Usually 7-14 days between withdrawals
- **Profit Balance**: Must have profits to withdraw

### Check Your Eligibility

Your dashboard shows:
- **Current Status**: Eligible or not eligible
- **Days Completed**: Trading days count
- **Next Eligible Date**: When you can withdraw next
- **Available Profit**: Amount you can withdraw

## Payment Methods

### Cryptocurrency
- **Speed**: 10-60 minutes
- **Fees**: Low (0.5-1%)
- **What You Need**: Crypto wallet address
- **Best For**: Fast payouts

### Bank Transfer
- **Speed**: 3-5 business days
- **Fees**: Moderate
- **What You Need**: Bank account details
- **Best For**: Traditional banking

### PayPal
- **Speed**: 1-2 business days
- **Fees**: Moderate (2.9%)
- **What You Need**: PayPal email
- **Best For**: Convenient transfers

## Your Profit Share

```mermaid
flowchart LR
    A[Total Profit<br/>$10,000] --> B[Your Share<br/>80%]
    B --> C[You Receive<br/>$8,000]

    A --> D[Platform Share<br/>20%]
    D --> E[Platform Keeps<br/>$2,000]

    style C fill:#ccffcc
    style E fill:#e6e6e6
```

### Understanding Profit Splits
- **Your Share**: Typically 70-90% of profits
- **Platform Share**: Typically 10-30% of profits
- **Clear Display**: See exact amounts before submitting
- **No Hidden Fees**: What you see is what you get

## Withdrawal Timeline

```mermaid
gantt
    title Typical Withdrawal Timeline
    dateFormat YYYY-MM-DD

    section Request
    Submit Request           :milestone, 2026-02-08, 0d

    section Review
    Under Review            :active, 2026-02-08, 2d

    section Approval
    Approved                :milestone, 2026-02-10, 0d

    section Processing
    Payment Processing      :active, 2026-02-10, 3d

    section Complete
    Payout Received         :milestone, 2026-02-13, 0d
```

### Expected Timeframes
1. **Submission**: Instant
2. **Review**: 1-3 business days
3. **Processing**: Varies by method
4. **Receipt**: Based on payment method

## What Happens During Review

### We Check
- **Account Status**: Verify funded account
- **Trading Activity**: Review your trades
- **Compliance**: Ensure rules followed
- **Amount**: Validate withdrawal amount

### You'll Be Notified
- **Status Updates**: Email notifications
- **Dashboard Updates**: Real-time status
- **Any Questions**: We'll contact you if needed
- **Final Decision**: Approval or decline with reason

## After Approval

### Processing Steps
1. **Payment Initiated**: Transfer starts
2. **In Transit**: Payment being processed
3. **Completed**: Funds delivered
4. **Balance Updated**: Account reflects withdrawal

### What You Receive
- **Confirmation Email**: Payment details
- **Transaction ID**: Reference number
- **Receipt**: Downloadable proof
- **Updated Dashboard**: New balance shown

## Withdrawal Limits

### Typical Limits
- **Minimum**: $100-$500 per withdrawal
- **Maximum**: $50,000-$100,000 per withdrawal
- **Frequency**: Based on waiting period
- **Balance**: Cannot exceed available profit

### Your Dashboard Shows
- **Available Amount**: How much you can withdraw
- **Minimum Required**: Lowest amount allowed
- **Maximum Allowed**: Highest amount allowed
- **Next Eligible Date**: When you can withdraw again

## If Request Is Declined

### Common Reasons
- **Insufficient Trading Days**: Need more trading activity
- **Waiting Period**: Too soon since last withdrawal
- **Account Review**: Additional verification needed
- **Amount Issue**: Requested amount not available

### What You Can Do
1. **Review Reason**: Understand why declined
2. **Contact Support**: Get clarification
3. **Meet Requirements**: Fulfill any missing criteria
4. **Resubmit**: Try again when eligible

## Managing Your Withdrawals

### Best Practices
- **Check Eligibility First**: Verify before requesting
- **Accurate Information**: Provide correct payment details
- **Reasonable Amounts**: Stay within limits
- **Plan Ahead**: Consider waiting periods
- **Keep Trading**: Continue earning while waiting

### Track Your Withdrawals
- **Request History**: See all past requests
- **Status Tracking**: Monitor current requests
- **Payment Records**: View completed payouts
- **Total Withdrawn**: Track lifetime earnings

## Support and Help

### Need Assistance?
- **FAQ Section**: Common questions answered
- **Live Chat**: Quick help available
- **Email Support**: Detailed inquiries
- **Help Center**: Self-service resources

### Contact Us About
- **Eligibility Questions**: When can I withdraw?
- **Payment Methods**: Which option is best?
- **Status Updates**: Where is my withdrawal?
- **Technical Issues**: Payment problems

---

**Your earnings, your way. We make withdrawals simple and transparent.**
