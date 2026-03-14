import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seeker Terms and Conditions",
  description:
    "Terms and conditions for seekers using LaundryEase booking, payment, and support services.",
};

export default function SeekerTermsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-24 text-foreground">
      <div className="rounded-2xl border border-border bg-background/80 p-6 md:p-8 shadow-xl shadow-primary/5">
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
          Seeker Terms and Conditions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: 14 March 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="font-semibold text-base text-foreground">
              1. Account Responsibility
            </h2>
            <p>
              You must provide accurate personal, contact, and address
              information and keep it updated so bookings and deliveries can be
              completed correctly.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              2. Booking Commitments
            </h2>
            <p>
              Once a provider accepts your booking, you agree to cooperate with
              pickup and delivery timelines. Cancellations or repeated no-shows
              may result in fees, restrictions, or account action.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              3. Payment and Escrow
            </h2>
            <p>
              Payments are processed through LaundryEase escrow flow. You agree
              to pay applicable charges and authorize release of funds after
              successful service completion or a support resolution.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              4. Fair Use and Conduct
            </h2>
            <p>
              You agree to behave respectfully with providers and platform
              support staff. Fraudulent disputes, abuse, harassment, or misuse
              of offers may lead to suspension or termination.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              5. Complaints and Resolution
            </h2>
            <p>
              If service issues arise, you must raise complaints honestly with
              relevant details and evidence.{" "}
              <strong>
                Complaints must be raised within 24 hours after delivery of your
                order. After this 24-hour window, you will not be able to raise
                a complaint through LaundryEase, and any further issues must be
                resolved directly with the provider.
              </strong>{" "}
              LaundryEase may review both sides and issue a final platform
              decision under policy for complaints submitted within the allowed
              time frame.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              6. Damage, Loss, and Liability Limit
            </h2>
            <p>
              If items are confirmed as damaged or lost during a LaundryEase
              order, we will prioritize a fair remedy through repair,
              re-cleaning, replacement support, refund, or a compensation payout
              based on case facts. At minimum, compensation for eligible claims
              will not be lower than the value charged for the affected service
              line in that order, and may be increased when clear provider
              negligence is established or when required by applicable law.
              Claims for indirect or consequential losses (including sentimental
              or special-purpose value) are excluded unless explicitly accepted
              in writing before pickup. For expensive or special-care garments,
              please declare value and care instructions at booking so stronger
              protection can be assessed.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-foreground">
              7. Policy Changes
            </h2>
            <p>
              LaundryEase may update these terms for legal, operational, or
              product reasons. Continued use of the platform after updates means
              you accept the revised terms.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
