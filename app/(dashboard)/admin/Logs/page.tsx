"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Info,
  Calendar,
  User,
} from "lucide-react";

type Log = {
  _id: string;
  level: "info" | "warning" | "error" | "success";
  action: string;
  message: string;
  user_id?: string;
  user_role?: string;
  user_name?: string;
  metadata?: any;
  createdAt: string;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "info" | "warning" | "error" | "success"
  >("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const response = await fetch("/api/admin/logs");
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.level === filter;
  });

  function getLogIcon(level: string) {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  }

  function getLogBadge(level: string) {
    switch (level) {
      case "error":
        return "bg-red-100 text-red-700";
      case "warning":
        return "bg-amber-100 text-amber-700";
      case "success":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading logs...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">System Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor system activity and events
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-blue-600">
              <Activity className="h-5 w-5" />
              <p className="text-sm font-semibold">Total Events</p>
            </div>
            <p className="mt-2 text-3xl font-bold">{logs.length}</p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-semibold">Errors</p>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {logs.filter((l) => l.level === "error").length}
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-semibold">Warnings</p>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {logs.filter((l) => l.level === "warning").length}
            </p>
          </div>
          <div className="rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-semibold">Success</p>
            </div>
            <p className="mt-2 text-3xl font-bold">
              {logs.filter((l) => l.level === "success").length}
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
            All ({logs.length})
          </button>
          <button
            onClick={() => setFilter("error")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "error"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Errors ({logs.filter((l) => l.level === "error").length})
          </button>
          <button
            onClick={() => setFilter("warning")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "warning"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Warnings ({logs.filter((l) => l.level === "warning").length})
          </button>
          <button
            onClick={() => setFilter("success")}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
              filter === "success"
                ? "bg-emerald-600 text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            Success ({logs.filter((l) => l.level === "success").length})
          </button>
        </div>

        {/* Logs List */}
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div
              key={log._id}
              className="rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getLogIcon(log.level)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getLogBadge(
                            log.level
                          )}`}
                        >
                          {log.level.toUpperCase()}
                        </span>
                        <span className="font-semibold">{log.action}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {log.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {log.user_name && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {log.user_name} ({log.user_role})
                    </div>
                  )}
                  {log.metadata && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        View metadata
                      </summary>
                      <pre className="mt-1 rounded-lg bg-muted p-2 text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
