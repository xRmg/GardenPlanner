import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Plant } from "./PlanterGrid";

interface PlantPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plants: Plant[];
  mode: "transplant" | "direct-sow";
  onSelect: (plant: Plant) => void;
}

export function PlantPickerDialog({
  open,
  onOpenChange,
  plants,
  mode,
  onSelect,
}: PlantPickerDialogProps) {
  const [search, setSearch] = useState("");

  // Filter by mode: direct-sow shows seeds, transplant shows plants
  const filtered = plants
    .filter((p) => (mode === "direct-sow" ? p.isSeed : !p.isSeed))
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.variety ?? "").toLowerCase().includes(search.toLowerCase()),
    );

  const handleSelect = (plant: Plant) => {
    onSelect(plant);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSearch("");
      }}
    >
      <DialogContent className="max-w-lg bg-white/95 backdrop-blur-xl border-white/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight uppercase">
            {mode === "transplant"
              ? "Select Plant to Transplant"
              : "Select Seed to Direct Sow"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              mode === "direct-sow" ? "Search seeds…" : "Search plants…"
            }
            className="w-full px-3 py-2 bg-muted/20 border border-white/30 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
          />

          {filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground/40 text-xs font-black uppercase tracking-widest">
              {mode === "direct-sow"
                ? "No seeds in library. Add them in My Plants & Seeds."
                : "No plants found."}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {filtered.map((plant) => (
                <button
                  key={plant.id}
                  onClick={() => handleSelect(plant)}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white/60 hover:bg-white rounded-xl border border-white/50 hover:border-primary/30 hover:shadow-md transition-all group text-left"
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">
                    {plant.icon}
                  </span>
                  <span className="text-[10px] font-black uppercase text-foreground tracking-tight text-center leading-tight">
                    {plant.name}
                  </span>
                  {plant.variety && (
                    <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                      {plant.variety}
                    </span>
                  )}
                  {plant.isSeed && plant.amount != null && (
                    <span className="text-[8px] font-black text-blue-500 mt-0.5">
                      {plant.amount} seeds
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
