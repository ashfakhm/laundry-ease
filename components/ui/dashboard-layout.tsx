
import Link from "next/link";
import { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  navLinks: { href: string; label: string }[];
  title: string;
}

export default function DashboardLayout({
  children,
  navLinks,
  title,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white p-6">
        <h1 className="text-2xl font-bold mb-8">{title}</h1>
        <nav>
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-200">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
