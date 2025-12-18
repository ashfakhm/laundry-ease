import Link from "next/link";

export default function RootMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500 text-xs font-bold text-white shadow-sm">
              LE
            </span>
            <span className="text-sm font-semibold tracking-tight">
              LaundryEase
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <Link
              href="/choose-role"
              className="hidden rounded-full border px-3 py-1.5 hover:bg-muted sm:inline-flex"
            >
              Get started
            </Link>
            <Link
              href="/auth"
              className="inline-flex rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
