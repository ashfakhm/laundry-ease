import { Package } from "lucide-react";
import Image from "next/image";

interface ProviderHeaderProps {
  provider: {
    name: string;
    businessName?: string;
    profilePicture?: string;
    bannerImage?: string;
  };
}

export function ProviderHeader({ provider }: ProviderHeaderProps) {
  return (
    <div className="relative mb-8">
      {/* Banner Image */}
      <div className="relative h-48 md:h-64 w-full rounded-3xl overflow-hidden bg-linear-to-r from-primary/20 to-purple-600/20 border border-border">
        {provider.bannerImage ? (
          <Image
            src={provider.bannerImage}
            alt={`${provider.businessName || provider.name} banner`}
            fill
            sizes="(max-width: 768px) 100vw, 1024px"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Profile Picture - Overlapping Banner */}
      <div className="absolute -bottom-16 left-6 md:left-8">
        <div className="relative">
          <div className="relative h-32 w-32 rounded-full border-4 border-background bg-card shadow-xl overflow-hidden">
            {provider.profilePicture ? (
              <Image
                src={provider.profilePicture}
                alt={provider.name}
                fill
                sizes="128px"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary">
                {provider.name?.charAt(0) || "P"}
              </div>
            )}
          </div>
          <div 
            className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-emerald-500 border-2 border-background" 
            title="Verified Provider" 
          />
        </div>
      </div>
    </div>
  );
}
