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
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  );
}
