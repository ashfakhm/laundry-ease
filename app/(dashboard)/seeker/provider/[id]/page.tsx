import { cache } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import ProviderDetailClient, {
  Provider,
  Review,
} from "./provider-detail-client";
import BreadcrumbJsonLd from "@/components/seo/breadcrumb-json-ld";
import { buildProviderPublicAvailability } from "@/lib/services/provider-availability";
import type { Provider as ProviderRecord } from "@/types/users";

type Props = {
  params: Promise<{ id: string }>;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

/**
 * Request-level memoized provider fetch.
 * React.cache deduplicates identical calls within the same request —
 * both generateMetadata and the page component share this single DB hit.
 */
const getCachedProvider = cache(async (id: string) => {
  if (!ObjectId.isValid(id)) return null;
  const { db } = await getDb();
  return db
    .collection<ProviderRecord>("providers")
    .findOne({ _id: new ObjectId(id) });
});

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
    const provider = await getCachedProvider(id);

    if (!provider) {
      return {
        title: "Provider Not Found",
        description:
          "The requested laundry service provider could not be found.",
      };
    }

    const displayName =
      provider.businessName || provider.name || "Laundry Provider";
    const location = provider.location || "LaundryEase";
    const description =
      provider.bio ||
      provider.description ||
      `Professional laundry services by ${displayName}. Book doorstep pickup and delivery with escrow protection.`;
    const services = provider.services?.join(", ") || "Laundry, Dry Cleaning";

    return {
      title: `${displayName} - Laundry Service Provider | ${location}`,
      description: `${description}. Services: ${services}. Starting at ₹${provider.pricing || 0}. Book now with escrow protection.`,
      keywords: [
        "laundry service",
        "dry cleaning",
        location,
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
  try {
    const provider = await getCachedProvider(id);

    if (!provider) {
      return null;
    }

    // Convert ObjectId to string for serialization
    const publicProvider = buildProviderPublicAvailability({
      ...provider,
      _id: provider._id.toString(),
    } as Omit<ProviderRecord, "_id"> & { _id: string });

    return {
      _id: publicProvider._id,
      name: publicProvider.name || publicProvider.businessName || "Provider",
      email: publicProvider.email,
      phone: publicProvider.phone || "",
      location: publicProvider.location || "",
      services: publicProvider.services ?? [],
      pricing: publicProvider.pricing ?? 0,
      radius_km: publicProvider.radius_km,
      free_radius_km: publicProvider.free_radius_km,
      per_km_rate: publicProvider.per_km_rate,
      bio: publicProvider.bio ?? undefined,
      description: publicProvider.description ?? undefined,
      businessName: publicProvider.businessName ?? undefined,
      pricingRates: publicProvider.pricingRates ?? undefined,
      createdAt:
        publicProvider.createdAt instanceof Date
          ? publicProvider.createdAt.toISOString()
          : publicProvider.createdAt,
      profilePicture: publicProvider.profilePicture ?? undefined,
      bannerImage: publicProvider.bannerImage ?? undefined,
      availability: publicProvider.availability,
    };
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
      order_id: review.order_id?.toString(),
      seeker_id: review.seeker_id?.toString(),
      provider_id: review.provider_id?.toString(),
    })) as unknown as Review[];
  } catch {
    return [];
  }
}

export default async function ProviderDetailPage({ params }: Props) {
  const { id } = await params;

  // Parallel fetch — provider and reviews are independent queries
  const [provider, reviews] = await Promise.all([
    getProviderData(id),
    getProviderReviews(id),
  ]);

  if (!provider) {
    notFound();
  }

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
