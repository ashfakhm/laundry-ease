import Script from "next/script";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

export default function JsonLd() {
  // SoftwareApplication schema for the main app (more specific than WebApplication)
  const softwareAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LaundryEase",
    url: APP_URL,
    description:
      "LaundryEase connects busy professionals with trusted laundry providers. Doorstep pickup, delivery, and escrow-protected payments.",
    applicationCategory: "LifestyleApplication",
    operatingSystem: ["Web", "Android", "iOS"],
    image: `${APP_URL}/og-image.png`,
    publisher: {
      "@type": "Organization",
      name: "LaundryEase",
      url: APP_URL,
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/icon.svg`,
        width: 512,
        height: 512,
      },
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${APP_URL}/seeker/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.5",
      reviewCount: "1000",
      bestRating: "5",
      worstRating: "1",
    },
    featureList: [
      "Doorstep pickup and delivery",
      "Real-time order tracking",
      "Escrow-protected payments",
      "Verified provider network",
      "24-hour complaint resolution",
    ],
    softwareVersion: "1.0",
    downloadUrl: APP_URL,
  };

  // LocalBusiness schema for service area
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "LaundryEase",
    description:
      "Premium laundry service marketplace connecting customers with verified laundry providers",
    url: APP_URL,
    telephone: "+91-XXXXXXXXXX",
    email: "support@laundryease.in",
    image: `${APP_URL}/og-image.png`,
    priceRange: "$$",
    areaServed: {
      "@type": "Country",
      name: "India",
    },
    serviceType: [
      "Laundry Service",
      "Dry Cleaning",
      "Wash and Fold",
      "Ironing Service",
    ],
  };

  // Service schema for laundry services
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Laundry Service",
    provider: {
      "@type": "Organization",
      name: "LaundryEase",
      url: APP_URL,
    },
    areaServed: {
      "@type": "Country",
      name: "India",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Laundry Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Wash and Fold",
            description:
              "Professional washing and folding service with doorstep pickup and delivery",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Dry Cleaning",
            description:
              "Premium dry cleaning for delicate fabrics and formal wear",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Ironing Service",
            description:
              "Professional pressing and ironing for crisp, wrinkle-free clothes",
          },
        },
      ],
    },
  };

  // Organization schema
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LaundryEase",
    url: APP_URL,
    logo: {
      "@type": "ImageObject",
      url: `${APP_URL}/icon.svg`,
      width: 512,
      height: 512,
    },
    sameAs: [
      // Add social media URLs when available
      // "https://facebook.com/laundryease",
      // "https://twitter.com/laundryease",
      // "https://instagram.com/laundryease",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+91-XXXXXXXXXX",
      contactType: "customer support",
      email: "support@laundryease.in",
      availableLanguage: ["English", "Hindi"],
    },
  };

  // FAQPage schema for common questions
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does LaundryEase work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LaundryEase connects you with verified laundry providers in your area. Simply search for providers, book a pickup, and track your order through our escrow-protected platform. Pay only when your laundry is delivered.",
        },
      },
      {
        "@type": "Question",
        name: "Is my payment secure?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! We use Razorpay for secure payment processing with escrow protection. Your payment is held securely until your laundry is delivered and you confirm receipt with OTP.",
        },
      },
      {
        "@type": "Question",
        name: "What areas do you serve?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "LaundryEase serves major cities across India. Our provider network covers urban and suburban areas. Enter your location to find providers in your service area.",
        },
      },
    ],
  };

  return (
    <>
      <Script
        id="jsonld-webapp"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <Script
        id="jsonld-localbusiness"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd),
        }}
      />
      <Script
        id="jsonld-service"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Script
        id="jsonld-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <Script
        id="jsonld-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
