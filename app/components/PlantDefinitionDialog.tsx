import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Plant } from "./PlanterGrid";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Loader2, Sparkles } from "lucide-react";
import type { Settings } from "../data/schema";
import { usePlantAILookup } from "../hooks/usePlantAILookup";
import { CONFIDENCE } from "../services/ai/prompts";
import { formatMonthNarrow } from "@/app/i18n/utils/formatting";
import {
  formatPlantReferenceList,
  getLocalizedPlantContent,
  parseLocalizedPlantReferenceList,
  updatePlantLocalizedContent,
  type PlantLocalizedContentField,
} from "../i18n/utils/plantTranslation";

const LOCALIZED_PROSE_FIELDS = [
  "description",
  "watering",
  "growingTips",
] as const satisfies readonly PlantLocalizedContentField[];

interface PlantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (plant: Plant) => void;
  initialPlant?: Plant;
  defaultIsSeed?: boolean;
  /** When provided, the "Ask AI ✨" button is shown for server-configured AI. */
  settings?: Settings;
}

const COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#84cc16", // Lime
  "#22c55e", // Green
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
];

const DEFAULT_ICON = "🌱";

const EMOJI_CATEGORIES = [
  {
    key: "veggies",
    items: [
      { icon: "🍅", labelKey: "tomato" },
      { icon: "🥕", labelKey: "carrot" },
      { icon: "🥬", labelKey: "leafyGreens" },
      { icon: "🥒", labelKey: "cucumber" },
      { icon: "🌶️", labelKey: "chiliPepper" },
      { icon: "🫑", labelKey: "bellPepper" },
      { icon: "🥦", labelKey: "broccoli" },
      { icon: "🧅", labelKey: "onion" },
      { icon: "🥔", labelKey: "potato" },
      { icon: "🍆", labelKey: "eggplant" },
      { icon: "🌽", labelKey: "corn" },
      { icon: "🎃", labelKey: "pumpkin" },
      { icon: "🧄", labelKey: "garlic" },
      { icon: "🫛", labelKey: "peaPod" },
      { icon: "🥜", labelKey: "peanuts" },
      { icon: "🫒", labelKey: "olive" },
    ],
  },
  {
    key: "herbs",
    items: [
      { icon: "🌿", labelKey: "herbs" },
      { icon: "🍃", labelKey: "freshLeaves" },
      { icon: "☘️", labelKey: "shamrock" },
      { icon: "🍀", labelKey: "fourLeafClover" },
      { icon: "🌾", labelKey: "sheafOfRice" },
    ],
  },
  {
    key: "flowers",
    items: [
      { icon: "🌻", labelKey: "sunflower" },
      { icon: "🌼", labelKey: "blossom" },
      { icon: "🌸", labelKey: "cherryBlossom" },
      { icon: "🌺", labelKey: "hibiscus" },
      { icon: "🌷", labelKey: "tulip" },
      { icon: "🌹", labelKey: "rose" },
      { icon: "🏵️", labelKey: "rosette" },
      { icon: "💐", labelKey: "bouquet" },
      { icon: "💮", labelKey: "whiteFlower" },
      { icon: "🪷", labelKey: "lotus" },
      { icon: "🥀", labelKey: "wiltedFlower" },
    ],
  },
  {
    key: "fruits",
    items: [
      { icon: "🍓", labelKey: "strawberry" },
      { icon: "🍒", labelKey: "cherries" },
      { icon: "🍑", labelKey: "peach" },
      { icon: "🍊", labelKey: "orange" },
      { icon: "🍋", labelKey: "lemon" },
      { icon: "🍌", labelKey: "banana" },
      { icon: "🍍", labelKey: "pineapple" },
      { icon: "🥭", labelKey: "mango" },
      { icon: "🍎", labelKey: "apple" },
      { icon: "🍏", labelKey: "greenApple" },
      { icon: "🍐", labelKey: "pear" },
      { icon: "🍉", labelKey: "watermelon" },
      { icon: "🍇", labelKey: "grapes" },
      { icon: "🥝", labelKey: "kiwi" },
      { icon: "🫐", labelKey: "blueberries" },
      { icon: "🍈", labelKey: "melon" },
      { icon: "🥥", labelKey: "coconut" },
    ],
  },
  {
    key: "seedlings",
    items: [
      { icon: "🌱", labelKey: "seedling" },
      { icon: "🪴", labelKey: "pottedPlant" },
      { icon: "🍁", labelKey: "mapleLeaf" },
      { icon: "🍂", labelKey: "fallenLeaves" },
    ],
  },
  {
    key: "trees",
    items: [
      { icon: "🌲", labelKey: "evergreenTree" },
      { icon: "🌳", labelKey: "deciduousTree" },
      { icon: "🌴", labelKey: "palmTree" },
      { icon: "🌵", labelKey: "cactus" },
      { icon: "🎋", labelKey: "bamboo" },
      { icon: "🎍", labelKey: "pineDecoration" },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Confidence badge helper
// ---------------------------------------------------------------------------

function ConfidenceBadge({
  confidence,
  mediumTitle,
  lowTitle,
}: {
  confidence: number | undefined;
  mediumTitle: string;
  lowTitle: string;
}) {
  if (confidence === undefined || confidence >= CONFIDENCE.HIGH) return null;
  if (confidence >= CONFIDENCE.MEDIUM) {
    return (
      <span
        className="text-amber-500 text-[10px] font-bold ml-1"
        title={mediumTitle}
      >
        ⚠
      </span>
    );
  }
  return (
    <span className="text-red-500 text-[10px] font-bold ml-1" title={lowTitle}>
      ⚠⚠
    </span>
  );
}

const DEFAULT_SETTINGS: Settings = {
  location: "",
  growthZone: "Cfb",
  aiProvider: { type: "none" },
  aiModel: "google/gemini-2.0-flash",
  locale: "en",
  profileId: "default",
  isEditMode: false,
};

export function PlantDialog({
  open,
  onOpenChange,
  onSave,
  initialPlant,
  defaultIsSeed = false,
  settings,
}: PlantDialogProps) {
  const { t, i18n } = useTranslation();
  const confidenceBadgeTitles = {
    mediumTitle: t("dialogs.plantDefinitionDialog.aiSuggestionVerifyTitle"),
    lowTitle: t("dialogs.plantDefinitionDialog.lowConfidenceTitle"),
  };

  const getEmojiCategoryLabel = (categoryKey: (typeof EMOJI_CATEGORIES)[number]["key"]) =>
    t(`dialogs.plantDefinitionDialog.emojiCategories.${categoryKey}`);

  const getEmojiLabel = (labelKey: (typeof EMOJI_CATEGORIES)[number]["items"][number]["labelKey"]) =>
    t(`dialogs.plantDefinitionDialog.emojiLabels.${labelKey}`);
  const getLocalizedColorName = (colorValue: string) => {
    switch (colorValue) {
      case "#ef4444":
        return t("dialogs.plantDefinitionDialog.colorNames.red");
      case "#f97316":
        return t("dialogs.plantDefinitionDialog.colorNames.orange");
      case "#f59e0b":
        return t("dialogs.plantDefinitionDialog.colorNames.amber");
      case "#84cc16":
        return t("dialogs.plantDefinitionDialog.colorNames.lime");
      case "#22c55e":
        return t("dialogs.plantDefinitionDialog.colorNames.green");
      case "#10b981":
        return t("dialogs.plantDefinitionDialog.colorNames.emerald");
      case "#06b6d4":
        return t("dialogs.plantDefinitionDialog.colorNames.cyan");
      case "#3b82f6":
        return t("dialogs.plantDefinitionDialog.colorNames.blue");
      case "#8b5cf6":
        return t("dialogs.plantDefinitionDialog.colorNames.violet");
      case "#d946ef":
        return t("dialogs.plantDefinitionDialog.colorNames.fuchsia");
      case "#ec4899":
        return t("dialogs.plantDefinitionDialog.colorNames.pink");
      default:
        return colorValue;
    }
  };
  const monthLabels = useMemo(
    () => Array.from({ length: 12 }, (_, i) => formatMonthNarrow(i + 1)),
    [i18n.language],
  );
  const [name, setName] = useState(initialPlant?.name || "");
  const [latinName, setLatinName] = useState(initialPlant?.latinName || "");
  const [variety, setVariety] = useState(initialPlant?.variety || "");
  const [description, setDescription] = useState(
    getLocalizedPlantContent(initialPlant, "description", i18n.language) || "",
  );
  const [icon, setIcon] = useState(initialPlant?.icon || DEFAULT_ICON);
  const [color, setColor] = useState(initialPlant?.color || COLORS[0]);
  const [daysToHarvest, setDaysToHarvest] = useState(
    initialPlant?.daysToHarvest || 60,
  );
  const [isSeed, setIsSeed] = useState(initialPlant?.isSeed ?? defaultIsSeed);
  const [amount, setAmount] = useState(initialPlant?.amount ?? 10);
  const [infiniteStock, setInfiniteStock] = useState(
    initialPlant?.amount === undefined,
  );
  const [spacingCm, setSpacingCm] = useState(initialPlant?.spacingCm || 30);
  const [frostHardy, setFrostHardy] = useState(
    initialPlant?.frostHardy ?? false,
  );
  const [watering, setWatering] = useState(
    getLocalizedPlantContent(initialPlant, "watering", i18n.language) || "",
  );
  const [growingTips, setGrowingTips] = useState(
    getLocalizedPlantContent(initialPlant, "growingTips", i18n.language) || "",
  );
  const [sowIndoorMonths, setSowIndoorMonths] = useState<number[]>(
    initialPlant?.sowIndoorMonths || [],
  );
  const [sowDirectMonths, setSowDirectMonths] = useState<number[]>(
    initialPlant?.sowDirectMonths || [],
  );
  const [harvestMonths, setHarvestMonths] = useState<number[]>(
    initialPlant?.harvestMonths || [],
  );
  const [sunRequirement, setSunRequirement] = useState<
    "full" | "partial" | "shade"
  >(initialPlant?.sunRequirement || "full");
  const [companions, setCompanions] = useState(
    formatPlantReferenceList(initialPlant?.companions, i18n.language),
  );
  const [antagonists, setAntagonists] = useState(
    formatPlantReferenceList(initialPlant?.antagonists, i18n.language),
  );
  const [nameError, setNameError] = useState("");

  // Track which fields were overridden by the user after an AI fill
  const [userOverrides, setUserOverrides] = useState<Set<string>>(new Set());
  const [localizedProseDirtyFields, setLocalizedProseDirtyFields] = useState<
    Set<PlantLocalizedContentField>
  >(new Set());

  const aiEnabled = settings?.aiProvider.type === "server";
  const {
    aiResult,
    aiLoading,
    aiError,
    handleAiLookup,
    cancelAiLookup,
    clearAiResult,
  } = usePlantAILookup(settings ?? DEFAULT_SETTINGS);

  // Reset form when dialog opens/closes or initialPlant changes
  useEffect(() => {
    if (open) {
      setName(initialPlant?.name || "");
      setLatinName(initialPlant?.latinName || "");
      setVariety(initialPlant?.variety || "");
      setDescription(
        getLocalizedPlantContent(initialPlant, "description", i18n.language) ||
          "",
      );
      setIcon(initialPlant?.icon || DEFAULT_ICON);
      setColor(initialPlant?.color || COLORS[0]);
      setDaysToHarvest(initialPlant?.daysToHarvest || 60);
      setIsSeed(initialPlant?.isSeed ?? defaultIsSeed);
      setInfiniteStock(initialPlant?.amount === undefined);
      setAmount(initialPlant?.amount ?? 10);
      setSpacingCm(initialPlant?.spacingCm || 30);
      setFrostHardy(initialPlant?.frostHardy ?? false);
      setWatering(
        getLocalizedPlantContent(initialPlant, "watering", i18n.language) || "",
      );
      setGrowingTips(
        getLocalizedPlantContent(initialPlant, "growingTips", i18n.language) ||
          "",
      );
      setSowIndoorMonths(initialPlant?.sowIndoorMonths || []);
      setSowDirectMonths(initialPlant?.sowDirectMonths || []);
      setHarvestMonths(initialPlant?.harvestMonths || []);
      setSunRequirement(initialPlant?.sunRequirement || "full");
      setCompanions(
        formatPlantReferenceList(initialPlant?.companions, i18n.language),
      );
      setAntagonists(
        formatPlantReferenceList(initialPlant?.antagonists, i18n.language),
      );
      setUserOverrides(new Set());
      setLocalizedProseDirtyFields(new Set());
      clearAiResult();
    }
  }, [open, initialPlant, defaultIsSeed, clearAiResult, i18n.language]);

  // Apply AI result to form fields (only non-overridden fields)
  useEffect(() => {
    if (!aiResult) return;
    const overrides = userOverrides;
    if (!overrides.has("latinName") && aiResult.latinName)
      setLatinName(aiResult.latinName);
    if (!overrides.has("description") && aiResult.description)
      setDescription(aiResult.description);
    if (!overrides.has("daysToHarvest") && aiResult.daysToHarvest)
      setDaysToHarvest(aiResult.daysToHarvest);
    if (!overrides.has("spacingCm") && aiResult.spacingCm)
      setSpacingCm(aiResult.spacingCm);
    if (!overrides.has("sunRequirement") && aiResult.sunRequirement)
      setSunRequirement(aiResult.sunRequirement);
    if (!overrides.has("watering") && aiResult.watering)
      setWatering(aiResult.watering);
    if (!overrides.has("growingTips") && aiResult.growingTips)
      setGrowingTips(aiResult.growingTips);
    if (!overrides.has("sowIndoorMonths"))
      setSowIndoorMonths(aiResult.sowIndoorMonths ?? []);
    if (!overrides.has("sowDirectMonths"))
      setSowDirectMonths(aiResult.sowDirectMonths ?? []);
    if (!overrides.has("harvestMonths"))
      setHarvestMonths(aiResult.harvestMonths ?? []);
    if (!overrides.has("companions"))
      setCompanions(
        formatPlantReferenceList(aiResult.companions ?? [], i18n.language),
      );
    if (!overrides.has("antagonists"))
      setAntagonists(
        formatPlantReferenceList(aiResult.antagonists ?? [], i18n.language),
      );
    if (!overrides.has("icon") && aiResult.icon) setIcon(aiResult.icon);
    if (!overrides.has("color") && aiResult.color) setColor(aiResult.color);

    setLocalizedProseDirtyFields((prev) => {
      const next = new Set(prev);
      if (!overrides.has("description") && aiResult.description)
        next.add("description");
      if (!overrides.has("watering") && aiResult.watering) next.add("watering");
      if (!overrides.has("growingTips") && aiResult.growingTips)
        next.add("growingTips");
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult, i18n.language, userOverrides]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    name,
    latinName,
    variety,
    description,
    icon,
    color,
    daysToHarvest,
    isSeed,
    amount,
    infiniteStock,
    spacingCm,
    frostHardy,
    watering,
    growingTips,
    sowIndoorMonths,
    sowDirectMonths,
    harvestMonths,
    sunRequirement,
    companions,
    antagonists,
  ]);

  const markOverride = (field: string) => {
    if (aiResult) setUserOverrides((prev) => new Set(prev).add(field));
  };

  const markLocalizedProseDirty = (field: PlantLocalizedContentField) => {
    setLocalizedProseDirtyFields((prev) => new Set(prev).add(field));
  };

  const canLookupWithAi = name.trim().length >= 2;

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(t("dialogs.plantDefinitionDialog.nameError"));
      return;
    }
    setNameError("");
    const parsedCompanions = parseLocalizedPlantReferenceList(
      companions,
      i18n.language,
    );
    const parsedAntagonists = parseLocalizedPlantReferenceList(
      antagonists,
      i18n.language,
    );

    const basePlant: Plant = {
      id: initialPlant?.id || `plant-${Date.now()}`,
      name: name.trim(),
      latinName: latinName.trim() || undefined,
      variety: variety.trim(),
      description: description.trim() || undefined,
      icon,
      color,
      daysToHarvest,
      isSeed,
      amount: infiniteStock ? undefined : amount,
      spacingCm,
      frostHardy,
      watering: watering.trim() || undefined,
      growingTips: growingTips.trim() || undefined,
      sowIndoorMonths: sowIndoorMonths.length ? sowIndoorMonths : undefined,
      sowDirectMonths: sowDirectMonths.length ? sowDirectMonths : undefined,
      harvestMonths: harvestMonths.length ? harvestMonths : undefined,
      sunRequirement,
      source: initialPlant
        ? initialPlant.source === "bundled"
          ? "custom"
          : (initialPlant.source ?? "custom")
        : "custom",
      companions: parsedCompanions.length ? parsedCompanions : undefined,
      antagonists: parsedAntagonists.length ? parsedAntagonists : undefined,
      localizedContent: initialPlant?.localizedContent,
    };

    const proseFieldsToPersist = initialPlant
      ? Array.from(localizedProseDirtyFields)
      : [...LOCALIZED_PROSE_FIELDS];

    onSave(
      updatePlantLocalizedContent(
        basePlant,
        i18n.language,
        { description, watering, growingTips },
        proseFieldsToPersist,
      ),
    );
    onOpenChange(false);
  };

  const confidence = aiResult?.confidence;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-auto bg-white/95 backdrop-blur-xl border-white/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {initialPlant
              ? isSeed
                ? t("dialogs.plantDefinitionDialog.titleEditSeed")
                : t("dialogs.plantDefinitionDialog.titleEditPlant")
              : isSeed
                ? t("dialogs.plantDefinitionDialog.titleAddSeed")
                : t("dialogs.plantDefinitionDialog.titleAddPlant")}
          </DialogTitle>
          <DialogDescription>
            {isSeed
              ? t("dialogs.plantDefinitionDialog.descriptionSeed")
              : t("dialogs.plantDefinitionDialog.descriptionPlant")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seed toggle + stock */}
          <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-2xl border border-white/20">
            <Switch
              id="is-seed"
              checked={isSeed}
              onCheckedChange={setIsSeed}
              className="data-[state=checked]:bg-primary"
            />
            <div className="flex flex-col">
              <Label
                htmlFor="is-seed"
                className="text-sm font-bold text-foreground"
              >
                {t("dialogs.plantDefinitionDialog.seedPacket")}
              </Label>
              <span className="text-sm text-muted-foreground font-medium">
                {t("dialogs.plantDefinitionDialog.seedPacketHint")}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex flex-col items-end gap-1">
                <label
                  htmlFor="plant-amount"
                  className="text-sm font-black text-muted-foreground uppercase tracking-widest block"
                >
                  {isSeed
                    ? t("dialogs.plantDefinitionDialog.seedCount")
                    : t("dialogs.plantDefinitionDialog.quantity")}
                </label>
                <div className="flex items-center gap-2">
                  {infiniteStock ? (
                    <span className="w-20 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center font-black text-emerald-600 text-lg shadow-inner select-none">
                      {t("dialogs.plantDefinitionDialog.unlimitedSwitch")}
                    </span>
                  ) : (
                    <input
                      id="plant-amount"
                      type="number"
                      min={0}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-20 px-3 py-1.5 bg-white/50 border border-white/40 rounded-xl text-center font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                    />
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    <Switch
                      checked={infiniteStock}
                      onCheckedChange={setInfiniteStock}
                      className="data-[state=checked]:bg-emerald-500 scale-75"
                    />
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground/60">
                      {t("dialogs.plantDefinitionDialog.unlimited")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Plant Name + taxonomy + preview */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_5.5rem] gap-4 items-start">
            <div className="space-y-4">
              <label
                htmlFor="plant-name"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                {t("dialogs.plantDefinitionDialog.plantName")}
              </label>
              <input
                id="plant-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError("");
                  if (aiResult) {
                    if (e.target.value.trim() !== aiResult.name) {
                      clearAiResult();
                    } else {
                      markOverride("name");
                    }
                  }
                }}
                placeholder={t("dialogs.plantDefinitionDialog.namePlaceholder")}
                aria-describedby={nameError ? "plant-name-error" : undefined}
                aria-invalid={!!nameError}
                className={`w-full px-4 py-3 bg-muted/30 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner ${nameError ? "border-destructive" : "border-white/20"}`}
              />
              {nameError && (
                <p
                  id="plant-name-error"
                  className="text-destructive text-xs mt-1 ml-1 animate-error-appear"
                >
                  {nameError}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="plant-latin-name"
                    className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
                  >
                    {t("dialogs.plantDefinitionDialog.latinName")}
                    <ConfidenceBadge
                      confidence={confidence?.latinName}
                      {...confidenceBadgeTitles}
                    />
                  </label>
                  <input
                    id="plant-latin-name"
                    type="text"
                    value={latinName}
                    onChange={(e) => {
                      setLatinName(e.target.value);
                      markOverride("latinName");
                    }}
                    placeholder={t(
                      "dialogs.plantDefinitionDialog.latinNamePlaceholder",
                    )}
                    className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner italic"
                  />
                </div>

                <div>
                  <label
                    htmlFor="plant-variety"
                    className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
                  >
                    {t("dialogs.plantDefinitionDialog.variety")}
                  </label>
                  <input
                    id="plant-variety"
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder={t(
                      "dialogs.plantDefinitionDialog.varietyPlaceholder",
                    )}
                    className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-1.5 text-center">
                {t("dialogs.plantDefinitionDialog.icon")}
              </label>
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-14 h-14 flex items-center justify-center text-3xl rounded-xl border shadow-sm mb-1"
                  style={{
                    backgroundColor: `${color}22`,
                    borderColor: `${color}66`,
                  }}
                >
                  {icon}
                </div>
                <span
                  className="h-2.5 w-10 rounded-full border"
                  style={{
                    backgroundColor: color,
                    borderColor: `${color}99`,
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          {/* AI Auto-fill Bar */}
          {aiEnabled && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 rounded-xl border border-primary/20">
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <span className="text-sm text-primary font-medium truncate">
                    {t("dialogs.plantDefinitionDialog.lookingUp", { name })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelAiLookup}
                    className="ml-auto shrink-0"
                  >
                    {t("common.cancel")}
                  </Button>
                </>
              ) : aiResult ? (
                <>
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-primary font-medium">
                    {t("dialogs.plantDefinitionDialog.aiFilledReview")}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {t("dialogs.plantDefinitionDialog.aiCanFill")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canLookupWithAi}
                    onClick={() => handleAiLookup(name, variety)}
                    className="ml-auto shrink-0"
                  >
                    {t("dialogs.plantDefinitionDialog.askAI")}
                  </Button>
                </>
              )}
            </div>
          )}
          {aiError && (
            <p className="text-[11px] text-red-500 -mt-2 px-1">{aiError}</p>
          )}

          {/* Emoji picker - organized by category */}
          <div className="space-y-3 bg-linear-to-b from-muted/10 to-muted/5 p-4 rounded-2xl border border-white/20">
            {EMOJI_CATEGORIES.map(({ key, items }) => (
              <div key={key}>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  {getEmojiCategoryLabel(key)}
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {items.map((item) => (
                    <button
                      key={`${key}-${item.icon}`}
                      type="button"
                      onClick={() => {
                        setIcon(item.icon);
                        markOverride("icon");
                      }}
                      className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-[background-color,transform] hover:bg-white/80 active:scale-95 ${icon === item.icon ? "bg-white shadow-md ring-2 ring-primary/20" : ""}`}
                      title={getEmojiLabel(item.labelKey)}
                      aria-label={t(
                        "dialogs.plantDefinitionDialog.selectIconAriaLabel",
                        {
                          icon: getEmojiLabel(item.labelKey),
                        },
                      )}
                      aria-pressed={icon === item.icon}
                    >
                      {item.icon}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Colour picker */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              {t("dialogs.plantDefinitionDialog.colorIdentity")}
            </label>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    markOverride("color");
                  }}
                  className={`w-8 h-8 rounded-full border-2 transition-[transform,border-color] hover:scale-110 active:scale-90 ${color === c ? "border-primary ring-2 ring-primary/20" : "border-white"}`}
                  style={{ backgroundColor: c }}
                  aria-label={t(
                    color === c
                      ? "dialogs.plantDefinitionDialog.colorAriaLabelSelected"
                      : "dialogs.plantDefinitionDialog.colorAriaLabel",
                    {
                      color: getLocalizedColorName(c),
                    },
                  )}
                  aria-pressed={color === c}
                  title={getLocalizedColorName(c)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("dialogs.plantDefinitionDialog.colorIdentityHint")}
            </p>
          </div>

          {/* Days to Harvest, Spacing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="plant-days-to-harvest"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                {t("dialogs.plantDefinitionDialog.daysToHarvest")}
                <ConfidenceBadge
                  confidence={confidence?.daysToHarvest}
                  {...confidenceBadgeTitles}
                />
              </label>
              <input
                id="plant-days-to-harvest"
                type="number"
                value={daysToHarvest}
                onChange={(e) => {
                  setDaysToHarvest(parseInt(e.target.value) || 0);
                  markOverride("daysToHarvest");
                }}
                className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>
            <div>
              <label
                htmlFor="plant-spacing"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                {t("dialogs.plantDefinitionDialog.spacingCm")}
                <ConfidenceBadge
                  confidence={confidence?.spacingCm}
                  {...confidenceBadgeTitles}
                />
              </label>
              <input
                id="plant-spacing"
                type="number"
                min={1}
                value={spacingCm}
                onChange={(e) => {
                  setSpacingCm(parseInt(e.target.value) || 1);
                  markOverride("spacingCm");
                }}
                className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>
          </div>

          {/* Frost hardy */}
          <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-2xl border border-white/20">
            <Switch
              id="frost-hardy"
              checked={frostHardy}
              onCheckedChange={setFrostHardy}
              className="data-[state=checked]:bg-primary"
            />
            <div className="flex flex-col">
              <Label
                htmlFor="frost-hardy"
                className="text-sm font-bold text-foreground"
              >
                {t("dialogs.plantDefinitionDialog.frostHardy")}
              </Label>
              <span className="text-sm text-muted-foreground font-medium">
                {t("dialogs.plantDefinitionDialog.frostHardyHint")}
              </span>
            </div>
          </div>

          {/* Sun Requirement */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              {t("dialogs.plantDefinitionDialog.sunlight")}
              <ConfidenceBadge
                confidence={confidence?.sunRequirement}
                {...confidenceBadgeTitles}
              />
            </label>
            <div className="flex gap-2">
              {(["full", "partial", "shade"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSunRequirement(opt);
                    markOverride("sunRequirement");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-[color,background-color,border-color] ${
                    sunRequirement === opt
                      ? "bg-primary text-white border-primary shadow-md"
                      : "bg-muted/30 text-muted-foreground border-white/20 hover:bg-white/60"
                  }`}
                >
                  {opt === "full"
                    ? t("dialogs.plantDefinitionDialog.sunFull")
                    : opt === "partial"
                      ? t("dialogs.plantDefinitionDialog.sunPartial")
                      : t("dialogs.plantDefinitionDialog.sunShade")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="plant-watering"
              className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
            >
              {t("dialogs.plantDefinitionDialog.watering")}
              <ConfidenceBadge
                confidence={confidence?.watering}
                {...confidenceBadgeTitles}
              />
            </label>
            <textarea
              id="plant-watering"
              value={watering}
              onChange={(e) => {
                setWatering(e.target.value);
                markOverride("watering");
                markLocalizedProseDirty("watering");
              }}
              placeholder={t(
                "dialogs.plantDefinitionDialog.wateringPlaceholder",
              )}
              className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner min-h-18 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="plant-growing-tips"
              className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
            >
              {t("dialogs.plantDefinitionDialog.growingTips")}
              <ConfidenceBadge
                confidence={confidence?.growingTips}
                {...confidenceBadgeTitles}
              />
            </label>
            <textarea
              id="plant-growing-tips"
              value={growingTips}
              onChange={(e) => {
                setGrowingTips(e.target.value);
                markOverride("growingTips");
                markLocalizedProseDirty("growingTips");
              }}
              placeholder={t(
                "dialogs.plantDefinitionDialog.growingTipsPlaceholder",
              )}
              className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner min-h-24 text-sm"
            />
          </div>

          {/* Sow Indoors */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              {t("dialogs.plantDefinitionDialog.sowIndoors")}
              <ConfidenceBadge
                confidence={confidence?.sowIndoorMonths}
                {...confidenceBadgeTitles}
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {monthLabels.map((m, i) => {
                const month = i + 1;
                const active = sowIndoorMonths.includes(month);
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setSowIndoorMonths((prev) =>
                        active
                          ? prev.filter((x) => x !== month)
                          : [...prev, month],
                      );
                      markOverride("sowIndoorMonths");
                    }}
                    className={`w-8 h-8 rounded-lg text-[10px] font-black border transition-[color,background-color,border-color] ${active ? "bg-green-500 text-white border-green-500 shadow" : "bg-muted/30 text-muted-foreground border-white/20 hover:bg-white/60"}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sow Direct */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              {t("dialogs.plantDefinitionDialog.sowDirect")}
              <ConfidenceBadge
                confidence={confidence?.sowDirectMonths}
                {...confidenceBadgeTitles}
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {monthLabels.map((m, i) => {
                const month = i + 1;
                const active = sowDirectMonths.includes(month);
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setSowDirectMonths((prev) =>
                        active
                          ? prev.filter((x) => x !== month)
                          : [...prev, month],
                      );
                      markOverride("sowDirectMonths");
                    }}
                    className={`w-8 h-8 rounded-lg text-[10px] font-black border transition-[color,background-color,border-color] ${active ? "bg-emerald-600 text-white border-emerald-600 shadow" : "bg-muted/30 text-muted-foreground border-white/20 hover:bg-white/60"}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Harvest Months */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              {t("dialogs.plantDefinitionDialog.harvestMonths")}
              <ConfidenceBadge
                confidence={confidence?.harvestMonths}
                {...confidenceBadgeTitles}
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {monthLabels.map((m, i) => {
                const month = i + 1;
                const active = harvestMonths.includes(month);
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setHarvestMonths((prev) =>
                        active
                          ? prev.filter((x) => x !== month)
                          : [...prev, month],
                      );
                      markOverride("harvestMonths");
                    }}
                    className={`w-8 h-8 rounded-lg text-[10px] font-black border transition-[color,background-color,border-color] ${active ? "bg-amber-500 text-white border-amber-500 shadow" : "bg-muted/30 text-muted-foreground border-white/20 hover:bg-white/60"}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Companions / Antagonists */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="plant-companions"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                {t("dialogs.plantDefinitionDialog.goodWith")}
                <ConfidenceBadge
                  confidence={confidence?.companions}
                  {...confidenceBadgeTitles}
                />
              </label>
              <input
                id="plant-companions"
                type="text"
                value={companions}
                onChange={(e) => {
                  setCompanions(e.target.value);
                  markOverride("companions");
                }}
                placeholder={t(
                  "dialogs.plantDefinitionDialog.goodWithPlaceholder",
                )}
                className="w-full px-3 py-2 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="plant-antagonists"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                {t("dialogs.plantDefinitionDialog.avoidNear")}
                <ConfidenceBadge
                  confidence={confidence?.antagonists}
                  {...confidenceBadgeTitles}
                />
              </label>
              <input
                id="plant-antagonists"
                type="text"
                value={antagonists}
                onChange={(e) => {
                  setAntagonists(e.target.value);
                  markOverride("antagonists");
                }}
                placeholder={t(
                  "dialogs.plantDefinitionDialog.avoidNearPlaceholder",
                )}
                className="w-full px-3 py-2 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="plant-description"
              className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
            >
              {t("dialogs.plantDefinitionDialog.shortDescription")}
              <ConfidenceBadge
                confidence={confidence?.description}
                {...confidenceBadgeTitles}
              />
            </label>
            <textarea
              id="plant-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markOverride("description");
                markLocalizedProseDirty("description");
              }}
              placeholder={t(
                "dialogs.plantDefinitionDialog.descriptionPlaceholder",
              )}
              className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner min-h-20 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl px-8 shadow-lg shadow-primary/20"
          >
            {t("dialogs.plantDefinitionDialog.savePlant")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
