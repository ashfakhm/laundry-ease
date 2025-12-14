import Link from "next/link";
import { Metadata } from "next";
export const metadata: Metadata = {
  title: {
    absolute: "404 Not Found",
  },
  description: "The requested resource was not found.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-3xl font-semibold">Not Found</h2>
      <p className="text-muted-foreground">Could not find requested resource</p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
