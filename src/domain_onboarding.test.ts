import { strict as assert } from "node:assert";
import { chooseCutover, verifyWebhook } from "./domain_onboarding.ts";

assert.equal(chooseCutover({ domain: "give.example.org", campaignId: "winter", receiptFrom: "receipts@example.org", volunteerReminderFrom: "volunteers@example.org" }), "ready");
assert.equal(chooseCutover({ domain: "give.example.org", campaignId: "", receiptFrom: "receipts@example.org", volunteerReminderFrom: "volunteers@example.org" }), "hold");
assert.equal(verifyWebhook("{\"verified\":true}", "f1d0f0b5e9e0f6e0e5a13c9d9dba5d89dbf7c10d4a7f4b7fc0a1a0c0c7b9e1c2", "local-secret"), false);
console.log("cutover decision and webhook boundary checks passed");
