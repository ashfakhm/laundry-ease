import { cn } from "@/lib/utils";

type PageTransitionShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageTransitionShell({
  children,
  className,
}: PageTransitionShellProps) {
  return (
    <div className={cn("page-transition-shell", className)} data-route-transition>
      {children}
    </div>
  );
}
