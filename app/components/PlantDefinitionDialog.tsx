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

interface PlantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (plant: Plant) => void;
  initialPlant?: Plant;
  defaultIsSeed?: boolean;
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

export function PlantDialog({
  open,
  onOpenChange,
  onSave,
  initialPlant,
  defaultIsSeed = false,
}: PlantDialogProps) {
  const [name, setName] = useState(initialPlant?.name || "");
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
  const [amount, setAmount] = useState(initialPlant?.amount || 10);
  const [spacingCm, setSpacingCm] = useState(initialPlant?.spacingCm || 30);
  const [frostHardy, setFrostHardy] = useState(
    initialPlant?.frostHardy ?? false,
  );
  const [sowIndoorMonths, setSowIndoorMonths] = useState<number[]>(
    initialPlant?.sowIndoorMonths || [],
  );
  const [sowDirectMonths, setSowDirectMonths] = useState<number[]>(
    initialPlant?.sowDirectMonths || [],
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

  // Update state when initialPlant changes or default values change
  // We can do this with a useEffect or just let the caller handle it by keying the component
  // Better to use useEffect here as Dialogs often persist
  useEffect(() => {
    if (open) {
      setName(initialPlant?.name || "");
      setVariety(initialPlant?.variety || "");
      setDescription(initialPlant?.description || "");
      setIcon(initialPlant?.icon || EMOJIS[0]);
      setColor(initialPlant?.color || COLORS[0]);
      setDaysToHarvest(initialPlant?.daysToHarvest || 60);
      setIsSeed(initialPlant?.isSeed ?? defaultIsSeed);
      setAmount(initialPlant?.amount || 10);
      setSpacingCm(initialPlant?.spacingCm || 30);
      setFrostHardy(initialPlant?.frostHardy ?? false);
      setSowIndoorMonths(initialPlant?.sowIndoorMonths || []);
      setSowDirectMonths(initialPlant?.sowDirectMonths || []);
      setSunRequirement(initialPlant?.sunRequirement || "full");
      setCompanions(initialPlant?.companions?.join(", ") || "");
      setAntagonists(initialPlant?.antagonists?.join(", ") || "");
    }
  }, [open, initialPlant, defaultIsSeed]);

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a plant name");
      return;
    }

    const splitTrimmed = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    onSave({
      id: initialPlant?.id || `plant-${Date.now()}`,
      name: name.trim(),
      variety: variety.trim(),
      description: description.trim(),
      icon,
      color,
      daysToHarvest,
      isSeed,
      amount,
      spacingCm,
      frostHardy,
      sowIndoorMonths: sowIndoorMonths.length ? sowIndoorMonths : undefined,
      sowDirectMonths: sowDirectMonths.length ? sowDirectMonths : undefined,
      sunRequirement,
      companions: splitTrimmed(companions).length
        ? splitTrimmed(companions)
        : undefined,
      antagonists: splitTrimmed(antagonists).length
        ? splitTrimmed(antagonists)
        : undefined,
    });

    onOpenChange(false);
  };

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
              <div className="flex flex-col items-end">
                <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-1">
                  {isSeed ? "Seed Count" : "Quantity"}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 bg-white/50 border border-white/40 rounded-xl text-center font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                Plant Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Roma Tomato"
                className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
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

          <div className="grid grid-cols-6 gap-2 bg-muted/20 p-3 rounded-2xl border border-white/20">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg transition-all hover:bg-white/80 active:scale-95 ${icon === e ? "bg-white shadow-md ring-2 ring-primary/20" : ""}`}
                title="Select icon"
              >
                {e}
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Color Identity
            </label>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-90 ${color === c ? "border-primary ring-2 ring-primary/20" : "border-white"}`}
                  style={{ backgroundColor: c }}
                  title="Select color"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                Variety
              </label>
              <input
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="e.g., Heirloom"
                className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>
            <div>
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                Days to Harvest
              </label>
              <input
                type="number"
                value={daysToHarvest}
                onChange={(e) =>
                  setDaysToHarvest(parseInt(e.target.value) || 0)
                }
                className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>
            <div>
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                Spacing (cm)
              </label>
              <input
                type="number"
                min={1}
                value={spacingCm}
                onChange={(e) => setSpacingCm(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
              />
            </div>
          </div>

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
              Sun Requirement
            </label>
            <div className="flex gap-2">
              {(["full", "partial", "shade"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSunRequirement(opt)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
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

          {/* Sow Indoor Months */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Sow Indoors
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
                      onClick={() =>
                        setSowIndoorMonths((prev) =>
                          active
                            ? prev.filter((x) => x !== month)
                            : [...prev, month],
                        )
                      }
                      className={`w-8 h-8 rounded-lg text-[10px] font-black border transition-all ${
                        active
                          ? "bg-green-500 text-white border-green-500 shadow"
                          : "bg-muted/30 text-muted-foreground border-white/20 hover:bg-white/60"
                      }`}
                    >
                      {m}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Sow Direct Months */}
          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Sow Direct / Outdoors
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
                      onClick={() =>
                        setSowDirectMonths((prev) =>
                          active
                            ? prev.filter((x) => x !== month)
                            : [...prev, month],
                        )
                      }
                      className={`w-8 h-8 rounded-lg text-[10px] font-black border transition-all ${
                        active
                          ? "bg-emerald-600 text-white border-emerald-600 shadow"
                          : "bg-muted/30 text-muted-foreground border-white/20 hover:bg-white/60"
                      }`}
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
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                Good With
              </label>
              <input
                type="text"
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
                placeholder="basil, carrot, onion"
                className="w-full px-3 py-2 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                Avoid Near
              </label>
              <input
                type="text"
                value={antagonists}
                onChange={(e) => setAntagonists(e.target.value)}
                placeholder="fennel, potato"
                className="w-full px-3 py-2 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Short Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about this plant..."
              className="w-full px-4 py-3 bg-muted/30 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-inner min-h-[80px] text-sm"
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
