/**
 * Hourly cron: check estimated Replicate balance and alert if below thresholds.
 *
 * Balance source: the internal DB ledger (replicateTopupsTable minus generationLogsTable costs).
 * This is NOT a live Replicate API call. Admins must manually log top-ups at
 * /admin → Replicate Balance whenever the Replicate account is funded.
 *
 * Alert thresholds:
 *  < $20  → log warning  (email if Resend configured)
 *  < $10  → log error    (red banner in /admin → Replicate Balance)
 *  < $5   → log critical + disable new generations
 *
 * Deduplication: emails are only sent when the alert level CHANGES (e.g. OK → CRITICAL),
 * or after ALERT_RESEND_INTERVAL_HRS hours at the same level. This prevents
 * the inbox from being flooded on every hourly cycle.
 */
import { logger } from "../../lib/logger";
import {
  getEstimatedReplicateBalance,
  BALANCE_THRESHOLD_WARN,
  BALANCE_THRESHOLD_RED,
  BALANCE_THRESHOLD_PAUSE,
  setGenerationsDisabled,
} from "../creditService";

const ADMIN_ALERT_EMAIL     = process.env["ADMIN_ALERT_EMAIL"] ?? process.env["ADMIN_EMAILS"]?.split(",")[0]?.trim() ?? "";
const RESEND_API_KEY        = process.env["RESEND_API_KEY"] ?? "";
/** Re-send an alert at the same level after this many hours (prevents total email silence if the level doesn't change). */
const ALERT_RESEND_INTERVAL_HRS = 24;

// ── Alert deduplication state ────────────────────────────────────────────────

type AlertLevel = "ok" | "warn" | "danger" | "critical";

let _lastAlertLevel: AlertLevel = "ok";
let _lastAlertEmailAt: number   = 0; // epoch ms

function shouldSendEmail(newLevel: AlertLevel): boolean {
  if (newLevel === "ok") return false; // never email on OK
  const levelChanged   = newLevel !== _lastAlertLevel;
  const intervalPassed = Date.now() - _lastAlertEmailAt > ALERT_RESEND_INTERVAL_HRS * 60 * 60 * 1000;
  return levelChanged || intervalPassed;
}

// ── Email helper ─────────────────────────────────────────────────────────────

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
    _lastAlertEmailAt = Date.now();
    logger.info({ to: ADMIN_ALERT_EMAIL, subject }, "creditCron: alert email sent");
  } catch (err) {
    logger.warn({ err }, "creditCron: failed to send alert email");
  }
}

// ── Balance check ─────────────────────────────────────────────────────────────

export async function runBalanceCheck(): Promise<void> {
  try {
    const { estimatedBalanceUsd, totalTopupsUsd, totalCostUsd, topupCount } =
      await getEstimatedReplicateBalance();

    const summary = `Estimated balance: $${estimatedBalanceUsd.toFixed(2)} (topups: $${totalTopupsUsd.toFixed(2)}, cost: $${totalCostUsd.toFixed(2)})`;

    // Diagnostic: warn loudly if no top-ups are logged in the DB ledger.
    // This is the most common cause of a $0.00 balance report — the Replicate
    // account was topped up but the admin never logged it at /admin → Replicate Balance.
    if (topupCount === 0) {
      logger.warn(
        { estimatedBalanceUsd, totalTopupsUsd },
        "creditCron: NO top-ups are recorded in the DB ledger. " +
        "If the Replicate account has been funded, log the amount at /admin → Replicate Balance. " +
        "Balance will show $0.00 until a top-up is logged.",
      );
    }

    let newLevel: AlertLevel;

    if (estimatedBalanceUsd < BALANCE_THRESHOLD_PAUSE) {
      newLevel = "critical";
      logger.error({ estimatedBalanceUsd }, `creditCron: CRITICAL — balance below $${BALANCE_THRESHOLD_PAUSE}, disabling generations`);
      setGenerationsDisabled(true);
      if (shouldSendEmail(newLevel)) {
        await sendAdminEmail(
          `🚨 KA.SHA AI Credits CRITICAL — balance $${estimatedBalanceUsd.toFixed(2)}`,
          `${summary}\n\nAI generations have been AUTOMATICALLY DISABLED.\nPlease top up your Replicate account and log the top-up at /admin → Replicate Balance.`,
        );
      }
    } else if (estimatedBalanceUsd < BALANCE_THRESHOLD_RED) {
      newLevel = "danger";
      setGenerationsDisabled(false);
      logger.error({ estimatedBalanceUsd }, `creditCron: DANGER — balance below $${BALANCE_THRESHOLD_RED}`);
      if (shouldSendEmail(newLevel)) {
        await sendAdminEmail(
          `🔴 KA.SHA AI Credits LOW — balance $${estimatedBalanceUsd.toFixed(2)}`,
          `${summary}\n\nBalance is critically low. Please top up Replicate soon.`,
        );
      }
    } else if (estimatedBalanceUsd < BALANCE_THRESHOLD_WARN) {
      newLevel = "warn";
      setGenerationsDisabled(false);
      logger.warn({ estimatedBalanceUsd }, `creditCron: WARNING — balance below $${BALANCE_THRESHOLD_WARN}`);
      if (shouldSendEmail(newLevel)) {
        await sendAdminEmail(
          `⚠️  KA.SHA AI Credits Warning — balance $${estimatedBalanceUsd.toFixed(2)}`,
          `${summary}\n\nConsider topping up Replicate soon.`,
        );
      }
    } else {
      newLevel = "ok";
      setGenerationsDisabled(false);
      logger.info({ estimatedBalanceUsd }, "creditCron: balance OK");
    }

    // Update deduplication state after processing.
    if (newLevel !== _lastAlertLevel) {
      logger.info(
        { from: _lastAlertLevel, to: newLevel },
        "creditCron: alert level changed",
      );
    }
    _lastAlertLevel = newLevel;

  } catch (err) {
    // Balance check failure must never disable generations or send misleading alerts.
    // The previous alert level / disabled state is preserved until the next successful check.
    logger.error({ err }, "creditCron: balance check failed — retaining previous state, NOT disabling generations");
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
