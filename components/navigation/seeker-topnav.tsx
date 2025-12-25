"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Search,
  Calendar,
  Package,
  Menu,
  X,
  LogOut,
  Home,
  User,
  Receipt,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { label: "Find Providers", href: "/seeker", icon: Search },
  { label: "My Bookings", href: "/seeker/bookings", icon: Calendar },
  { label: "Invoices", href: "/seeker/invoices", icon: Receipt },
  { label: "Orders", href: "/seeker/view-orders", icon: Package },
  { label: "Profile", href: "/seeker/profile", icon: User },
];

export function SeekerTopNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeDisputes, setActiveDisputes] = useState(0);

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const res = await fetch("/api/complaints");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setActiveDisputes(data.length);
          }
        }
      } catch (error) {
        console.error("Failed to fetch disputes:", error);
      }
    };
    fetchDisputes();
  }, []);

  const dynamicNavigation = [...navigation];
  if (activeDisputes > 0) {
    if (!dynamicNavigation.find((i) => i.href === "/seeker/disputes")) {
      dynamicNavigation.push({
        label: `Disputes (${activeDisputes})`,
        href: "/seeker/disputes",
        icon: AlertCircle,
      });
    }
  }

  return (
    <>
      {/* Desktop Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/seeker" className="flex items-center gap-2 group">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Image
                  src="/laundryease-logo.png"
                  alt="LaundryEase logo"
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
              <span className="font-heading font-semibold text-lg tracking-tight">
                LaundryEase
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {dynamicNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-sm font-medium transition-colors relative py-1",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -bottom-[21px] left-0 right-0 h-[2px] bg-primary"
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
            >
              Sign Out
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 top-16 z-40 bg-background border-t border-border/50 p-6 md:hidden flex flex-col gap-6"
          >
            <nav className="flex flex-col gap-4">
              {dynamicNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-4 text-lg font-medium p-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border pt-6">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-4 text-destructive font-medium"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer to prevent content overlap */}
      <div className="h-16" />
    </>
  );
}
