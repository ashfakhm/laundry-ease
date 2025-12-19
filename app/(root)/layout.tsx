import { AppHeader } from "@/components/ui/app-header";

export default function RootMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader showAuth={true} />
      <main>{children}</main>
    </div>
  );
}
