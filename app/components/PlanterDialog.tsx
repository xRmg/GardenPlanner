import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Plus, Trash2, Minus } from "lucide-react";
import { Button } from "./ui/button";

export interface VirtualSection {
  id: string;
  name: string;
  type: "rows" | "columns";
  start: number;
  end: number;
  color?: string;
}

export interface PlanterConfig {
  id?: string;
  name: string;
  rows: number;
  cols: number;
  virtualSections?: VirtualSection[];
  backgroundColor?: string;
  tagline?: string;
}

interface PlanterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: PlanterConfig) => void;
  initialConfig?: PlanterConfig;
}

const VIRTUAL_BED_COLORS = [
  "#fef3c7", // yellow-100
  "#ffedd5", // orange-100
  "#fce7f3", // pink-100
  "#d1fae5", // green-100
  "#dbeafe", // blue-100
  "#fae8ff", // purple-100
];

export function PlanterDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
}: PlanterDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialConfig?.name || "");
  const [tagline, setTagline] = useState(initialConfig?.tagline || "");
  const [backgroundColor, setBackgroundColor] = useState(
    initialConfig?.backgroundColor || "#5D4037",
  ); // Default brown
  const [rows, setRows] = useState(initialConfig?.rows || 4);
  const [cols, setCols] = useState(initialConfig?.cols || 4);
  const [virtualSections, setVirtualSections] = useState<VirtualSection[]>(
    initialConfig?.virtualSections || [],
  );
  const [newVirtualSectionName, setNewVirtualSectionName] = useState("");
  const [newVirtualSectionType, setNewVirtualSectionType] = useState<
    "rows" | "columns"
  >("rows");
  const [newVirtualSectionStart, setNewVirtualSectionStart] = useState(1);
  const [newVirtualSectionEnd, setNewVirtualSectionEnd] = useState(2);
  const [nameError, setNameError] = useState("");
  const [sectionNameError, setSectionNameError] = useState("");
  const [sectionRangeError, setSectionRangeError] = useState("");

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, name, tagline, backgroundColor, rows, cols, virtualSections]);

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(t("dialogs.planterDialog.nameRequired"));
      return;
    }
    setNameError("");

    onSave({
      id: initialConfig?.id,
      name: name.trim(),
      tagline: tagline.trim(),
      backgroundColor,
      rows,
      cols,
      virtualSections: virtualSections.length > 0 ? virtualSections : undefined,
    });

    onOpenChange(false);
  };

  const handleAddVirtualSection = () => {
    setSectionNameError("");
    setSectionRangeError("");
    if (!newVirtualSectionName.trim()) {
      setSectionNameError(t("dialogs.planterDialog.sectionNameRequired"));
      return;
    }

    const maxValue = newVirtualSectionType === "rows" ? rows : cols;

    if (
      newVirtualSectionStart < 1 ||
      newVirtualSectionEnd > maxValue ||
      newVirtualSectionStart > newVirtualSectionEnd
    ) {
      setSectionRangeError(t("dialogs.planterDialog.invalidRange", { max: maxValue }));
      return;
    }

    const newVirtualSection: VirtualSection = {
      id: `vsection-${Date.now()}`,
      name: newVirtualSectionName.trim(),
      type: newVirtualSectionType,
      start: newVirtualSectionStart,
      end: newVirtualSectionEnd,
      color:
        VIRTUAL_BED_COLORS[virtualSections.length % VIRTUAL_BED_COLORS.length],
    };

    setVirtualSections([...virtualSections, newVirtualSection]);
    setNewVirtualSectionName("");
    const nextStart = Math.min(newVirtualSectionEnd + 1, maxValue);
    const nextEnd = Math.min(nextStart + 1, maxValue);
    setNewVirtualSectionStart(nextStart);
    setNewVirtualSectionEnd(nextEnd);
  };

  const handleRemoveVirtualSection = (id: string) => {
    setVirtualSections(virtualSections.filter((vb) => vb.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialConfig ? t("dialogs.planterDialog.titleEdit") : t("dialogs.planterDialog.titleCreate")}
          </DialogTitle>
          <DialogDescription>
            {t("dialogs.planterDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <div>
<<<<<<< HEAD
              <label htmlFor="planter-name" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                {t("dialogs.planterDialog.planterName")}
=======
              <label
                htmlFor="planter-name"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                Planter Name *
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
              </label>
              <input
                id="planter-name"
                type="text"
                value={name}
<<<<<<< HEAD
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                placeholder={t("dialogs.planterDialog.namePlaceholder")}
=======
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError("");
                }}
                placeholder="e.g., Raised Bed 1, Herb Pot..."
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                aria-describedby={nameError ? "planter-name-error" : undefined}
                aria-invalid={!!nameError}
                className={`w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm ${nameError ? "border-destructive" : ""}`}
              />
              {nameError && (
                <p
                  id="planter-name-error"
                  className="text-destructive text-xs mt-1 ml-1 animate-error-appear"
                >
                  {nameError}
                </p>
              )}
            </div>

            <div>
<<<<<<< HEAD
              <label htmlFor="planter-tagline" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                {t("dialogs.planterDialog.tagline")}
=======
              <label
                htmlFor="planter-tagline"
                className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
              >
                Short Tag-line
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
              </label>
              <input
                id="planter-tagline"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder={t("dialogs.planterDialog.taglinePlaceholder")}
                className="w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>

            <div>
              <label className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-3">
                {t("dialogs.planterDialog.backgroundColor")}
              </label>
              <div className="flex gap-4">
                {[
                  { label: t("dialogs.planterDialog.colorEarthBrown"), value: "#5D4037" },
                  { label: t("dialogs.planterDialog.colorForestGreen"), value: "#1B5E20" },
                  { label: t("dialogs.planterDialog.colorSpringGreen"), value: "#81C784" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBackgroundColor(option.value)}
                    className={`flex-1 p-3 rounded-xl border-2 transition-[background-color,border-color,transform] flex flex-col items-center gap-2 ${
                      backgroundColor === option.value
                        ? "border-primary bg-primary/5 scale-105 shadow-md"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full shadow-inner border border-white/20"
                      style={{ backgroundColor: option.value }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
<<<<<<< HEAD
                <label htmlFor="planter-rows" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                  {t("dialogs.planterDialog.rows")}
=======
                <label
                  htmlFor="planter-rows"
                  className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
                >
                  Number of Rows *
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRows(Math.max(1, rows - 1))}
                    aria-label={t("dialogs.planterDialog.decreaseRows")}
                    className="px-3 py-2 border border-border/40 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <input
                    id="planter-rows"
                    type="number"
                    min="1"
                    max="20"
                    value={rows}
                    onChange={(e) =>
                      setRows(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="flex-1 bg-white/50 border border-border/40 rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                  <button
                    onClick={() => setRows(Math.min(20, rows + 1))}
                    aria-label={t("dialogs.planterDialog.increaseRows")}
                    className="px-3 py-2 border border-border/40 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div>
<<<<<<< HEAD
                <label htmlFor="planter-cols" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                  {t("dialogs.planterDialog.columns")}
=======
                <label
                  htmlFor="planter-cols"
                  className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2"
                >
                  Number of Columns *
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCols(Math.max(1, cols - 1))}
                    aria-label={t("dialogs.planterDialog.decreaseColumns")}
                    className="px-3 py-2 border border-border/40 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={cols}
                    onChange={(e) =>
                      setCols(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    id="planter-cols"
                    className="flex-1 bg-white/50 border border-border/40 rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                  <button
                    onClick={() => setCols(Math.min(20, cols + 1))}
                    aria-label={t("dialogs.planterDialog.increaseColumns")}
                    className="px-3 py-2 border border-border/40 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded-xl text-sm font-medium text-muted-foreground">
              {t("dialogs.planterDialog.totalSquares", { rows, cols, total: rows * cols })}
            </div>
          </div>

          {/* Virtual Sections Section */}
          <div className="border-t pt-6">
<<<<<<< HEAD
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">{t("dialogs.planterDialog.virtualSections")}</h3>
=======
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">
              Virtual Sections{" "}
              <span className="font-medium normal-case tracking-normal text-muted-foreground">
                (Optional)
              </span>
            </h3>
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
            <p className="text-xs text-muted-foreground mb-4">
              {t("dialogs.planterDialog.virtualSectionsHint")}
            </p>

            {/* Add Virtual Section */}
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
<<<<<<< HEAD
                  <label htmlFor="vsection-name" className="text-xs text-muted-foreground block mb-1">
                    {t("dialogs.planterDialog.sectionName")}
=======
                  <label
                    htmlFor="vsection-name"
                    className="text-xs text-muted-foreground block mb-1"
                  >
                    Section Name
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                  </label>
                  <input
                    id="vsection-name"
                    type="text"
                    value={newVirtualSectionName}
<<<<<<< HEAD
                    onChange={(e) => { setNewVirtualSectionName(e.target.value); setSectionNameError(""); }}
                    placeholder={t("dialogs.planterDialog.sectionNamePlaceholder")}
                    aria-describedby={sectionNameError ? "vsection-name-error" : undefined}
=======
                    onChange={(e) => {
                      setNewVirtualSectionName(e.target.value);
                      setSectionNameError("");
                    }}
                    placeholder="e.g., Tomato Section"
                    aria-describedby={
                      sectionNameError ? "vsection-name-error" : undefined
                    }
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                    aria-invalid={!!sectionNameError}
                    className={`w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary ${sectionNameError ? "border-destructive" : "border-border/60"}`}
                  />
                  {sectionNameError && (
                    <p
                      id="vsection-name-error"
                      className="text-destructive text-xs mt-1 animate-error-appear"
                    >
                      {sectionNameError}
                    </p>
                  )}
                </div>
                <div>
<<<<<<< HEAD
                  <label htmlFor="vsection-type" className="text-xs text-muted-foreground block mb-1">
                    {t("dialogs.planterDialog.divisionType")}
=======
                  <label
                    htmlFor="vsection-type"
                    className="text-xs text-muted-foreground block mb-1"
                  >
                    Division Type
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                  </label>
                  <select
                    id="vsection-type"
                    value={newVirtualSectionType}
                    onChange={(e) => {
                      setNewVirtualSectionType(
                        e.target.value as "rows" | "columns",
                      );
                      setNewVirtualSectionStart(1);
                      setNewVirtualSectionEnd(
                        e.target.value === "rows"
                          ? Math.min(2, rows)
                          : Math.min(2, cols),
                      );
                    }}
                    className="w-full px-2 py-1.5 border border-border/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white/50 shadow-inner"
                  >
                    <option value="rows">{t("dialogs.planterDialog.byRows")}</option>
                    <option value="columns">{t("dialogs.planterDialog.byColumns")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
<<<<<<< HEAD
                  <label htmlFor="vsection-start" className="text-xs text-muted-foreground block mb-1">
                    {newVirtualSectionType === "rows" ? t("dialogs.planterDialog.startRow") : t("dialogs.planterDialog.startColumn")}
=======
                  <label
                    htmlFor="vsection-start"
                    className="text-xs text-muted-foreground block mb-1"
                  >
                    Start {newVirtualSectionType === "rows" ? "Row" : "Column"}
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                  </label>
                  <input
                    id="vsection-start"
                    type="number"
                    min="1"
                    max={newVirtualSectionType === "rows" ? rows : cols}
                    value={newVirtualSectionStart}
                    onChange={(e) => {
                      setNewVirtualSectionStart(parseInt(e.target.value) || 1);
                      setSectionRangeError("");
                    }}
                    className="w-full px-2 py-1.5 border border-border/60 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
<<<<<<< HEAD
                  <label htmlFor="vsection-end" className="text-xs text-muted-foreground block mb-1">
                    {newVirtualSectionType === "rows" ? t("dialogs.planterDialog.endRow") : t("dialogs.planterDialog.endColumn")}
=======
                  <label
                    htmlFor="vsection-end"
                    className="text-xs text-muted-foreground block mb-1"
                  >
                    End {newVirtualSectionType === "rows" ? "Row" : "Column"}
>>>>>>> 80d649d27e83e7021ba729bca0ba39777fd3e54c
                  </label>
                  <input
                    id="vsection-end"
                    type="number"
                    min="1"
                    max={newVirtualSectionType === "rows" ? rows : cols}
                    value={newVirtualSectionEnd}
                    onChange={(e) => {
                      setNewVirtualSectionEnd(parseInt(e.target.value) || 1);
                      setSectionRangeError("");
                    }}
                    className="w-full px-2 py-1.5 border border-border/60 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              {sectionRangeError && (
                <p className="text-destructive text-xs mb-2 animate-error-appear">
                  {sectionRangeError}
                </p>
              )}

              <button
                onClick={handleAddVirtualSection}
                className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
              >
                <Plus className="w-4 h-4" />
                {t("dialogs.planterDialog.addVirtualSection")}
              </button>
            </div>

            {/* Virtual Sections List */}
            {virtualSections.length > 0 && (
              <div className="space-y-2">
                {virtualSections.map((vb) => (
                  <div
                    key={vb.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                    style={{ backgroundColor: vb.color }}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{vb.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {vb.type === "rows" ? t("dialogs.planterDialog.rowsLabel") : t("dialogs.planterDialog.columnsLabel")}{" "}
                        {t("dialogs.planterDialog.rangeDisplay", { start: vb.start, end: vb.end })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveVirtualSection(vb.id)}
                      className="p-1.5 hover:bg-red-100 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 justify-end pt-2 border-t">
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
              {initialConfig ? t("dialogs.planterDialog.saveChanges") : t("dialogs.planterDialog.createPlanter")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
