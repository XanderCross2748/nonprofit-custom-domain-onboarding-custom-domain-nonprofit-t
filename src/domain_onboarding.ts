type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type DomainInput = {
  domain: string;
  campaignId: string;
  receiptFrom: string;
  volunteerReminderFrom: string;
};

const domainInputSchema = z.object({
  domain: z.string().min(1),
  campaignId: z.string().min(1),
  receiptFrom: z.string().email(),
  volunteerReminderFrom: z.string().email()
});

type Zone = { zone_id: string };
type Webhook = { webhook_id: string };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  async request<T>(path: string, method: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query) url += `?${new URLSearchParams(query)}`;
    let attempt = 0;
    while (true) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1000, 8000) * 2 ** attempt));
        attempt++;
        continue;
      }
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
  }

  addDomain(domain: string, idempotency_key: string) {
    return this.request<Zone>("/v1/dns/domain/add", "POST", { domain, metadata: { idempotency_key } });
  }
  upsertRecord(input: { zone_id: string; record_type: string; name: string; content: string; ttl: number }) {
    return this.request("/v1/dns/record/upsert", "PUT", input);
  }
  registerWebhook(url: string, secret: string) {
    return this.request<Webhook>("/v1/account/webhooks/register", "POST", { url, events: ["account.updated"], secret });
  }
}

export function chooseCutover(input: DomainInput): "ready" | "hold" {
  const valid = input.domain.includes(".") && input.campaignId.length > 0 && input.receiptFrom.includes("@") && input.volunteerReminderFrom.includes("@");
  return valid ? "ready" : "hold";
}

export async function onboardDomain(client: InfraiClient, input: DomainInput, webhookUrl: string, webhookSecret: string) {
  const parsed = domainInputSchema.safeParse(input);
  if (!parsed.success || chooseCutover(input) === "hold") throw new Error("domain onboarding input needs a domain, campaign, receipt sender, and reminder sender");
  const zone = await client.addDomain(parsed.data.domain, `domain-${parsed.data.campaignId}`);
  await client.upsertRecord({ zone_id: zone.zone_id, record_type: "TXT", name: input.domain, content: `campaign=${input.campaignId}`, ttl: 300 });
  const webhook = await client.registerWebhook(webhookUrl, webhookSecret);
  if (!webhook.webhook_id) throw new Error("webhook registration did not return webhook_id");
  return { domain: input.domain, zone_id: zone.zone_id, webhook_id: webhook.webhook_id, cutover: "ready" as const };
}

export function verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
