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
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Plant } from "./PlanterGrid";
import { Sprout } from "lucide-react";

interface SowSeedsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plant: Plant | null;
  onSow: (plant: Plant, seedCount: number, location: string) => void;
}

export function SowSeedsDialog({
  open,
  onOpenChange,
  plant,
  onSow,
}: SowSeedsDialogProps) {
  const [seedCount, setSeedCount] = useState(1);
  const [location, setLocation] = useState("Indoor Tray");

  useEffect(() => {
    if (open && plant) {
      setSeedCount(Math.min(10, plant.amount ?? 1));
      setLocation("Indoor Tray");
    }
  }, [open, plant]);

  if (!plant) return null;

  const handleSow = () => {
    onSow(plant, seedCount, location);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white/95 backdrop-blur-xl border-white/40 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex items-center justify-center text-2xl bg-primary/10 rounded-xl border border-primary/20">
              {plant.icon}
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">
                Sow {plant.name}
              </DialogTitle>
              <DialogDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground/60">
                Start a new seedling batch
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Seeds to Sow
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={plant.amount}
                  value={seedCount}
                  onChange={(e) => setSeedCount(parseInt(e.target.value) || 1)}
                  className="bg-muted/30 border-white/20 rounded-xl px-4 py-6 font-bold text-lg shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-muted-foreground/40">
                  of {plant.amount}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Location
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Propagator"
                className="bg-muted/30 border-white/20 rounded-xl px-4 py-6 font-bold text-sm shadow-inner"
              />
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Sprout className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary/80 uppercase tracking-wide leading-snug">
                Sowing {seedCount} seeds will create a single "Seedling Batch"
                in your nursery.
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                You can plant these out individually later when they are ready.
              </p>
            </div>
          </div>
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
            onClick={handleSow}
            className="rounded-xl px-8 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold uppercase tracking-widest text-xs"
          >
            Sow Seeds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
