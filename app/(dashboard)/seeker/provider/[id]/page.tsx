import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import ProviderDetailClient, {
  Provider,
  Review,
} from "./provider-detail-client";
import BreadcrumbJsonLd from "@/components/seo/breadcrumb-json-ld";

type Props = {
  params: Promise<{ id: string }>;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

/**
 * Generate dynamic metadata for provider profile pages
 * This improves SEO with unique titles, descriptions, and Open Graph tags
 */
export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;

  // Validate provider ID
  if (!ObjectId.isValid(id)) {
    return {
      title: "Provider Not Found",
      description: "The requested laundry service provider could not be found.",
    };
  }

  try {
    const { db } = await getDb();
    const provider = await db.collection("providers").findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          name: 1,
          businessName: 1,
          bio: 1,
          description: 1,
          location: 1,
          services: 1,
          pricing: 1,
          profilePicture: 1,
        },
      },
    );

    if (!provider) {
      return {
        title: "Provider Not Found",
        description:
          "The requested laundry service provider could not be found.",
      };
    }

    const displayName = provider.businessName || provider.name;
    const description =
      provider.bio ||
      provider.description ||
      `Professional laundry services by ${displayName}. Book doorstep pickup and delivery with escrow protection.`;
    const services = provider.services?.join(", ") || "Laundry, Dry Cleaning";

    return {
      title: `${displayName} - Laundry Service Provider | ${provider.location}`,
      description: `${description}. Services: ${services}. Starting at ₹${provider.pricing || 0}. Book now with escrow protection.`,
      keywords: [
        "laundry service",
        "dry cleaning",
        provider.location,
        "doorstep pickup",
        "wash and fold",
        "ironing service",
        displayName,
      ],
      openGraph: {
        type: "profile",
        title: `${displayName} - Professional Laundry Service`,
        description: description,
        url: `${APP_URL}/seeker/provider/${id}`,
        images: provider.profilePicture
          ? [
              {
                url: provider.profilePicture,
                width: 400,
                height: 400,
                alt: `${displayName} profile picture`,
              },
            ]
          : [
              {
                url: `${APP_URL}/og-image.png`,
                width: 1200,
                height: 630,
                alt: "LaundryEase - Premium laundry service marketplace",
              },
            ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${displayName} - Laundry Service`,
        description: description,
        images: provider.profilePicture
          ? [provider.profilePicture]
          : [`${APP_URL}/og-image.png`],
      },
      alternates: {
        canonical: `${APP_URL}/seeker/provider/${id}`,
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: "Provider Profile",
      description: "View laundry service provider details on LaundryEase.",
    };
  }
}

/**
 * Fetch provider data for server component
 */
async function getProviderData(id: string): Promise<Provider | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  try {
    const { db } = await getDb();
    const provider = await db.collection("providers").findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          passwordHash: 0,
          emailVerified: 0,
          phoneVerified: 0,
          bankDetails: 0,
          razorpay_fund_account_id: 0,
          razorpay_contact_id: 0,
        },
      },
    );

    if (!provider) {
      return null;
    }

    // Convert ObjectId to string for serialization
    return {
      ...provider,
      _id: provider._id.toString(),
    } as Provider;
  } catch {
    return null;
  }
}

/**
 * Fetch reviews for provider
 */
async function getProviderReviews(id: string): Promise<Review[]> {
  if (!ObjectId.isValid(id)) {
    return [];
  }

  try {
    const { db } = await getDb();
    const reviews = await db
      .collection("reviews")
      .find({ provider_id: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return reviews.map((review) => ({
      ...review,
      _id: review._id.toString(),
    })) as Review[];
  } catch {
    return [];
  }
}

export default async function ProviderDetailPage({ params }: Props) {
  const { id } = await params;
  const provider = await getProviderData(id);

  if (!provider) {
    notFound();
  }

  const reviews = await getProviderReviews(id);

  // Breadcrumb data for structured data
  const breadcrumbItems = [
    { name: "Home", item: APP_URL },
    { name: "Find Providers", item: `${APP_URL}/seeker/search` },
    {
      name: provider.businessName || provider.name,
      item: `${APP_URL}/seeker/provider/${id}`,
    },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <ProviderDetailClient
        providerId={id}
        initialProvider={provider}
        initialReviews={reviews}
      />
    </>
  );
}
