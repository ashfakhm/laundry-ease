"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import type { MotionProps } from "framer-motion";

// Motion wrappers for server component pages
export function MotionDiv({
  children,
  className,
  initial,
  animate,
  whileInView,
  viewport,
  transition,
}: {
  children: ReactNode;
  className?: string;
  initial?: MotionProps["initial"];
  animate?: MotionProps["animate"];
  whileInView?: MotionProps["whileInView"];
  viewport?: MotionProps["viewport"];
  transition?: MotionProps["transition"];
}) {
  return (
    <motion.div
      className={className}
      initial={initial}
      animate={animate}
      whileInView={whileInView}
      viewport={viewport}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

// Re-export motion for client components
export { motion, AnimatePresence };

// Landing page specific animations
export function LandingAnimations({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Hero section with animations
export function HeroSection({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="text-center space-y-8"
    >
      {children}
    </motion.div>
  );
}

// Badge animation
export function AnimatedBadge({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground border border-primary/20 text-xs font-medium shadow-[0_0_10px_rgba(45,212,191,0.1)]"
    >
      <span className="flex h-2 w-2 rounded-full bg-primary animate-[pulse_2s_infinite]"></span>
      {children}
    </motion.div>
  );
}

// Feature card animation wrapper
export function FeatureCardWrapper({
  children,
  delay,
}: {
  children: ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

// Workflow step animation wrapper
export function WorkflowStepWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      className="md:flex items-start gap-8 relative pl-8 md:pl-0"
    >
      {children}
    </motion.div>
  );
}

// Features grid animation wrapper
export function FeaturesGridWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="grid md:grid-cols-3 gap-8"
    >
      {children}
    </motion.div>
  );
}
