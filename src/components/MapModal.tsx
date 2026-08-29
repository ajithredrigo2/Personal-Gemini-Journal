import React from 'react';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { X, MapPin, ExternalLink, Navigation } from 'lucide-react';
import { JournalLocation } from '../types';

interface MapModalProps {
  location: JournalLocation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MapModal: React.FC<MapModalProps> = ({ location, isOpen, onClose }) => {
  if (!isOpen || !location) return null;

  const center = {
    lat: location.latitude,
    lng: location.longitude,
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location.name
  )}&query_place_id=${location.placeId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="location-map-modal"
        className="bg-white border border-[#D6D5CD] rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D6D5CD] bg-[#F5F5F0]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#5A5A40]/15 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-[#5A5A40]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-serif font-bold text-[#3A3A35] truncate">
                {location.name}
              </h3>
              <p className="text-xs text-[#73726B] truncate font-sans">
                {location.formattedAddress || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
              </p>
            </div>
          </div>

          <button
            id="close-map-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#73726B] hover:text-[#3A3A35] hover:bg-[#E8E6DF] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Body Container */}
        <div className="relative w-full h-[360px] bg-[#E8E6DF]">
          <Map
            defaultCenter={center}
            defaultZoom={15}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="w-full h-full"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          >
            <AdvancedMarker position={center} title={location.name}>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#5A5A40] text-white shadow-md border-2 border-white">
                <MapPin className="w-4 h-4" />
              </div>
            </AdvancedMarker>
          </Map>
        </div>

        {/* Footer Details & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3.5 bg-white border-t border-[#D6D5CD]">
          <div className="text-xs text-[#73726B] space-y-0.5">
            <div className="font-mono text-[11px] text-[#3A3A35]">
              GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </div>
            <div className="text-[10px] text-[#B5B4AC] truncate max-w-xs">
              Place ID: {location.placeId}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <a
              id="open-google-maps-external-btn"
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#EFEEE7] hover:bg-[#E8E6DF] text-[#3A3A35] rounded-xl text-xs font-semibold border border-[#D6D5CD] transition-colors cursor-pointer"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              id="done-map-modal-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
