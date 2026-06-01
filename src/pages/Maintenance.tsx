import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getNextJune14(now = new Date()) {
  // Local time: June 14 at 00:00:00
  const year = now.getFullYear();
  const targetThisYear = new Date(year, 5, 14, 0, 0, 0, 0); // month=5 => June
  if (now.getTime() < targetThisYear.getTime()) return targetThisYear;
  return new Date(year + 1, 5, 14, 0, 0, 0, 0);
}

function formatCountdown(target: Date, now: Date): Countdown {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

export default function Maintenance() {
  const targetDate = useMemo(() => getNextJune14(new Date()), []);
  const [now, setNow] = useState(() => new Date());
  const countdown = useMemo(() => formatCountdown(targetDate, now), [targetDate, now]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const contactEmail = "support@signaturepicture.co";

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center">
            <img src="/signature-tv-logo.png" alt="Signature TV" className="h-8 w-auto" />
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-secondary/20 via-background to-background shadow-glow">
            {/* Animated background accents */}
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-[pulse_3s_ease-in-out_infinite]"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-[pulse_4s_ease-in-out_infinite]"
                style={{ animationDelay: "500ms" }}
              />
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.18)_0%,transparent_55%),radial-gradient(ellipse_at_70%_60%,hsl(var(--accent)/0.16)_0%,transparent_50%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.06),transparent)] translate-x-[-100%] animate-[shine_2.8s_ease-in-out_infinite]" />
            </div>

            <div className="relative px-4 py-10 md:py-16">
              <div className="flex flex-col items-center text-center gap-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 backdrop-blur-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary animate-[ping_1.2s_ease-in-out_infinite]" />
                  <span className="text-sm font-medium text-foreground">
                    Under Maintenance
                  </span>
                </div>

                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  We’re making Signature TV even better
                </h1>

                <p className="max-w-2xl text-base md:text-lg text-muted-foreground">
                  Streaming, VOD, and OTT experiences are being improved. The
                  service will be back soon.
                </p>

                <div className="w-full max-w-3xl">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <CountdownTile value={countdown.days} label="Days" />
                    <CountdownTile value={countdown.hours} label="Hours" />
                    <CountdownTile value={countdown.minutes} label="Minutes" />
                    <CountdownTile value={countdown.seconds} label="Seconds" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Countdown to June 14th.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    asChild
                    variant="premium"
                    className="gradient-accent text-primary-foreground shadow-glow"
                  >
                    <a href={`mailto:${contactEmail}?subject=Signature%20TV%20Support`}>
                      Contact us
                    </a>
                  </Button>

                </div>

                <div className="text-xs text-muted-foreground/80">
                  For more information, email{" "}
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-primary hover:underline underline-offset-4"
                  >
                    {contactEmail}
                  </a>
                  .
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <InfoCard
              title="Streaming"
              description="Quality improvements in progress"
              emoji="📺"
            />
            <InfoCard
              title="VOD"
              description="Better browsing + smoother playback"
              emoji="🎬"
            />
            <InfoCard
              title="OTT"
              description="Upgrades to keep everything fast"
              emoji="⚡"
            />
          </section>
        </div>
      </main>

      <style>{`
        @keyframes shine {
          0% { transform: translateX(-110%); opacity: 0; }
          30% { opacity: 0.7; }
          100% { transform: translateX(110%); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes pulse2 {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.07); opacity: 1; }
        }
        @keyframes ping {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.35); }
          70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
      `}</style>
    </div>
  );
}

function CountdownTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 backdrop-blur-sm px-3 py-4">
      <div className="text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-xs sm:text-sm font-medium text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  description,
  emoji,
}: {
  title: string;
  description: string;
  emoji: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-5 py-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{emoji}</div>
        <div>
          <div className="font-semibold text-foreground">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
    </div>
  );
}
