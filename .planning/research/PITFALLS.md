# Pitfalls Research

**Domain:** Adding failed/expired-purchase tracking events to the existing `pft-backend` Tracking/dispatch framework (v1.4, following v1.3's `signup_completed`/`purchase_completed`/`pap_payment_completed` build)
**Researched:** 2026-07-03
**Confidence:** HIGH — grounded in direct reads of the actual v1.3 code (`Tracking/tracking.events.service.ts`, `Tracking/tracking.service.ts`, `Tracking/tracking.constants.ts`, `Tracking/tracking.interface.ts`, `Tracking/dedup/dedup.service.ts`, `Tracking/enrichment/hash.ts`, `Tracking/destinations/klaviyo.ts`, `Payment/utils/trackingPurchaseEmit.ts`, `Payment/payment.model.ts`, `Payment/payment.interface.ts`, `Payment/services/cron.service.ts`, `Payment/services/{fanbasis-webhook,stripe-webhook,callback}.service.ts`, `Payment/payment.service.modular.ts`) in this repo, not generic advice.

## Key Ground-Truth Findings (read directly from code, not inferred)

These facts change the shape of the work significantly from a "build it from scratch" assumption — the scaffolding for `purchase_failed` **already exists but is dead code**:

1. `purchase_failed` is already a fully-defined `EventName` (`tracking.interface.ts:20`), has default per-destination toggles (`tracking.constants.ts:42`), and has a Klaviyo metric mapping `"Purchase Failed"` (`tracking.constants.ts:122`) plus a GA4/FB event mapping. `TrackingEvents.purchaseFailed(...)` is a fully-typed helper in `tracking.events.service.ts:96-105` with `{userId, email, invoiceId, value, currency, errorCode}`.
2. **`TrackingEvents.purchaseFailed` is never called anywhere in the codebase** (confirmed via repo-wide grep — the only match is its own definition). v1.3 built the scaffold, presumably anticipating this v1.4 work, but never wired a single call site.
3. There is **no `purchase_expired` event name** at all. Only `purchase_failed` exists in the `EVENT_NAMES` enum. Any "expired" tracking must either (a) reuse `purchase_failed` with a `reason: "expired"` distinguishing value, or (b) add a brand-new event name across three files that must all be updated together (`tracking.interface.ts` EVENT_NAMES, `tracking.constants.ts` DEFAULT_EVENT_TOGGLES, `tracking.constants.ts` EVENT_MAPPING) — missing any one silently breaks the pipeline in a specific, characteristic way (see Pitfall 5).
4. `ITrackingEventPayload` already has both a `reason?: string` field (line 269) AND an `errorCode?: string` field (line 270) — but the Klaviyo adapter's `buildProperties()` (`destinations/klaviyo.ts:20-38`) does **not** map either of them into the outgoing `properties` object. Both fields exist on the payload type and flow all the way to the dispatcher, but silently die at the Klaviyo adapter boundary today.
5. `dispatch()`'s dedup key (`tracking.service.ts:169-178`) falls back to `deterministicEventId(user, eventName, Date.now())`, which is **minute-bucketed** (`enrichment/hash.ts:85-95`: `Math.floor(timestampMs / 60000)`) whenever the caller does not pass an explicit `eventId`. `purchase_completed` and `pap_payment_completed` both explicitly pass `eventId: "purchase:<paymentId>"` / an equivalent stable key for exactly this reason (documented in code comments at `trackingPurchaseEmit.ts:52-54` and `callback.service.ts:864`). **Any new failed/expired call site that omits an explicit `eventId` will NOT be retry-safe** — it degrades to per-minute dedup only.
6. The `Payment` model has exactly this status enum (`payment.interface.ts:109`): `"pending" | "completed" | "failed" | "cancelled" | "expired" | "partially_paid" | "processing" | "capturing"`. There is already an `errorMessage?: string` field on `IPayment` (`payment.interface.ts:187`, `payment.model.ts:239`) that gateway webhook handlers can populate — this is the natural source for the `reason`/`errorCode` tracking fields, if it's actually populated on the failure paths (not verified beyond confirming the field exists).
7. **The expiry cron (`Payment/services/cron.service.ts`, `CronService.checkAndExpirePendingPayments`) is transition-safe by construction** — it does a single `updateMany({status: "pending", createdAt: {$lt: oneHourAgo}}, {$set: {status: "expired"}})` per run, driven by a time-bounded query on the OLD status (`"pending"`), not a re-scan of already-`"expired"` docs. A doc that already has `status: "expired"` will never match this query again on a later tick. This means the classic "cron double-fire" risk is **not a risk for this specific cron as currently written** — but it becomes a risk the moment anyone "helpfully" adds a second query like `find({status: "expired", trackingEventSent: {$ne: true}})` as a retrofit, or if the event-fire is added as a *separate* pass that re-queries by current status instead of being fired inline in the same `updateMany`-driven loop. This is exactly the kind of retrofit likely to be proposed for "add tracking to the cron" and must be resisted.
8. **Two other places in `payment.service.modular.ts` set `status: "expired"` outside the cron**, and both are concurrency/dedup mechanisms, NOT payment failures:
   - Line 1451: when a sibling PAP funded-leg payment is found already provisioned (double-click guard), the *current* (second, redundant) payment doc is flipped to `"expired"` and the request returns the *original* doc's success. The user's purchase succeeded — this doc is being marked expired purely to get it out of the way.
   - Line 2704 (free $0 PAP path): stale `pending`/`processing` FREE PAP attempts (`amount: 0` only) are superseded to `"expired"` to let a fresh retry proceed, again not a real failed purchase.

   **If a naive implementation fires a tracking event on every `status → "expired"` transition wherever it's set (e.g., via a Mongoose `pre("save")`/`post("updateOne")` hook watching for `status === "expired"`), these two non-failure paths will generate false "purchase failed" Klaviyo events for purchases that actually succeeded.** This is the single most repo-specific, highest-value finding of this research — a generic "hook on status change to expired" implementation will misfire here in a way that isn't visible from a spec/ticket description alone. This is also the concrete mechanism behind the ticket's own reported symptom (a client having BOTH a completed AND an expired payment for what was probably the same underlying purchase attempt) — that pattern is exactly what the sibling-supersede guard at line 1451 produces by design, and it is a correct, intentional artifact of the concurrency guard, not a bug to "fix" by collapsing the two Payment docs. The bug risk is solely in whether a new tracking hook incorrectly treats that artifact as a real customer-facing failure.
9. The Klaviyo adapter (`destinations/klaviyo.ts:61-64`) hard-skips (status `"skipped"`, not an error) any event with no `payload.email`. Failed/expired Payment docs from very early-abandoned checkouts (e.g., a `Pending` payment created before the user ever reaches a step where email is captured/available in scope) may legitimately have no email at the point of expiry — this is a silent-skip, not a crash, so it's easy to ship and not notice the event never reaches Klaviyo for a subset of cases.
10. The v1.3 JPY bug fix pattern is `value: payment.usdAmount` + `currency: "USD"` always, sourced from `payment.usdAmount` (never `payment.amount`/`payAfterPassRemainingPrice` directly) — confirmed in both `trackingPurchaseEmit.ts:91-92` and `callback.service.ts`'s PAP block. `payment.model.ts`'s `pre("validate")` hook (lines 317-324) backfills `usdAmount` with a **non-currency-converted** fallback (`this.amount ?? this.totalPrice ?? 0`) whenever `usdAmount` is missing at save time — explicitly commented as a best-effort "treat amount as already-USD" safety net for legacy docs. A `Pending` payment that expires without ever having gone through a gateway's explicit FX-conversion step (which, per `upigateway.service.ts`, some but likely not all gateways perform) is exactly the kind of doc most likely to hit this raw fallback. This reintroduces the JPY-as-USD bug class specifically for failed/expired payments, which (per Pitfall 3 below) are structurally MORE likely to hit it than completed payments were.

## Critical Pitfalls

### Pitfall 1: Omitting an explicit `eventId` on the new failed/expired call — breaks retry-safety silently

**What goes wrong:**
The dispatcher's dedup fallback (`deterministicEventId`) buckets by minute. If the new `TrackingEvents.purchaseFailed(...)` call site doesn't pass `eventId`, then a payment retried (Pending → Expired → new Pending on retry → Completed, or a webhook redelivery arriving 90+ seconds later) can generate the SAME dedup-relevant identity twice with a DIFFERENT `eventId` on each call, defeating dedup entirely — or, in the case of a cron re-invocation more than a minute apart for reasons unrelated to a real second failure, produce duplicate Klaviyo "Purchase Failed" events for what is really the same transition.

**Why it happens:**
`purchase_completed` and `pap_payment_completed` both explicitly set `eventId: "purchase:<paymentId>"` (or equivalent) specifically to defeat the minute-bucket fallback — this was a deliberate v1.3 design decision, documented in code comments, not the dispatcher's default behavior. It is easy to write a new call site by copy-pasting the `TrackingEvents.purchaseFailed({...})` call shape without also copying the `eventId` line, since the helper signature doesn't force it (it's optional).

**How to avoid:**
Set `eventId: \`purchase_failed:${String(payment._id)}\`` (mirroring the exact `"purchase:<paymentId>"` pattern used by `emitTrackingPurchaseCompleted`) on every failed/expired call site. Since a single Payment document has a single terminal-failure transition in its lifecycle (a doc doesn't flip from Expired back to Pending back to Expired again — retries create NEW Payment docs per the codebase's PAP-retry pattern seen at `payment.service.modular.ts:2696-2708`), keying purely on `paymentId` is sufficient — do not add a timestamp or attempt counter into the key.

**Warning signs:**
Query `TrackingEventLog` grouped by `(eventName: "purchase_failed", userId)` — any burst of >1 log row within a short window for the same user, each with a DIFFERENT `eventId` value, indicates the minute-bucket fallback fired instead of a stable key.

**Phase to address:**
Same phase/PR that adds the first failed/expired event-fire call — this is not a follow-up hardening task. It must be part of the review checklist for that PR (grep the diff for `TrackingEvents.purchaseFailed(` and confirm every call includes an explicit `eventId`).

---

### Pitfall 2: Wiring the event on ANY `status → "expired"` transition instead of only genuine payment-failure transitions — fires false "purchase failed" events for successful PAP purchases

**What goes wrong:**
`payment.service.modular.ts` sets `status: "expired"` in at least two places that are NOT payment failures:
- Line 1451 — a redundant/duplicate PAP funded-leg payment doc is marked expired as a double-click guard; the underlying purchase succeeded (the sibling doc is `status: "completed"`).
- Line ~2704 (free/$0 PAP path) — stale `pending`/`processing` FREE PAP attempts are superseded to `"expired"` purely to unblock a fresh retry; this is bookkeeping cleanup, not a customer-facing failure.

If the new tracking hook is implemented generically (e.g., a Mongoose middleware watching for any write where `status` becomes `"expired"`, or a shared helper called from every `Payment.updateOne(..., {$set: {status: "expired"}})` site without distinguishing WHY), it will fire a "purchase failed" Klaviyo event for these two paths even though the user's purchase actually succeeded. This directly corrupts marketing segment quality — a customer who successfully became funded via PAP could land in a "failed purchase — win them back" flow. This is the exact mechanism behind the ticket's reported symptom of a client having both a completed and an expired payment for the same attempt — that's a correct, intentional artifact of the concurrency guard, not evidence of a double-charge or a real failure.

**Why it happens:** The `Payment.status` field reuses the string `"expired"` for two semantically different things: (a) a genuine TTL timeout where the customer never completed payment, and (b) an internal "supersede this redundant/duplicate doc" marker used purely for concurrency control. This overload is not obvious from the schema/interface alone — it only becomes visible by reading the call sites, which is exactly what this research did.

**How to avoid:**
Do not hook tracking dispatch generically off "any doc that is now `status: expired`." Instead, fire the failed/expired tracking event explicitly and only from the specific code path that legitimately represents a real expiry/failure for the CUSTOMER — primarily `CronService.checkAndExpirePendingPayments` (the genuine TTL-timeout path) — and explicitly exclude the two supersede/dedup-guard call sites in `payment.service.modular.ts`. If a shared "fire failed event" utility is built (mirroring `emitTrackingPurchaseCompleted`), give it an explicit `reason` parameter and have call sites pass it deliberately, rather than inferring "why" from the resulting status string alone; consider a guard analogous to the existing PAP-skip guard (`payment.payAfterPass === true && payment.currentProgramId` in `trackingPurchaseEmit.ts:65`) that suppresses the failed event specifically when a sibling `status: "completed"` doc exists for the same user/program (mirroring the exact check already performed at line 1436-1446 before the doc is expired).

**Warning signs:**
Cross-reference `TrackingEventLog` rows with `eventName: "purchase_failed"` against the `Payment` collection: for each, check whether a sibling Payment doc for the same `userId` + `currentProgramId`/`programId` reached `status: "completed"` within a short window. Any non-trivial rate of "failed event fired, but user also has a completed purchase for the same program around the same time" indicates this pitfall is live.

**Phase to address:**
Must be designed in the same phase that decides WHERE to hook the failed/expired event (the phase that touches `cron.service.ts` and/or `payment.service.modular.ts`/`callback.service.ts`), not deferred — this is a trigger-condition design decision, not a bug that can be patched after the fact without re-auditing every call site again.

---

### Pitfall 3: Reading `payment.usdAmount` for the failed/expired payload without accounting for the un-converted fallback — reintroduces the JPY-as-USD bug, likely at a HIGHER rate than the original completed-purchase bug

**What goes wrong:**
`payment.model.ts`'s `pre("validate")` hook backfills `usdAmount = this.amount ?? this.totalPrice ?? 0` (no currency conversion) whenever `usdAmount` is missing at save time. This is explicitly a legacy-doc safety net, but it applies to ANY doc, old or new, that reaches save/validate without an explicit converted `usdAmount` already set. Completed payments reliably get a real converted `usdAmount` because a gateway webhook handler runs a full completion flow (which, per the v1.3 fix, explicitly computes/verifies it). A payment that dies at Pending → Expired via the TTL cron, however, may never have passed through that conversion step at all if the currency-conversion logic is tied to a later stage of the checkout/webhook flow rather than to checkout creation — meaning expired payments are structurally MORE likely to carry a raw, non-USD-converted `amount` value in `usdAmount` than completed ones ever were.

**Why it happens:** The `usdAmount` fallback was added as a generic defensive measure for an unrelated legacy-data problem ("Payment validation failed: usdAmount is required" per the code comment), not written with the failed/expired tracking use case in mind. It silently produces a plausible-looking number (not an error, not null) so there's nothing that surfaces the problem at the call site — it will look like a normal `value` field in the Klaviyo payload.

**How to avoid:**
- Do not read `payment.usdAmount` blindly for the failed/expired event. Before emitting, check whether the value looks like it went through real conversion (e.g., compare `payment.currency !== "USD" && payment.usdAmount === payment.amount` as a heuristic red flag — mirroring the exact heuristic already used for the JPY PAP bug per project memory: `payAfterPassRemainingPrice > 10000`).
- Prefer explicitly calling the same currency-conversion utility (`CurrencyService.convertToUsd`, referenced in `payment.service.modular.ts` around the `PAP_SANE_MAX_USD` guard) rather than trusting whatever is currently stored in `usdAmount` on a payment that never completed.
- Add a unit/integration test: create a Pending Payment doc with `currency: "JPY"`, `amount: 356296`, no explicit `usdAmount` set, let it expire via the cron, and assert the emitted tracking event's `value`/`currency` fields are NOT `356296`/`"USD"`.
- If a genuinely converted `usdAmount` cannot be produced for a given expired/failed doc (no FX rate available at that stage), prefer omitting the `value` field entirely (or flagging it) over sending a wrong number — a missing value is far less damaging to marketing data than a wrong one.

**Warning signs:**
Sweep `TrackingEventLog`/Klaviyo delivery data for `purchase_failed` events where `currency === "USD"` but `value` is implausibly large relative to the brand's typical challenge price (same detection heuristic as the existing JPY payout bug sweep, e.g. `value > 10000` in a USD-priced-challenge context).

**Phase to address:**
Same phase as building the failed/expired payload — treat "reuse the existing normalized-USD-amount pattern, do not add a new amount-extraction path" as an explicit code-review gate for that PR, exactly as was true for `purchase_completed`/`pap_payment_completed`.

---

### Pitfall 4: PAP funded-leg failure/timeout paths have no equivalent to `pap_payment_completed` today — a failed-event addition scoped only to the main flow will miss them entirely

**What goes wrong:**
`purchase_completed` (skipped for PAP) and `pap_payment_completed` (fired instead) are wired at 5 real call sites across `fanbasis-webhook.service.ts` (x2), `stripe-webhook.service.ts`, `callback.service.ts`, and the free/$0 path in `payment.service.modular.ts` — each PAP funded-leg completion path independently calls `TrackingEvents.papPaymentCompleted(...)`. There is **no `papPaymentFailed`/`pap_payment_failed` equivalent defined anywhere** — not in `EVENT_NAMES`, not in `tracking.events.service.ts`. If v1.4 adds failed/expired tracking only for the STANDARD purchase flow (the flow the ticket's own example came from) via the generic `purchase_failed` event, PAP funded-leg payment failures/expiries will remain completely untracked — a customer whose PAP final-payment attempt fails or expires will generate no Klaviyo signal at all, even though the analogous SUCCESS path (`pap_payment_completed`) is fully tracked. This is a direct parallel to why `purchase_completed` needed multiple separate wiring points in v1.3 — PAP funded-leg logic is genuinely scattered across gateway-specific webhook handlers rather than funneling through one shared function.

**Why it happens:** PAP's payment-completion logic already required per-gateway wiring because there's no single shared "PAP payment succeeded" function — each gateway webhook handler (fanbasis, stripe, generic callback) independently detects the PAP condition (`payment.payAfterPass && payment.currentProgramId`) and calls the PAP-specific event. The same fragmentation almost certainly applies to failure: each gateway's webhook handler likely has its OWN way of marking a PAP payment as failed/declined (or relies solely on the generic expiry cron), with no shared code path to hang a single tracking call off of.

**How to avoid:**
- Before implementation, explicitly grep for `payment.payAfterPass && payment.currentProgramId` (the PAP-detection guard used consistently at all known completion sites) inside each gateway webhook handler and trace whether that handler has an equivalent "payment declined/failed" branch alongside its completion branch — audit `fanbasis-webhook.service.ts`, `stripe-webhook.service.ts`, and `callback.service.ts` individually, not just the shared `cron.service.ts` TTL path (the cron only catches "never completed," not "gateway explicitly declined").
- Decide explicitly: does a failed/expired PAP funded-leg payment need its own `pap_payment_failed` event name (mirroring the completed/failed split that exists for the standard flow), or is `purchase_failed` + a `payAfterPass`/`programType` flag in `properties` sufficient? Given `pap_payment_completed` was kept deliberately distinct from `purchase_completed` (per the code comment: "This is the signal Klaviyo uses to EXIT the PAP recovery flow"), symmetry strongly suggests PAP failures should also be distinguishable from standard failures, likely via a new `pap_payment_failed` event name added consistently across all 3 tracking files (see Pitfall 5) rather than overloading `purchase_failed`.
- Cross-reference against the existing PAP funded queue gate finding (project memory: PAP funded-leg "Program Not Assigned" is usually a KYC/contract-gate hold, NOT a failed payment) — a PAP funded-leg payment that succeeded but is stuck behind KYC/contract approval must NOT be misclassified as a failed/expired payment by whatever new detection logic is added; the trigger condition must be the `Payment.status` field transitioning to `failed`/`expired`, never a downstream `fundedprogressionqueue` hold state.

**Warning signs:**
Query `Payment` documents where `payAfterPass === true` and `status` is `failed` or `expired` over a recent window; if this count is non-trivial while `TrackingEventLog` has zero `pap_payment_failed`/`purchase_failed` rows referencing PAP payments, the PAP failure path is confirmed untracked.

**Phase to address:**
Give this its own explicit checklist/sub-phase item — "audit PAP funded-leg gateway handlers for a failure-tracking equivalent to pap_payment_completed" — rather than folding it silently into "add purchase_failed to the main flow." This mirrors how v1.3's PAP purchaseCompleted wiring needed deliberate site-by-site verification, not a single generic implementation task.

---

### Pitfall 5: Adding a new event name (e.g., `purchase_expired` or `pap_payment_failed`) requires touching 3 separate files in lockstep — missing one produces a specific, easy-to-miss silent failure mode

**What goes wrong:**
A new `EventName` must be added to ALL of: (1) `EVENT_NAMES` array in `tracking.interface.ts`, (2) `DEFAULT_EVENT_TOGGLES` in `tracking.constants.ts`, (3) `EVENT_MAPPING` in `tracking.constants.ts`. Each has a different failure mode if skipped:
- Skip (1): TypeScript compile error (`EventName` union missing the value) — loud, caught immediately. Low risk.
- Skip (2) or (3): both `DEFAULT_EVENT_TOGGLES` and `EVENT_MAPPING` are typed as `Record<EventName, ...>`, so TypeScript's exhaustiveness check SHOULD catch a missing key at compile time too — the real risk in practice is not a missing key but a **copy-pasted row with a wrong value**, e.g. duplicating `purchase_completed`'s row for the new event and forgetting to change `klaviyo: "Placed Order"` to a distinct metric name. This compiles cleanly and produces no runtime error — it just silently sends the new event under an existing metric name, corrupting that metric's counts in Klaviyo.
- At runtime, if `EVENT_MAPPING[payload.eventName]?.klaviyo` were ever undefined (e.g., a values-only object literal missing the `as const` exhaustiveness protection in a refactor), `klaviyoAdapter.send()` returns `{status: "skipped", error: "no klaviyo metric for ..."}` — a normal, no-throw skip with no alarm bell, not an exception.

**Why it happens:** There's no single source-of-truth registry beyond the `Record<EventName, ...>` typing convention — TypeScript catches missing KEYS but cannot catch a syntactically-valid but semantically-wrong VALUE (e.g., a copy-paste artifact).

**How to avoid:** If reusing `purchase_failed` (already fully wired, just never called) rather than adding a new event name, this entire pitfall is avoided — this is the strongest argument for reusing the existing scaffold with a `reason: "expired"` vs `reason: "declined"` distinguishing field rather than inventing `purchase_expired` as a new event name. If a genuinely new event name is still needed (e.g. for PAP, per Pitfall 4), rely on the TypeScript `Record<EventName, ...>` exhaustiveness check for missing keys, but ALSO manually diff the new row against `purchase_completed`'s/`pap_payment_completed`'s row in code review to confirm the Klaviyo metric name (and GA4/FB event name) are genuinely distinct, not copy-paste leftovers.

**Warning signs:** `tsc`/build failure listing missing keys (if using a new event name) is the fast, loud signal for a missing key — trust it. The silent failure mode is specifically the "value copy-pasted from an existing row" case, which only shows up as `EVENT_MAPPING["your_new_event"].klaviyo === "Placed Order"` (or similar) in a code review diff, or as duplicate-looking metric names inside the Klaviyo dashboard after the fact.

**Phase to address:** Scope decision (reuse `purchase_failed` vs. new event name) belongs in the same phase as the payload/trigger design (Pitfall 2/4), since it affects which files get touched at all.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Fire `purchase_failed` from a generic Mongoose `post("save")`/`post("updateOne")` hook watching `status → expired/failed` on the Payment model | Fast to implement, one hook covers every call site | Fires for the two non-failure "supersede/dedup-guard" expiry paths identified above (Pitfall 2); very hard to selectively suppress from inside a generic hook without re-adding the exact PAP-sibling-check logic that already exists at the call sites | Never — always fire explicitly from the specific business-logic path that represents a genuine customer-facing failure, exactly as `emitTrackingPurchaseCompleted` is called explicitly from each completion site rather than via a generic hook |
| Reuse `payment.usdAmount` as-is for the failed-event `value` field without re-verifying it went through real FX conversion | No new code needed, matches the completed-event pattern superficially | Reintroduces JPY-as-USD for the subset of expired/failed payments that never reached the conversion step (Pitfall 3) | Only acceptable if `usdAmount` is independently confirmed to be populated via explicit conversion (not the model's raw fallback) for every payment status, including `pending`/`expired` — needs verification, not assumption |
| Add `purchase_expired` as a brand-new event name instead of reusing `purchase_failed` + a `reason` field | Cleaner semantic separation in Klaviyo's event list | Triples the file-sync surface area (Pitfall 5) for marginal value, since `purchase_failed` already has full scaffolding including a Klaviyo mapping that's never been used | Only if there's a strong product reason two genuinely distinct Klaviyo metrics are needed for flow-branching purposes that a `reason` property filter can't achieve (Klaviyo flow triggers CAN filter on event properties, so this is rarely necessary) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Klaviyo Events API (`destinations/klaviyo.ts`) | Assuming `reason`/`errorCode` on the payload automatically reach Klaviyo because they're typed fields on `ITrackingEventPayload` | They do NOT — `buildProperties()` only maps a fixed allowlist of fields (program_id, account_size, challenge_type, etc.) into Klaviyo `properties`; `reason` and `errorCode` must be explicitly added to that allowlist in `buildProperties()` or they silently never appear in the Klaviyo event, even though the field exists on the payload type |
| Klaviyo Events API — email requirement | Assuming every failed/expired Payment doc has `payment.billingInfo.email` populated by the time it expires | Klaviyo adapter skips (silently, `status: "skipped"`) any event with no email; very-early-abandoned Pending payments (created before email capture) will never reach Klaviyo for this event — this may be an acceptable gap but should be a deliberate decision, not a surprise found in production |
| Dispatcher dedup (`tracking.service.ts` / `dedup.service.ts`) | Assuming the dedup log automatically prevents duplicate failed-event dispatch across retries without an explicit `eventId` | Dedup is keyed on `eventId`; without an explicit stable key, the minute-bucket fallback only protects against duplicates within the same 60-second window, not across a longer retry gap or cron re-run |
| PAP funded-leg gateways (fanbasis/stripe/generic callback) | Assuming one shared "PAP failed" hook exists to parallel the one shared PAP-skip guard used for completions | No such shared failure path currently exists — `payAfterPass && currentProgramId` detection for FAILURE (not completion) must be independently verified/added per gateway handler |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-scanning all `status: "expired"` docs on every cron tick to find "ones that still need a tracking event" (rather than firing inline in the same `updateMany` pass that performs the transition) | Growing DB read load on `payments` collection over time; delivery-log write volume disproportionate to actual new expiries per tick | Fire the tracking event only for the doc IDs that were JUST transitioned in that tick's pass (the current `checkAndExpirePendingPayments` already isolates `stalePayments` as exactly this set before the `updateMany` calls — hang the event-fire off that existing array, do not add a second separate query keyed on current status) | Becomes noticeable once the `payments` collection accumulates a large volume of historically-expired docs (abandoned-checkout volume is typically higher than completed-purchase volume across most funnels) |
| Delivery-log (`TrackingEventLog`) volume growth | Failed/expired-event volume is likely higher than completed-event volume (declines/abandonment usually outnumber conversions) | No action needed immediately — the collection already has a unique-index-backed dedup design; just confirm indexing/retention is still adequate once this new higher-volume event type ships | Worth a quick capacity check before shipping, not a blocker |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Putting raw gateway decline messages (e.g., a Stripe `decline_code` or full error string, sourced from the existing `payment.errorMessage` field) directly into `errorCode`/`reason` without normalizing | Gateway error strings can occasionally embed sensitive/PII-adjacent details (partial card numbers in some legacy error formats, internal system paths) and get forwarded to a third-party (Klaviyo) | Normalize to a small closed vocabulary (`card_declined`, `gateway_timeout`, `expired_no_completion`, `fraud_hold`, etc.) rather than passing the gateway's raw message string through to `reason`/`errorCode` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Firing a marketing "you didn't complete your purchase" flow off a PAP-supersede/dedup-guard false-positive (Pitfall 2) | A customer who successfully became funded receives a "did your payment fail?" email — confusing and trust-eroding | Explicitly exclude the two non-failure `status: "expired"` call sites identified in `payment.service.modular.ts` (lines ~1451 and ~2704) from triggering the marketing event |
| Sending a bare "purchase_failed" event with no `reason` populated | Marketer cannot differentiate "card declined, suggest retry" from "abandoned checkout, send reminder" from "fraud hold, do not re-engage" — reduces the event to noise | Populate `reason` from `payment.errorMessage` (already exists on the model) when present, normalized to a small enum; use a distinct value like `"expired_no_completion"` for pure TTL cron-driven expiry with no underlying gateway error |

## "Looks Done But Isn't" Checklist

- [ ] **`TrackingEvents.purchaseFailed(...)` is called from at least one real site:** Verify with a repo-wide grep post-implementation — as of this research it exists but is called from nowhere.
- [ ] **Every new call site passes an explicit `eventId`:** Grep the diff for `TrackingEvents.purchaseFailed(` / any new PAP-failure helper and confirm each includes `eventId: \`purchase_failed:${paymentId}\`` (or equivalent) — do not rely on the minute-bucket fallback.
- [ ] **`reason`/`errorCode` actually reach Klaviyo:** Confirm `destinations/klaviyo.ts`'s `buildProperties()` has been updated to `set("reason", payload.reason)` / `set("error_code", payload.errorCode)` — the fields existing on `ITrackingEventPayload` does NOT mean they're mapped through.
- [ ] **The two non-failure `status: "expired"` call sites are excluded:** Confirm the PAP sibling-supersede path (`payment.service.modular.ts` ~line 1451) and the free-PAP stale-attempt supersede path (~line 2704) do NOT trigger the new failed/expired tracking event.
- [ ] **PAP funded-leg failure paths are separately audited:** Confirm each of `fanbasis-webhook.service.ts`, `stripe-webhook.service.ts`, `callback.service.ts` has been checked for its own PAP-failure branch, not just the main-flow cron.
- [ ] **JPY/non-USD amount test case exists:** A unit test asserting an expired JPY-currency Payment doc (with no explicit converted `usdAmount`) does not emit a raw-yen-as-USD value.
- [ ] **Klaviyo event-name choice is deliberate:** Confirm whether the team decided to reuse `purchase_failed` (already fully scaffolded) vs. add new event name(s) — and if new names were added, confirm all 3 files (`EVENT_NAMES`, `DEFAULT_EVENT_TOGGLES`, `EVENT_MAPPING`) were updated with genuinely distinct values (not copy-paste artifacts from `purchase_completed`).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Non-idempotent eventId caused duplicate Klaviyo events already sent | MEDIUM | Klaviyo events cannot be bulk-deleted/de-duplicated after ingestion easily; best recovery is fixing the eventId going forward and, if the duplicate volume materially affects a specific flow's trigger counts, manually excluding/suppressing the affected date range in that flow's segment logic rather than attempting historical cleanup |
| False "purchase_failed" fired for the two non-failure expired-status paths, already delivered | LOW–MEDIUM | Identify affected Payment IDs via the sibling-completed-doc cross-reference query (see Pitfall 2 warning signs), then either suppress those specific customers from any automated win-back flow manually in Klaviyo, or (if volume is small) accept as noise while fixing the trigger condition going forward |
| JPY-as-USD value already sent for failed/expired events | LOW | Same remediation pattern as the original v1.3 JPY bug: identify affected `TrackingEventLog`/Klaviyo events via the `value > 10000`-style heuristic sweep, and since these are informational marketing events (not billing records), no financial correction is needed — just fix the code path and treat historical bad values as accepted noise unless a specific flow's aggregate stats need manual adjustment |
| PAP funded-leg failure coverage gap discovered late | LOW (tracking-only, not a payment-processing bug) | Add the missing call site(s); no historical backfill is realistically possible for tracking events (unlike payment data) — document the gap's start/end date if a marketing stakeholder needs to know why historical PAP-failure segments are incomplete |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Non-idempotent eventId (Pitfall 1) | Same phase as the first failed/expired event-fire implementation | Unit test: firing detection logic twice on the same Payment doc produces the identical `eventId` both times; grep diff for missing `eventId` on any new call |
| Generic expired-status hook misfiring on non-failure paths (Pitfall 2) | Same phase that decides the trigger location (cron vs. inline hook) | Cross-reference query: no `purchase_failed`/`pap_payment_failed` log rows where a sibling `status: "completed"` doc exists for the same user+program |
| JPY/currency-unit leak via unconverted `usdAmount` fallback (Pitfall 3) | Same phase as payload-field design, before first call site ships | Unit test with JPY Pending→Expired doc lacking pre-set `usdAmount`; production sweep heuristic (`value > 10000` while `currency === "USD"`) |
| PAP funded-leg failure paths uncovered (Pitfall 4) | Dedicated audit sub-phase, explicitly separate from "wire the main flow" | Query: `Payment` docs with `payAfterPass: true` and `status` in `[failed, expired]` vs. corresponding `TrackingEventLog` rows — gap size should trend to zero |
| Multi-file event-name registration drift (Pitfall 5) | Scope-decision phase (reuse `purchase_failed` vs. new event name), before implementation phase | TypeScript compile (`Record<EventName,...>` exhaustiveness) + manual diff review confirming no copy-paste of `purchase_completed`'s Klaviyo metric name |
| Missing `reason`/`errorCode` mapping in Klaviyo adapter | Same phase as payload design | Manually verify a test-fired event's Klaviyo payload actually contains a `reason`/`error_code` property, not just confirm the field is set on `ITrackingEventPayload` |

## Sources

- Direct code reads (this session, `pft-backend` on branch `main-2026`): `src/app/modules/Tracking/tracking.events.service.ts`, `src/app/modules/Tracking/tracking.service.ts`, `src/app/modules/Tracking/tracking.constants.ts`, `src/app/modules/Tracking/tracking.interface.ts`, `src/app/modules/Tracking/dedup/dedup.service.ts`, `src/app/modules/Tracking/enrichment/hash.ts`, `src/app/modules/Tracking/destinations/klaviyo.ts`, `src/app/modules/Payment/utils/trackingPurchaseEmit.ts`, `src/app/modules/Payment/payment.model.ts`, `src/app/modules/Payment/payment.interface.ts`, `src/app/modules/Payment/services/cron.service.ts`, `src/app/modules/Payment/services/fanbasis-webhook.service.ts`, `src/app/modules/Payment/services/stripe-webhook.service.ts`, `src/app/modules/Payment/services/callback.service.ts`, `src/app/modules/Payment/payment.service.modular.ts`. All findings above are traceable to specific line ranges cited inline.
- Milestone context supplied by the orchestrating task (v1.3 build history: `isFirstPurchase` FTD non-suppression decision, JPY-as-USD payout bug, PAP funded-leg call sites) — corroborated and made more precise by the direct code reads (actual completed-purchase call-site count is 5 across fanbasis x2/stripe/callback/free-path, sharing one `emitTrackingPurchaseCompleted` util, plus separate inline `papPaymentCompleted` calls at the PAP-specific branch in each of those same files).
- Project memory (`MEMORY.md`): PAP double XP bug, PAP funded KYC bypass, PAP JPY charged as USD, PAP funded queue gate gotcha — used to establish PAP funded-leg code paths' demonstrated history of edge-case bugs in this codebase, and specifically to flag the KYC/contract-gate-hold-vs-failed-payment confusion risk in Pitfall 4.

---
*Pitfalls research for: pft-backend Klaviyo/tracking dispatch framework — failed/expired purchase event addition (v1.4)*
*Researched: 2026-07-03*
