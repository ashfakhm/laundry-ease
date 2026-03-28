import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetDb, mockGeocodeLocationText } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockGeocodeLocationText: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/geocoding", () => ({
  geocodeLocationText: mockGeocodeLocationText,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from "./route";

type ProvidersCollectionMock = {
  aggregate: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
};

function createProvidersCollectionMock() {
  const aggregateToArray = vi.fn();
  const aggregate = vi.fn(() => ({
    toArray: aggregateToArray,
  }));

  const findToArray = vi.fn();
  const limit = vi.fn(() => ({ toArray: findToArray }));
  const project = vi.fn(() => ({ limit }));
  const find = vi.fn(() => ({ project }));

  const providersCollection: ProvidersCollectionMock = {
    aggregate,
    find,
  };

  return {
    providersCollection,
    aggregateToArray,
    findToArray,
  };
}

function mockDbWithProvidersCollection(
  providersCollection: ProvidersCollectionMock,
) {
  mockGetDb.mockResolvedValue({
    db: {
      collection: vi.fn((name: string) => {
        if (name === "providers") return providersCollection;
        throw new Error(`Unexpected collection: ${name}`);
      }),
    },
  });
}

describe("GET /api/providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeocodeLocationText.mockResolvedValue(null);
  });

  it("returns 400 when only one coordinate is provided", async () => {
    const { providersCollection } = createProvidersCollectionMock();
    mockDbWithProvidersCollection(providersCollection);

    const req = new NextRequest("https://laundryease.test/api/providers?lat=10");

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain("Both lat and lng");
  });

  it("returns 400 for invalid coordinate range", async () => {
    const { providersCollection } = createProvidersCollectionMock();
    mockDbWithProvidersCollection(providersCollection);

    const req = new NextRequest(
      "https://laundryease.test/api/providers?lat=99.1&lng=77.5",
    );

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain("Invalid coordinates");
  });

  it("uses geo query and includes provider-radius match stage", async () => {
    const { providersCollection, aggregateToArray, findToArray } =
      createProvidersCollectionMock();
    mockDbWithProvidersCollection(providersCollection);

    aggregateToArray.mockResolvedValue([
      {
        _id: "provider-1",
        name: "Provider One",
        distance_meters: 1200,
        radius_km: 3,
      },
      {
        _id: "provider-2",
        name: "Provider Two",
        distance_meters: 2500,
        radius_km: 5,
      },
    ]);
    findToArray.mockResolvedValue([]);

    const req = new NextRequest(
      "https://laundryease.test/api/providers?lat=10&lng=20&limit=10",
    );

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(providersCollection.aggregate).toHaveBeenCalledTimes(1);
    expect(providersCollection.find).not.toHaveBeenCalled();

    const pipeline = providersCollection.aggregate.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    const hasProviderRadiusMatch = pipeline.some((stage) => {
      const matchStage = stage.$match as
        | { $expr?: { $lte?: unknown[] } }
        | undefined;
      return Array.isArray(matchStage?.$expr?.$lte);
    });
    expect(hasProviderRadiusMatch).toBe(true);

    expect(data.data.providers).toHaveLength(2);
    expect(data.data.providers[0].distance_km).toBeCloseTo(1.2, 4);
    expect(data.data.providers[1].distanceFromSeeker).toBeCloseTo(2.5, 4);
  });

  it("keeps leave-blocked providers visible and annotates availability for the requested deadline", async () => {
    const { providersCollection, findToArray } = createProvidersCollectionMock();
    mockDbWithProvidersCollection(providersCollection);

    findToArray.mockResolvedValue([
      {
        _id: "provider-1",
        name: "Provider One",
        leavePeriods: [
          {
            _id: "leave-1",
            startDate: "2030-06-15",
            endDate: "2030-06-16",
            createdAt: "2030-06-01T00:00:00.000Z",
          },
        ],
      },
    ]);

    const req = new NextRequest(
      "https://laundryease.test/api/providers?deadline=2030-06-15T10:00&limit=10",
    );

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.providers).toHaveLength(1);
    expect(data.data.providers[0].availability).toMatchObject({
      isCurrentlyOnLeave: false,
      isUnavailableForRequestedDeadline: true,
      nextAvailableDate: "2030-06-17",
    });
  });
});
