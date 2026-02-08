"use client";

import { motion } from "framer-motion";
import { Package, Truck, Wallet, Clock, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ProviderDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
     revenue: 0,
     deliveriesDue: 0,
     pendingPickups: 0,
     activeProcessing: 0
  });

  useEffect(() => {
     async function fetchStats() {
        try {
           const res = await fetch("/api/provider/dashboard-stats");
           if (res.ok) {
              const data = await res.json();
              setStats(data);
           }
        } catch (error) {
           console.error("Failed to fetch dashboard stats", error);
        } finally {
           setLoading(false);
        }
     }
     
     if (session) {
        fetchStats();
     }
  }, [session]);

  const statCards = [
    {
       label: "Pending Pickups",
       value: stats.pendingPickups.toString(),
       // trend: "+12.5%", // Removed false trends for now
       // trendUp: true,
       icon: Package,
       description: "New booking requests"
    },
    {
       label: "Deliveries Due",
       value: stats.deliveriesDue.toString(),
       // trend: "-2.4%",
       // trendUp: false,
       icon: Truck,
       description: "Orders ready for dispatch"
    },
    {
       label: "Total Revenue",
       value: `₹${stats.revenue.toLocaleString('en-IN')}`,
       // trend: "+8.2%",
       // trendUp: true,
       icon: Wallet,
       description: "Total earnings to date"
    }
  ];

  if (loading) {
     return (
        <div className="flex min-h-screen items-center justify-center">
           <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
     )
  }

  return (
    <main className="min-h-screen bg-background/50 p-6 space-y-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Provider Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Overview of your business performance.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live · Shop Open
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid gap-6 md:grid-cols-3">
           {statCards.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-3xl border border-border bg-card shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                       <stat.icon className="w-5 h-5" />
                    </div>
                    {/* Trend Indicator (Optional - hidden for now as we don't calculate history yet) */}
                    {/* 
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${stat.trendUp ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                       {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                       {stat.trend}
                    </div> 
                    */}
                 </div>
                 
                 <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <h3 className="font-heading text-3xl font-bold text-foreground">{stat.value}</h3>
                 </div>
                 <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50">
                    {stat.description}
                 </p>
              </motion.div>
           ))}
        </section>

        {/* Two Column Layout */}
        <section className="grid gap-6 md:grid-cols-2">
           {/* Queue */}
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.3 }}
             className="rounded-3xl border border-border bg-card p-6 shadow-sm"
           >
              <div className="mb-6 flex items-center justify-between">
                <div>
                   <h2 className="font-heading text-lg font-bold">Processing Orders</h2>
                   <p className="text-xs text-muted-foreground">Currently being cleaned ({stats.activeProcessing})</p>
                </div>
                <button className="text-xs font-bold text-primary hover:underline">
                  View All
                </button>
              </div>
              
              <div className="flex bg-muted/30 h-[240px] items-center justify-center rounded-2xl border border-dashed border-border text-center p-6">
                <div className="space-y-2">
                   <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                   <p className="text-sm font-medium text-muted-foreground">
                     {stats.activeProcessing > 0 
                        ? `${stats.activeProcessing} orders are currently in processing.` 
                        : "No orders are currently in the washing/ironing stage."}
                   </p>
                </div>
              </div>
           </motion.div>

           {/* Recent Payouts */}
            <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.4 }}
             className="rounded-3xl border border-border bg-card p-6 shadow-sm"
           >
              <div className="mb-6 flex items-center justify-between">
                 <div>
                   <h2 className="font-heading text-lg font-bold">Recent Payouts</h2>
                   <p className="text-xs text-muted-foreground">Latest financial activity</p>
                </div>
                <button className="text-xs font-bold text-primary hover:underline">
                  View History
                </button>
              </div>
              
              <div className="flex bg-muted/30 h-[240px] items-center justify-center rounded-2xl border border-dashed border-border text-center p-6">
                 <div className="space-y-2">
                   <div className="w-16 h-1 bg-muted-foreground/10 rounded-full mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground pt-4">
                     No recent transactions to display.
                   </p>
                </div>
              </div>
           </motion.div>
        </section>
      </div>
    </main>
  );
}
