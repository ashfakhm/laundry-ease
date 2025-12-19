"use client";
import { Navbar } from "@/components/ui/navbar";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const providerLinks = [
    { label: "Dashboard", href: "/provider" },
    { label: "Manage Bookings", href: "/provider/Manage-booking" },
    { label: "Order Status", href: "/provider/order-status" },
    { label: "Invoice Generation", href: "/provider/invoice-generation" },
    { label: "Manage Reviews", href: "/provider/Reviews-Manage" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        title="Provider Dashboard"
        links={providerLinks}
        userRole="provider"
      />
      <main className="w-full">
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
