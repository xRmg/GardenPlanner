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
import { Sprout, Search } from "lucide-react";

export interface SeedlingFormData {
  plant: Plant;
  seedCount: number;
  location: string;
  plantedDate: string;
  method: "indoor" | "direct-sow";
  status: "germinating" | "growing" | "hardening" | "ready";
}

interface AddSeedlingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plants: Plant[];
  onAdd: (data: SeedlingFormData) => void;
  defaultPlant?: Plant | null;
}

export function AddSeedlingDialog({
  open,
  onOpenChange,
  plants,
  onAdd,
  defaultPlant,
}: AddSeedlingDialogProps) {
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(
    defaultPlant ?? null,
  );
  const [seedCount, setSeedCount] = useState(1);
  const [location, setLocation] = useState("Indoor Tray");
  const [plantedDate, setPlantedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [method, setMethod] = useState<"indoor" | "direct-sow">("indoor");
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPlant(defaultPlant ?? null);
      setSeedCount(
        defaultPlant?.isSeed ? Math.min(10, defaultPlant.amount ?? 1) : 1,
      );
      setLocation("Indoor Tray");
      setPlantedDate(new Date().toISOString().split("T")[0]);
      setMethod("indoor");
      setSearch("");
      setShowPicker(!defaultPlant);
    }
  }, [open, defaultPlant]);

  useEffect(() => {
    if (method === "indoor") setLocation("Indoor Tray");
    else setLocation("Garden Bed");
  }, [method]);

  const filteredPlants = plants.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.variety ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = () => {
    if (!selectedPlant) return;
    onAdd({
      plant: selectedPlant,
      seedCount,
      location,
      plantedDate: new Date(plantedDate).toISOString(),
      method,
      status: "germinating",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white/95 backdrop-blur-xl border-white/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
            <Sprout className="w-5 h-5 text-primary" /> Add Seedling Batch
          </DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-wider font-bold text-muted-foreground/60">
            Log a new seedling or direct-sown batch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Plant selector */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 block mb-1.5">
              Plant / Seed *
            </label>
            {!showPicker && selectedPlant ? (
              <button
                onClick={() => setShowPicker(true)}
                className="w-full flex items-center gap-3 p-3 bg-white/80 border border-primary/30 rounded-xl hover:border-primary/60 transition-all shadow-sm"
              >
                <span className="text-2xl">{selectedPlant.icon}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-black text-foreground">
                    {selectedPlant.name}
                  </p>
                  {selectedPlant.variety && (
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">
                      {selectedPlant.variety}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                  Change
                </span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search plants and seeds…"
                    className="w-full pl-9 pr-3 py-2 bg-muted/20 border border-white/30 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                  {filteredPlants.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPlant(p);
                        setShowPicker(false);
                        setSearch("");
                        if (p.isSeed) setSeedCount(Math.min(10, p.amount ?? 1));
                      }}
                      className="flex flex-col items-center gap-1 p-2 bg-white/60 hover:bg-white rounded-lg border border-white/50 hover:border-primary/30 transition-all text-center"
                    >
                      <span className="text-xl">{p.icon}</span>
                      <span className="text-[9px] font-black uppercase leading-tight">
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedPlant && (
            <>
              {/* Method */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 block mb-1.5">
                  Sowing Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["indoor", "direct-sow"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                        method === m
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                          : "bg-white/60 text-muted-foreground border-border/30 hover:border-primary/30"
                      }`}
                    >
                      {m === "indoor" ? "🌱 Indoor Start" : "🌾 Direct Sow"}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground/50 mt-1.5 ml-1 font-medium">
                  {method === "indoor"
                    ? "Seeds started in trays/pots indoors before transplanting out."
                    : "Seeds sown directly into the outdoor growing bed."}
                </p>
              </div>

              {/* Count + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 block mb-1.5">
                    Seed / Plant Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={seedCount}
                    onChange={(e) =>
                      setSeedCount(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full px-3 py-2.5 bg-muted/30 border border-white/20 rounded-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 block mb-1.5">
                    Location
                  </label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Propagator"
                    className="w-full px-3 py-2.5 bg-muted/30 border border-white/20 rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 block mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={plantedDate}
                  onChange={(e) => setPlantedDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted/30 border border-white/20 rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedPlant}
            className="rounded-xl px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-black uppercase tracking-wider text-xs"
          >
            Add Seedling
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
