import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface PlayerImageProps {
  name: string;
  className?: string;
}

const PlayerImage: React.FC<PlayerImageProps> = ({ name, className = "" }) => {
  // 0: try .png, 1: try .jpg, 2: try .jpeg, 3: try default_player.png, 4: fallback icon
  const [fallbackState, setFallbackState] = useState(0); 
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    setFallbackState(0);
    setSrc(`/photos/${name}.png`);
  }, [name]);

  const handleError = () => {
    const nextState = fallbackState + 1;
    setFallbackState(nextState);

    if (nextState === 1) {
      setSrc(`/photos/${name}.jpg`);
    } else if (nextState === 2) {
      setSrc(`/photos/${name}.jpeg`);
    } else if (nextState === 3) {
      setSrc(`/photos/default_player.png`);
    }
  };

  if (fallbackState >= 4) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 text-slate-600 ${className}`}>
        <User className="w-1/2 h-1/2 opacity-50" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={name} 
      className={className}
      onError={handleError}
      loading="eager"
    />
  );
};

export default PlayerImage;