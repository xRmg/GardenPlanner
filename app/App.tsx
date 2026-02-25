import { useState } from 'react';
import { GardenGrid, Plant, PlantInstance } from './components/GardenGrid';
import { EventsBar, GardenEvent, Suggestion } from './components/EventsBar';
import { ToolBar } from './components/ToolBar';
import { GardenBedDialog, GardenBedConfig, VirtualBed } from './components/GardenBedDialog';

// Available plants for the garden
const AVAILABLE_PLANTS: Plant[] = [
  { id: '1', name: 'Tomato', color: '#ef4444', icon: '🍅' },
  { id: '2', name: 'Carrot', color: '#f97316', icon: '🥕' },
  { id: '3', name: 'Lettuce', color: '#84cc16', icon: '🥬' },
  { id: '4', name: 'Pepper', color: '#eab308', icon: '🌶️' },
  { id: '5', name: 'Broccoli', color: '#22c55e', icon: '🥦' },
  { id: '6', name: 'Cucumber', color: '#10b981', icon: '🥒' },
  { id: '7', name: 'Corn', color: '#fbbf24', icon: '🌽' },
  { id: '8', name: 'Pumpkin', color: '#fb923c', icon: '🎃' },
  { id: '9', name: 'Eggplant', color: '#a855f7', icon: '🍆' },
  { id: '10', name: 'Radish', color: '#ec4899', icon: '🌱' },
];

interface Garden {
  id: string;
  name: string;
  rows: number;
  cols: number;
  virtualBeds?: VirtualBed[];
}

