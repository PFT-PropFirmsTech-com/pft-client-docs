# Account Outcomes

## Understanding Your Results

```mermaid
flowchart TD
    Start([Trading in Progress]) --> CheckStatus[Check Your Status]

    CheckStatus --> Outcome{What's Your Result?}

    Outcome -->|Success Path| PassCheck[Profit Target Reached]
    Outcome -->|Challenge Path| StillTrading[Still Trading]
    Outcome -->|Limit Reached| BreachCheck[Risk Limit Exceeded]

    PassCheck --> Celebrate[Congratulations!<br/>You Passed]
    Celebrate --> Certificate[Receive Achievement Certificate]
    Certificate --> NextStep{What's Next?}

    NextStep -->|More Stages| AdvanceStage[Advance to Next Stage:<br/>- New account provided<br/>- Higher targets<br/>- Same or larger size]

    NextStep -->|Funded Stage| GetFunded[Funded Account Activated:<br/>- Trade with real capital<br/>- Earn profit splits<br/>- Request withdrawals]

    AdvanceStage --> NewAccount[Receive New Credentials]
    GetFunded --> NewAccount

    NewAccount --> StartNew[Start Trading New Stage]
    StartNew --> Success([Continue Your Journey])

    BreachCheck --> Closed[Challenge Not Met]
    Closed --> Explanation[See What Happened:<br/>- Which limit was reached<br/>- Account snapshot<br/>- Trading summary]

    Explanation --> LearnMore[Review Your Trading:<br/>- See your trades<br/>- Understand the outcome<br/>- Learn for next time]

    LearnMore --> Options{What Would You Like to Do?}

    Options -->|Try Again| NewChallenge[Start New Challenge:<br/>- Choose same or different size<br/>- Apply lessons learned<br/>- Fresh start]

    Options -->|Review Details| ViewDetails[View Full Details:<br/>- All trades<br/>- Account history<br/>- Performance stats]

    Options -->|Contact Us| Support[Contact Support:<br/>- Ask questions<br/>- Get guidance<br/>- Discuss options]

    NewChallenge --> Purchase[Purchase New Account]
    Purchase --> Success

    ViewDetails --> Options
    Support --> Options

    StillTrading --> Monitor[Keep Trading:<br/>- Work toward target<br/>- Manage risk<br/>- Track progress]

    Monitor --> CheckStatus

    style Celebrate fill:#ccffcc
    style GetFunded fill:#99ff99
    style Success fill:#e1f5e1
    style Closed fill:#ffcccc
    style Purchase fill:#ffffcc
```

## Success Outcomes

### When You Pass

```mermaid
flowchart LR
    A[Target<br/>Reached] --> B[Certificate<br/>Earned]
    B --> C[Next Stage<br/>or Funded]
    C --> D[New<br/>Account]
    D --> E[Continue<br/>Trading]

    style A fill:#ccffcc
    style B fill:#ccffcc
    style C fill:#99ff99
    style D fill:#99ff99
    style E fill:#ccffcc
```

#### What Happens
1. **Immediate Recognition**: Dashboard shows success message
2. **Certificate Issued**: Professional achievement certificate
3. **Email Notification**: Congratulations email with details
4. **Next Steps**: Clear instructions for advancement

#### What You Receive
- **Achievement Certificate**: Proof of your success
- **Progress Summary**: Your trading performance
- **Next Stage Details**: Information about advancement
- **New Credentials**: Access to next account (if applicable)

### Advancement Paths

| Current Stage | Next Stage | What Changes |
|--------------|------------|--------------|
| **Phase 1** | Phase 2 or Funded | Higher targets, new account |
| **Phase 2** | Phase 3 or Funded | Final evaluation or funded |
| **Phase 3** | Funded Account | Real trading begins |
| **Funded** | Continue Trading | Keep earning and withdrawing |

## Challenge Outcomes

### When Limits Are Reached

```mermaid
flowchart LR
    A[Limit<br/>Reached] --> B[Account<br/>Closed]
    B --> C[Review<br/>Details]
    C --> D[Learn &<br/>Improve]
    D --> E[Try<br/>Again]

    style A fill:#ffcccc
    style B fill:#ffcccc
    style C fill:#ffffcc
    style D fill:#e6f3ff
    style E fill:#ccffcc
```

#### What Happens
1. **Notification**: Dashboard shows outcome
2. **Summary Provided**: See what happened
3. **Account Closed**: Trading stops on this account
4. **Options Presented**: Clear next steps available

#### What You See
- **Clear Explanation**: Which limit was reached
- **Trading Summary**: Your trades and performance
- **Account Snapshot**: Final account state
- **Learning Points**: Understand the outcome

### Common Scenarios

#### Daily Loss Limit
- **What it means**: Maximum daily loss reached
- **Why it matters**: Protects your account
- **Next time**: Manage daily risk better

#### Total Loss Limit
- **What it means**: Overall loss limit reached
- **Why it matters**: Account protection rule
- **Next time**: Use better risk management

#### Trading Rules
- **What it means**: A trading rule wasn't followed
- **Why it matters**: Rules ensure fair evaluation
- **Next time**: Review and follow all rules

## Your Options After Challenge

### Option 1: Start Fresh
- **New Challenge**: Purchase a new account
- **Same or Different**: Choose any size or type
- **Apply Learning**: Use experience from previous attempt
- **Fresh Start**: Clean slate with new account

### Option 2: Review and Learn
- **Study Trades**: Analyze what happened
- **Identify Patterns**: See where to improve
- **Understand Rules**: Review requirements
- **Plan Better**: Develop improved strategy

### Option 3: Get Support
- **Ask Questions**: Contact support team
- **Get Guidance**: Understand your results
- **Discuss Options**: Explore possibilities
- **Receive Help**: Get assistance with next steps

## Progress Tracking

### While Trading

```mermaid
graph TD
    subgraph Your Progress
        A[Profit Progress<br/>Toward Target]
        B[Trading Days<br/>Completed]
        C[Risk Usage<br/>Limits Remaining]
        D[Performance<br/>Statistics]
    end

    style A fill:#ccffcc
    style B fill:#ccccff
    style C fill:#ffffcc
    style D fill:#e6e6e6
```

### Status Indicators
- **Green**: On track, good progress
- **Yellow**: Approaching limits, be careful
- **Red**: Very close to limits, trade cautiously

## Understanding Your Results

### Success Metrics
- **Profit Target**: Did you reach the goal?
- **Trading Days**: Did you trade enough days?
- **Risk Management**: Did you stay within limits?
- **Rule Compliance**: Did you follow all rules?

### Performance Review
- **Win Rate**: Percentage of winning trades
- **Average Profit**: Typical profit per trade
- **Risk Usage**: How much risk you used
- **Consistency**: Trading pattern quality

## Moving Forward

### After Success
1. **Celebrate**: Acknowledge your achievement
2. **Prepare**: Get ready for next stage
3. **Continue**: Keep improving your skills
4. **Advance**: Progress toward funded trading

### After Challenge
1. **Review**: Understand what happened
2. **Learn**: Identify improvement areas
3. **Plan**: Develop better strategy
4. **Retry**: Start fresh when ready

## Support Resources

### Available Help
- **FAQ**: Common questions answered
- **Trading Tips**: Improve your strategy
- **Rule Guides**: Understand requirements
- **Support Team**: Personal assistance

### Contact Options
- **Email Support**: Detailed inquiries
- **Live Chat**: Quick questions
- **Help Center**: Self-service resources
- **Community**: Connect with other traders

---

**Every outcome is a learning opportunity. Success or challenge, we're here to support your journey.**
