import { Calendar, Sprout, CheckCircle2, Droplets, Leaf, Package, Scissors } from 'lucide-react';
import { Plant } from './GardenGrid';

export interface GardenEvent {
  id: string;
  type: 'planted' | 'watered' | 'composted' | 'weeded' | 'harvested';
  plant?: Plant;
  date: string;
  gardenId?: string;
  note?: string;
}

export interface Suggestion {
  id: string;
  type: 'water' | 'harvest' | 'repot' | 'compost' | 'weed';
  plant?: Plant;
  priority: 'low' | 'medium' | 'high';
  description: string;
  dueDate?: string;
}

interface EventsBarProps {
  events: GardenEvent[];
  suggestions: Suggestion[];
  onCompleteSuggestion?: (suggestion: Suggestion) => void;
}

const eventIcons = {
  planted: { icon: Sprout, color: 'text-green-600' },
  watered: { icon: Droplets, color: 'text-blue-600' },
  composted: { icon: Package, color: 'text-amber-700' },
  weeded: { icon: Scissors, color: 'text-orange-600' },
  harvested: { icon: Leaf, color: 'text-purple-600' },
};

const suggestionIcons = {
  water: { icon: Droplets, color: 'text-blue-600' },
  harvest: { icon: Leaf, color: 'text-purple-600' },
  repot: { icon: Package, color: 'text-indigo-600' },
  compost: { icon: Package, color: 'text-amber-700' },
  weed: { icon: Scissors, color: 'text-orange-600' },
};

export function EventsBar({ events, suggestions, onCompleteSuggestion }: EventsBarProps) {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const currentMonth = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays < 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-primary text-primary-foreground">
        <h2 className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {currentMonth}
        </h2>
      </div>
      
      {/* Suggestions Section */}
      <div className="flex-1 overflow-y-auto border-b border-border">
        <div className="p-4 bg-accent border-b border-border">
          <h3 className="text-sm text-accent-foreground">Upcoming Suggestions</h3>
        </div>
        <div className="p-4">
          {suggestions.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <p className="text-sm">No suggestions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions.map((suggestion) => {
                const IconComponent = suggestionIcons[suggestion.type].icon;
                const iconColor = suggestionIcons[suggestion.type].color;
                const priorityColors = {
                  low: 'border-l-gray-300',
                  medium: 'border-l-yellow-400',
                  high: 'border-l-red-400',
                };
                
                return (
                  <div
                    key={suggestion.id}
                    className={`p-3 bg-card rounded border-l-4 ${priorityColors[suggestion.priority]} shadow-sm hover:shadow transition-shadow`}
                  >
                    <div className="flex items-start gap-2">
                      <IconComponent className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          {suggestion.description}
                        </div>
                        {suggestion.plant && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-lg">{suggestion.plant.icon}</span>
                            <span className="text-xs text-gray-600">{suggestion.plant.name}</span>
                          </div>
                        )}
                        {suggestion.dueDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(suggestion.dueDate)}
                          </div>
                        )}
                      </div>
                      {onCompleteSuggestion && (
                        <button
                          onClick={() => onCompleteSuggestion(suggestion)}
                          className="p-1 hover:bg-green-50 rounded transition-colors flex-shrink-0"
                          title="Mark as done"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Events Journal Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 bg-muted border-b border-border">
          <h3 className="text-sm text-muted-foreground">Garden Journal</h3>
        </div>
        <div className="p-4">
          {sortedEvents.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <Sprout className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events logged</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedEvents.map((event) => {
                const IconComponent = eventIcons[event.type].icon;
                const iconColor = eventIcons[event.type].color;
                
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-muted transition-colors"
                  >
                    <IconComponent className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        {event.type === 'planted' && event.plant && `Planted ${event.plant.name}`}
                        {event.type === 'watered' && (event.plant ? `Watered ${event.plant.name}` : 'Watered garden')}
                        {event.type === 'composted' && 'Added compost'}
                        {event.type === 'weeded' && 'Weeded garden'}
                        {event.type === 'harvested' && event.plant && `Harvested ${event.plant.name}`}
                      </div>
                      {event.note && (
                        <div className="text-xs text-gray-500 mt-0.5">{event.note}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatEventDate(event.date)}
                      </div>
                    </div>
                    {event.plant && (
                      <span className="text-lg flex-shrink-0">{event.plant.icon}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}