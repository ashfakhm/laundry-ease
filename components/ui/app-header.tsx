"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Sparkles } from "lucide-react";

interface AppHeaderProps {
  showAuth?: boolean;
}

export function AppHeader({ showAuth = true }: AppHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-heading font-semibold text-lg tracking-tight">
            LaundryEase
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {showAuth && (
            <div className="flex items-center gap-4">
              <Link href="/auth">
                 <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                   Sign In
                 </button>
              </Link>
              <Link href="/choose-role">
                <button className="h-9 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:translate-y-[-1px]">
                  Get Started
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
