import { useState, useEffect, useRef, useCallback } from "react";
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
import type { CellDimensions, PlanterLayout, UnitSystem } from "../data/schema";
import { defaultCellDimensions, formatDimensions } from "../i18n/utils/formatting";

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
  cellDimensions?: CellDimensions;
  layout?: PlanterLayout;
}

interface PlanterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: PlanterConfig) => void;
  initialConfig?: PlanterConfig;
  /** The user's preferred unit system — used to set sensible defaults for new planters. */
  unitSystem?: UnitSystem;
}

const VIRTUAL_BED_COLORS = [
  "#fef3c7", // yellow-100
  "#ffedd5", // orange-100
  "#fce7f3", // pink-100
  "#d1fae5", // green-100
  "#dbeafe", // blue-100
  "#fae8ff", // purple-100
];

/** Preset choices for cell dimensions. */
type CellPreset =
  | "imperial-sqft"   // 1 ft × 1 ft
  | "metric-30"       // 30 cm × 30 cm
  | "metric-25"       // 25 cm × 25 cm
  | "custom";         // user-supplied width + depth

const PRESET_DIMS: Record<Exclude<CellPreset, "custom">, CellDimensions> = {
  "imperial-sqft": { width: 1, depth: 1, unit: "feet" },
  "metric-30":     { width: 30, depth: 30, unit: "cm" },
  "metric-25":     { width: 25, depth: 25, unit: "cm" },
};

function dimToPreset(dims: CellDimensions | undefined): CellPreset {
  if (!dims) return "custom";
  if (dims.unit === "feet" && dims.width === 1 && dims.depth === 1) return "imperial-sqft";
  if (dims.unit === "cm" && dims.width === 30 && dims.depth === 30) return "metric-30";
  if (dims.unit === "cm" && dims.width === 25 && dims.depth === 25) return "metric-25";
  return "custom";
}

