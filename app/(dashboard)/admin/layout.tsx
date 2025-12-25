import { Metadata } from "next";
import {
  AdminSidebar,
  AdminMobileNav,
} from "@/components/navigation/admin-sidebar";

export const metadata: Metadata = {
  title: "Admin Dashboard | LaundryEase",
  description: "Platform administration and oversight.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden" role="banner">
        <AdminMobileNav />
      </header>
      <div className="flex">
        <nav className="hidden lg:block" aria-label="Admin sidebar navigation">
          <AdminSidebar className="sticky top-0 h-screen" />
        </nav>
        <main
          className="flex-1 min-w-0 pb-20 lg:pb-0"
          role="main"
          aria-label="Admin main content"
        >
          <div className="container mx-auto px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
