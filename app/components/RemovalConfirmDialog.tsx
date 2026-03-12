import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { PlantInstance } from "./PlanterGrid";

interface RemovalConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantInstance: PlantInstance | null;
  onConfirm: (eventType: "harvested" | "removed") => void;
}

export function RemovalConfirmDialog({
  open,
  onOpenChange,
  plantInstance,
  onConfirm,
}: RemovalConfirmDialogProps) {
  const handleHarvested = () => {
    onConfirm("harvested");
    onOpenChange(false);
  };

  const handleRemoved = () => {
    onConfirm("removed");
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {plantInstance?.plant.name}?</DialogTitle>
          <DialogDescription>
            How do you want to log this removal?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Choose how to record this plant removal in your garden journal:
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleHarvested}
              className="w-full justify-start"
              variant="outline"
            >
              <span className="text-base">✓ Mark as Harvested</span>
              <span className="text-xs text-muted-foreground ml-2 block text-left">
                Plant reached maturity and was harvested
              </span>
            </Button>
            <Button
              onClick={handleRemoved}
              className="w-full justify-start"
              variant="outline"
            >
              <span className="text-base">✗ Remove</span>
              <span className="text-xs text-muted-foreground ml-2 block text-left">
                Plant died, was discarded, or removed early
              </span>
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCancel} variant="ghost">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
