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
    image: `${APP_URL}/og-image.png`,
    publisher: {
      "@type": "Organization",
      name: "LaundryEase",
      url: APP_URL,
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/icon.svg`,
      },
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${APP_URL}/seeker/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
