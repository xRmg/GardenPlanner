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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
          <DialogTitle>{t("dialogs.removalConfirmDialog.title", { name: plantInstance?.plant.name })}</DialogTitle>
          <DialogDescription>
            {t("dialogs.removalConfirmDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {t("dialogs.removalConfirmDialog.chooseHow")}
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleHarvested}
              className="w-full justify-start"
              variant="outline"
            >
              <span className="text-base">{t("dialogs.removalConfirmDialog.markHarvested")}</span>
              <span className="text-xs text-muted-foreground ml-2 block text-left">
                {t("dialogs.removalConfirmDialog.harvestedHint")}
              </span>
            </Button>
            <Button
              onClick={handleRemoved}
              className="w-full justify-start"
              variant="outline"
            >
              <span className="text-base">{t("dialogs.removalConfirmDialog.remove")}</span>
              <span className="text-xs text-muted-foreground ml-2 block text-left">
                {t("dialogs.removalConfirmDialog.removeHint")}
              </span>
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCancel} variant="ghost">
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
