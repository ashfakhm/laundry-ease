"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  return (
    <main>
      {/* Here Goes Admin Navbar  or dashboard */}
      <h1>Admin Dashboard Layout</h1>
      <button onClick={handleSignOut}>Sign Out</button>
      {children}
    </main>
  );
};

export default Layout;
