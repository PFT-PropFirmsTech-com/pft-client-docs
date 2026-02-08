# Account Purchase Flow

## Simple Path to Your Trading Account

```mermaid
flowchart TD
    Start([Browse Programs]) --> ViewPrograms[View Available Challenges]

    ViewPrograms --> ProgramInfo[Review Program Details:<br/>- Account size options<br/>- Profit targets<br/>- Trading rules<br/>- Pricing]

    ProgramInfo --> SelectSize[Choose Account Size]
    SelectSize --> SelectType[Choose Challenge Type:<br/>- One Step<br/>- Two Step<br/>- Three Step<br/>- Instant Funded]

    SelectType --> Addons{Add Features?}

    Addons -->|Yes| BrowseAddons[Browse Optional Features:<br/>- Higher leverage<br/>- Extended drawdown<br/>- Better profit split<br/>- Reset options]
    BrowseAddons --> SelectAddons[Select Features]
    SelectAddons --> Addons

    Addons -->|No| Discount{Have Discount Code?}

    Discount -->|Yes| ApplyCode[Enter Discount Code]
    ApplyCode --> Discount

    Discount -->|No| PaymentChoice{Choose Payment Plan}

    PaymentChoice -->|Pay in Full| FullPayment[Pay Complete Amount Now]
    PaymentChoice -->|Pay as You Progress| PartialPayment[Pay Initial Amount<br/>Pay remainder after passing]

    FullPayment --> ReviewOrder[Review Your Order:<br/>- Account details<br/>- Features included<br/>- Total price<br/>- Discounts applied]
    PartialPayment --> ReviewOrder

    ReviewOrder --> SelectMethod[Choose Payment Method:<br/>- Credit/Debit Card<br/>- PayPal<br/>- Cryptocurrency<br/>- Bank Transfer]

    SelectMethod --> ProcessPayment[Complete Payment]

    ProcessPayment --> PaymentResult{Payment Status}

    PaymentResult -->|Success| Success[Payment Confirmed]
    PaymentResult -->|Failed| Failed[Payment Failed]

    Failed --> Retry{Try Again?}
    Retry -->|Yes| SelectMethod
    Retry -->|No| End1([Exit])

    Success --> ReceiveAccess[Receive Trading Access:<br/>- Login credentials<br/>- Trading platform details<br/>- Welcome email<br/>- Getting started guide]

    ReceiveAccess --> Dashboard[Access Your Dashboard]
    Dashboard --> ViewAccount[View Account Details:<br/>- Account balance<br/>- Trading rules<br/>- Profit targets<br/>- Progress tracking]

    ViewAccount --> Ready[Ready to Trade]

    style Start fill:#e1f5e1
    style Success fill:#ccffcc
    style Ready fill:#99ff99
    style Failed fill:#ffcccc
    style End1 fill:#e1e1e1
```

## Account Size Options

```mermaid
graph LR
    A[$2,500] --> B[$5,000]
    B --> C[$10,000]
    C --> D[$25,000]
    D --> E[$50,000]
    E --> F[$100,000]
    F --> G[$200,000]

    style A fill:#ffe6cc
    style B fill:#ffe6cc
    style C fill:#ffcc99
    style D fill:#ffcc99
    style E fill:#ffb366
    style F fill:#ff9933
    style G fill:#ff8000
```

## Challenge Types Comparison

| Challenge Type | Stages | Time to Funded | Best For |
|---------------|--------|----------------|----------|
| **One Step** | 1 phase | Fastest | Experienced traders |
| **Two Step** | 2 phases | Moderate | Most traders |
| **Three Step** | 3 phases | Longer | Conservative approach |
| **Instant Funded** | 0 phases | Immediate | Skip evaluation |

## Payment Plans

### Pay in Full
- **Pay once**: Complete payment upfront
- **Immediate access**: Start trading right away
- **No future payments**: All stages included
- **Best value**: Often includes discounts

### Pay as You Progress
- **Lower initial cost**: Pay 20-30% to start
- **Pay after passing**: Pay remainder when you advance
- **Flexible**: Only pay more if you succeed
- **Risk reduction**: Lower upfront investment

## Optional Features

### Performance Enhancements
- **Higher Leverage**: Trade with more buying power
- **Extended Drawdown**: More room for trading strategies
- **Better Profit Split**: Keep more of your earnings

### Trading Flexibility
- **High-Frequency Trading**: No restrictions on trade duration
- **News Trading**: Trade during major announcements
- **Weekend Holding**: Keep positions over weekends

### Safety Net
- **Reset Options**: Restart if you breach rules
- **Multiple Attempts**: Get extra chances to pass

## What You Receive

### Immediate Access
- Trading account credentials
- Platform download links
- Account dashboard access
- Real-time progress tracking

### Support Materials
- Welcome email with all details
- Trading rules and guidelines
- Profit target information
- Risk management limits

### Ongoing Benefits
- 24/7 dashboard access
- Real-time balance updates
- Performance analytics
- Achievement tracking

---

**Simple, transparent pricing. Choose what works for you.**
