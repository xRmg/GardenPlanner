import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from './ui/dialog';
import { Plus, Trash2, Minus } from 'lucide-react';

export interface VirtualBed {
  id: string;
  name: string;
  type: 'rows' | 'columns';
  start: number;
  end: number;
  color?: string;
}

export interface GardenBedConfig {
  id?: string;
  name: string;
  rows: number;
  cols: number;
  virtualBeds?: VirtualBed[];
}

interface GardenBedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: GardenBedConfig) => void;
  initialConfig?: GardenBedConfig;
}

const VIRTUAL_BED_COLORS = [
  '#fef3c7', // yellow-100
  '#ffedd5', // orange-100
  '#fce7f3', // pink-100
  '#d1fae5', // green-100
  '#dbeafe', // blue-100
  '#fae8ff', // purple-100
];

export function GardenBedDialog({ 
  open, 
  onOpenChange, 
  onSave,
  initialConfig 
}: GardenBedDialogProps) {
  const [name, setName] = useState(initialConfig?.name || '');
  const [rows, setRows] = useState(initialConfig?.rows || 4);
  const [cols, setCols] = useState(initialConfig?.cols || 4);
  const [virtualBeds, setVirtualBeds] = useState<VirtualBed[]>(initialConfig?.virtualBeds || []);
  const [newVirtualBedName, setNewVirtualBedName] = useState('');
  const [newVirtualBedType, setNewVirtualBedType] = useState<'rows' | 'columns'>('rows');
  const [newVirtualBedStart, setNewVirtualBedStart] = useState(0);
  const [newVirtualBedEnd, setNewVirtualBedEnd] = useState(1);

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a name for the garden bed');
      return;
    }

    onSave({
      id: initialConfig?.id,
      name: name.trim(),
      rows,
      cols,
      virtualBeds: virtualBeds.length > 0 ? virtualBeds : undefined,
    });

    onOpenChange(false);
  };

  const handleAddVirtualBed = () => {
    if (!newVirtualBedName.trim()) {
      alert('Please enter a name for the virtual bed');
      return;
    }

    const maxValue = newVirtualBedType === 'rows' ? rows : cols;
    
    if (newVirtualBedStart < 0 || newVirtualBedEnd > maxValue || newVirtualBedStart >= newVirtualBedEnd) {
      alert(`Invalid range. Must be between 0 and ${maxValue}, and start must be less than end.`);
      return;
    }

    const newVirtualBed: VirtualBed = {
      id: `vbed-${Date.now()}`,
      name: newVirtualBedName.trim(),
      type: newVirtualBedType,
      start: newVirtualBedStart,
      end: newVirtualBedEnd,
      color: VIRTUAL_BED_COLORS[virtualBeds.length % VIRTUAL_BED_COLORS.length],
    };

    setVirtualBeds([...virtualBeds, newVirtualBed]);
    setNewVirtualBedName('');
    setNewVirtualBedStart(newVirtualBedEnd);
    setNewVirtualBedEnd(Math.min(newVirtualBedEnd + 2, maxValue));
  };

  const handleRemoveVirtualBed = (id: string) => {
    setVirtualBeds(virtualBeds.filter(vb => vb.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialConfig ? 'Edit Garden Bed' : 'Create New Garden Bed'}
          </DialogTitle>
          <DialogDescription>
            Configure your garden bed or planter with custom dimensions and optional virtual sections
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Bed Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Front Yard Bed, Raised Planter 1..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                    onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
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
                    onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
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

          {/* Virtual Beds Section */}
          <div className="border-t pt-6">
            <h3 className="text-sm mb-3">Virtual Beds (Optional)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Divide your garden bed into sections (e.g., one section for tomatoes, another for lettuce)
            </p>

            {/* Add Virtual Bed */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Section Name</label>
                  <input
                    type="text"
                    value={newVirtualBedName}
                    onChange={(e) => setNewVirtualBedName(e.target.value)}
                    placeholder="e.g., Tomato Section"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Division Type</label>
                  <select
                    value={newVirtualBedType}
                    onChange={(e) => {
                      setNewVirtualBedType(e.target.value as 'rows' | 'columns');
                      setNewVirtualBedStart(0);
                      setNewVirtualBedEnd(e.target.value === 'rows' ? Math.min(2, rows) : Math.min(2, cols));
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
                    Start {newVirtualBedType === 'rows' ? 'Row' : 'Column'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={newVirtualBedType === 'rows' ? rows - 1 : cols - 1}
                    value={newVirtualBedStart}
                    onChange={(e) => setNewVirtualBedStart(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    End {newVirtualBedType === 'rows' ? 'Row' : 'Column'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={newVirtualBedType === 'rows' ? rows : cols}
                    value={newVirtualBedEnd}
                    onChange={(e) => setNewVirtualBedEnd(parseInt(e.target.value) || 1)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleAddVirtualBed}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Virtual Bed
              </button>
            </div>

            {/* Virtual Beds List */}
            {virtualBeds.length > 0 && (
              <div className="space-y-2">
                {virtualBeds.map((vb) => (
                  <div
                    key={vb.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                    style={{ backgroundColor: vb.color }}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{vb.name}</div>
                      <div className="text-xs text-gray-600">
                        {vb.type === 'rows' ? 'Rows' : 'Columns'} {vb.start} to {vb.end - 1}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveVirtualBed(vb.id)}
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
              {initialConfig ? 'Save Changes' : 'Create Garden Bed'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
