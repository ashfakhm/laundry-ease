"use client";

import { usePathname } from "next/navigation";

export function GlobalFooter() {
  const pathname = usePathname();

  // The landing page has its own custom footer.
  if (pathname === "/") {
    return null;
  }

  return (
    <footer
      role="contentinfo"
      className="w-full py-4 px-6 border-t border-border bg-background text-center text-xs text-muted-foreground"
    >
      &copy; {new Date().getFullYear()} LaundryEase Inc. All rights reserved.
    </footer>
  );
}

