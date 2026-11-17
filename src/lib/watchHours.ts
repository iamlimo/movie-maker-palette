export const WATCH_HOURS_REWARD_MINUTES = 120;
export const WATCH_HOURS_REWARD_AMOUNT_KOBO = 10000;

export type WatchRewardProgress = {
  totalEligibleMinutes: number;
  creditedMinutes: number;
  completedRewardBlocks: number;
  pendingRewardMinutes: number;
  pendingRewardValueKobo: number;
  remainingEligibleMinutes: number;
  totalRewardValueKobo: number;
};

export const calculateWatchRewardProgress = (
  totalEligibleMinutes: number,
  creditedMinutes = 0,
  rewardMinutes = WATCH_HOURS_REWARD_MINUTES,
  rewardValueKobo = WATCH_HOURS_REWARD_AMOUNT_KOBO,
): WatchRewardProgress => {
  const safeEligibleMinutes = Math.max(0, Number.isFinite(totalEligibleMinutes) ? Math.floor(totalEligibleMinutes) : 0);
  const safeCreditedMinutes = Math.max(0, Number.isFinite(creditedMinutes) ? Math.floor(creditedMinutes) : 0);
  const remainingMinutes = Math.max(0, safeEligibleMinutes - safeCreditedMinutes);
  const completedRewardBlocks = Math.floor(remainingMinutes / rewardMinutes);
  const pendingRewardMinutes = completedRewardBlocks * rewardMinutes;
  const remainingEligibleMinutes = Math.max(0, remainingMinutes - pendingRewardMinutes);
  const totalRewardValueKobo = Math.floor(safeEligibleMinutes / rewardMinutes) * rewardValueKobo;

  return {
    totalEligibleMinutes: safeEligibleMinutes,
    creditedMinutes: safeCreditedMinutes,
    completedRewardBlocks,
    pendingRewardMinutes,
    pendingRewardValueKobo: completedRewardBlocks * rewardValueKobo,
    remainingEligibleMinutes: remainingEligibleMinutes,
    totalRewardValueKobo,
  };
};

export const formatMinutesToReadable = (minutes: number): string => {
  const safe = Math.max(0, Math.floor(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export const formatProgressLabel = (minutes: number): string => {
  const safe = Math.max(0, Math.floor(minutes || 0));
  return `${safe} eligible min`;
};
