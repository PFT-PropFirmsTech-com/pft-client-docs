# Contract Submission Flow

## Complete Contract Upload and Signing Process

```mermaid
flowchart TD
    Start([Funded Account]) --> CheckRequired{Contract<br/>Required?}

    CheckRequired -->|No| NoContract[No Contract Needed:<br/>Proceed to withdrawals]
    CheckRequired -->|Yes| ContractNotif[Contract Requirement Notification]

    ContractNotif --> NotifChannels[Notification Channels:<br/>- Email reminder<br/>- In-app banner<br/>- Dashboard alert<br/>- Withdrawal blocked message]

    NotifChannels --> UserDashboard[User Goes to Dashboard]
    UserDashboard --> ContractSection[Navigate to Contract Section]

    ContractSection --> CheckExisting{Existing<br/>Contract?}

    CheckExisting -->|Yes| ViewStatus[View Contract Status]
    ViewStatus --> StatusCheck{Contract<br/>Status?}

    StatusCheck -->|Pending| WaitReview[Wait for Admin Review]
    StatusCheck -->|Approved| ContractApproved[Contract Approved:<br/>Can request withdrawals]
    StatusCheck -->|Rejected| ViewRejection[View Rejection Reason]

    ViewRejection --> ReuploadOption{Reupload?}
    ReuploadOption -->|Yes| UploadNew
    ReuploadOption -->|No| End1([End])

    CheckExisting -->|No| ContractType{Contract<br/>Type?}

    ContractType -->|System Contract| SystemContract[System-Generated Contract]
    ContractType -->|Manual Upload| ManualContract[Manual Contract Upload]

    SystemContract --> CheckTemplate{Template<br/>Available?}

    CheckTemplate -->|Yes| SelectTemplate[Select Contract Template]
    SelectTemplate --> TemplateInfo[Template Information:<br/>- Standard agreement<br/>- Profit split terms<br/>- Trading rules<br/>- Payout terms<br/>- Liability clauses]

    TemplateInfo --> FillDetails[Auto-fill User Details:<br/>- Full name<br/>- Email<br/>- Address<br/>- Program details<br/>- Account size<br/>- Profit split %]

    FillDetails --> ReviewTemplate[Review Contract Terms]
    ReviewTemplate --> AcceptTerms{Accept<br/>Terms?}

    AcceptTerms -->|No| DeclineContract[Decline Contract]
    DeclineContract --> CannotWithdraw[Cannot Request Withdrawals]
    CannotWithdraw --> End2([End])

    AcceptTerms -->|Yes| SigningMethod{Signing<br/>Method?}

    SigningMethod -->|Manual| ManualSign[Manual Signature]
    ManualSign --> UploadSigned[Upload Signed PDF]
    UploadSigned --> SubmitContract

    SigningMethod -->|Adobe Sign| AdobeSign[Adobe Sign Integration]
    AdobeSign --> SendToAdobe[Send to Adobe Sign]
    SendToAdobe --> AdobeProcess[Adobe Sign Process:<br/>1. Email sent to user<br/>2. User opens email<br/>3. Review document<br/>4. E-sign document<br/>5. Submit signature]

    AdobeProcess --> AdobeCallback[Adobe Sign Callback]
    AdobeCallback --> AdobeStatus{Signing<br/>Status?}

    AdobeStatus -->|Completed| DownloadSigned[Download Signed Document]
    AdobeStatus -->|Declined| SigningDeclined[User Declined Signing]
    AdobeStatus -->|Expired| SigningExpired[Signing Link Expired]

    SigningDeclined --> CannotWithdraw
    SigningExpired --> ResendSign{Resend?}
    ResendSign -->|Yes| SendToAdobe
    ResendSign -->|No| End2

    DownloadSigned --> StoreContract[Store Signed Contract]
    StoreContract --> SubmitContract

    CheckTemplate -->|No| ManualContract

    ManualContract --> UploadNew[Upload Contract Document]

    UploadNew --> FileUpload[File Upload Interface]
    FileUpload --> SelectFile[Select File from Device]

    SelectFile --> ValidateFile{File Valid?}

    ValidateFile -->|No| FileError[File Error:<br/>- Invalid format<br/>- File too large<br/>- Corrupted file<br/>- Wrong document type]
    FileError --> SelectFile

    ValidateFile -->|Yes| FileDetails[File Details:<br/>- File name<br/>- File size<br/>- Upload date<br/>- Document type]

    FileDetails --> AddNotes{Add Notes?}
    AddNotes -->|Yes| EnterNotes[Enter Notes/Comments]
    EnterNotes --> SubmitContract
    AddNotes -->|No| SubmitContract[Submit Contract]

    SubmitContract --> CreateRecord[Create Contract Record]

    CreateRecord --> RecordData[Contract Record:<br/>- User ID<br/>- Program ID<br/>- Contract type<br/>- File URL<br/>- Signing type<br/>- Status: pending<br/>- Notes<br/>- Submission date]

    RecordData --> NotifyUser[Notify User:<br/>- Email confirmation<br/>- In-app notification<br/>- Submission received<br/>- Review timeline]

    NotifyUser --> NotifyAdmin[Notify Admin:<br/>- New contract submitted<br/>- User details<br/>- Dashboard alert<br/>- Review queue]

    NotifyAdmin --> AdminQueue[Add to Admin Review Queue]

    AdminQueue --> AdminReview[Admin Reviews Contract]

    AdminReview --> AdminDashboard[Admin Dashboard Shows:<br/>- User profile<br/>- Contract document<br/>- Program details<br/>- Account history<br/>- Previous contracts<br/>- KYC status]

    AdminDashboard --> DownloadContract[Download Contract PDF]
    DownloadContract --> ReviewDocument[Review Document Content]

    ReviewDocument --> CheckValidity[Check Contract Validity:<br/>- Correct template used<br/>- All fields filled<br/>- Signature present<br/>- Dates correct<br/>- Terms accepted<br/>- Legal compliance]

    CheckValidity --> VerifyIdentity[Verify Identity:<br/>- Name matches KYC<br/>- Signature matches<br/>- Address matches<br/>- Details consistent]

    VerifyIdentity --> CheckCompleteness{Document<br/>Complete?}

    CheckCompleteness -->|No| RequestRevision[Request Revision]
    RequestRevision --> RevisionReason[Provide Revision Reason:<br/>- Missing information<br/>- Incorrect details<br/>- Invalid signature<br/>- Wrong template<br/>- Other issues]

    RevisionReason --> RejectContract[Reject Contract]

    CheckCompleteness -->|Yes| CheckLegitimacy{Legitimate<br/>Document?}

    CheckLegitimacy -->|No| FraudDetected[Fraud Detected:<br/>- Forged signature<br/>- Fake document<br/>- Identity mismatch<br/>- Suspicious activity]

    FraudDetected --> FlagAccount[Flag Account for Investigation]
    FlagAccount --> RejectContract

    CheckLegitimacy -->|Yes| AutoApprove{Auto-Approve<br/>Enabled?}

    AutoApprove -->|Yes| ApproveContract[Approve Contract]
    AutoApprove -->|No| ManualDecision{Admin<br/>Decision?}

    ManualDecision -->|Reject| RejectContract
    ManualDecision -->|Approve| ApproveContract

    ApproveContract --> UpdateStatus[Update Status: approved]
    UpdateStatus --> StoreApproved[Store Approved Contract]

    StoreApproved --> NotifyApproval[Notify User:<br/>- Email: Contract approved<br/>- In-app notification<br/>- Can now request withdrawals<br/>- View approved contract]

    NotifyApproval --> SocketUpdate[Socket.io Update:<br/>- Event: contract:approved<br/>- Dashboard refresh<br/>- Enable withdrawal button]

    SocketUpdate --> UnblockWithdrawals[Unblock Withdrawal Requests]
    UnblockWithdrawals --> ContractComplete[Contract Process Complete]

    ContractComplete --> EnableWithdrawals[User Can Now:<br/>- Request withdrawals<br/>- View contract<br/>- Download contract<br/>- Update contract if needed]

    EnableWithdrawals --> End3([End - Contract Approved])

    RejectContract --> UpdateStatusRejected[Update Status: rejected]
    UpdateStatusRejected --> NotifyRejection[Notify User:<br/>- Email: Contract rejected<br/>- Rejection reason<br/>- Required corrections<br/>- Resubmission instructions]

    NotifyRejection --> UserResubmit{User<br/>Resubmits?}

    UserResubmit -->|Yes| UploadNew
    UserResubmit -->|No| End4([End - Cannot Withdraw])

    WaitReview --> CheckReviewTime{Review<br/>Time Exceeded?}
    CheckReviewTime -->|Yes| SendReminder[Send Reminder to Admin]
    SendReminder --> WaitReview
    CheckReviewTime -->|No| WaitReview

    NoContract --> End5([End - No Contract Needed])

    style ApproveContract fill:#ccffcc
    style ContractComplete fill:#99ff99
    style RejectContract fill:#ffcccc
    style FraudDetected fill:#ff9999
    style End3 fill:#e1f5e1
    style End4 fill:#ffe1e1
    style End5 fill:#e1f5e1
```

