import { prisma } from "./db";
import { randomId, signReceipt } from "./crypto";
import type { Webhook, WebhookDelivery } from "@prisma/client";
import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "receipt.created",
  "receipt.blocked",
  "receipt.needs_approval",
  "approval.requested",
  "approval.decided",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  enabled: z.boolean().optional().default(true),
});
export const updateWebhookSchema = createWebhookSchema.partial();

const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [0, 1_000, 5_000, 30_000];
const REQUEST_TIMEOUT_MS = 10_000;

export interface WebhookView {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function publicWebhook(w: Webhook): WebhookView {
  let events: WebhookEvent[] = [];
  try {
    const parsed = JSON.parse(w.events);
    if (Array.isArray(parsed)) events = parsed as WebhookEvent[];
  } catch {
    events = [];
  }
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events,
    enabled: w.enabled,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export interface DeliveryView {
  id: string;
  webhookId: string;
  eventType: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  error: string | null;
  signature: string;
  createdAt: string;
  lastTriedAt: string | null;
}

export function publicDelivery(d: WebhookDelivery): DeliveryView {
  return {
    id: d.id,
    webhookId: d.webhookId,
    eventType: d.eventType,
    status: d.status,
    attempts: d.attempts,
    responseCode: d.responseCode,
    error: d.error,
    signature: d.signature,
    createdAt: d.createdAt.toISOString(),
    lastTriedAt: d.lastTriedAt?.toISOString() ?? null,
  };
}

/**
 * Fire-and-forget event dispatch. Persists a delivery row per matching webhook,
 * then attempts delivery in the background with exponential backoff. Errors
 * stay scoped to the delivery row — they NEVER fail the calling request.
 *
 * CAVEAT for serverless deploys: retries run in-process with up to 30 s of
 * sleep between attempts. Vercel / Cloudflare functions may be killed before
 * the retry chain finishes, leaving deliveries stuck in `pending`. A future
 * cron-driven sweeper (or queue) is needed for production multi-tenant use.
 * On a long-lived Node server (incl. `next dev` / `next start`), retries
 * complete normally.
 */
export async function emit(eventType: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  const webhooks = await prisma.webhook.findMany({ where: { enabled: true } });
  const matching = webhooks.filter((w) => publicWebhook(w).events.includes(eventType));
  if (matching.length === 0) return;

  // Sign once per payload — same canonical-Ed25519 scheme as receipts.
  const envelope = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  };
  const body = JSON.stringify(envelope);
  const signature = signReceipt(envelope);

  for (const w of matching) {
    const id = randomId("whd");
    await prisma.webhookDelivery.create({
      data: {
        id,
        webhookId: w.id,
        eventType,
        status: "pending",
        attempts: 0,
        payload: body,
        signature,
      },
    });
    // Detached delivery — caller doesn't await retries.
    void deliverWithRetry({ deliveryId: id, url: w.url, body, signature, eventType });
  }
}

async function deliverWithRetry(args: {
  deliveryId: string;
  url: string;
  body: string;
  signature: string;
  eventType: string;
}): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt - 1] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(args.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "MandateSeal-Webhook/0.8",
          "x-mandateseal-event": args.eventType,
          "x-mandateseal-signature": args.signature,
        },
        body: args.body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        await prisma.webhookDelivery.update({
          where: { id: args.deliveryId },
          data: {
            status: "sent",
            responseCode: res.status,
            attempts: attempt,
            lastTriedAt: new Date(),
            error: null,
          },
        });
        return;
      }

      const errBody = await res.text().catch(() => "");
      await prisma.webhookDelivery.update({
        where: { id: args.deliveryId },
        data: {
          status: attempt === MAX_ATTEMPTS ? "failed" : "pending",
          responseCode: res.status,
          attempts: attempt,
          lastTriedAt: new Date(),
          error: errBody.slice(0, 500) || `HTTP ${res.status}`,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.webhookDelivery.update({
        where: { id: args.deliveryId },
        data: {
          status: attempt === MAX_ATTEMPTS ? "failed" : "pending",
          attempts: attempt,
          lastTriedAt: new Date(),
          error: msg.slice(0, 500),
        },
      });
    }
  }
}
