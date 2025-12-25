"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, ShieldCheck, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { InteractiveGridPattern } from "@/components/ui/interactive-grid";

export function LandingPageClient() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/10 selection:text-primary overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
              <Image
                src="/laundryease-logo.png"
                alt="LaundryEase logo"
                width={32}
                height={32}
                className="object-cover"
              />
            </div>
            <span className="font-heading font-semibold text-lg tracking-tight">
              LaundryEase
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link
              href="#features"
              className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(45,212,191,0.5)] transition-all duration-300"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(45,212,191,0.5)] transition-all duration-300"
            >
              How it Works
            </Link>
            <Link
              href="#pricing"
              className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(45,212,191,0.5)] transition-all duration-300"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/auth">
              <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/choose-role">
              <button className="h-9 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(45,212,191,0.4)] hover:shadow-[0_0_30px_rgba(45,212,191,0.6)] hover:-translate-y-px">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24 relative">
        {/* Interactive Background */}
        <InteractiveGridPattern />

        {/* Hero Section */}
        <section className="relative px-6 py-20 md:py-32 overflow-hidden pointer-events-none">
          <div className="container mx-auto max-w-5xl relative z-10 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center space-y-8"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground border border-primary/20 text-xs font-medium shadow-[0_0_10px_rgba(45,212,191,0.1)]"
              >
                <span className="flex h-2 w-2 rounded-full bg-primary animate-[pulse_2s_infinite]"></span>
                Available in New York & San Francisco
              </motion.div>

              <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.1] drop-shadow-sm">
                Laundry,{" "}
                <span className="text-primary italic drop-shadow-[0_0_15px_rgba(45,212,191,0.4)]">
                  solved
                </span>{" "}
                <br />for the modern professional.
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Doorstep pickup, deadline-guaranteed delivery, and payment
                only upon satisfaction. Experience the future of laundry with
                our tech-enabled fleet.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/signup/seeker" className="w-full sm:w-auto">
                  <button className="group w-full sm:w-auto h-12 px-8 bg-foreground text-background text-base font-medium rounded-lg hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(255,255,255,0.1)] dark:shadow-[0_4px_14px_0_rgba(0,0,0,0.5)]">
                    Book a Pickup
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/signup/provider" className="w-full sm:w-auto">
                  <button className="w-full sm:w-auto h-12 px-8 bg-background border border-border text-foreground text-base font-medium rounded-lg hover:bg-secondary/50 transition-all hover:border-primary/50">
                    Become a Provider
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Value Props */}
        <section id="features" className="px-6 py-24 relative z-10">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-8"
            >
              <FeatureCard
                icon={
                  <Clock className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                }
                title="Deadline Guaranteed"
                description="Set your exact deadline. If we miss it by a minute, your order is free. Precision logistics at your service."
                delay={0.1}
              />
              <FeatureCard
                icon={
                  <ShieldCheck className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                }
                title="Escrow Protection"
                description="Your payment is held in a secure tech-escrow smart contract until you verify the delivery via OTP."
                delay={0.3}
              />
              <FeatureCard
                icon={
                  <MapPin className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                }
                title="Geofenced Fleet"
                description="Matched with providers strictly within your radius. Real-time tracking and optimized routing."
                delay={0.5}
              />
            </motion.div>
          </div>
        </section>

        {/* Workflow Section */}
        <section
          id="how-it-works"
          className="px-6 py-24 bg-card/30 border-y border-border/50 backdrop-blur-sm"
        >
          <div className="container mx-auto max-w-5xl">
            <div className="mb-16 text-center">
              <h2 className="font-heading text-3xl font-bold mb-4">
                How it works
              </h2>
              <p className="text-muted-foreground">
                Automated workflow from request to delivery.
              </p>
            </div>

            <div className="relative border-l border-primary/20 ml-4 md:ml-0 md:pl-0 space-y-16">
              <WorkflowStep
                number="01"
                title="Book & Schedule"
                description="Find a nearby provider, pick a time slot, and pay a small booking fee to confirm."
              />
              <WorkflowStep
                number="02"
                title="Pickup & Pay"
                description="Provider picks up your laundry, sends you an invoice—approve it and pay securely."
              />
              <WorkflowStep
                number="03"
                title="Track & Receive"
                description="Track your order live. Confirm delivery with OTP, and payment releases to the provider."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-6 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/laundryease-logo.png"
              alt="LaundryEase"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="font-heading font-semibold text-base">
              LaundryEase
            </span>
          </Link>
          <small className="text-sm text-muted-foreground">
            © 2025 LaundryEase Inc. All rights reserved.
          </small>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
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
      className="h-full"
    >
      <SpotlightCard className="h-full p-8 rounded-2xl bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
        <div className="mb-4 p-3 bg-secondary/50 rounded-xl inline-block border border-primary/10">
          {icon}
        </div>
        <h3 className="font-heading text-xl font-bold mb-3 tracking-tight">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </SpotlightCard>
    </motion.div>
  );
}

function WorkflowStep({
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
      className="md:flex items-start gap-8 relative pl-8 md:pl-0"
    >
      <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-background border-[3px] border-primary rounded-full z-10 shadow-[0_0_10px_rgba(45,212,191,0.6)]" />

      <div className="md:w-1/2 md:text-right md:pr-12">
        <span className="text-xs font-bold text-primary tracking-wider uppercase mb-2 block drop-shadow-[0_0_5px_rgba(45,212,191,0.6)]">
          Step {number}
        </span>
        <h3 className="font-heading text-2xl font-bold mb-2">{title}</h3>
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