## Contract Types

```mermaid
mindmap
  root((Contract<br/>Types))
    System Contract
      Auto-generated
      Standard template
      Pre-filled details
      Adobe Sign integration
      Quick approval
    Manual Contract
      User uploads
      Custom format
      Manual review required
      Longer approval time
    Created by Admin
      Admin generates
      Custom terms
      Assigned to user
      User signs
    Assigned System
      System assigns
      Based on program
      Auto-approval option
      Standard terms
```

## Contract Data Structure

```mermaid
classDiagram
    class Contract {
        +ObjectId userId
        +ObjectId programId
        +string contractType
        +string signingType
        +string status
        +string fileUrl
        +string fileName
        +number fileSize
        +string notes
        +string rejectionReason
        +Date submittedAt
        +Date approvedAt
        +Date rejectedAt
        +Object signatureFields
        +string adobeAgreementId
        +Date createdAt
        +Date updatedAt
    }

    class ContractType {
        <<enumeration>>
        contract
        system-contract
        created-by-admin
        assigned-system
    }

    class SigningType {
        <<enumeration>>
        manual
        acrobat
    }

    class ContractStatus {
        <<enumeration>>
        pending
        approved
        rejected
    }

    Contract --> ContractType
    Contract --> SigningType
    Contract --> ContractStatus
```

