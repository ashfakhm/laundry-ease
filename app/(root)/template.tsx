import { PageTransitionShell } from "@/components/layout/page-transition-shell";

export default function RootMarketingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransitionShell>{children}</PageTransitionShell>;
}
