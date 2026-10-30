# Institutional licensing integration

Cboard API keeps ordinary paid/lifetime subscriptions unchanged. Sponsored access is a separate local, signed entitlement with exact start/end dates. The feature is disabled by default.

## Configuration

Set these values through the existing environment/secret mechanism, with a different key per product and environment:

```dotenv
INSTITUTIONAL_LICENSING_ENABLED=false
CBOARD_INSTITUTIONS_URL=https://institutional-staging.example.test
INSTITUTIONS_HMAC_KEY=
```

Set the institutional service's PRODUCT_ENDPOINTS.cboard to this API origin, PRODUCT_LOGIN_URLS.cboard to the real browser login URL, PRODUCT_ACTIVATION_URLS.cboard to the real browser URL ending in /institutional-access, and PRODUCT_KEYS.cboard to the same dedicated key. Those service settings are JSON objects. No token or secret belongs in a browser URL.

## Deployment and checks

Deploy routes and bounded access readers with the flag off. Enable only in isolated staging after configuring the service and running migrations. The bridge initializes its scoped institutional indexes on first signed synchronization. POST /api/institutions/entitlements accepts raw HMAC-authenticated bytes; do not put a body transformer before signature verification. Activation actions preview, redeem, status, check, retry and cancel use the existing authenticated product session and supply its account identity to the service. The browser must never supply authoritative user/email/access information.

Open /institutional-access after signing in. Review the invitation and renewal terms, redeem once, complete provider approval, then check status. After a refresh, Find my existing activation recovers the account's most recent assignment. An individual payer can request renewal cancellation here; access continues until the entitled end. Institution-paid cancellation belongs to the institution administrator.

Test valid/wrong-account/expired/replayed invitations, existing ordinary paid/lifetime access, actual premium feature access, unavailable service, local expiry, stale/conflicting revisions, provider approval recovery and cancellation. Normal Stripe webhooks ignore purpose=institutional-subscription where Stripe is used, so billing events cannot create an unbounded ordinary subscription. Cbuilder also rejects that purpose in its ordinary checkout verification action.

Do not delete institutional records or disable a deployed reader as a billing rollback: preserve funded access through its recorded end. Stop the institutional worker and new writes, restore a compatible image, reconcile provider state, then replay targeted jobs. Full provider and production-host validation remains required.
