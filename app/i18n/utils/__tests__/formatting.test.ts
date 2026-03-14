import { describe, expect, it } from "vitest";
import {
  formatDimensions,
  defaultCellDimensions,
  detectUnitSystem,
} from "../formatting";

describe("formatDimensions", () => {
  it("formats square imperial dimensions with unit symbol", () => {
    expect(formatDimensions({ width: 1, depth: 1, unit: "feet" })).toBe(
      "1 ft × 1 ft",
    );
  });

  it("formats square metric cm dimensions", () => {
    expect(formatDimensions({ width: 30, depth: 30, unit: "cm" })).toBe(
      "30 cm × 30 cm",
    );
  });

  it("formats non-square dimensions without repeating the unit", () => {
    expect(formatDimensions({ width: 30, depth: 25, unit: "cm" })).toBe(
      "30 × 25 cm",
    );
  });

  it("formats fractional values to one decimal place", () => {
    expect(formatDimensions({ width: 0.5, depth: 0.5, unit: "m" })).toBe(
      "0.5 m × 0.5 m",
    );
  });

  it("uses correct symbol for inches", () => {
    expect(formatDimensions({ width: 12, depth: 12, unit: "inches" })).toBe(
      "12 in × 12 in",
    );
  });
});

describe("defaultCellDimensions", () => {
  it("returns 1ft × 1ft for imperial", () => {
    const dims = defaultCellDimensions("imperial");
    expect(dims).toEqual({ width: 1, depth: 1, unit: "feet" });
  });

  it("returns 30cm × 30cm for metric", () => {
    const dims = defaultCellDimensions("metric");
    expect(dims).toEqual({ width: 30, depth: 30, unit: "cm" });
  });
});

describe("detectUnitSystem", () => {
  it("detects imperial for en-US locale", () => {
    expect(detectUnitSystem("en-US")).toBe("imperial");
    expect(detectUnitSystem("en-us")).toBe("imperial");
  });

  it("detects metric for non-US locales", () => {
    expect(detectUnitSystem("en")).toBe("metric");
    expect(detectUnitSystem("nl")).toBe("metric");
    expect(detectUnitSystem("de")).toBe("metric");
    expect(detectUnitSystem("fr-FR")).toBe("metric");
  });

  it("detects metric for en-GB", () => {
    expect(detectUnitSystem("en-GB")).toBe("metric");
  });
});
