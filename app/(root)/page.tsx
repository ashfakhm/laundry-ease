import Link from "next/link";
import { SignInButton, SignUpButton, SignOutButton } from "@clerk/nextjs";

const Home = () => {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-semibold mx-auto">
          Welcome To LaundryEase
        </h1>
        <div className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold">
          <SignInButton mode="modal" />
        </div>
        <div className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold">
          <SignUpButton mode="modal" />
        </div>
        <div className="inline-flex items-center justify-center rounded-full border px-6 py-3 font-semibold">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
};

export default Home;
