import { describe, expect, it } from "vitest";
import {
  buildProviderAvailabilitySummary,
  hasOverlappingLeavePeriod,
  normalizeLeaveDateRange,
} from "./provider-availability";

describe("provider availability helpers", () => {
  it("normalizes valid leave ranges and rejects reversed ranges", () => {
    expect(
      normalizeLeaveDateRange({
        startDate: "2030-06-10",
        endDate: "2030-06-12",
      }),
    ).toEqual({
      startDate: "2030-06-10",
      endDate: "2030-06-12",
    });

    expect(() =>
      normalizeLeaveDateRange({
        startDate: "2030-06-12",
        endDate: "2030-06-10",
      }),
    ).toThrow("Leave start date cannot be after end date");
  });

  it("detects inclusive overlapping leave periods", () => {
    const leavePeriods = [
      {
        _id: "leave-1",
        startDate: "2030-06-10",
        endDate: "2030-06-12",
        createdAt: "2030-06-01T00:00:00.000Z",
      },
    ];

    expect(
      hasOverlappingLeavePeriod(leavePeriods, {
        startDate: "2030-06-12",
        endDate: "2030-06-15",
      }),
    ).toBe(true);

    expect(
      hasOverlappingLeavePeriod(leavePeriods, {
        startDate: "2030-06-13",
        endDate: "2030-06-15",
      }),
    ).toBe(false);
  });

  it("marks providers as currently on leave and exposes the next available date", () => {
    const summary = buildProviderAvailabilitySummary(
      {
        leavePeriods: [
          {
            _id: "leave-1",
            startDate: "2030-06-10",
            endDate: "2030-06-12",
            createdAt: "2030-06-01T00:00:00.000Z",
          },
        ],
      },
      {
        now: new Date("2030-06-11T06:00:00+05:30"),
      },
    );

    expect(summary).toEqual({
      isCurrentlyOnLeave: true,
      activeLeaveEndDate: "2030-06-12",
      isUnavailableForRequestedDeadline: false,
      nextAvailableDate: "2030-06-13",
    });
  });

  it("blocks requested deadlines inside leave and skips across back-to-back leave windows", () => {
    const summary = buildProviderAvailabilitySummary(
      {
        leavePeriods: [
          {
            _id: "leave-1",
            startDate: "2030-06-15",
            endDate: "2030-06-16",
            createdAt: "2030-06-01T00:00:00.000Z",
          },
          {
            _id: "leave-2",
            startDate: "2030-06-17",
            endDate: "2030-06-17",
            createdAt: "2030-06-02T00:00:00.000Z",
          },
        ],
      },
      {
        requestedDeadline: "2030-06-15T10:00",
        now: new Date("2030-06-01T10:00:00+05:30"),
      },
    );

    expect(summary.isUnavailableForRequestedDeadline).toBe(true);
    expect(summary.nextAvailableDate).toBe("2030-06-18");
  });
});
