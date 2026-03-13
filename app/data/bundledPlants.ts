import type { Plant } from "./schema";

export const BUNDLED_PLANTS: Plant[] = [
  {
    id: "tomato",
    name: "Tomato",
    latinName: "Solanum lycopersicum",
    description:
      "Tender fruiting crop that needs warmth, steady feeding, and support for reliable harvests.",
    color: "#ef4444",
    icon: "🍅",
    isSeed: false,
    daysToHarvest: 75,
    spacingCm: 60,
    frostHardy: false,
    frostSensitive: true,
    watering: "Water deeply 2-3 times per week and keep moisture even once fruits begin to set.",
    growingTips:
      "Stake or cage early and remove lower leaves to improve airflow around the base of the plant.",
    companions: ["basil", "carrot", "onion"],
    antagonists: ["fennel", "corn"],
    sowIndoorMonths: [2, 3, 4],
    sowDirectMonths: [5],
    harvestMonths: [7, 8, 9],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "carrot",
    name: "Carrot",
    latinName: "Daucus carota subsp. sativus",
    description:
      "Cool-season root crop that prefers loose soil and steady moisture for straight, sweet roots.",
    color: "#f97316",
    icon: "🥕",
    isSeed: false,
    daysToHarvest: 70,
    spacingCm: 5,
    frostHardy: true,
    frostSensitive: false,
    watering: "Keep the top layer of soil evenly moist until germination, then water whenever soil starts to dry.",
    growingTips:
      "Thin seedlings promptly and avoid fresh manure or stones that can cause forked roots.",
    companions: ["onion", "lettuce", "radish"],
    antagonists: ["dill"],
    sowIndoorMonths: [],
    sowDirectMonths: [3, 4, 5, 6, 7],
    harvestMonths: [6, 7, 8, 9, 10],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "lettuce",
    name: "Lettuce",
    latinName: "Lactuca sativa",
    description:
      "Fast leafy crop for cool weather that can bolt quickly in heat if kept too dry.",
    color: "#84cc16",
    icon: "🥬",
    isSeed: false,
    daysToHarvest: 45,
    spacingCm: 25,
    frostHardy: true,
    frostSensitive: false,
    watering: "Keep soil consistently moist and water more often during warm spells to prevent bitterness.",
    growingTips:
      "Succession sow every few weeks and harvest outer leaves first to keep plants productive longer.",
    companions: ["carrot", "radish", "spring onion"],
    antagonists: [],
    sowIndoorMonths: [2, 3],
    sowDirectMonths: [3, 4, 5, 8, 9],
    harvestMonths: [5, 6, 7, 9, 10],
    sunRequirement: "partial",
    source: "bundled",
  },
  {
    id: "pepper",
    name: "Pepper",
    latinName: "Capsicum annuum",
    description:
      "Warm-season plant that needs steady heat and even watering to set and ripen fruit well.",
    color: "#22c55e",
    icon: "🌶️",
    isSeed: false,
    daysToHarvest: 80,
    spacingCm: 45,
    frostHardy: false,
    frostSensitive: true,
    watering: "Water deeply when the top few centimeters of soil dry out and avoid repeated drought stress.",
    growingTips:
      "Give peppers warm soil, protect them from cold snaps, and support heavy branches once fruit develops.",
    companions: ["basil", "onion", "carrot"],
    antagonists: ["fennel"],
    sowIndoorMonths: [2, 3, 4],
    sowDirectMonths: [],
    harvestMonths: [7, 8, 9],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "broccoli",
    name: "Broccoli",
    latinName: "Brassica oleracea var. italica",
    description:
      "Cool-season brassica that prefers fertile soil, regular moisture, and timely harvest before buds loosen.",
    color: "#16a34a",
    icon: "🥦",
    isSeed: false,
    daysToHarvest: 70,
    spacingCm: 45,
    frostHardy: true,
    frostSensitive: false,
    watering: "Keep soil evenly moist with a deep soak each week, increasing in dry or windy weather.",
    growingTips:
      "Feed well with compost and harvest the main head promptly so side shoots can continue.",
    companions: ["beet", "celery", "onion"],
    antagonists: ["strawberry"],
    sowIndoorMonths: [2, 3, 7],
    sowDirectMonths: [4, 8],
    harvestMonths: [6, 7, 9, 10],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "cucumber",
    name: "Cucumber",
    latinName: "Cucumis sativus",
    description:
      "Vigorous warm-season vine that needs steady moisture and frequent picking for continued production.",
    color: "#10b981",
    icon: "🥒",
    isSeed: false,
    daysToHarvest: 60,
    spacingCm: 30,
    frostHardy: false,
    frostSensitive: true,
    watering: "Water deeply and consistently, especially during flowering and fruit set, to avoid bitterness.",
    growingTips:
      "Trellis when possible for cleaner fruit and harvest often to keep vines productive.",
    companions: ["bean", "lettuce", "radish"],
    antagonists: ["potato", "sage"],
    sowIndoorMonths: [4],
    sowDirectMonths: [5, 6],
    harvestMonths: [7, 8, 9],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "corn",
    name: "Corn",
    latinName: "Zea mays",
    description:
      "Tall, hungry grass crop that performs best in blocks for pollination and appreciates warmth.",
    color: "#f59e0b",
    icon: "🌽",
    isSeed: false,
    daysToHarvest: 90,
    spacingCm: 25,
    frostHardy: false,
    frostSensitive: true,
    watering: "Give a deep weekly watering and avoid letting plants dry out during tasseling and ear fill.",
    growingTips:
      "Plant in blocks rather than single rows to improve pollination and support stems in windy sites.",
    companions: ["bean", "pumpkin", "cucumber"],
    antagonists: ["tomato"],
    sowIndoorMonths: [],
    sowDirectMonths: [4, 5, 6],
    harvestMonths: [8, 9],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "pumpkin",
    name: "Pumpkin",
    latinName: "Cucurbita pepo",
    description:
      "Large sprawling cucurbit that needs rich soil, warmth, and room for vines to run.",
    color: "#fb923c",
    icon: "🎃",
    isSeed: false,
    daysToHarvest: 110,
    spacingCm: 90,
    frostHardy: false,
    frostSensitive: true,
    watering: "Water deeply at the base and keep the root zone mulched so vines do not stall in dry weather.",
    growingTips:
      "Feed generously, keep fruit off wet soil when possible, and cure mature pumpkins before storage.",
    companions: ["corn", "bean"],
    antagonists: ["potato"],
    sowIndoorMonths: [4],
    sowDirectMonths: [5, 6],
    harvestMonths: [9, 10],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "eggplant",
    name: "Eggplant",
    latinName: "Solanum melongena",
    description:
      "Heat-loving fruit crop that needs a long warm season and consistent feeding for reliable yields.",
    color: "#8b5cf6",
    icon: "🍆",
    isSeed: false,
    daysToHarvest: 80,
    spacingCm: 60,
    frostHardy: false,
    frostSensitive: true,
    watering: "Water regularly to keep soil evenly moist, especially once plants start carrying fruit.",
    growingTips:
      "Give eggplants the warmest spot you have and harvest while skins are still glossy.",
    companions: ["bean", "pepper"],
    antagonists: ["fennel"],
    sowIndoorMonths: [2, 3],
    sowDirectMonths: [],
    harvestMonths: [7, 8, 9],
    sunRequirement: "full",
    source: "bundled",
  },
  {
    id: "radish",
    name: "Radish",
    latinName: "Raphanus sativus",
    description:
      "Very fast cool-season root crop that is best grown quickly in moist soil.",
    color: "#ec4899",
    icon: "🌱",
    isSeed: false,
    daysToHarvest: 28,
    spacingCm: 5,
    frostHardy: true,
    frostSensitive: false,
    watering: "Keep soil evenly moist so roots stay tender and do not become woody or split.",
    growingTips:
      "Sow little and often for steady harvests and pull promptly once roots size up.",
    companions: ["carrot", "cucumber", "lettuce"],
    antagonists: [],
    sowIndoorMonths: [],
    sowDirectMonths: [3, 4, 5, 8, 9],
    harvestMonths: [4, 5, 6, 9, 10],
    sunRequirement: "full",
    source: "bundled",
  },
];

function normalizePlantLookupValue(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, "-") ?? "";
}

export function getBundledPlantByMatch(plant: {
  id?: string;
  name?: string;
}): Plant | undefined {
  const targetId = normalizePlantLookupValue(plant.id);
  const targetName = normalizePlantLookupValue(plant.name);

  return BUNDLED_PLANTS.find((candidate) => {
    const candidateId = normalizePlantLookupValue(candidate.id);
    const candidateName = normalizePlantLookupValue(candidate.name);
    return candidateId === targetId || candidateName === targetName;
  });
}