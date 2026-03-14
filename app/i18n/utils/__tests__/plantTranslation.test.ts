import { describe, expect, it } from "vitest";

import { applyPlantNameOverrides } from "../../plantNameOverrides";
import {
  formatPlantReferenceList,
  getLocalizedPlantContent,
  getLocalizedPlantReferenceName,
  parseLocalizedPlantReferenceList,
  updatePlantLocalizedContent,
} from "../plantTranslation";

describe("plant relationship translation helpers", () => {
  it("localizes canonical plant references for display", () => {
    expect(getLocalizedPlantReferenceName("potato", "nl")).toBe(
      "Aardappel",
    );
    expect(formatPlantReferenceList(["potato", "cabbage"], "nl")).toBe(
      "Aardappel, Kool",
    );
  });

  it("converts localized relationship names back to canonical values", () => {
    expect(parseLocalizedPlantReferenceList("Aardappel, Kool", "nl")).toEqual(
      ["potato", "cabbage"],
    );
  });

  it("normalizes unknown relationship values to canonical slugs", () => {
    expect(
      parseLocalizedPlantReferenceList("Aardappel, Friendly Mystery", "nl"),
    ).toEqual(["potato", "friendly-mystery"]);
  });

  it("uses runtime-injected overrides for missing locale labels", () => {
    applyPlantNameOverrides("nl", { "heirloom-herb": "Erfkruid" });

    expect(getLocalizedPlantReferenceName("heirloom-herb", "nl")).toBe(
      "Erfkruid",
    );
    expect(formatPlantReferenceList(["heirloom-herb"], "nl")).toBe(
      "Erfkruid",
    );
    expect(parseLocalizedPlantReferenceList("Erfkruid", "nl")).toEqual([
      "heirloom-herb",
    ]);
  });

  it("reads locale-specific prose before falling back to the top-level field", () => {
    expect(
      getLocalizedPlantContent(
        {
          description: "Fallback description.",
          localizedContent: {
            nl: {
              description: "Nederlandse beschrijving.",
            },
          },
        },
        "description",
        "nl",
      ),
    ).toBe("Nederlandse beschrijving.");

    expect(
      getLocalizedPlantContent(
        {
          description: "Fallback description.",
        },
        "description",
        "en",
      ),
    ).toBe("Fallback description.");
  });

  it("can persist locale-specific prose fields and explicit blanks", () => {
    const updatedPlant = updatePlantLocalizedContent(
      {
        description: "Fallback description.",
      },
      "nl-NL",
      {
        description: "Nederlandse beschrijving.",
        watering: "",
      },
      ["description", "watering"],
    );

    expect(updatedPlant.localizedContent).toEqual({
      nl: {
        description: "Nederlandse beschrijving.",
        watering: null,
      },
    });
    expect(getLocalizedPlantContent(updatedPlant, "watering", "nl")).toBe(
      undefined,
    );
  });
});