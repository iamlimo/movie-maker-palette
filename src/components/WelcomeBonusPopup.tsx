import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Wallet, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const POPUP_STORAGE_KEY = "signaturetv_signup_bonus_popup_dismissed";

export function WelcomeBonusPopup() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    const isHomeEntry = location.pathname === "/";
    const hasDismissed =
      typeof window !== "undefined" &&
      window.localStorage.getItem(POPUP_STORAGE_KEY) === "true";

    if (!isHomeEntry || hasDismissed) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
  }, [loading, location.pathname, user]);

  const handleClose = () => {
    setIsOpen(false);

    try {
      window.localStorage.setItem(POPUP_STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures, popup may reappear once if unavailable.
    }
  };

  const handleStartWatching = () => {
    handleClose();

    if (user) {
      navigate("/movies");
      return;
    }

    navigate("/auth?mode=signup");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-[28px] border-0 bg-card/95 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl [&>button]:hidden sm:rounded-[28px]">
        <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/10" />

          <div className="relative p-5 sm:p-6">
            <button
              type="button"
              aria-label="Close welcome bonus popup"
              onClick={handleClose}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Welcome bonus
                </p>
                <p className="text-sm text-muted-foreground">
                  Your wallet is ready
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Available now
                  </p>
                  <p className="mt-2 text-3xl font-black text-foreground">
                    ₦400
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
            </div>

            <DialogHeader className="mt-5 text-left">
              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                Use your signup bonus
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Add it to your wallet and start renting movies, TV shows, and exclusive content right away.
              </DialogDescription>
            </DialogHeader>

            <Button
              onClick={handleStartWatching}
              variant="premium"
              size="lg"
              className="mt-6 w-full rounded-xl text-base font-semibold"
            >
              Start Watching
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
