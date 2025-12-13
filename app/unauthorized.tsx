import { SignInButton } from "@clerk/nextjs";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Unauthorised Page",
  },
  description: "Please Login To Access LaundryEase.",
};

export default function Unauthorized() {
  return (
    <main>
      <h1>401 - Unauthorized</h1>
      <p>Please log in to access this page.</p>
      <SignInButton />
    </main>
  );
}
