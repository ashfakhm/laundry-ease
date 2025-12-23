"use client";

import { useState, useEffect } from "react";
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
      Date.now() + Number(days) * 24 * 60 * 60 * 1000
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
        `Delete user ${user.name} (${user.email})? This cannot be undone!`
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

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-blue-600">
              <Users className="h-5 w-5" />
              <p className="text-sm font-semibold">Total Users</p>
            </div>
            <p className="mt-2 text-3xl font-bold">{users.length}</p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-emerald-600">
              <UserCheck className="h-5 w-5" />
              <p className="text-sm font-semibold">Seekers</p>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {users.filter((u) => u.role === "seeker").length}
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-purple-600">
              <Store className="h-5 w-5" />
              <p className="text-sm font-semibold">Providers</p>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {users.filter((u) => u.role === "provider").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "all"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            onClick={() => setFilter("seeker")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "seeker"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Seekers ({users.filter((u) => u.role === "seeker").length})
          </button>
          <button
            onClick={() => setFilter("provider")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "provider"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Providers ({users.filter((u) => u.role === "provider").length})
          </button>
        </div>

        {/* Users List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user) => (
            <div
              key={user._id}
              className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      user.role === "provider"
                        ? "bg-purple-100"
                        : "bg-emerald-100"
                    }`}
                  >
                    {user.role === "provider" ? (
                      <Store className="h-6 w-6 text-purple-600" />
                    ) : (
                      <UserCheck className="h-6 w-6 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user.role}
                    </p>
                  </div>
                </div>
                {user.blocked_until &&
                  new Date(user.blocked_until) > new Date() && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      <ShieldAlert className="h-3 w-3" />
                      Blocked
                    </span>
                  )}
              </div>

              {user.businessName && (
                <p className="mt-3 rounded-lg bg-muted px-2 py-1 text-xs font-medium">
                  {user.businessName}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-lg bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold hover:bg-red-200"
                  onClick={() => banUser(user)}
                >
                  Ban
                </button>
                <button
                  className="rounded-lg bg-gray-100 text-gray-700 px-3 py-1 text-xs font-semibold hover:bg-gray-200"
                  onClick={() => deleteUser(user)}
                >
                  Delete
                </button>
              </div>

              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
