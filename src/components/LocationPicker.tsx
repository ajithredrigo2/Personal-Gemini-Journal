import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Search,
  X,
  Eye,
  Loader2,
  AlertCircle,
  Building2,
  Navigation2,
  Check,
} from 'lucide-react';
import { JournalLocation } from '../types';
import { MapModal } from './MapModal';

interface LocationPickerProps {
  selectedLocation: JournalLocation | null;
  onSelectLocation: (location: JournalLocation | null) => void;
  className?: string;
}

interface SuggestionItem {
  id: string;
  name: string;
  address: string;
  rawSuggestion?: google.maps.places.AutocompleteSuggestion;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  selectedLocation,
  onSelectLocation,
  className = '',
}) => {
  const placesLibrary = useMapsLibrary('places');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced places search handler using Google Maps Places API (New)
  const handleInputChange = (val: string) => {
    setSearchQuery(val);
    setSearchError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    searchTimeoutRef.current = setTimeout(async () => {
      if (!placesLibrary) {
        setIsSearching(false);
        setSearchError('Google Maps Places Library is initializing. Please verify your Maps API key.');
        return;
      }

      try {
        // Initialize session token if not present
        if (!sessionTokenRef.current && placesLibrary.AutocompleteSessionToken) {
          sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
        }

        // Use modern Places API (New) AutocompleteSuggestion
        if (placesLibrary.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
          const response = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: val.trim(),
            sessionToken: sessionTokenRef.current || undefined,
          });

          if (response?.suggestions && response.suggestions.length > 0) {
            const items: SuggestionItem[] = response.suggestions
              .filter((s) => s.placePrediction)
              .map((s) => {
                const pred = s.placePrediction!;
                return {
                  id: pred.placeId,
                  name: pred.mainText?.text || pred.text?.text || 'Location',
                  address: pred.secondaryText?.text || pred.text?.text || '',
                  rawSuggestion: s,
                };
              });
            setSuggestions(items);
            setIsSearching(false);
            return;
          }
        }

        // Fallback: searchByText if available
        if (placesLibrary.Place?.searchByText) {
          const textRes = await placesLibrary.Place.searchByText({
            textQuery: val.trim(),
            fields: ['id', 'displayName', 'formattedAddress', 'location'],
          });

          if (textRes?.places && textRes.places.length > 0) {
            const items: SuggestionItem[] = textRes.places.map((p) => ({
              id: p.id || `place_${Date.now()}`,
              name: p.displayName || val,
              address: p.formattedAddress || '',
            }));
            setSuggestions(items);
            setIsSearching(false);
            return;
          }
        }

        setSuggestions([]);
      } catch (err: unknown) {
        console.warn('Places search failed or restricted:', err);
        setSearchError('No matching places found or request limits reached.');
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);
  };

  // Handle selecting a place prediction and retrieving its coordinates and address
  const handleSelectSuggestion = async (item: SuggestionItem) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      if (item.rawSuggestion?.placePrediction) {
        const place = item.rawSuggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'id'],
        });

        const lat = place.location?.lat() ?? 0;
        const lng = place.location?.lng() ?? 0;

        const locationData: JournalLocation = {
          name: place.displayName || item.name,
          placeId: place.id || item.id,
          formattedAddress: place.formattedAddress || item.address || '',
          latitude: lat,
          longitude: lng,
        };

        onSelectLocation(locationData);
      } else if (placesLibrary?.Place) {
        // Fetch fields using Place ID
        const place = new placesLibrary.Place({ id: item.id });
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'id'],
        });

        const lat = place.location?.lat() ?? 0;
        const lng = place.location?.lng() ?? 0;

        const locationData: JournalLocation = {
          name: place.displayName || item.name,
          placeId: place.id || item.id,
          formattedAddress: place.formattedAddress || item.address || '',
          latitude: lat,
          longitude: lng,
        };

        onSelectLocation(locationData);
      }

      // Reset session token
      sessionTokenRef.current = null;
      setIsOpen(false);
      setSearchQuery('');
      setSuggestions([]);
    } catch (err) {
      console.error('Failed to fetch full place details:', err);
      setSearchError('Could not load detailed place coordinates.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveLocation = () => {
    onSelectLocation(null);
    setSearchQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* If a location is already selected */}
      {selectedLocation ? (
        <div
          id="selected-location-card"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border border-[#D6D5CD] rounded-xl shadow-xs"
        >
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#5A5A40]/15 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#3A3A35] truncate">
                  {selectedLocation.name}
                </span>
                <span className="text-[10px] text-[#4B6350] bg-[#4B6350]/10 px-1.5 py-0.2 rounded font-medium">
                  Attached
                </span>
              </div>
              <p className="text-[11px] text-[#73726B] truncate max-w-md">
                {selectedLocation.formattedAddress ||
                  `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              id="view-location-on-map-btn"
              type="button"
              onClick={() => setIsMapModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-[#EFEEE7] hover:bg-[#E8E6DF] text-[#3A3A35] rounded-lg border border-[#D6D5CD] transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>View on Map</span>
            </button>

            <button
              id="remove-location-btn"
              type="button"
              onClick={handleRemoveLocation}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 text-[#73726B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Remove location"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        /* Location Search Input Box */
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[#3A3A35] uppercase tracking-wider mb-1">
            Attach Location <span className="text-[#73726B] font-normal normal-case">(Optional, search Google Maps)</span>
          </label>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="w-4 h-4 text-[#73726B]" />
            </div>

            <input
              id="location-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setIsOpen(true);
              }}
              placeholder="Search a place, cafe, city, or landmark on Google Maps..."
              className="w-full pl-9 pr-10 py-2 bg-white border border-[#D6D5CD] rounded-xl text-xs text-[#3A3A35] placeholder:text-[#B5B4AC] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40 focus:border-[#5A5A40]"
            />

            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 text-[#5A5A40] animate-spin" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                    setIsOpen(false);
                  }}
                  className="text-[#73726B] hover:text-[#3A3A35] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Search className="w-3.5 h-3.5 text-[#B5B4AC]" />
              )}
            </div>
          </div>

          {/* Autocomplete Results Dropdown */}
          {isOpen && (
            <div
              id="location-suggestions-dropdown"
              className="absolute left-0 right-0 z-30 mt-1 bg-white border border-[#D6D5CD] rounded-xl shadow-lg max-h-60 overflow-y-auto"
            >
              {suggestions.length > 0 ? (
                <ul className="py-1 divide-y divide-[#F5F5F0]">
                  {suggestions.map((item) => (
                    <li key={item.id}>
                      <button
                        id={`select-place-${item.id}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-[#F5F5F0] transition-colors flex items-start gap-2.5 cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[#3A3A35] truncate">
                            {item.name}
                          </div>
                          {item.address && (
                            <div className="text-[11px] text-[#73726B] truncate">
                              {item.address}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : searchQuery.trim() && !isSearching ? (
                <div className="p-3 text-center text-xs text-[#73726B]">
                  No Google Maps places found for "{searchQuery}"
                </div>
              ) : null}

              {searchError && (
                <div className="p-2.5 bg-amber-50 text-amber-800 text-[11px] flex items-center gap-1.5 border-t border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Map Modal */}
      <MapModal
        location={selectedLocation}
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
      />
    </div>
  );
};
