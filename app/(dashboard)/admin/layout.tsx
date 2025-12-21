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
      {/* Mobile Navigation */}
      <AdminMobileNav />

      <div className="flex">
        {/* Desktop Sidebar */}
        <AdminSidebar className="sticky top-0 h-screen" />

        {/* Main Content */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <div className="container mx-auto px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
