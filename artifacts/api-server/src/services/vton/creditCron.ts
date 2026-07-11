/**
 * Hourly cron: check estimated Replicate balance and alert if below thresholds.
 *
 * Alerts:
 *  < $20  → log warning (email if Resend configured)
 *  < $10  → log error (red banner surfaced via /admin/credits/replicate-balance)
 *  < $5   → log critical + disable new generations
 */
import { logger } from "../../lib/logger";
import {
  getEstimatedReplicateBalance,
  BALANCE_THRESHOLD_WARN,
  BALANCE_THRESHOLD_RED,
  BALANCE_THRESHOLD_PAUSE,
  setGenerationsDisabled,
} from "../creditService";

const ADMIN_ALERT_EMAIL = process.env["ADMIN_ALERT_EMAIL"] ?? process.env["ADMIN_EMAILS"]?.split(",")[0]?.trim() ?? "";
const RESEND_API_KEY     = process.env["RESEND_API_KEY"] ?? "";

async function sendAdminEmail(subject: string, body: string): Promise<void> {
  if (!RESEND_API_KEY || !ADMIN_ALERT_EMAIL) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: "alerts@kashaonline.in",
      to: ADMIN_ALERT_EMAIL,
      subject,
      html: `<pre style="font-family:monospace">${body}</pre>`,
    });
  } catch (err) {
    logger.warn({ err }, "creditCron: failed to send alert email");
  }
}

export async function runBalanceCheck(): Promise<void> {
  try {
    const { estimatedBalanceUsd, totalTopupsUsd, totalCostUsd } =
      await getEstimatedReplicateBalance();

    const summary = `Estimated balance: $${estimatedBalanceUsd.toFixed(2)} (topups: $${totalTopupsUsd.toFixed(2)}, cost: $${totalCostUsd.toFixed(2)})`;

    if (estimatedBalanceUsd < BALANCE_THRESHOLD_PAUSE) {
      logger.error({ estimatedBalanceUsd }, `creditCron: CRITICAL — balance below $${BALANCE_THRESHOLD_PAUSE}, disabling generations`);
      setGenerationsDisabled(true);
      await sendAdminEmail(
        `🚨 KA.SHA AI Credits CRITICAL — balance $${estimatedBalanceUsd.toFixed(2)}`,
        `${summary}\n\nAI generations have been AUTOMATICALLY DISABLED.\nPlease top up your Replicate account and log the top-up at /admin → Replicate Balance.`,
      );
    } else if (estimatedBalanceUsd < BALANCE_THRESHOLD_RED) {
      setGenerationsDisabled(false);
      logger.error({ estimatedBalanceUsd }, `creditCron: DANGER — balance below $${BALANCE_THRESHOLD_RED}`);
      await sendAdminEmail(
        `🔴 KA.SHA AI Credits LOW — balance $${estimatedBalanceUsd.toFixed(2)}`,
        `${summary}\n\nBalance is critically low. Please top up Replicate soon.`,
      );
    } else if (estimatedBalanceUsd < BALANCE_THRESHOLD_WARN) {
      setGenerationsDisabled(false);
      logger.warn({ estimatedBalanceUsd }, `creditCron: WARNING — balance below $${BALANCE_THRESHOLD_WARN}`);
      await sendAdminEmail(
        `⚠️  KA.SHA AI Credits Warning — balance $${estimatedBalanceUsd.toFixed(2)}`,
        `${summary}\n\nConsider topping up Replicate soon.`,
      );
    } else {
      setGenerationsDisabled(false);
      logger.info({ estimatedBalanceUsd }, "creditCron: balance OK");
    }
  } catch (err) {
    logger.error({ err }, "creditCron: balance check failed");
  }
}

let cronInterval: ReturnType<typeof setInterval> | null = null;

export function startCreditCron(): void {
  if (cronInterval) return;
  // Run once immediately on startup, then every hour.
  void runBalanceCheck();
  cronInterval = setInterval(() => { void runBalanceCheck(); }, 60 * 60 * 1000);
  logger.info("creditCron: started (hourly balance check)");
}

export function stopCreditCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}
