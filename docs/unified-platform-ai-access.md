# Unified CDC platform and AI access

Public navigation has five sections: Digital College, Digital Market, Employment, Forum, and About. AI tools are listed in the Digital Market, including its unfiltered view. Terms remain available in About and the footer. Existing routes remain on the same site.

## College benefit

The server derives access from an actual enrollment in a published course with lessons. Access continues while any enrolled course remains unfinished. Passing a configured final exam or holding a course certificate ends that course's benefit permanently, even if lesson completion is later unchecked. Courses without a configured exam use the existing all-lessons completion rule.

The benefit is checked on requests, not stored as a permanent paid flag. Existing explicit admin grants and previously purchased entitlements are preserved. Usage limits and moderation continue to apply.

## Per-tool subscriptions

The canonical price is `AI_TOOL_MONTHLY_PRICE_MINOR = 2900` tetri for each registered AI tool. A confirmed payment grants a separate 30-day period for that tool only. Early renewal appends another period without discarding paid days. Existing tutor, educator, and per-agent checkout prices also use this constant.

The existing BOG integration does not debit saved cards automatically. The UI explicitly describes renewal by a new payment. No automatic recurring billing is claimed or enabled.

- `GET /api/digital-tools/catalog`: authoritative prices and registered tool keys.
- `GET /api/digital-tools/:key/access`: access, college inclusion, and paid expiration.
- `POST /api/payments/checkout/ai-tool/:key`: authenticated checkout; client prices and durations are ignored. Active college learners are not charged.
- BOG confirmation atomically claims a pending payment and creates a time-bounded `AccessGrant`. Concurrent duplicate notifications cannot add extra months.
- Expiration is enforced at request time. Refunding a payment with access revocation removes the corresponding paid period.
- Disabled, coming-soon, and non-admin access to admin-only tools cannot be purchased.

Active college/subscription book access covers book generation without a second per-book charge. Coloring subscription access bypasses credit consumption while preserving hourly limits and safety checks. Existing purchased books, credit balances and legacy purchase endpoints remain supported.

## Migration and validation

`20261115000100_ai_tool_subscription_purpose` adds the payment-purpose enum value; subscription periods reuse the existing AccessGrant table. The migration was applied only to the disposable local test database. Production migration/deployment has not been performed.

Regression coverage includes real database enrollment/final-exam revocation, payment idempotency, per-tool isolation, expiry/refund behavior, renewal periods, forged prices, unconfigured tool rejection, navigation and the market subscription UI. AI and bank-provider calls are mocked in tests.
