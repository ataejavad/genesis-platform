// Why a customer, deal or order was lost (gap audit 2026-10-25b). Shared by the cockpit forms and the portal card.
export const LOSS_REASONS = ["price", "timing", "fit", "competitor", "no_answer", "quality", "other"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];
