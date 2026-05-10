import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRentalRemaining } from '@/lib/rentalStates';

interface RentalCountdownProps {
  expiresAt: string | null | undefined;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
  /** Called once when the countdown crosses zero. */
  onExpire?: () => void;
  /** Called once when the countdown drops below the warning threshold (default 5 min). */
  onWarning?: () => void;
  warningMinutes?: number;
}

/**
 * Self-ticking rental countdown badge.
 * Backend remains source of truth — this is a visual ticker only.
 */
export const RentalCountdown = ({
  expiresAt,
  className,
  iconClassName,
  showIcon = true,
  onExpire,
  onWarning,
  warningMinutes = 5,
}: RentalCountdownProps) => {
  const [now, setNow] = useState(() => Date.now());
  const [warned, setWarned] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const cur = Date.now();
      setNow(cur);
      const remainingMs = end - cur;
      if (remainingMs <= 0 && !expired) {
        setExpired(true);
        onExpire?.();
      } else if (
        remainingMs > 0 &&
        remainingMs <= warningMinutes * 60_000 &&
        !warned
      ) {
        setWarned(true);
        onWarning?.();
      }
    };
    tick();
    // Tick every second when within an hour, otherwise every 30s.
    const remaining = end - Date.now();
    const interval = remaining < 60 * 60 * 1000 ? 1000 : 30_000;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [expiresAt, warningMinutes, onExpire, onWarning, expired, warned]);

  if (!expiresAt) return null;
  const label = formatRentalRemaining(expiresAt, now);
  const isUrgent = warned && !expired;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        isUrgent && 'text-destructive',
        className,
      )}
    >
      {showIcon && <Clock className={cn('h-3 w-3', iconClassName)} />}
      {label}
    </span>
  );
};