## Contract Status Flow

```mermaid
stateDiagram-v2
    [*] --> Pending: Contract Submitted
    Pending --> Approved: Admin Approves
    Pending --> Rejected: Admin Rejects
    Rejected --> Pending: User Resubmits
    Approved --> [*]: Contract Active

    note right of Pending
        Under admin review
        User cannot withdraw
    end note

    note right of Approved
        Contract valid
        Withdrawals enabled
    end note

    note right of Rejected
        Needs correction
        User must resubmit
    end note
```

## Adobe Sign Integration Flow

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant AdobeSign
    participant Email

    User->>Backend: Select Adobe Sign
    Backend->>Backend: Generate Contract PDF
    Backend->>Backend: Prepare Signature Fields

    Backend->>AdobeSign: Create Agreement
    Note over Backend,AdobeSign: POST /agreements<br/>{fileInfo, participantSets, signatureFields}

    AdobeSign->>AdobeSign: Create Agreement
    AdobeSign->>Backend: Agreement ID + Signing URL

    Backend->>Backend: Store Agreement ID
    Backend->>Email: Send Signing Email
    Email->>User: Email with Signing Link

    User->>AdobeSign: Click Signing Link
    AdobeSign->>User: Show Contract Document
    User->>User: Review Contract
    User->>AdobeSign: E-Sign Document

    AdobeSign->>AdobeSign: Process Signature
    AdobeSign->>Backend: Webhook: Agreement Signed
    Backend->>Backend: Download Signed Document

    Backend->>Backend: Store Signed Contract
    Backend->>Backend: Update Status: pending
    Backend->>User: Notification: Contract Submitted

    Note over Backend: Admin reviews and approves

    Backend->>User: Notification: Contract Approved
