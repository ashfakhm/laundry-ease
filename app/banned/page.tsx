"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, Clock, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppHeader } from "@/components/ui/app-header";

function BannedPageContent() {
  const searchParams = useSearchParams();
  const untilStr = searchParams.get("until");
  const reason = searchParams.get("reason");

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!untilStr) return;

    const targetDate = new Date(untilStr);

    function updateTimer() {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [untilStr]);

  const isValidDate = untilStr && !isNaN(new Date(untilStr).getTime());

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-card border border-border/50 shadow-xl rounded-2xl p-6 md:p-8 text-center"
        >
          <div className="mx-auto mb-5 inline-flex rounded-full bg-red-100 p-4 dark:bg-red-900/20">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Account Terminated / Banned
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your access to LaundryEase has been restricted by an administrator.
          </p>

          {reason && (
            <div className="mb-6 rounded-xl bg-muted/50 p-4 border border-border/40 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Reason for Ban
              </p>
              <p className="text-sm text-foreground">{reason}</p>
            </div>
          )}

          {isValidDate && timeLeft ? (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Time Remaining
              </p>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-background border border-border/60 rounded-xl p-2">
                  <div className="text-xl font-bold text-foreground">
                    {timeLeft.days}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Days</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-2">
                  <div className="text-xl font-bold text-foreground">
                    {timeLeft.hours}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Hours</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-2">
                  <div className="text-xl font-bold text-foreground">
                    {timeLeft.minutes}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Mins</div>
                </div>
                <div className="bg-background border border-border/60 rounded-xl p-2">
                  <div className="text-xl font-bold text-foreground">
                    {timeLeft.seconds}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Secs</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                You will be able to sign in back on{" "}
                {new Date(untilStr).toLocaleDateString()}
              </p>
            </div>
          ) : isValidDate ? (
            <p className="text-sm text-emerald-600 mb-8 font-medium">
              Your ban has expired. You may try logging in again.
            </p>
          ) : (
            <p className="text-sm text-red-600 mb-8 font-medium">
              This suspension has no set expiry date.
            </p>
          )}

          <Link
            href="/auth"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign in
          </Link>
        </motion.div>
      </main>
    </>
  );
}

export default function BannedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mb-4" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      }
    >
      <BannedPageContent />
    </Suspense>
  );
}
