"use client";

import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/ui/app-header";
import { motion } from "framer-motion";
import { User, Store, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

export default function ChooseRole() {
  const router = useRouter();

  function choose(role: "seeker" | "provider") {
    if (role === "seeker") {
      router.push("/signup/seeker");
    } else {
      router.push("/signup/provider");
    }
  }

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-screen pt-24 pb-12 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16 space-y-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 backdrop-blur-md text-secondary-foreground border border-primary/20 text-xs font-medium shadow-[0_0_15px_rgba(45,212,191,0.2)]"
            >
               <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
               Step 1 of 2
            </motion.div>
            
            <div className="mx-auto max-w-3xl">
               <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
                 How do you want to use <br className="hidden md:block"/> 
                 <span className="text-primary italic">LaundryEase?</span>
               </h1>
               {/* Cinematic Text Reveal for Subtitle */}
               <div className="flex justify-center">
                 <TextGenerateEffect 
                    words="Join the network as a customer seeking premium care, or as a verified professional growing your business."
                    className="text-lg md:text-xl text-muted-foreground font-normal max-w-2xl leading-relaxed"
                 />
               </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <RoleCard 
              role="seeker"
              title="I need laundry done"
              description="Book pickups, track processing in real-time, and pay securely via escrow."
              icon={User}
              onClick={() => choose("seeker")}
              features={[
                "Doorstep pickup & delivery",
                "Deadline guaranteed service",
                "Escrow payment protection"
              ]}
              delay={0.2}
            />
            
            <RoleCard 
              role="provider"
              title="I am a laundry provider"
              description="Grow your business with verified orders, automated invoicing, and secure payouts."
              icon={Store}
              onClick={() => choose("provider")}
              features={[
                "Set your own service radius",
                "Automated digital invoices",
                "Guaranteed payouts"
              ]}
              delay={0.4}
            />
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }} // Delay until after cards appear
            className="mt-16 text-center text-sm text-muted-foreground"
          >
            Already have an account?{" "}
            <a href="/auth" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Sign in
            </a>
          </motion.div>
        </div>
      </main>
    </>
  );
}

interface RoleCardProps {
  role: "seeker" | "provider";
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  features: string[];
  delay: number;
}

function RoleCard({ role, title, description, icon: Icon, onClick, features, delay }: RoleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className="h-full"
    >
      <SpotlightCard 
        className="h-full cursor-pointer rounded-3xl bg-card/60 backdrop-blur-md border-primary/10 hover:border-primary/40 transition-all duration-500 group"
        spotlightColor={role === "seeker" ? "rgba(45, 212, 191, 0.15)" : "rgba(16, 185, 129, 0.15)"}
      >
        <div className="p-8 h-full flex flex-col items-start text-left" onClick={onClick}>
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.1)]",
            role === "seeker" 
              ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110" 
              : "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white group-hover:scale-110"
          )}>
            <Icon className="w-7 h-7" />
          </div>

          <h3 className="font-heading text-2xl font-bold mb-3 tracking-tight group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-muted-foreground mb-8 leading-relaxed max-w-sm">
            {description}
          </p>

          <ul className="space-y-4 mb-8 w-full">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                 <CheckCircle2 className={cn(
                   "w-5 h-5 shrink-0 transition-colors",
                   role === "seeker" ? "text-primary/70 group-hover:text-primary" : "text-emerald-500/70 group-hover:text-emerald-500"
                 )} />
                 {feature}
              </li>
            ))}
          </ul>

          <div className={cn(
            "mt-auto flex items-center gap-2 text-sm font-bold transition-all transform group-hover:translate-x-2",
            role === "seeker" ? "text-primary" : "text-emerald-500"
          )}>
            Continue as {role === "seeker" ? "Seeker" : "Provider"}
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
