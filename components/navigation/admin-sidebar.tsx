"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  AlertTriangle,
  CreditCard,
  Users,
  ScrollText,
  Menu,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface NavItem {
  label: string;
  href: string;
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
    ],
  },
  {
    title: "Users",
    items: [
      { label: "User Management", href: "/admin/User-Management", icon: Users },
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
            // Count only active complaints (open, under_review)
            const activeCount = data.filter(
              (c: any) => c.status === "open" || c.status === "under_review"
            ).length;
            setActiveComplaintsCount(activeCount);
          }
        }
      } catch (error) {
        console.error("Failed to fetch complaints:", error);
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
        "hidden lg:flex flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
              <Image
                src="/laundryease-logo.png"
                alt="LaundryEase Admin logo"
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
            <span className="font-semibold text-foreground">Admin Panel</span>
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              isCollapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {navigation.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.title && !isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h3>
            )}
            <ul className="space-y-1">
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
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        isCollapsed && "justify-center px-2"
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isActive && "text-violet-600 dark:text-violet-400"
                        )}
                      />
                      {!isCollapsed && (
                        <>
                          <span>{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
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
      <div className="border-t p-3">
        {!isCollapsed && (
          <div className="flex items-center justify-between mb-3 px-3">
            <span className="text-xs text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
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
              (c: any) => c.status === "open" || c.status === "under_review"
            ).length;
            setActiveComplaintsCount(activeCount);
          }
        }
      } catch (error) {
        console.error("Failed to fetch complaints:", error);
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
      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card/95 backdrop-blur-sm px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
            <Image
              src="/laundryease-logo.png"
              alt="LaundryEase Admin"
              fill
              className="object-cover"
            />
          </div>
          <span className="font-semibold text-foreground">Admin</span>
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
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setIsOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 right-0 z-50 w-72 bg-card border-l shadow-xl overflow-y-auto">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <span className="font-semibold">Menu</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-4 space-y-6">
              {navigation.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {group.title && (
                    <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.title}
                    </h3>
                  )}
                  <ul className="space-y-1">
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
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{item.label}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
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
            <div className="border-t p-4 mt-auto">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
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
