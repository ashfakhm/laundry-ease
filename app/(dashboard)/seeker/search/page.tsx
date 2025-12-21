"use client";

import { useState } from "react";
import { Search, MapPin, Calendar, Loader2 } from "lucide-react";
import { ProviderSearchResult } from "@/types/provider";
import { ProviderCard } from "@/components/provider-card";
import { toast } from "sonner";

export default function SeekerSearchPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ProviderSearchResult[]>([]);
  // MVP: Manual Coordinates for now because we don't have Geocoding API
  const [lat, setLat] = useState("12.9716"); // Default Bangalore
  const [lng, setLng] = useState("77.5946");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`/api/providers/search?lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data);
      if (data.length === 0) {
        toast.info("No providers found in this area");
      }
    } catch (error) {
      toast.error("Failed to fetch providers");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Find a Laundry Provider
        </h1>
        <p className="mt-2 text-muted-foreground">
          Enter your location to find top-rated providers near you.
        </p>
      </header>

      {/* Search Bar */}
      <section className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude"
              className="w-full h-12 pl-10 rounded-xl border border-input bg-background px-4 focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Longitude"
              className="w-full h-12 pl-10 rounded-xl border border-input bg-background px-4 focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-12 px-8 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            Search
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          * Using manual coordinates for MVP. Default is Bangalore (12.97, 77.59).
        </p>
      </section>

      {/* Results Grid */}
      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((provider) => (
          <ProviderCard key={provider._id} provider={provider} />
        ))}
      </section>
      
      {!isLoading && results.length === 0 && (
         <div className="text-center py-20 text-muted-foreground">
             Enter coordinates to see available providers.
         </div>
      )}
    </main>
  );
}
