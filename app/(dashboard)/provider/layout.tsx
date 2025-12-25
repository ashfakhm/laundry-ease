import { Metadata } from "next";
import {
  ProviderSidebar,
  ProviderMobileNav,
} from "@/components/navigation/provider-sidebar";

export const metadata: Metadata = {
  title: "Provider Dashboard | LaundryEase",
  description:
    "Manage bookings, update order status, and grow your laundry business.",
};

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden" role="banner">
        <ProviderMobileNav />
      </header>
      <div className="flex">
        <nav
          className="hidden lg:block"
          aria-label="Provider sidebar navigation"
        >
          <ProviderSidebar className="sticky top-0 h-screen" />
        </nav>
        <main
          className="flex-1 min-w-0 pb-20 lg:pb-0"
          role="main"
          aria-label="Provider main content"
        >
          <div className="container mx-auto px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
