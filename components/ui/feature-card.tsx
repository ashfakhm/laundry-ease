"use client";

import { motion } from "framer-motion";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import React from "react";

export function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -5 }}
      className="h-full"
    >
      <SpotlightCard className="h-full p-8 rounded-2xl bg-card/40 backdrop-blur-md border border-white/10 hover:border-primary/20 transition-all shadow-sm hover:shadow-md group">
        <div className="mb-6 p-4 bg-primary/5 rounded-2xl inline-block border border-primary/10 group-hover:bg-primary/10 transition-colors">
          {icon}
        </div>
        <h3 className="font-heading text-xl font-bold mb-3 tracking-tight text-foreground/90">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </SpotlightCard>
    </motion.div>
  );
}
