import { describe, expect, it } from "vitest";
import {
  getAllowedNextStates,
  isValidTransition,
  ORDER_STATUS_TRANSITIONS,
  type OrderProcessStatus,
} from "./status-machine";

describe("order status machine", () => {
  it("exposes deterministic allowed transitions for each state", () => {
    const knownStates = Object.keys(
      ORDER_STATUS_TRANSITIONS,
    ) as OrderProcessStatus[];
    expect(knownStates).toEqual([
      "invoiced",
      "processing",
      "washing",
      "ironing",
      "ready",
      "out_for_delivery",
      "delivered",
    ]);

    expect(getAllowedNextStates("invoiced")).toEqual(["processing"]);
    expect(getAllowedNextStates("processing")).toEqual(["washing", "ready"]);
    expect(getAllowedNextStates("washing")).toEqual(["ironing", "ready"]);
    expect(getAllowedNextStates("ironing")).toEqual(["ready"]);
    expect(getAllowedNextStates("ready")).toEqual(["out_for_delivery"]);
    expect(getAllowedNextStates("out_for_delivery")).toEqual(["delivered"]);
    expect(getAllowedNextStates("delivered")).toEqual([]);
  });

  it("accepts valid transitions", () => {
    expect(
      isValidTransition({ from: "invoiced", to: "processing" }),
    ).toBe(true);
    expect(isValidTransition({ from: "washing", to: "ready" })).toBe(true);
    expect(
      isValidTransition({ from: "out_for_delivery", to: "delivered" }),
    ).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(isValidTransition({ from: "invoiced", to: "ready" })).toBe(false);
    expect(
      isValidTransition({ from: "processing", to: "out_for_delivery" }),
    ).toBe(false);
    expect(isValidTransition({ from: "delivered", to: "washing" })).toBe(false);
  });
});