```

## Contract Validation Checklist

```mermaid
flowchart TD
    Start[Contract Submitted] --> Check1{Correct<br/>Template?}
    Check1 -->|No| Invalid1[Invalid: Wrong template]
    Check1 -->|Yes| Check2{All Fields<br/>Filled?}

    Check2 -->|No| Invalid2[Invalid: Missing information]
    Check2 -->|Yes| Check3{Signature<br/>Present?}

    Check3 -->|No| Invalid3[Invalid: No signature]
    Check3 -->|Yes| Check4{Dates<br/>Correct?}

    Check4 -->|No| Invalid4[Invalid: Incorrect dates]
    Check4 -->|Yes| Check5{Name Matches<br/>KYC?}

    Check5 -->|No| Invalid5[Invalid: Name mismatch]
    Check5 -->|Yes| Check6{Address<br/>Matches?}

    Check6 -->|No| Invalid6[Invalid: Address mismatch]
    Check6 -->|Yes| Check7{Terms<br/>Accepted?}

    Check7 -->|No| Invalid7[Invalid: Terms not accepted]
    Check7 -->|Yes| Check8{Legal<br/>Compliance?}

    Check8 -->|No| Invalid8[Invalid: Non-compliant]
    Check8 -->|Yes| Valid[Valid Contract]

    Invalid1 --> Reject[Reject Contract]
    Invalid2 --> Reject
    Invalid3 --> Reject
    Invalid4 --> Reject
    Invalid5 --> Reject
    Invalid6 --> Reject
    Invalid7 --> Reject
    Invalid8 --> Reject

    Valid --> Approve[Approve Contract]

    style Valid fill:#ccffcc
    style Approve fill:#99ff99
    style Reject fill:#ffcccc
```

## Contract Requirements by Program

| Program Type | Contract Required | Signing Method | Auto-Approve | Review Time |
|--------------|-------------------|----------------|--------------|-------------|
| **Challenge Phase 1** | No | N/A | N/A | N/A |
| **Challenge Phase 2** | No | N/A | N/A | N/A |
| **Challenge Phase 3** | No | N/A | N/A | N/A |
| **Funded Account** | Yes | Manual or Adobe | Optional | 1-3 days |
| **Instant Funded** | Yes | Manual or Adobe | Optional | 1-3 days |

## Contract Document Sections

Typical contract includes:

1. **Parties**
   - Company information
   - User information
   - Effective date

2. **Account Details**
   - Program name
   - Account size
   - Account number
   - Start date

3. **Trading Terms**
   - Trading rules
   - Drawdown limits
   - Prohibited strategies
   - Risk management

4. **Profit Split**
   - Profit split percentage
   - Platform fee
   - Payment terms
   - Withdrawal schedule

5. **Payout Terms**
   - Minimum withdrawal
   - Holding period
   - Payment methods
   - Processing time

6. **Liability**
   - Risk disclosure
   - Liability limitations
   - Indemnification
   - Dispute resolution

7. **Termination**
   - Termination conditions
   - Breach consequences
   - Account closure
   - Final settlement

8. **Signatures**
   - User signature
   - Date
   - Company signature
   - Witness (if required)

## File Upload Specifications

| Specification | Requirement |
|---------------|-------------|
| **File Format** | PDF only |
| **Max File Size** | 10 MB |
| **Min File Size** | 10 KB |
| **Resolution** | Readable quality |
| **Pages** | 1-20 pages |
| **Encryption** | Not encrypted |
| **Password** | No password |

## Admin Review Dashboard

```mermaid
mindmap
  root((Admin Review<br/>Dashboard))
    Contract Details
      Document preview
      File information
      Submission date
      Contract type
    User Information
      Full name
      Email
      KYC status
      Account history
    Verification
      Signature check
      Identity match
      Details accuracy
      Completeness
    Actions
      Approve
      Reject
      Request revision
      Download
      Flag for review
    History
      Previous contracts
      Rejection history
      Approval history
      Notes
```

## Contract Rejection Reasons

Common rejection reasons:

1. **Missing Information**
   - Incomplete fields
   - Missing signature
   - No date
   - Missing address

2. **Incorrect Details**
   - Name mismatch
   - Wrong account number
   - Incorrect dates
   - Wrong program details

3. **Invalid Signature**
   - No signature
   - Illegible signature
   - Digital signature invalid
   - Signature doesn't match

4. **Wrong Template**
   - Old version used
   - Wrong program template
   - Custom template not accepted
   - Missing required clauses

5. **Quality Issues**
   - Poor scan quality
   - Unreadable text
   - Corrupted file
   - Wrong file format

6. **Fraud Concerns**
   - Forged signature
   - Fake document
   - Identity theft suspected
   - Suspicious activity

## Contract Approval Notifications

```mermaid
sequenceDiagram
    participant Admin
    participant Backend
    participant EmailService
    participant SocketIO
    participant User

    Admin->>Backend: Approve Contract
    Backend->>Backend: Update Status: approved
    Backend->>Backend: Store Approval Data

    Backend->>EmailService: Send Approval Email
    EmailService->>User: Email: Contract Approved

    Backend->>SocketIO: Emit contract:approved
    SocketIO->>User: Real-time Notification

    Backend->>Backend: Unblock Withdrawals
    Backend->>User: In-App Notification

    Note over User: User can now<br/>request withdrawals
