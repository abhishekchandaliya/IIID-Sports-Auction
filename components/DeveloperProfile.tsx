import React, { useMemo } from 'react';
import { Player } from '../types';
import { Phone, Briefcase, Code, Crown, Shirt } from 'lucide-react';

interface DeveloperProfileProps {
  players: Player[];
  variant?: 'sidebar' | 'full';
}

const DeveloperProfile: React.FC<DeveloperProfileProps> = ({ players, variant = 'sidebar' }) => {
  // Logic: Search for the developer in the player list
  const devStats = useMemo(() => {
    return players.find(p => 
      p.name.toLowerCase().includes("abhishek") && 
      p.name.toLowerCase().includes("chandaliya")
    );
  }, [players]);

  const isSold = devStats && devStats.team;

  return (
    <div className={`bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl ${variant === 'sidebar' ? 'max-w-sm' : 'w-full'}`}>
      {/* Header / Image Area */}
      <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-4 flex items-center gap-4 relative">
        <div className="absolute top-0 right-0 p-2 opacity-10">
            <Code className="w-16 h-16 text-white" />
        </div>
        
        {/* Avatar Placeholder (using initials or image if available) */}
        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-indigo-400 flex items-center justify-center shadow-lg relative z-10">
            <span className="text-xl font-black text-indigo-400">AC</span>
        </div>
        
        <div className="relative z-10">
            <h4 className="text-white font-bold text-lg leading-tight">Ar. Abhishek Chandaliya</h4>
            <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-medium mt-1">
                <Briefcase className="w-3 h-3" />
                <span>Auction Architect (4 Yrs)</span>
            </div>
        </div>
      </div>

      {/* Dynamic Status Section */}
      <div className="p-4 space-y-4">
        {devStats ? (
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${isSold ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-amber-900/20 border-amber-500/30'}`}>
                <div className={`p-2 rounded-full ${isSold ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {isSold ? <Shirt className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
                </div>
                <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        {isSold ? 'Playing For' : 'Auction Status'}
                    </div>
                    <div className={`font-bold ${isSold ? 'text-emerald-100' : 'text-amber-100'}`}>
                        {isSold ? devStats.team : `Unsold / Category ${devStats.cricket !== '0' ? devStats.cricket : 'Player'}`}
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
                <span className="text-xs text-slate-500 italic">Player data not loaded</span>
            </div>
        )}

        {/* Contact Info */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
            <div className="flex items-center gap-2 text-slate-400">
                <Phone className="w-3.5 h-3.5" />
                <span className="text-xs font-mono">9314422669</span>
            </div>
            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                Tech Lead
            </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperProfile;