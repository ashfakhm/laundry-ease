import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provider Terms and Conditions",
  description:
    "Terms and conditions for providers using LaundryEase operations, payouts, and platform services.",
};

export default function ProviderTermsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-24 text-foreground">
      <div className="rounded-2xl border border-border bg-background/80 p-6 md:p-8 shadow-xl shadow-primary/5">
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
          Provider Terms and Conditions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: 14 March 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="font-semibold text-base text-foreground">
              1. Eligibility and Accuracy
            </h2>
            <p>
              You confirm that business identity, bank details, operational
              data, and service information submitted to LaundryEase are true,
              current, and lawful.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              2. Service Delivery Standards
            </h2>
            <p>
              You agree to perform accepted bookings on time, maintain garment
              safety, and provide quality consistent with descriptions shown to
              seekers on your profile.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              3. Pricing and Charges
            </h2>
            <p>
              You are responsible for accurate pricing setup and lawful billing.
              Platform fees, payout deductions, and escrow release windows apply
              according to LaundryEase policy.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              4. Payout and Compliance
            </h2>
            <p>
              Payouts are issued to verified payout destinations after policy
              checks. Suspicious activity, fraud flags, or unresolved disputes
              may delay or hold payouts until review is complete.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              5. Customer Data and Conduct
            </h2>
            <p>
              You may use seeker data only to fulfill orders on LaundryEase.
              Misuse of personal data, unsolicited outreach, or abusive conduct
              can result in suspension, penalties, or account closure.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              6. Disputes and Platform Actions
            </h2>
            <p>
              You agree to cooperate with complaint workflows and provide
              evidence when requested.{" "}
              <strong>
                Seekers may only raise complaints within 24 hours after delivery
                of an order. After this period, LaundryEase will not accept new
                complaints, and any further issues must be resolved directly
                between you and the seeker.
              </strong>{" "}
              LaundryEase may issue operational warnings, temporary
              restrictions, or termination for violations.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              7. Damage Claims and Liability Cap
            </h2>
            <p>
              For confirmed damage or loss claims, provider liability through
              the LaundryEase platform is limited to the value of the affected
              order, except where a higher amount is required by applicable law.
              Providers are not liable for indirect or consequential losses
              beyond order value, including sentimental or special-purpose
              claims, unless separately accepted in writing before pickup.
              Providers must document garment condition at pickup where possible
              and cooperate with investigations to determine fair outcomes.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
