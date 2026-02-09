import { Clock } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50/50">
      <div className="text-center space-y-4">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-20"></div>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 shadow-sm border border-emerald-100">
            <Clock className="h-8 w-8 text-emerald-600 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Syncing Bookings...</h3>
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Fetching latest data from server
            </p>
        </div>
      </div>
    </div>
  );
}