export function PlanterDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
  unitSystem = "metric",
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

  // ── Cell dimensions ──────────────────────────────────────────────────────
  const resolvedInitialDims: CellDimensions =
    initialConfig?.cellDimensions ?? defaultCellDimensions(unitSystem);
  const [cellPreset, setCellPreset] = useState<CellPreset>(
    dimToPreset(initialConfig?.cellDimensions),
  );
  // Custom dimension inputs (raw string to allow free-form editing)
  const [customWidth, setCustomWidth] = useState(
    String(resolvedInitialDims.width),
  );
  const [customDepth, setCustomDepth] = useState(
    String(resolvedInitialDims.depth),
  );
  const [customUnit, setCustomUnit] = useState<CellDimensions["unit"]>(
    resolvedInitialDims.unit,
  );
  const [dimsError, setDimsError] = useState("");

  // ── Layout type ───────────────────────────────────────────────────────────
  const [layout, setLayout] = useState<PlanterLayout>(
    initialConfig?.layout ?? "grid",
  );

  // Keep a stable ref to handleSave so the keyboard handler doesn't need to
  // list all form state as dependencies, avoiding unnecessary listener churn.
  const handleSaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveRef.current();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setNameError(t("dialogs.planterDialog.nameRequired"));
      return;
    }
    setNameError("");

    // Resolve final cell dimensions
    let finalDims: CellDimensions;
    if (cellPreset !== "custom") {
      finalDims = PRESET_DIMS[cellPreset];
    } else {
      const w = parseFloat(customWidth);
      const d = parseFloat(customDepth);
      if (!isFinite(w) || w <= 0 || !isFinite(d) || d <= 0) {
        setDimsError(t("dialogs.planterDialog.cellDimensionInvalid"));
        return;
      }
      finalDims = { width: w, depth: d, unit: customUnit };
    }
    setDimsError("");

    onSave({
      id: initialConfig?.id,
      name: name.trim(),
      tagline: tagline.trim(),
      backgroundColor,
      rows,
      cols,
      virtualSections: virtualSections.length > 0 ? virtualSections : undefined,
      cellDimensions: finalDims,
      layout,
    });

    onOpenChange(false);
  }, [name, tagline, backgroundColor, rows, cols, virtualSections, cellPreset, customWidth, customDepth, customUnit, layout, t, onSave, onOpenChange, initialConfig?.id]);

  // Keep the ref in sync so the keyboard handler always calls the latest version
  handleSaveRef.current = handleSave;

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
              <label htmlFor="planter-name" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                {t("dialogs.planterDialog.planterName")}
              </label>
              <input
                id="planter-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                placeholder={t("dialogs.planterDialog.namePlaceholder")}
                aria-describedby={nameError ? "planter-name-error" : undefined}
                aria-invalid={!!nameError}
                className={`w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm ${nameError ? "border-destructive" : ""}`}
              />
              {nameError && (
                <p id="planter-name-error" className="text-destructive text-xs mt-1 ml-1 animate-error-appear">{nameError}</p>
              )}
            </div>

            <div>
              <label htmlFor="planter-tagline" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                {t("dialogs.planterDialog.tagline")}
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
                <label htmlFor="planter-rows" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                  {t("dialogs.planterDialog.rows")}
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
                <label htmlFor="planter-cols" className="text-sm font-black text-muted-foreground uppercase tracking-widest block mb-2">
                  {t("dialogs.planterDialog.columns")}
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

          {/* ── Cell Dimensions & Layout ─────────────────────────────── */}
          <div className="border-t pt-6 space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-1">
                {t("dialogs.planterDialog.cellDimensions")}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t("dialogs.planterDialog.cellDimensionsHint")}
              </p>

              {/* Preset buttons */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {(
                  [
                    { key: "imperial-sqft", label: t("dialogs.planterDialog.cellDimensionPresetImperialSqFt") },
                    { key: "metric-30",     label: t("dialogs.planterDialog.cellDimensionPresetMetric30") },
                    { key: "metric-25",     label: t("dialogs.planterDialog.cellDimensionPresetMetric25") },
                    { key: "custom",        label: t("dialogs.planterDialog.cellDimensionCustom") },
                  ] as { key: CellPreset; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCellPreset(key);
                      if (key !== "custom") {
                        setDimsError("");
                        const d = PRESET_DIMS[key];
                        setCustomWidth(String(d.width));
                        setCustomDepth(String(d.depth));
                        setCustomUnit(d.unit);
                      }
                    }}
                    className={`px-3 py-2 rounded-xl border-2 text-xs font-bold transition-[border-color,background-color] text-left ${
                      cellPreset === key
                        ? "border-primary bg-primary/5"
                        : "border-border/40 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Custom dimension inputs */}
              {cellPreset === "custom" && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t("dialogs.planterDialog.cellDimensionWidth")}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={customWidth}
                      onChange={(e) => { setCustomWidth(e.target.value); setDimsError(""); }}
                      className="w-full px-2 py-1.5 border border-border/60 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t("dialogs.planterDialog.cellDimensionDepth")}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={customDepth}
                      onChange={(e) => { setCustomDepth(e.target.value); setDimsError(""); }}
                      className="w-full px-2 py-1.5 border border-border/60 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t("dialogs.planterDialog.cellDimensionUnit")}
                    </label>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value as CellDimensions["unit"])}
                      className="w-full px-2 py-1.5 border border-border/40 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white/50"
                    >
                      <option value="cm">{t("dialogs.planterDialog.cellDimensionUnitCm")}</option>
                      <option value="m">{t("dialogs.planterDialog.cellDimensionUnitM")}</option>
                      <option value="feet">{t("dialogs.planterDialog.cellDimensionUnitFeet")}</option>
                      <option value="inches">{t("dialogs.planterDialog.cellDimensionUnitInches")}</option>
                    </select>
                  </div>
                </div>
              )}
              {dimsError && (
                <p className="text-destructive text-xs mt-1 animate-error-appear">{dimsError}</p>
              )}

              {/* Preview of resolved dimensions */}
              {cellPreset !== "custom" && (
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDimensions(PRESET_DIMS[cellPreset])}
                </p>
              )}
            </div>

            {/* Layout type */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-foreground block mb-2">
                {t("dialogs.planterDialog.layoutType")}
              </label>
              <div className="flex gap-3">
                {(
                  [
                    { key: "grid",          label: t("dialogs.planterDialog.layoutGrid") },
                    { key: "pot-container", label: t("dialogs.planterDialog.layoutPotContainer") },
                  ] as { key: PlanterLayout; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLayout(key)}
                    className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-[border-color,background-color] ${
                      layout === key
                        ? "border-primary bg-primary/5"
                        : "border-border/40 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {layout === "pot-container" && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t("dialogs.planterDialog.layoutPotContainerHint")}
                </p>
              )}
            </div>
          </div>

          {/* Virtual Sections Section */}
          <div className="border-t pt-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground mb-3">{t("dialogs.planterDialog.virtualSections")}</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {t("dialogs.planterDialog.virtualSectionsHint")}
            </p>

            {/* Add Virtual Section */}
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="vsection-name" className="text-xs text-muted-foreground block mb-1">
                    {t("dialogs.planterDialog.sectionName")}
                  </label>
                  <input
                    id="vsection-name"
                    type="text"
                    value={newVirtualSectionName}
                    onChange={(e) => { setNewVirtualSectionName(e.target.value); setSectionNameError(""); }}
                    placeholder={t("dialogs.planterDialog.sectionNamePlaceholder")}
                    aria-describedby={sectionNameError ? "vsection-name-error" : undefined}
                    aria-invalid={!!sectionNameError}
                    className={`w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary ${sectionNameError ? "border-destructive" : "border-border/60"}`}
                  />
                  {sectionNameError && (
                    <p id="vsection-name-error" className="text-destructive text-xs mt-1 animate-error-appear">{sectionNameError}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="vsection-type" className="text-xs text-muted-foreground block mb-1">
                    {t("dialogs.planterDialog.divisionType")}
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
                  <label htmlFor="vsection-start" className="text-xs text-muted-foreground block mb-1">
                    {newVirtualSectionType === "rows" ? t("dialogs.planterDialog.startRow") : t("dialogs.planterDialog.startColumn")}
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
                  <label htmlFor="vsection-end" className="text-xs text-muted-foreground block mb-1">
                    {newVirtualSectionType === "rows" ? t("dialogs.planterDialog.endRow") : t("dialogs.planterDialog.endColumn")}
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
                <p className="text-destructive text-xs mb-2 animate-error-appear">{sectionRangeError}</p>
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
