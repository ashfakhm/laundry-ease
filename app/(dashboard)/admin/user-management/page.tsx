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
  Trash2,
} from "lucide-react";
import { reportError } from "@/lib/client-error";
import { unwrapApiData } from "@/lib/client-api";
import {
  ConfirmDialog,
  useConfirmDialog,
} from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

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
  const { showConfirm, dialogProps } = useConfirmDialog();
  const { toast } = useToast();

  // Ban dialog state
  const [banDialog, setBanDialog] = useState<{
    isOpen: boolean;
    user: User | null;
    days: string;
    reason: string;
    submitting: boolean;
  }>({ isOpen: false, user: null, days: "7", reason: "", submitting: false });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const data = unwrapApiData<{ users?: User[] }>(payload);
        setUsers(Array.isArray(data?.users) ? data.users : []);
      }
    } catch (error) {
      reportError("UserFetchError", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (filter === "all") return true;
    return u.role === filter;
  });
  const totalUsers = users.length;
  const seekerCount = users.filter((u) => u.role === "seeker").length;
  const providerCount = users.filter((u) => u.role === "provider").length;
  const blockedUsers = users.filter(
    (u) => u.blocked_until && new Date(u.blocked_until) > new Date(),
  ).length;
  const seekerShare =
    totalUsers > 0 ? Math.round((seekerCount / totalUsers) * 100) : 0;
  const providerShare =
    totalUsers > 0 ? Math.round((providerCount / totalUsers) * 100) : 0;

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

  function banUser(user: User) {
    setBanDialog({ isOpen: true, user, days: "7", reason: "", submitting: false });
  }

  async function executeBan() {
    const { user, days, reason } = banDialog;
    if (!user || !days || isNaN(Number(days)) || Number(days) <= 0 || !reason.trim()) return;
    setBanDialog((prev) => ({ ...prev, submitting: true }));
    const until = new Date(
      Date.now() + Number(days) * 24 * 60 * 60 * 1000,
    ).toISOString();
    try {
      const res = await fetch(`/api/admin/users/${user._id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          blocked_until: until, 
          role: user.role,
          reason: reason.trim()
        }),
      });
      if (res.ok) {
        toast({
          title: "User banned",
          description: `${user.name} has been banned for ${days} day(s).`,
          type: "success",
        });
        fetchUsers();
      } else {
        toast({
          title: "Failed to ban user",
          description: "Please try again.",
          type: "error",
        });
      }
    } catch {
      toast({
        title: "Failed to ban user",
        description: "Network error.",
        type: "error",
      });
    } finally {
      setBanDialog({ isOpen: false, user: null, days: "7", reason: "", submitting: false });
    }
  }

  function executeUnban(user: User) {
    showConfirm({
      title: "Unban User",
      message: `Are you sure you want to lift the ban for ${user.name}?`,
      confirmText: "Yes, Unban",
      cancelText: "Cancel",
      variant: "info",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users/${user._id}/unban`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: user.role }),
          });
          if (res.ok) {
            toast({
              title: "User unbanned",
              description: `${user.name}'s ban has been lifted.`,
              type: "success",
            });
            fetchUsers();
          } else {
            toast({
              title: "Failed to unban user",
              description: "Please try again.",
              type: "error",
            });
          }
        } catch {
          toast({
            title: "Failed to unban user",
            description: "Network error.",
            type: "error",
          });
        }
      },
    });
  }

  function deleteUser(user: User) {
    showConfirm({
      title: "Delete User",
      message: `Delete user ${user.name} (${user.email})? This cannot be undone.`,
      confirmText: "Yes, Delete",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users/${user._id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: user.role }),
        });
        if (res.ok) {
          toast({
            title: "User deleted",
            description: `${user.name} has been removed.`,
            type: "success",
          });
          fetchUsers();
        } else {
          toast({
            title: "Failed to delete user",
            description: "Please try again.",
            type: "error",
          });
        }
      },
    });
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Custom confirm dialog — replaces browser confirm() */}
      <ConfirmDialog {...dialogProps} />

      {/* Ban User Dialog — replaces browser prompt() */}
      {banDialog.isOpen && banDialog.user && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() =>
              !banDialog.submitting &&
              setBanDialog({
                isOpen: false,
                user: null,
                days: "7",
                reason: "",
                submitting: false,
              })
            }
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="mb-4 inline-flex rounded-full bg-red-100 p-3 dark:bg-red-900/20">
                <ShieldAlert className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="mb-1 text-lg font-bold">Ban User</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                How many days should{" "}
                <span className="font-semibold text-foreground">
                  {banDialog.user.name}
                </span>{" "}
                be banned?
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Ban Duration (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={banDialog.days}
                onChange={(e) =>
                  setBanDialog((prev) => ({ ...prev, days: e.target.value }))
                }
                disabled={banDialog.submitting}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all mb-4 disabled:opacity-50"
                autoFocus
              />

              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Reason for Ban
              </label>
              <textarea
                value={banDialog.reason}
                onChange={(e) =>
                  setBanDialog((prev) => ({ ...prev, reason: e.target.value }))
                }
                disabled={banDialog.submitting}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all mb-5 disabled:opacity-50 resize-none h-20"
                placeholder="e.g., Policy violation, unpaid fees..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey && !banDialog.submitting) executeBan();
                }}
              />

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() =>
                    setBanDialog({
                      isOpen: false,
                      user: null,
                      days: "7",
                      reason: "",
                      submitting: false,
                    })
                  }
                  disabled={banDialog.submitting}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeBan}
                  disabled={
                    banDialog.submitting ||
                    !banDialog.days ||
                    isNaN(Number(banDialog.days)) ||
                    Number(banDialog.days) <= 0 ||
                    !banDialog.reason.trim()
                  }
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {banDialog.submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Banning...
                    </span>
                  ) : (
                    "Ban User"
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {blockedUsers > 0
                    ? `${blockedUsers} currently blocked`
                    : "No active bans"}
                </p>
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
                <p className="text-2xl font-bold">{seekerCount}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {seekerShare}% of total users
                </p>
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
                <p className="text-2xl font-bold">{providerCount}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {providerShare}% of total users
                </p>
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
                    ? totalUsers
                    : role === "seeker"
                      ? seekerCount
                      : providerCount}
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
              <div className="flex gap-3 mt-auto pt-4 border-t border-border/50">
                {user.blocked_until && new Date(user.blocked_until) > new Date() ? (
                  <button
                    className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-700 px-3 py-2.5 text-sm font-semibold hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:hover:border-emerald-500/50 transition-all duration-200 flex items-center justify-center gap-2 group/btn"
                    onClick={() => executeUnban(user)}
                  >
                    <UserCheck className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                    Unban User
                  </button>
                ) : (
                  <button
                    className="flex-1 rounded-xl border border-red-200 bg-red-50/80 text-red-700 px-3 py-2.5 text-sm font-semibold hover:bg-red-100 hover:border-red-300 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:border-red-500/50 transition-all duration-200 flex items-center justify-center gap-2 group/btn"
                    onClick={() => banUser(user)}
                  >
                    <ShieldAlert className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                    Ban User
                  </button>
                )}
                <button
                  className="flex-1 rounded-xl border border-transparent bg-transparent text-muted-foreground px-3 py-2.5 text-sm font-semibold hover:bg-muted/50 hover:text-foreground hover:border-border/50 dark:hover:bg-slate-800/50 dark:hover:text-slate-200 transition-all duration-200 flex items-center justify-center gap-2 group/btn2"
                  onClick={() => deleteUser(user)}
                >
                  <Trash2 className="w-4 h-4 transition-transform group-hover/btn2:scale-110" />
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
