import { useState } from "react";
import { MapPin } from "lucide-react";

interface Photo {
  id: string;
  lat: number;
  lng: number;
  thumbnailUrl: string;
  username: string;
}

interface MapViewProps {
  onPhotoClick: (photo: Photo) => void;
}

export function MapView({ onPhotoClick }: MapViewProps) {
  const [photos] = useState<Photo[]>([
    { id: "1", lat: 35.6762, lng: 139.6503, thumbnailUrl: "", username: "user1" },
    { id: "2", lat: 35.6812, lng: 139.7671, thumbnailUrl: "", username: "user2" },
    { id: "3", lat: 35.6586, lng: 139.7454, thumbnailUrl: "", username: "user3" },
  ]);

  // Convert lat/lng to pixel positions (simplified for demo)
  const getPosition = (lat: number, lng: number) => {
    // Center on Tokyo area (simplified projection)
    const centerLat = 35.6762;
    const centerLng = 139.6503;
    const scale = 8000; // Adjust this for zoom level
    
    const x = 50 + ((lng - centerLng) * scale);
    const y = 50 - ((lat - centerLat) * scale);
    
    return { x: `${x}%`, y: `${y}%` };
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-br from-gray-100 to-gray-200">
      {/* Map Background Pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(0deg, #ddd 1px, transparent 1px),
            linear-gradient(90deg, #ddd 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Streets Pattern */}
      <div className="absolute inset-0">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="streets" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <line x1="0" y1="50" x2="100" y2="50" stroke="#999" strokeWidth="2" opacity="0.3"/>
              <line x1="50" y1="0" x2="50" y2="100" stroke="#999" strokeWidth="2" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#streets)" />
        </svg>
      </div>

      {/* Area Labels */}
      <div className="absolute top-1/4 left-1/4 text-gray-400 text-xl opacity-40 pointer-events-none">
        渋谷区
      </div>
      <div className="absolute top-1/3 right-1/3 text-gray-400 text-xl opacity-40 pointer-events-none">
        港区
      </div>
      <div className="absolute bottom-1/3 left-1/3 text-gray-400 text-xl opacity-40 pointer-events-none">
        品川区
      </div>

      {/* Photo Pins */}
      {photos.map((photo) => {
        const pos = getPosition(photo.lat, photo.lng);
        return (
          <button
            key={photo.id}
            className="absolute transform -translate-x-1/2 -translate-y-full hover:scale-110 transition-transform cursor-pointer z-20"
            style={{ left: pos.x, top: pos.y }}
            onClick={() => onPhotoClick(photo)}
          >
            <MapPin className="w-8 h-8 text-red-500 fill-red-500 drop-shadow-lg" />
          </button>
        );
      })}

      {/* Zoom Controls */}
      <div className="absolute bottom-24 right-6 flex flex-col gap-1 bg-white rounded-lg shadow-lg p-1">
        <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg">
          +
        </button>
        <div className="w-full h-px bg-gray-200" />
        <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg">
          −
        </button>
      </div>
    </div>
  );
}
