# Phase 12 Research: partnerPostback Adapter + Config + Verify (CRM-07/09)

**Derived from** `.planning/research/ARCHITECTURE.md`/`STACK.md` + fresh code investigation 2026-07-01 (live pft-backend, HEAD 982ba9a1 = origin/main-2026). All anchors verified.

## Phase scope (final v1.3 phase)

Build the outbound S2S GET postback so the events Phase 11 now fires actually reach the partner. Add a `partnerPostback` destination adapter + per-brand config. Gate the CONVERSION send on the FTD flag (once-per-user). NOTHING else — Phase 10 (capture) + Phase 11 (emit) are done.

## The framework is already built — this is a small, well-shaped addition

The Tracking dispatcher (`tracking.service.ts:150 dispatch()`) already:
- `shouldDispatch(event, destination, settings)` (`:62`) gates on the EVENT_DESTINATION matrix AND the per-destination `enabled` toggle (`:72` `if (!d || !d.enabled) return false`).
- Dedup: `isDuplicate(payload.eventId, destination)` (`:203`) — per-(eventId,destination). Phase 11's stable eventIds (`signup:<userId>`/`purchase:<paymentId>`/`pap:<paymentId>`) make this retry-safe. **CRM-08 dedup is INHERITED — nothing to add.**
- Delivery log: `reserveLogRow(...)` (`:207`) writes the log row per destination. **CRM-07's "delivery-log record" is INHERITED — the adapter just returns a result.**
- Adapter call: `adapter.send(payload, { req, settings })` (`:220`).

So Phase 12 = (a) a config type + toggle, (b) one `IDestinationAdapter`, (c) register it, (d) one matrix column. The dedup/log/gating are free.

## Exact anchors

### CRM-09 — config
- `DESTINATIONS` tuple (`tracking.interface.ts:51-60`) — add `"partnerPostback"`. `DestinationName` derives from it automatically (`:61`).
- New `IPartnerPostbackConfig extends IDestinationToggle` (mirror `IConversionWebhookConfig` at `:116` `{ webhookUrl; webhookSecret }`) → `{ registrationUrl: string; conversionUrl: string }` (+ inherited `enabled`). `IDestinationToggle` (`:~108`) provides `enabled: boolean`.
- Add `partnerPostback: IPartnerPostbackConfig` to `ITrackingSettings.destinations` (`:145-150`, next to `conversionWebhook`).
- Defaults: DISABLED + empty URLs, wherever tracking settings defaults/model are seeded (grep the settings model + any `DEFAULT_TRACKING_SETTINGS`). So no brand fires unless explicitly configured (CRM-09: "no other brand fires postbacks unless configured"). Confirm the per-brand settings loader surfaces the new field (mirror conversionWebhook — likely strict schema, so add the field to the settings mongoose model + validation too).
- **Do NOT hardcode Trading Cult URLs.** The partner's exact URL template (with `{clickid}`/`{payout}` placeholders) is set at config time via the existing `PUT /api/tracking/settings` (per-brand DB). It is an EXTERNAL dependency (partner spec) → the Trading Cult URL values are a post-deploy config step, not code. A seed script is optional/placeholder.

### CRM-07 — the adapter (`destinations/partner-postback.ts`, new)
Mirror the shape of `conversion-webhook.ts` / `meta-capi.ts` (both implement `IDestinationAdapter`; `send` returns `{destination, status: "sent"|"failed"|"skipped"|"deduplicated", error?, responseMeta?}` and MUST NOT throw). Logic:
1. `const cfg = ctx.settings.destinations.partnerPostback`. If `!cfg?.enabled` → `{status:"skipped"}`. (Redundant with shouldDispatch but defensive, matches conversion-webhook.ts.)
2. If `!payload.partnerClickId` → `{status:"skipped"}` (no clickid = nothing to attribute).
3. Select goal + template by event:
   - `signup_completed` → `goal=registration`, template = `cfg.registrationUrl`, no payout.
   - `purchase_completed` / `pap_payment_completed` → `goal=conversion`, template = `cfg.conversionUrl`, payout = `payload.value` (Phase 11 sets this to `usdAmount`), currency `USD`. **FTD GATE: if `payload.isFirstPurchase !== true` → `{status:"skipped"}`** (only the first purchase fires the conversion postback — the once-per-user guarantee lives HERE).
4. If the chosen template is empty → `{status:"skipped"}`.
5. Macro substitution: replace `{clickid}` → `encodeURIComponent(payload.partnerClickId)` (Phase 10/11 kept it raw byte-identical; encode ONCE here per the locked contract), `{goal}` → goal, `{payout}` → payout (conversion) or "" (registration), `{currency}` → "USD". Only substitute placeholders present in the template (the partner's `?clickid={clickid}&goal=conversion&payout={payout}` matches these names).
6. GET via native `fetch(url, { method:"GET", signal: AbortSignal.timeout(15000) })` — no new deps (STACK.md). Bounded retry/backoff on partner 5xx (small, e.g. 1 retry). Treat network error/timeout as `{status:"failed", error}` (dispatcher logs it; never throw).
7. Return `{destination:"partnerPostback", status:"sent", responseMeta:{httpStatus}}` on 2xx/3xx.

### CRM-07 — register + route
- `destinations/index.ts` `registerAllAdapters()` → add `registerAdapter(partnerPostbackAdapter)`.
- `tracking.constants.ts` EVENT_DESTINATION matrix — add a `partnerPostback` column to the `DestinationToggleRow` type (`:19` area) AND to every event row. Set `partnerPostback: true` ONLY for: `signup_completed` (:29), `purchase_completed` (:40), `pap_payment_completed` (:59). All other rows `partnerPostback: false`.
  - NOTE: free-trial/$0 stays registration-only automatically — free users still fire `signup_completed` (→ registration postback), and free funnels fire `free_*_signup` / never `purchase_completed` with real value, so no $0 conversion postback. Matches the locked "$0 = registration only" decision. Do NOT set partnerPostback:true on `free_trial_signup`/`free_challenge_signup`/`pap_free_signup`.

### CRM-07 verify (Phase 12 SC)
- Adapter returns "skipped" when partnerClickId absent OR url empty OR (conversion && !isFirstPurchase).
- signup_completed w/ clickid → GET to registrationUrl, {clickid} URL-encoded, goal=registration, log row written.
- purchase_completed w/ clickid + isFirstPurchase → GET to conversionUrl, {clickid} encoded, goal=conversion, payout=usdAmount, currency=USD, log row.
- clickid with URL-special chars (`+`,`=`,`/`) → `encodeURIComponent` → partner receives exact original value.
- Post-deploy live checkpoint (Trading Cult real config + real partner endpoint) = DEFERRED (matches every prior phase).

## Do NOT
- Do NOT reuse/modify `conversion-webhook.ts` (POST/JSON/HMAC — wrong protocol). New adapter only.
- Do NOT hardcode partner URLs (config-driven).
- Do NOT change Phase 10/11 code. Do NOT touch other adapters/events.
- No new npm deps. No brandId. main-2026.

## Open items to resolve in planning (grep/read to resolve)
1. Where tracking-settings DEFAULTS live (settings mongoose model + any DEFAULT_TRACKING_SETTINGS constant + validation schema) — the new field must default disabled+empty AND be accepted by the settings update validation, else `PUT /api/tracking/settings` rejects it.
2. Whether `payload.value` for `pap_payment_completed` is reliably `usdAmount` (Phase 11 set it) vs any path still passing billed — reconfirm.
3. `DestinationToggleRow` type in tracking.constants — add the `partnerPostback: boolean` field so TS forces every row to declare it (compile-time completeness).