```

## Contract Verification Code

Some contracts include verification codes for authenticity:

```mermaid
flowchart LR
    Generate[Generate Contract] --> CreateCode[Create Verification Code]
    CreateCode --> EmbedCode[Embed in Contract PDF]
    EmbedCode --> StoreCode[Store in Database]
    StoreCode --> UserReceives[User Receives Contract]

    UserReceives --> ThirdParty[Third Party Verification]
    ThirdParty --> EnterCode[Enter Verification Code]
    EnterCode --> Verify[Verify Against Database]
    Verify --> Result{Valid?}

    Result -->|Yes| ShowDetails[Show Contract Details:<br/>- User name<br/>- Program<br/>- Date<br/>- Status]
    Result -->|No| Invalid[Invalid Code]

    style ShowDetails fill:#ccffcc
    style Invalid fill:#ffcccc
```

## Auto-Approve Feature

When enabled, contracts are automatically approved if:

1. **System-Generated Contract**
   - Using standard template
   - Auto-filled details
   - Adobe Sign used

2. **User Verified**
   - KYC completed
   - Identity verified
   - No fraud flags

3. **Account Good Standing**
   - No breaches
   - No violations
   - Clean history

4. **Signature Valid**
   - E-signature captured
   - Adobe Sign confirmed
   - Timestamp recorded

## Contract Update Process

If user needs to update contract:

```mermaid
flowchart TD
    Start[Need Contract Update] --> Reason{Update<br/>Reason?}

    Reason -->|Personal Info Changed| UpdateInfo[Update Personal Information]
    Reason -->|Address Changed| UpdateAddress[Update Address]
    Reason -->|Error in Contract| CorrectError[Correct Error]

    UpdateInfo --> UploadNew[Upload New Contract]
    UpdateAddress --> UploadNew
    CorrectError --> UploadNew

    UploadNew --> OldContract{Old Contract<br/>Status?}

    OldContract -->|Approved| MarkSuperseded[Mark Old as Superseded]
    OldContract -->|Pending| CancelOld[Cancel Old Request]
    OldContract -->|Rejected| ReplaceOld[Replace Rejected]

    MarkSuperseded --> NewReview[New Contract Review]
    CancelOld --> NewReview
    ReplaceOld --> NewReview

    NewReview --> AdminApproves{Admin<br/>Approves?}

    AdminApproves -->|Yes| NewApproved[New Contract Approved]
    AdminApproves -->|No| NewRejected[New Contract Rejected]

    NewApproved --> UpdateActive[Update Active Contract]
    NewRejected --> KeepOld[Keep Old Contract Active]

    style NewApproved fill:#ccffcc
    style NewRejected fill:#ffcccc
```

---

**API Endpoints**:
- `GET /api/contracts/eligibility` - Check if contract required
- `POST /api/contracts` - Submit contract
- `GET /api/contracts/my-contracts` - Get user's contracts
- `GET /api/contracts/:id` - Get contract details
- `GET /api/contracts/:id/download` - Download contract PDF
- `POST /api/contracts/:id/resubmit` - Resubmit rejected contract
- `GET /api/admin/contracts` - List all contracts (admin)
- `POST /api/admin/contracts/:id/approve` - Approve contract (admin)
- `POST /api/admin/contracts/:id/reject` - Reject contract (admin)
- `GET /api/contracts/verify/:code` - Verify contract code
- `POST /api/contracts/adobe-sign` - Create Adobe Sign agreement
- `POST /api/contracts/adobe-webhook` - Adobe Sign webhook

**Socket.io Events**:
- `contract:submitted` - Contract submitted
- `contract:approved` - Contract approved
- `contract:rejected` - Contract rejected
- `withdrawals:unblocked` - Withdrawals enabled

**Files**:
- `pft-backend/src/app/modules/Contracts/contract.routes.ts`
- `pft-backend/src/app/modules/Contracts/contract.service.ts`
- `pft-backend/src/app/modules/Contracts/services/adobe-sign.service.ts`
- `pft-dashboard/src/app/(dashboard)/_components/modules/users/contracts`
