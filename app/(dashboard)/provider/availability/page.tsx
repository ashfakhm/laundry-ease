import type { Metadata } from "next";
import { AvailabilityManager } from "@/components/provider/availability-manager";

export const metadata: Metadata = {
  title: "Availability | LaundryEase Provider",
  description: "Manage provider leave periods and booking availability.",
};

export default function ProviderAvailabilityPage() {
  return (
    <main className="min-h-screen bg-background/50 p-6">
      <div className="mx-auto max-w-5xl">
        <AvailabilityManager />
      </div>
    </main>
  );
}
