"use client";

import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

import {
  LayoutDashboard,
  AlertTriangle,
  CreditCard,
  Users,
  Menu,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/client-error";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

const baseNavigation: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Operations",
    items: [
      { label: "Complaints", href: "/admin/complaints", icon: AlertTriangle },
      {
        label: "Payments",
        href: "/admin/payment-management",
        icon: CreditCard,
      },
      {
        label: "Users",
        href: "/admin/user-management",
        icon: Users,
      },
    ],
  },
];

interface AdminSidebarProps {
  className?: string;
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeComplaintsCount, setActiveComplaintsCount] = useState(0);

  useEffect(() => {
    const fetchActiveComplaints = async () => {
      try {
        const res = await fetch("/api/admin/complaints");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            // Count only active complaints (open, accepted, in_review)
            const activeCount = data.filter(
              (c: { status: string }) =>
                c.status === "open" ||
                c.status === "accepted" ||
                c.status === "in_review",
            ).length;
            setActiveComplaintsCount(activeCount);
          }
        }
      } catch (error) {
        reportError("ComplaintFetchError", error);
      }
    };
    fetchActiveComplaints();
  }, []);

  // Build dynamic navigation with badge
  const navigation: NavGroup[] = baseNavigation.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.href === "/admin/complaints" && activeComplaintsCount > 0) {
        return { ...item, badge: activeComplaintsCount };
      }
      return item;
    }),
  }));

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border/40 bg-card/60 backdrop-blur-xl transition-all duration-300 relative z-20",
        isCollapsed ? "w-20" : "w-72",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-border/40">
        {!isCollapsed && (
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow">
              <Image
                src="/laundryease-logo.png"
                alt="LaundryEase"
                width={36}
                height={36}
                sizes="36px"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-foreground tracking-tight leading-none">
                LaundryEase
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                Admin Panel
              </span>
            </div>
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-2 rounded-xl hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200",
            isCollapsed ? "mx-auto" : "",
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn(
              "h-5 w-5 transition-transform duration-300",
              isCollapsed && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
        {navigation.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.title && !isCollapsed && (
              <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">
                {group.title}
              </h3>
            )}
            <ul className="space-y-1.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        isCollapsed && "justify-center px-0 py-3",
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full" />
                      )}

                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          isActive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm shadow-rose-500/20">
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
      <div className="p-4 border-t border-border/40 bg-muted/20">
        {!isCollapsed && (
          <div className="mb-4">
            <div className="flex items-center justify-between rounded-xl bg-background/50 border border-border/50 p-2 shadow-sm">
              <div className="flex items-center gap-2 px-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-muted-foreground">
                  System Online
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 transition-all duration-200 w-full group",
            isCollapsed && "justify-center px-0",
          )}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0 group-hover:scale-110 transition-transform" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeComplaintsCount, setActiveComplaintsCount] = useState(0);

  useEffect(() => {
    const fetchActiveComplaints = async () => {
      try {
        const res = await fetch("/api/admin/complaints");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const activeCount = data.filter(
              (c: { status: string }) =>
                c.status === "open" ||
                c.status === "accepted" ||
                c.status === "in_review",
            ).length;
            setActiveComplaintsCount(activeCount);
          }
        }
      } catch (error) {
        reportError("ComplaintFetchError", error);
      }
    };
    fetchActiveComplaints();
  }, []);

  // Build dynamic navigation with badge
  const navigation: NavGroup[] = baseNavigation.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.href === "/admin/complaints" && activeComplaintsCount > 0) {
        return { ...item, badge: activeComplaintsCount };
      }
      return item;
    }),
  }));

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg shadow-md">
            <Image
              src="/laundryease-logo.png"
              alt="LaundryEase"
              width={32}
              height={32}
              sizes="32px"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-bold text-foreground tracking-tight">
            LaundryEase Admin
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide Menu */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 right-0 z-50 w-72 bg-card border-l border-border/50 shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex h-16 items-center justify-between border-b border-border/50 px-6 bg-muted/10">
              <span className="font-semibold text-lg">Menu</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-6 space-y-8">
              {navigation.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {group.title && (
                    <h3 className="px-2 mb-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">
                      {group.title}
                    </h3>
                  )}
                  <ul className="space-y-2">
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/admin" &&
                          pathname.startsWith(item.href));
                      const Icon = item.icon;

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                              isActive
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                isActive && "text-emerald-600",
                              )}
                            />
                            <span>{item.label}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="border-t border-border/50 p-6 bg-muted/10 mt-auto">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors w-full bg-background border border-border/50 shadow-sm"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
