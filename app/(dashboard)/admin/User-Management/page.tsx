"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Users,
  UserCheck,
  Store,
  ShieldAlert,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";

type User = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "seeker" | "provider";
  createdAt: string;
  blocked_until?: string;
  businessName?: string;
  location?: string;
  profilePicture?: string;
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "seeker" | "provider">("all");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (filter === "all") return true;
    return u.role === filter;
  });

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  async function banUser(user: User) {
    const days = prompt("Ban for how many days? (Enter number)", "7");
    if (!days || isNaN(Number(days))) return;
    const until = new Date(
      Date.now() + Number(days) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const res = await fetch(`/api/admin/users/${user._id}/ban`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked_until: until, role: user.role }),
    });
    if (res.ok) fetchUsers();
    else alert("Failed to ban user");
  }

  async function deleteUser(user: User) {
    if (
      !confirm(
        `Delete user ${user.name} (${user.email})? This cannot be undone!`,
      )
    )
      return;
    const res = await fetch(`/api/admin/users/${user._id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: user.role }),
    });
    if (res.ok) fetchUsers();
    else alert("Failed to delete user");
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage seekers and providers
          </p>
        </div>

        {/* Premium Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card/50 p-6 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Users
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{users.length}</p>
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    +12.5%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/50 p-6 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                <UserCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Seekers
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {users.filter((u) => u.role === "seeker").length}
                  </p>
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    +8%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card/50 p-6 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Store className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Providers
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {users.filter((u) => u.role === "provider").length}
                  </p>
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    +15%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-xl bg-muted p-1 border border-border/50">
            {(["all", "seeker", "provider"] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilter(role)}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
                  filter === role
                    ? "bg-background text-foreground shadow-sm scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {role === "all"
                  ? "All Users"
                  : role === "seeker"
                    ? "Seekers"
                    : "Providers"}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${filter === role ? "bg-muted text-foreground" : "bg-background text-muted-foreground"}`}
                >
                  {role === "all"
                    ? users.length
                    : users.filter((u) => u.role === role).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* User Directory Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user) => (
            <div
              key={user._id}
              className="group relative flex flex-col rounded-3xl border bg-card/60 p-6 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Role Badge */}
              <div className="absolute top-4 right-4">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    user.role === "provider"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  }`}
                >
                  {user.role === "provider" ? "Provider" : "Seeker"}
                </span>
              </div>

              {/* Profile Header */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold shadow-inner overflow-hidden shrink-0 ${
                    user.role === "provider"
                      ? "bg-linear-to-br from-purple-100 to-purple-200 text-purple-700"
                      : "bg-linear-to-br from-emerald-100 to-emerald-200 text-emerald-700"
                  }`}
                >
                  {user.profilePicture ? (
                    <Image
                      src={user.profilePicture}
                      alt={user.businessName || user.name}
                      fill
                      sizes="56px"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-lg text-foreground line-clamp-1 truncate">
                    {user.name}
                  </h3>
                  {user.businessName && (
                    <p className="text-xs font-medium text-muted-foreground line-clamp-1 flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      {user.businessName}
                    </p>
                  )}
                </div>
              </div>

              {/* Info List */}
              <div className="space-y-3 mb-6 flex-1">
                <div className="flex items-center gap-3 text-sm text-muted-foreground p-2 rounded-lg bg-background/50 border border-border/40">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground p-2 rounded-lg bg-background/50 border border-border/40">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-muted-foreground p-2 rounded-lg bg-background/50 border border-border/40">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Block Warning */}
              {user.blocked_until &&
                new Date(user.blocked_until) > new Date() && (
                  <div className="mb-4 rounded-xl bg-red-50 p-3 flex items-start gap-2 border border-red-100 text-red-700">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold">Account Blocked</p>
                      <p>
                        Until{" "}
                        {new Date(user.blocked_until).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

              {/* Action Buttons */}
              {/* Action Buttons */}
              <div className="flex gap-3 mt-auto pt-4 border-t border-border/50">
                <button
                  className="flex-1 rounded-xl border border-red-200 bg-red-50/80 text-red-700 px-3 py-2.5 text-sm font-semibold hover:bg-red-100 hover:border-red-300 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:border-red-500/50 dark:hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.15)] transition-all duration-200 flex items-center justify-center gap-2 group/btn"
                  onClick={() => banUser(user)}
                >
                  <ShieldAlert className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                  Ban User
                </button>
                <button
                  className="flex-1 rounded-xl border border-transparent bg-transparent text-muted-foreground px-3 py-2.5 text-sm font-semibold hover:bg-muted/50 hover:text-foreground hover:border-border/50 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 transition-all duration-200"
                  onClick={() => deleteUser(user)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
