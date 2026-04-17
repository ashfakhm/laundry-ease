import { PageTransitionShell } from "@/components/layout/page-transition-shell";

export default function ChooseRoleTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransitionShell>{children}</PageTransitionShell>;
}
