import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Plus, Trash2, Minus } from "lucide-react";

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
  const [newVirtualSectionStart, setNewVirtualSectionStart] = useState(0);
  const [newVirtualSectionEnd, setNewVirtualSectionEnd] = useState(1);

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a name for the planter");
      return;
    }

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
    if (!newVirtualSectionName.trim()) {
      alert("Please enter a name for the section");
      return;
    }

    const maxValue = newVirtualSectionType === "rows" ? rows : cols;

    if (
      newVirtualSectionStart < 0 ||
      newVirtualSectionEnd > maxValue ||
      newVirtualSectionStart >= newVirtualSectionEnd
    ) {
      alert(
        `Invalid range. Must be between 0 and ${maxValue}, and start must be less than end.`,
      );
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
    setNewVirtualSectionStart(newVirtualSectionEnd);
    setNewVirtualSectionEnd(Math.min(newVirtualSectionEnd + 2, maxValue));
  };

  const handleRemoveVirtualSection = (id: string) => {
    setVirtualSections(virtualSections.filter((vb) => vb.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialConfig ? "Edit Planter" : "Create New Planter"}
          </DialogTitle>
          <DialogDescription>
            Configure your planter with custom dimensions and optional virtual
            sections
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">
                Planter Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Raised Bed 1, Herb Pot..."
                className="w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">
                Short Tag-line
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g., Summer vegetables, Northwest corner..."
                className="w-full px-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground block mb-3">
                Background Color
              </label>
              <div className="flex gap-4">
                {[
                  { label: "Earth Brown", value: "#5D4037" },
                  { label: "Forest Green", value: "#1B5E20" },
                  { label: "Spring Green", value: "#81C784" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBackgroundColor(option.value)}
                    className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
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
                <label className="text-sm text-gray-600 block mb-1">
                  Number of Rows *
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRows(Math.max(1, rows - 1))}
                    className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={rows}
                    onChange={(e) =>
                      setRows(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setRows(Math.min(20, rows + 1))}
                    className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">
                  Number of Columns *
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCols(Math.max(1, cols - 1))}
                    className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={cols}
                    onChange={(e) =>
                      setCols(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setCols(Math.min(20, cols + 1))}
                    className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded text-sm text-gray-600">
              Total squares: {rows} × {cols} = {rows * cols}
            </div>
          </div>

          {/* Virtual Sections Section */}
          <div className="border-t pt-6">
            <h3 className="text-sm mb-3">Virtual Sections (Optional)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Divide your planter into sections (e.g., one section for tomatoes,
              another for lettuce)
            </p>

            {/* Add Virtual Section */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Section Name
                  </label>
                  <input
                    type="text"
                    value={newVirtualSectionName}
                    onChange={(e) => setNewVirtualSectionName(e.target.value)}
                    placeholder="e.g., Tomato Section"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Division Type
                  </label>
                  <select
                    value={newVirtualSectionType}
                    onChange={(e) => {
                      setNewVirtualSectionType(
                        e.target.value as "rows" | "columns",
                      );
                      setNewVirtualSectionStart(0);
                      setNewVirtualSectionEnd(
                        e.target.value === "rows"
                          ? Math.min(2, rows)
                          : Math.min(2, cols),
                      );
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="rows">By Rows</option>
                    <option value="columns">By Columns</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Start {newVirtualSectionType === "rows" ? "Row" : "Column"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={newVirtualSectionType === "rows" ? rows - 1 : cols - 1}
                    value={newVirtualSectionStart}
                    onChange={(e) =>
                      setNewVirtualSectionStart(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    End {newVirtualSectionType === "rows" ? "Row" : "Column"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={newVirtualSectionType === "rows" ? rows : cols}
                    value={newVirtualSectionEnd}
                    onChange={(e) =>
                      setNewVirtualSectionEnd(parseInt(e.target.value) || 1)
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleAddVirtualSection}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Virtual Section
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
                      <div className="font-medium">{vb.name}</div>
                      <div className="text-xs text-gray-600">
                        {vb.type === "rows" ? "Rows" : "Columns"} {vb.start} to{" "}
                        {vb.end - 1}
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
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              {initialConfig ? "Save Changes" : "Create Planter"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
