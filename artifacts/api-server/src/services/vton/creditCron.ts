/**
 * Hourly cron: check estimated Replicate balance and alert if below thresholds.
 *
 * Balance source: the internal DB ledger (replicateTopupsTable minus generationLogsTable costs).
 * This is NOT a live Replicate API call. Admins must manually log top-ups at
 * /admin → Replicate Balance whenever the Replicate account is funded.
 *
 * Alert deduplication (survives server restarts):
 *   State is persisted to siteSettingsTable under two keys:
 *     "replicate_alert_level"    — last alerted level ("ok" | "warn" | "danger" | "critical")
 *     "replicate_alert_email_at" — ISO timestamp of last email sent
 *
 *   An email is sent only when the alert level CHANGES, or when the same
 *   level has persisted for longer than ALERT_RESEND_INTERVAL_HRS (default 24h).
 *   This means a server restart will NOT re-trigger the email.
 *
 * Thresholds:
 *   < $20 → warn
 *   < $10 → danger (red)
 *   < $5  → critical (disables new AI generations)
 */
import { eq } from "drizzle-orm";
import { db, siteSettingsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import {
  getEstimatedReplicateBalance,
  BALANCE_THRESHOLD_WARN,
  BALANCE_THRESHOLD_RED,
  BALANCE_THRESHOLD_PAUSE,
  setGenerationsDisabled,
} from "../creditService";

const ADMIN_ALERT_EMAIL         = process.env["ADMIN_ALERT_EMAIL"] ?? process.env["ADMIN_EMAILS"]?.split(",")[0]?.trim() ?? "";
const RESEND_API_KEY            = process.env["RESEND_API_KEY"] ?? "";
const ALERT_RESEND_INTERVAL_HRS = 24;

type AlertLevel = "ok" | "warn" | "danger" | "critical";

const SETTING_LEVEL    = "replicate_alert_level";
const SETTING_EMAIL_AT = "replicate_alert_email_at";

// ── Persistent state (backed by siteSettingsTable) ───────────────────────────

async function readAlertState(): Promise<{ level: AlertLevel; emailAt: number }> {
  const rows = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, SETTING_LEVEL))
    .limit(1);

  const emailAtRows = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, SETTING_EMAIL_AT))
    .limit(1);

  const level   = (rows[0]?.value ?? "ok") as AlertLevel;
  const emailAt = emailAtRows[0]?.value ? new Date(emailAtRows[0].value).getTime() : 0;

  return { level, emailAt };
}

async function saveAlertLevel(level: AlertLevel): Promise<void> {
  await db
    .insert(siteSettingsTable)
    .values({ key: SETTING_LEVEL, value: level })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: level } });
}

async function saveEmailSentNow(): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(siteSettingsTable)
    .values({ key: SETTING_EMAIL_AT, value: now })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: now } });
}

// ── Email helper ─────────────────────────────────────────────────────────────

async function sendAdminEmail(subject: string, body: string): Promise<void> {
  if (!RESEND_API_KEY || !ADMIN_ALERT_EMAIL) {
    logger.warn({ reason: "missing RESEND_API_KEY or ADMIN_ALERT_EMAIL" }, "creditCron: skipping email");
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: "alerts@kashaonline.in",
      to:   ADMIN_ALERT_EMAIL,
      subject,
      html: `<pre style="font-family:monospace;white-space:pre-wrap">${body}</pre>`,
    });
    await saveEmailSentNow();
    logger.info({ to: ADMIN_ALERT_EMAIL, subject }, "creditCron: alert email sent");
  } catch (err) {
    logger.warn({ err }, "creditCron: failed to send alert email");
  }
}

// ── Core check ───────────────────────────────────────────────────────────────

