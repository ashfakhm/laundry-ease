"use client";

import { Navbar } from "@/components/ui/navbar";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const seekerLinks = [
    { label: "Search Providers", href: "/seeker" },
    { label: "My Orders", href: "/seeker/view-orders" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Seeker Dashboard" links={seekerLinks} userRole="seeker" />
      <main className="w-full">
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
