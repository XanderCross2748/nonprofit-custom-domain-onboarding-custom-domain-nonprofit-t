import { InfraiClient, onboardDomain } from "./domain_onboarding.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting");
const result = await onboardDomain(new InfraiClient(key), {
  domain: process.env.NONPROFIT_DOMAIN ?? "example.org",
  campaignId: process.env.CAMPAIGN_ID ?? "spring-appeal",
  receiptFrom: process.env.RECEIPT_FROM ?? "receipts@example.org",
  volunteerReminderFrom: process.env.REMINDER_FROM ?? "volunteers@example.org"
}, process.env.WEBHOOK_URL ?? "https://app.example.org/hooks/domain", process.env.WEBHOOK_SECRET ?? "local-secret");
console.log(JSON.stringify(result, null, 2));