export async function runBalanceCheck(): Promise<void> {
  try {
    const { estimatedBalanceUsd, totalTopupsUsd, totalCostUsd, topupCount } =
      await getEstimatedReplicateBalance();

    const summary = `Estimated balance: $${estimatedBalanceUsd.toFixed(2)}\n  Topups logged: $${totalTopupsUsd.toFixed(2)} (${topupCount} entries)\n  Cost to date:  $${totalCostUsd.toFixed(2)}`;

    if (topupCount === 0) {
      // The billing ledger has never been initialised — the admin hasn't logged any
      // Replicate top-ups yet.  In this state we cannot know the real balance, so we
      // treat it as "OK" and leave generations ENABLED.  Disabling here would block
      // every user even when the Replicate account has funds.
      // The admin should record the current Replicate credit at /admin → Replicate Balance.
      logger.warn(
        { estimatedBalanceUsd, totalTopupsUsd },
        "creditCron: NO top-ups recorded in DB ledger — treating balance as OK. " +
        "Log the current Replicate credit at /admin → Replicate Balance to activate balance tracking.",
      );
      setGenerationsDisabled(false);
      return;
    }

    let newLevel: AlertLevel;

    if (estimatedBalanceUsd < BALANCE_THRESHOLD_PAUSE) {
      newLevel = "critical";
      setGenerationsDisabled(true);
      logger.error({ estimatedBalanceUsd }, `creditCron: CRITICAL — balance below $${BALANCE_THRESHOLD_PAUSE}, generations disabled`);
    } else if (estimatedBalanceUsd < BALANCE_THRESHOLD_RED) {
      newLevel = "danger";
      setGenerationsDisabled(false);
      logger.error({ estimatedBalanceUsd }, `creditCron: DANGER — balance below $${BALANCE_THRESHOLD_RED}`);
    } else if (estimatedBalanceUsd < BALANCE_THRESHOLD_WARN) {
      newLevel = "warn";
      setGenerationsDisabled(false);
      logger.warn({ estimatedBalanceUsd }, `creditCron: WARNING — balance below $${BALANCE_THRESHOLD_WARN}`);
    } else {
      newLevel = "ok";
      setGenerationsDisabled(false);
      logger.info({ estimatedBalanceUsd }, "creditCron: balance OK");
    }

    // Read persisted state from DB (survives restarts).
    const { level: lastLevel, emailAt: lastEmailAt } = await readAlertState();

    const levelChanged   = newLevel !== lastLevel;
    const reminderDue    = newLevel !== "ok" && (Date.now() - lastEmailAt) > ALERT_RESEND_INTERVAL_HRS * 60 * 60 * 1000;
    const shouldEmail    = levelChanged || reminderDue;

    if (levelChanged) {
      logger.info({ from: lastLevel, to: newLevel }, "creditCron: alert level changed");
      await saveAlertLevel(newLevel);
    }

    if (newLevel === "ok" || !shouldEmail) {
      if (!shouldEmail && newLevel !== "ok") {
        logger.info({ level: newLevel, lastEmailAt: new Date(lastEmailAt).toISOString() }, "creditCron: alert suppressed (no level change, reminder not yet due)");
      }
      return;
    }

    // Send email and save timestamp only once per state change / reminder interval.
    switch (newLevel) {
      case "critical":
        await sendAdminEmail(
          `🚨 KA.SHA AI Credits CRITICAL — balance $${estimatedBalanceUsd.toFixed(2)}`,
          `${summary}\n\nAI generations have been AUTOMATICALLY DISABLED.\nPlease top up your Replicate account and log the top-up at /admin → Replicate Balance.`,
        );
        break;
      case "danger":
        await sendAdminEmail(
          `🔴 KA.SHA AI Credits LOW — balance $${estimatedBalanceUsd.toFixed(2)}`,
          `${summary}\n\nBalance is critically low. Please top up Replicate soon.`,
        );
        break;
      case "warn":
        await sendAdminEmail(
          `⚠️  KA.SHA AI Credits Warning — balance $${estimatedBalanceUsd.toFixed(2)}`,
          `${summary}\n\nConsider topping up Replicate in the next day or two.`,
        );
        break;
    }

  } catch (err) {
    // A check failure must never flip the disabled flag or mislead alert state.
    logger.error({ err }, "creditCron: balance check failed — retaining previous state, NOT disabling generations");
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

let cronInterval: ReturnType<typeof setInterval> | null = null;

export function startCreditCron(): void {
  if (cronInterval) return;
  void runBalanceCheck();
  cronInterval = setInterval(() => { void runBalanceCheck(); }, 60 * 60 * 1000);
  logger.info("creditCron: started (hourly balance check, state persisted to DB)");
}

export function stopCreditCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}
