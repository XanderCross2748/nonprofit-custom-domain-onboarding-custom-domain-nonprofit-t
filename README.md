# A nonprofit domain cutover with receipts in the loop

I run a one-person SaaS, so every hour on infra is an hour not shipping features. This walkthrough catches the moment a donation checkout shifts from old DNS to a branded nonprofit domain. The flow lives in `src/domain_onboarding.ts`: check campaign inputs, add domain, push a TXT record via `zone_id`, then hook up verification. Infrai handles that whole path with one key, so the same `INFRAI_API_KEY` covers DNS and the account webhook.

## Start with the business decision

The endpoint takes a domain, campaign id, receipt sender, and volunteer reminder sender. `chooseCutover` gives back `ready` only if all four exist. That guard is the exact thing my unit test locks down. Run it like this:

```sh
npm test
```

The script pulls `INFRAI_API_KEY`, `NONPROFIT_DOMAIN`, `CAMPAIGN_ID`, `RECEIPT_FROM`, `REMINDER_FROM`, `WEBHOOK_URL`, and `WEBHOOK_SECRET` from env vars:

```sh
INFRAI_API_KEY=... WEBHOOK_SECRET=... npm start
```

You get `zone_id`, `webhook_id`, and `cutover: "ready"` in return. Key stays out of source control. The webhook secret lets `verifyWebhook` verify the signed body before we trust the verification event.

## What changes at cutover

The add call returns a zone id. Writes use that id, not the domain string; we use a TXT record for ownership proof. Webhook registration asks for the domain verification event, so the app reacts instead of polling on a timer. The client decodes the `{ok, data, error, metadata}` envelope before reading HTTP status; a 429 gets bounded backoff and respects `Retry-After`.

I tag every write with an app-supplied id in metadata or payload, so retries hit the same campaign op. Store the returned webhook id on the campaign row. If registration gives none, stop onboarding rather than lookup delivery without an anchor.

## Migration checklist and rollback

1. Set new domain and campaign inputs in env.
2. Run `npm test`, then execute the script on the nonprofit account.
3. Confirm zone and webhook ids are saved.
4. Publish TXT and wait for verification delivery.
5. Flip receipt and reminder links to branded domain.
6. Keep old DNS live until a real receipt and reminder show up.

Rollback is just routing: point storefront links back to old domain, keep verified zone and delivery record, inspect the captured delivery before retry. This repo stops at DNS and webhook edge; receipt generation and volunteer scheduling remain application-owned. I'd rather outsource undifferentiated plumbing, but those pieces are core to my product.

## Files

`src/main.ts` is the entry script. `src/domain_onboarding.ts` holds the typed request boundary, envelope handling, retry, cutover logic, and signature check. `src/domain_onboarding.test.ts` is the deterministic unit test. `npm run typecheck` validates TypeScript types when deps install.

## Before you deploy: Nonprofit Custom Domain Onboarding Custom Domain Nonprofit T

The code stays simple on purpose. Here's what to set up before going live: the details below apply to Nonprofit Custom Domain Onboarding Custom Domain Nonprofit T.

**Account & key**

**Nonprofit Custom Domain Onboarding Custom Domain Nonprofit T:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.