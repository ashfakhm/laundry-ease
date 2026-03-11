"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  Calendar,
  Package,
  FileText,
  Star,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/client-error";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  label: string;
  href: Route;
  icon: React.ElementType;
  badge?: number;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/provider", icon: LayoutDashboard },
      { label: "Bookings", href: "/provider/manage-booking", icon: Calendar },
      { label: "Orders", href: "/provider/order-status", icon: Package },
      {
        label: "Invoices",
        href: "/provider/invoice-generation",
        icon: FileText,
      },
      {
        label: "Messages",
        href: "/provider/messages",
        icon: MessageSquare,
      },
    ],
  },
  {
    title: "Business",
    items: [{ label: "Reviews", href: "/provider/reviews-manage", icon: Star }],
  },
  {
    title: "Account",
    items: [{ label: "Profile", href: "/provider/profile", icon: Settings }],
  },
];

interface ProviderSidebarProps {
  className?: string;
}

function getComplaintCount(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: unknown[] }).data.length;
  }
  return 0;
}

function buildProviderNavigation(activeDisputes: number): NavGroup[] {
  const cloned = navigation.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }));

  if (activeDisputes <= 0) {
    return cloned;
  }

  if (!cloned[0].items.some((item) => item.href === "/provider/disputes")) {
    const messageIndex = cloned[0].items.findIndex(
      (item) => item.href === "/provider/messages",
    );
    const insertAt = messageIndex >= 0 ? messageIndex : cloned[0].items.length;

    cloned[0].items.splice(insertAt, 0, {
      label: "Disputes",
      href: "/provider/disputes",
      icon: AlertCircle,
      badge: activeDisputes,
    });
  }

  return cloned;
}

export function ProviderSidebar({ className }: ProviderSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeDisputes, setActiveDisputes] = useState(0);

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const res = await fetch("/api/complaints", { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          setActiveDisputes(getComplaintCount(payload));
        }
      } catch (error) {
        reportError("DisputeFetchError", error);
      }
    };

    fetchDisputes();
    const interval = setInterval(fetchDisputes, 30000);
    return () => clearInterval(interval);
  }, []);

  const dynamicNavigation = buildProviderNavigation(activeDisputes);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border/50 bg-background/50 backdrop-blur-xl transition-all duration-300",
        isCollapsed ? "w-20" : "w-72",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-20 items-center justify-between border-b border-border/50 px-6">
        {!isCollapsed && (
          <Link href="/provider" className="flex items-center gap-3 group">
            <div className="relative h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <Image
                src="/laundryease-logo.png"
                alt="LaundryEase logo"
                width={36}
                height={36}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-base leading-none">
                LaundryEase
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-1">
                Provider
              </span>
            </div>
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-muted transition-colors ml-auto"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isCollapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {dynamicNavigation.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.title && !isCollapsed && (
              <h3 className="px-4 mb-3 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                {group.title}
              </h3>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/provider" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 group overflow-hidden",
                        isActive
                          ? "text-primary bg-primary/5"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        isCollapsed && "justify-center px-0 w-12 h-12 mx-auto"
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
                        />
                      )}
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      {!isCollapsed && (
                        <>
                          <span>{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 p-4 bg-muted/20">
        <div
          className={cn(
            "flex items-center gap-2",
            isCollapsed ? "flex-col" : "justify-between"
          )}
        >
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={cn(
              "flex items-center gap-2 rounded-lg p-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors",
              isCollapsed && "mt-2"
            )}
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function ProviderMobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeDisputes, setActiveDisputes] = useState(0);

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const res = await fetch("/api/complaints", { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          setActiveDisputes(getComplaintCount(payload));
        }
      } catch (error) {
        reportError("DisputeFetchError", error);
      }
    };

    fetchDisputes();
    const interval = setInterval(fetchDisputes, 30000);
    return () => clearInterval(interval);
  }, []);

  const dynamicNavigation = buildProviderNavigation(activeDisputes);
  const mobileNavItems = dynamicNavigation[0].items.slice(
    0,
    activeDisputes > 0 ? 5 : 4,
  );

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md px-4">
        <Link href="/provider" className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center">
            <Image
              src="/laundryease-logo.png"
              alt="LaundryEase"
              fill
              className="object-cover"
            />
          </div>
          <span className="font-heading font-semibold text-lg tracking-tight">
            Provider
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-background lg:hidden flex flex-col"
          >
            <div className="flex h-16 items-center justify-between border-b px-4">
              <span className="font-heading font-semibold text-lg">Menu</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-6 space-y-8">
              {dynamicNavigation.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {group.title && (
                    <h3 className="px-2 mb-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {group.title}
                    </h3>
                  )}
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-4 p-3 rounded-xl transition-colors",
                            isActive
                              ? "bg-secondary text-primary font-semibold"
                              : "text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-6 border-t border-border/50">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 w-full p-4 rounded-xl bg-destructive/5 text-destructive font-medium hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/50 bg-background/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                  isActive
                    ? "text-primary scale-105"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("h-5 w-5", isActive && "fill-current/20")}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