export default function App() {
  const [gardens, setGardens] = useState<Garden[]>([
    { id: '1', name: 'Garden Bed 1', rows: 4, cols: 4 },
    { id: '2', name: 'Garden Bed 2', rows: 4, cols: 4 },
  ]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [events, setEvents] = useState<GardenEvent[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    {
      id: 'sug-1',
      type: 'water',
      priority: 'high',
      description: 'Hot weather expected - give plants extra water',
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'sug-2',
      type: 'weed',
      priority: 'medium',
      description: 'Regular weeding helps your vegetables grow better',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'sug-3',
      type: 'compost',
      priority: 'low',
      description: 'Add compost to enrich soil nutrients',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);

  const handleAddGarden = () => {
    setEditingGarden(null);
    setBedDialogOpen(true);
  };

  const handleEditGarden = (garden: Garden) => {
    setEditingGarden(garden);
    setBedDialogOpen(true);
  };

  const handleSaveGarden = (config: GardenBedConfig) => {
    if (config.id) {
      // Update existing garden
      setGardens(gardens.map(g => 
        g.id === config.id 
          ? { ...g, name: config.name, rows: config.rows, cols: config.cols, virtualBeds: config.virtualBeds }
          : g
      ));
    } else {
      // Add new garden
      const newId = String(Date.now());
      setGardens([...gardens, {
        id: newId,
        name: config.name,
        rows: config.rows,
        cols: config.cols,
        virtualBeds: config.virtualBeds,
      }]);
    }
  };

  const handleRemoveGarden = () => {
    if (gardens.length > 0) {
      const removedGarden = gardens[gardens.length - 1];
      // Remove events associated with this garden
      setEvents(events.filter(e => e.gardenId !== removedGarden.id));
      setGardens(gardens.slice(0, -1));
    }
  };

  const handlePlantAdded = (plantInstance: PlantInstance, gardenId: string) => {
    // Log planting event
    setEvents(prev => [
      {
        id: `planted-${Date.now()}-${Math.random()}`,
        type: 'planted',
        plant: plantInstance.plant,
        date: new Date().toISOString(),
        gardenId,
      },
      ...prev,
    ]);

    // Add harvest suggestion
    if (plantInstance.harvestDate) {
      setSuggestions(prev => [
        ...prev,
        {
          id: `harvest-sug-${plantInstance.instanceId}`,
          type: 'harvest',
          plant: plantInstance.plant,
          priority: 'medium',
          description: `Time to harvest ${plantInstance.plant.name}`,
          dueDate: plantInstance.harvestDate,
        },
      ]);
    }
  };

  const handlePlantRemoved = (plantInstance: PlantInstance, gardenId: string) => {
    // Remove harvest suggestions for this specific plant instance
    setSuggestions(prev => 
      prev.filter(s => s.id !== `harvest-sug-${plantInstance.instanceId}`)
    );
  };

  const handlePlantUpdated = (plantInstance: PlantInstance, gardenId: string) => {
    // Update harvest suggestion if harvest date changed
    if (plantInstance.harvestDate) {
      setSuggestions(prev => 
        prev.map(s => 
          s.id === `harvest-sug-${plantInstance.instanceId}`
            ? {
                ...s,
                plant: plantInstance.plant,
                dueDate: plantInstance.harvestDate,
                description: `Time to harvest ${plantInstance.variety || plantInstance.plant.name}`,
              }
            : s
        )
      );
    }
  };

  const handleCompleteSuggestion = (suggestion: Suggestion) => {
    // Remove the suggestion
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    
    // Log the event
    const eventType = 
      suggestion.type === 'water' ? 'watered' :
      suggestion.type === 'harvest' ? 'harvested' :
      suggestion.type === 'compost' ? 'composted' :
      suggestion.type === 'weed' ? 'weeded' :
      'composted'; // repot -> composted as fallback
    
    setEvents(prev => [
      {
        id: `event-${Date.now()}-${Math.random()}`,
        type: eventType as GardenEvent['type'],
        plant: suggestion.plant,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  return (
    <div className="size-full flex flex-col bg-background">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Garden area */}
        <div className="flex-1 overflow-auto p-8">
          <div className="mb-6">
            <h1 className="text-foreground">Garden Planner</h1>
            <p className="text-muted-foreground mt-2">
              Plan your square foot vegetable gardens. Create custom beds, define sections, and track your plants.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-8">
            {gardens.length === 0 ? (
              <div className="text-center text-gray-400 w-full mt-12">
                <p className="text-xl">No garden beds yet</p>
                <p className="mt-2">Click "New Bed" in the toolbar below to create your first garden bed</p>
              </div>
            ) : (
              gardens.map((garden) => (
                <GardenGrid
                  key={garden.id}
                  id={garden.id}
                  name={garden.name}
                  rows={garden.rows}
                  cols={garden.cols}
                  selectedPlant={selectedPlant}
                  virtualBeds={garden.virtualBeds}
                  onPlantAdded={handlePlantAdded}
                  onPlantRemoved={handlePlantRemoved}
                  onPlantUpdated={handlePlantUpdated}
                  onEdit={() => handleEditGarden(garden)}
                />
              ))
            )}
          </div>
        </div>

        {/* Events sidebar */}
        <EventsBar 
          events={events} 
          suggestions={suggestions}
          onCompleteSuggestion={handleCompleteSuggestion}
        />
      </div>

      {/* Bottom toolbar */}
      <ToolBar
        plants={AVAILABLE_PLANTS}
        selectedPlant={selectedPlant}
        onSelectPlant={setSelectedPlant}
        onAddGarden={handleAddGarden}
        onRemoveGarden={handleRemoveGarden}
        gardenCount={gardens.length}
      />

      {/* Garden Bed Configuration Dialog */}
      <GardenBedDialog
        open={bedDialogOpen}
        onOpenChange={setBedDialogOpen}
        onSave={handleSaveGarden}
        initialConfig={editingGarden ? {
          id: editingGarden.id,
          name: editingGarden.name,
          rows: editingGarden.rows,
          cols: editingGarden.cols,
          virtualBeds: editingGarden.virtualBeds,
        } : undefined}
      />
    </div>
  );
}