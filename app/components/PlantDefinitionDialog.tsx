import { useState, useEffect } from "react";
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

const COLOR_NAMES: Record<string, string> = {
  "#ef4444": "Red",
  "#f97316": "Orange",
  "#f59e0b": "Amber",
  "#84cc16": "Lime",
  "#22c55e": "Green",
  "#10b981": "Emerald",
  "#06b6d4": "Cyan",
  "#3b82f6": "Blue",
  "#8b5cf6": "Violet",
  "#d946ef": "Fuchsia",
  "#ec4899": "Pink",
};

const EMOJIS = [
  "🌱",
  "🍅",
  "🥕",
  "🥬",
  "🌶️",
  "🥦",
  "🥒",
  "🌽",
  "🎃",
  "🍆",
  "🍓",
  "🍇",
  "🍉",
  "🍋",
  "🍌",
  "🍍",
  "🥭",
  "🍎",
  "🍐",
  "🍑",
  "🍒",
  "🌻",
  "🌼",
  "🌿",
];

// ---------------------------------------------------------------------------
// Confidence badge helper
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number | undefined }) {
  if (confidence === undefined || confidence >= CONFIDENCE.HIGH) return null;
  if (confidence >= CONFIDENCE.MEDIUM) {
    return (
      <span
        className="text-amber-500 text-[10px] font-bold ml-1"
        title="AI suggestion — please verify"
      >
        ⚠
      </span>
    );
  }
  return (
    <span
      className="text-red-500 text-[10px] font-bold ml-1"
      title="Low confidence — please check carefully"
    >
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
  const [name, setName] = useState(initialPlant?.name || "");
  const [latinName, setLatinName] = useState(initialPlant?.latinName || "");
  const [variety, setVariety] = useState(initialPlant?.variety || "");
  const [description, setDescription] = useState(
    initialPlant?.description || "",
  );
  const [icon, setIcon] = useState(initialPlant?.icon || EMOJIS[0]);
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
  const [watering, setWatering] = useState(initialPlant?.watering || "");
  const [growingTips, setGrowingTips] = useState(
    initialPlant?.growingTips || "",
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
    initialPlant?.companions?.join(", ") || "",
  );
  const [antagonists, setAntagonists] = useState(
    initialPlant?.antagonists?.join(", ") || "",
  );
  const [nameError, setNameError] = useState("");

  // Track which fields were overridden by the user after an AI fill
  const [userOverrides, setUserOverrides] = useState<Set<string>>(new Set());

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
      setDescription(initialPlant?.description || "");
      setIcon(initialPlant?.icon || EMOJIS[0]);
      setColor(initialPlant?.color || COLORS[0]);
      setDaysToHarvest(initialPlant?.daysToHarvest || 60);
      setIsSeed(initialPlant?.isSeed ?? defaultIsSeed);
      setInfiniteStock(initialPlant?.amount === undefined);
      setAmount(initialPlant?.amount ?? 10);
      setSpacingCm(initialPlant?.spacingCm || 30);
      setFrostHardy(initialPlant?.frostHardy ?? false);
      setWatering(initialPlant?.watering || "");
      setGrowingTips(initialPlant?.growingTips || "");
      setSowIndoorMonths(initialPlant?.sowIndoorMonths || []);
      setSowDirectMonths(initialPlant?.sowDirectMonths || []);
      setHarvestMonths(initialPlant?.harvestMonths || []);
      setSunRequirement(initialPlant?.sunRequirement || "full");
      setCompanions(initialPlant?.companions?.join(", ") || "");
      setAntagonists(initialPlant?.antagonists?.join(", ") || "");
      setUserOverrides(new Set());
      clearAiResult();
    }
  }, [open, initialPlant, defaultIsSeed]);

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
      setCompanions((aiResult.companions ?? []).join(", "));
    if (!overrides.has("antagonists"))
      setAntagonists((aiResult.antagonists ?? []).join(", "));
    if (!overrides.has("icon") && aiResult.icon) setIcon(aiResult.icon);
    if (!overrides.has("color") && aiResult.color) setColor(aiResult.color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult, userOverrides]);

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

  const handleSave = () => {
    if (!name.trim()) {
      setNameError("Please enter a plant name");
      return;
    }
    setNameError("");
    const splitTrimmed = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    onSave({
      id: initialPlant?.id || `plant-${Date.now()}`,
      name: name.trim(),
      latinName: latinName.trim() || undefined,
      variety: variety.trim(),
      description: description.trim(),
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
      companions: splitTrimmed(companions).length
        ? splitTrimmed(companions)
        : undefined,
      antagonists: splitTrimmed(antagonists).length
        ? splitTrimmed(antagonists)
        : undefined,
    });
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
                ? "Edit Seed Packet"
                : "Edit Plant Catalog"
              : isSeed
                ? "Add New Seeds"
                : "Add New Plant"}
          </DialogTitle>
          <DialogDescription>
            {isSeed
              ? "Track your seed inventory and varieties."
              : "Define the characteristics of your custom vegetable or herb."}
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
                Seed Packet
              </Label>
              <span className="text-sm text-muted-foreground font-medium">
                Manage inventory for seedlings
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex flex-col items-end gap-1">
                <label
                  htmlFor="plant-amount"
                  className="text-sm font-black text-muted-foreground uppercase tracking-widest block"
                >
                  {isSeed ? "Seed Count" : "Quantity"}
                </label>
                <div className="flex items-center gap-2">
                  {infiniteStock ? (
                    <span className="w-20 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center font-black text-emerald-600 text-lg shadow-inner select-none">
                      ∞
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
                      ∞ Unlimited
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Plant Name + icon preview */}
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <label
                htmlFor="plant-name"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                Plant Name *
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
                placeholder="e.g., Roma Tomato"
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
            </div>
            <div>
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-1.5 text-center">
                Icon
              </label>
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 flex items-center justify-center text-3xl bg-primary/10 rounded-xl border border-primary/20 shadow-sm mb-1">
                  {icon}
                </div>
              </div>
            </div>
          </div>

          {/* AI Auto-fill Bar */}
          {aiEnabled && name.trim().length >= 2 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 rounded-xl border border-primary/20">
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <span className="text-sm text-primary font-medium truncate">
                    Looking up {name}…
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelAiLookup}
                    className="ml-auto shrink-0"
                  >
                    Cancel
                  </Button>
                </>
              ) : aiResult ? (
                <>
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-primary font-medium">
                    AI-filled — review &amp; edit below
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    AI can fill in growing data
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAiLookup(name, variety)}
                    className="ml-auto shrink-0"
                  >
                    Ask AI ✨
                  </Button>
                </>
              )}
            </div>
          )}
          {aiError && (
            <p className="text-[11px] text-red-500 -mt-2 px-1">{aiError}</p>
          )}

          {/* Emoji picker */}
          <div className="grid grid-cols-6 gap-2 bg-muted/20 p-3 rounded-2xl border border-white/20">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setIcon(e);
                  markOverride("icon");
                }}
                className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-[background-color,transform] hover:bg-white/80 active:scale-95 ${icon === e ? "bg-white shadow-md ring-2 ring-primary/20" : ""}`}
                aria-label={`Select ${e} icon`}
                aria-pressed={icon === e}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Colour picker */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Color Identity
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
                  aria-label={`${COLOR_NAMES[c] ?? c} color${color === c ? ", currently selected" : ""}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>

          {/* Latin Name */}
          <div>
            <label
              htmlFor="plant-latin-name"
              className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
            >
              Latin Name
              <ConfidenceBadge confidence={confidence?.latinName} />
            </label>
            <input
              id="plant-latin-name"
              type="text"
              value={latinName}
              onChange={(e) => {
                setLatinName(e.target.value);
                markOverride("latinName");
              }}
              placeholder="e.g., Solanum lycopersicum"
              className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner italic"
            />
          </div>

          {/* Variety, Days to Harvest, Spacing */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="plant-variety"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                Variety
              </label>
              <input
                id="plant-variety"
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="e.g., Heirloom"
                className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>
            <div>
              <label
                htmlFor="plant-days-to-harvest"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                Days to Harvest
                <ConfidenceBadge confidence={confidence?.daysToHarvest} />
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
                Spacing (cm)
                <ConfidenceBadge confidence={confidence?.spacingCm} />
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
                Frost Hardy
              </Label>
              <span className="text-sm text-muted-foreground font-medium">
                Can tolerate light frost
              </span>
            </div>
          </div>

          {/* Sun Requirement */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Sunlight
              <ConfidenceBadge confidence={confidence?.sunRequirement} />
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
                    ? "☀ Full"
                    : opt === "partial"
                      ? "⛅ Partial"
                      : "🌥 Shade"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="plant-watering"
              className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
            >
              Watering
              <ConfidenceBadge confidence={confidence?.watering} />
            </label>
            <textarea
              id="plant-watering"
              value={watering}
              onChange={(e) => {
                setWatering(e.target.value);
                markOverride("watering");
              }}
              placeholder="e.g., Water deeply once or twice a week and keep soil evenly moist"
              className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner min-h-18 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="plant-growing-tips"
              className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
            >
              Growing Tips
              <ConfidenceBadge confidence={confidence?.growingTips} />
            </label>
            <textarea
              id="plant-growing-tips"
              value={growingTips}
              onChange={(e) => {
                setGrowingTips(e.target.value);
                markOverride("growingTips");
              }}
              placeholder="Add practical care notes, pruning guidance, or harvest timing cues"
              className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner min-h-24 text-sm"
            />
          </div>

          {/* Sow Indoors */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Sow Indoors
              <ConfidenceBadge confidence={confidence?.sowIndoorMonths} />
            </label>
            <div className="flex flex-wrap gap-1">
              {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map(
                (m, i) => {
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
                },
              )}
            </div>
          </div>

          {/* Sow Direct */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Sow Direct / Outdoors
              <ConfidenceBadge confidence={confidence?.sowDirectMonths} />
            </label>
            <div className="flex flex-wrap gap-1">
              {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map(
                (m, i) => {
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
                },
              )}
            </div>
          </div>

          {/* Harvest Months */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Harvest Months
              <ConfidenceBadge confidence={confidence?.harvestMonths} />
            </label>
            <div className="flex flex-wrap gap-1">
              {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map(
                (m, i) => {
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
                },
              )}
            </div>
          </div>

          {/* Companions / Antagonists */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="plant-companions"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                Good With
                <ConfidenceBadge confidence={confidence?.companions} />
              </label>
              <input
                id="plant-companions"
                type="text"
                value={companions}
                onChange={(e) => {
                  setCompanions(e.target.value);
                  markOverride("companions");
                }}
                placeholder="basil, carrot, onion"
                className="w-full px-3 py-2 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="plant-antagonists"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                Avoid Near
                <ConfidenceBadge confidence={confidence?.antagonists} />
              </label>
              <input
                id="plant-antagonists"
                type="text"
                value={antagonists}
                onChange={(e) => {
                  setAntagonists(e.target.value);
                  markOverride("antagonists");
                }}
                placeholder="fennel, potato"
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
              Short Description
              <ConfidenceBadge confidence={confidence?.description} />
            </label>
            <textarea
              id="plant-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markOverride("description");
              }}
              placeholder="Tell us about this plant..."
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
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl px-8 shadow-lg shadow-primary/20"
          >
            Save Plant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
