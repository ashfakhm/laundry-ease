"use client";

import { motion } from "framer-motion";
import React from "react";

export function WorkflowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      className="md:flex items-start gap-8 relative pl-8 md:pl-0 group"
    >
      <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-background border-[3px] border-primary rounded-full z-10 shadow-[0_0_10px_rgba(45,212,191,0.6)] group-hover:scale-125 transition-transform duration-300" />

      <div className="md:w-1/2 md:text-right md:pr-12">
        <span className="text-xs font-bold text-primary tracking-widest uppercase mb-2 block opacity-80">
          Step {number}
        </span>
        <h3 className="font-heading text-2xl font-bold mb-2 group-hover:text-primary transition-colors duration-300">
          {title}
        </h3>
      </div>
      <div className="md:w-1/2 md:pl-12 pb-16 md:pb-0 md:ml-0 pl-8">
        {/* Mobile dot */}
        <div className="md:hidden absolute -left-1.5 top-1 w-3 h-3 bg-background border-[3px] border-primary rounded-full z-10 shadow-[0_0_10px_rgba(45,212,191,0.6)]" />
        <p className="text-muted-foreground leading-relaxed max-w-sm">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
