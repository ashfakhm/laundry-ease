const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

export default function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "LaundryEase",
    url: APP_URL,
    description:
      "LaundryEase connects busy professionals with trusted laundry providers. Doorstep pickup, delivery, and escrow-protected payments.",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
