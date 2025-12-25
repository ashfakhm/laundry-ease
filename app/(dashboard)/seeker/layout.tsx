import { Metadata } from "next";
import { SeekerTopNav } from "@/components/navigation/seeker-topnav";

export const metadata: Metadata = {
  title: "Seeker Dashboard | LaundryEase",
  description: "Find and book top-rated laundry providers near you.",
};

export default function SeekerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header role="banner">
        <SeekerTopNav />
      </header>
      <main
        className="w-full pb-20 md:pb-0"
        role="main"
        aria-label="Seeker main content"
      >
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
