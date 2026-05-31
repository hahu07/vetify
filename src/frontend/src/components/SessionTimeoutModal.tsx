import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_MS = 25 * 60 * 1000; // 25 min → show warning
const COUNTDOWN_S = 5 * 60; // 5 min countdown

interface SessionTimeoutModalProps {
  prefix: string; // e.g. "business", "admin", etc.
}

export function SessionTimeoutModal({ prefix }: SessionTimeoutModalProps) {
  const { isAuthenticated, login, logout } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(COUNTDOWN_S);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setVisible(true);
    setRemaining(COUNTDOWN_S);
    clearCountdown();
    countdownTimer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearCountdown();
          logout();
          router.navigate({ to: "/" });
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [logout, router, clearCountdown]);

  const resetIdleTimer = useCallback(() => {
    if (!isAuthenticated) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (visible) return; // don't reset if modal is already showing
    idleTimer.current = setTimeout(startCountdown, IDLE_MS);
  }, [isAuthenticated, visible, startCountdown]);

  // Attach interaction listeners
  useEffect(() => {
    if (!isAuthenticated) return;
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    for (const e of events) {
      window.addEventListener(e, resetIdleTimer, { passive: true });
    }
    resetIdleTimer(); // kick off
    return () => {
      for (const e of events) {
        window.removeEventListener(e, resetIdleTimer);
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      clearCountdown();
    };
  }, [isAuthenticated, resetIdleTimer, clearCountdown]);

  const handleStayLoggedIn = async () => {
    clearCountdown();
    setVisible(false);
    try {
      await login();
    } catch {
      // if re-auth fails, keep user in but reset timer
    }
    // restart idle timer after staying logged in
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(startCountdown, IDLE_MS);
  };

  const handleLogout = () => {
    clearCountdown();
    setVisible(false);
    logout();
    router.navigate({ to: "/" });
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeDisplay = `${minutes}:${String(seconds).padStart(2, "0")}`;

  if (!visible) return null;

  return (
    <dialog
      aria-modal="true"
      tabIndex={-1}
      aria-labelledby="session-timeout-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-ocid={`${prefix}_session_timeout.dialog`}
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2
              id="session-timeout-title"
              className="font-display text-lg font-semibold text-foreground"
            >
              Session Expiring Soon
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your session is about to expire due to inactivity.
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground">
            Would you like to continue? Your session will expire in:
          </p>
          <div
            className="mt-3 flex items-center justify-center rounded-lg bg-destructive/10 py-4"
            aria-live="polite"
            aria-label={`Session expires in ${timeDisplay}`}
            data-ocid={`${prefix}_session_timeout.countdown`}
          >
            <span className="font-mono text-3xl font-bold tabular-nums text-destructive">
              {timeDisplay}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-border px-6 pb-6 pt-4">
          <Button
            type="button"
            variant="default"
            className="flex-1"
            onClick={handleStayLoggedIn}
            data-ocid={`${prefix}_session_timeout.stay_button`}
          >
            Stay Logged In
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={handleLogout}
            data-ocid={`${prefix}_session_timeout.logout_button`}
          >
            Log Out
          </Button>
        </div>
      </div>
    </dialog>
  );
}
