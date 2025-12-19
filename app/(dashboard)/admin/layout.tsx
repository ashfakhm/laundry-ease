"use client";
import { Navbar } from "@/components/ui/navbar";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const adminLinks = [
    { label: "Dashboard", href: "/admin" },
    { label: "Complaints", href: "/admin/Complaints" },
    { label: "Logs", href: "/admin/Logs" },
    { label: "Payment Management", href: "/admin/payment-management" },
    { label: "User Management", href: "/admin/User-Management" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Admin Dashboard" links={adminLinks} userRole="admin" />
      <main className="w-full">
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
