/**
 * Hourly cron: check estimated Replicate balance and disable generations if
 * the balance falls below the critical threshold.
 *
 * Email alerts have been removed — the app now uses FASHN for try-on.
 * The generation gate (setGenerationsDisabled) is kept for safety in case
 * any Replicate-backed route is still in use.
 */
import { logger } from "../../lib/logger";
import {
  getEstimatedReplicateBalance,
  BALANCE_THRESHOLD_PAUSE,
  BALANCE_THRESHOLD_WARN,
  setGenerationsDisabled,
} from "../creditService";

// ── Core check ───────────────────────────────────────────────────────────────

export async function runBalanceCheck(): Promise<void> {
  try {
    const { estimatedBalanceUsd, topupCount } = await getEstimatedReplicateBalance();

    if (topupCount === 0) {
      // Billing ledger not initialised — leave generations enabled.
      setGenerationsDisabled(false);
      return;
    }

    if (estimatedBalanceUsd < BALANCE_THRESHOLD_PAUSE) {
      setGenerationsDisabled(true);
      logger.error({ estimatedBalanceUsd }, `creditCron: CRITICAL — balance below $${BALANCE_THRESHOLD_PAUSE}, generations disabled`);
    } else {
      setGenerationsDisabled(false);
      if (estimatedBalanceUsd < BALANCE_THRESHOLD_WARN) {
        logger.warn({ estimatedBalanceUsd }, `creditCron: balance warning (below $${BALANCE_THRESHOLD_WARN})`);
      } else {
        logger.info({ estimatedBalanceUsd }, "creditCron: balance OK");
      }
    }
  } catch (err) {
    // A check failure must never flip the disabled flag or mislead alert state.
    logger.error({ err }, "creditCron: balance check failed — retaining previous state");
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

let cronInterval: ReturnType<typeof setInterval> | null = null;

export function startCreditCron(): void {
  if (cronInterval) return;
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
