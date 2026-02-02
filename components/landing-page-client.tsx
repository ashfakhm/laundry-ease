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
        <section className="relative px-6 py-24 md:py-32 overflow-hidden">
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-left space-y-8"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 backdrop-blur-md border border-primary/10 text-xs font-semibold text-primary tracking-wide uppercase shadow-sm"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Available in India
                </motion.div>

                <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tighter text-foreground leading-[1.1]">
                  Laundry, <br />
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-teal-400">
                    solved.
                  </span>
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed font-light">
                  Doorstep pickup, deadline-guaranteed delivery, and payment
                  only upon satisfaction. The new standard for urban
                  professionals.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <Link href="/signup/seeker" className="w-full sm:w-auto">
                    <button className="group w-full sm:w-auto h-12 px-8 bg-primary text-primary-foreground text-base font-medium rounded-full hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5">
                      Book a Pickup
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Link>
                  <Link href="/signup/provider" className="w-full sm:w-auto">
                    <button className="w-full sm:w-auto h-12 px-8 bg-background border border-border text-foreground text-base font-medium rounded-full hover:bg-secondary/50 transition-all hover:border-primary/50">
                      Become a Provider
                    </button>
                  </Link>
                </div>
              </motion.div>

              {/* Minimalist Abstract Visual */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="relative hidden lg:block h-150 w-full"
              >
                <div className="absolute inset-0 bg-linear-to-br from-primary/20 via-teal-100/10 to-transparent rounded-3xl blur-3xl transform rotate-3" />
                <div className="relative h-full w-full bg-card/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-position-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] mask-[linear-gradient(to_bottom,transparent,black)]" />
                  {/* Abstract UI Representation */}
                  <div className="relative w-3/4 max-w-sm bg-background/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-border/50 p-6 flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b border-border/10 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">
                            Pickup Scheduled
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Today, 2:00 PM
                          </p>
                        </div>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">
                            123 Innovation Dr, Tech City
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Pickup Location
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">
                            Escrow Protected
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Payment held until delivery
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 pt-4 border-t border-border/10 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Estimated Total
                        </p>
                        <p className="text-lg font-bold text-foreground">
                          ₹350.00
                        </p>
                      </div>
                      <div className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-lg shadow-primary/20">
                        View Details
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
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
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
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
