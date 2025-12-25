import { AppHeader } from "@/components/ui/app-header";

export default function RootMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header role="banner">
        <AppHeader showAuth={true} />
      </header>
      <main role="main" aria-label="Marketing main content">
        {children}
      </main>
    </div>
  );
}
