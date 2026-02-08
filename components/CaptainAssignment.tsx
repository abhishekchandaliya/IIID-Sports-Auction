import React, { useState, useMemo, useEffect } from 'react';
import { Player, TeamStats } from '../types';
import { Search, X, Check, Trophy, User } from 'lucide-react';

interface CaptainAssignmentProps {
  players: Player[];
  teams: TeamStats[];
  onAssign: (playerId: number, teamName: string, sport: 'Cricket' | 'Badminton' | 'TT', price: number) => void;
  onRemove: (playerId: number) => void;
}

const CaptainAssignment: React.FC<CaptainAssignmentProps> = ({ players, teams, onAssign, onRemove }) => {
  // State for the selection form
  const [activeSelection, setActiveSelection] = useState<{team: string, sport: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  
  // Toast Notification State
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info'} | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleOpenSelection = (teamName: string, sport: string) => {
    setActiveSelection({ team: teamName, sport });
    setSearchTerm("");
    setSelectedPlayerId("");
    setPrice(0);
  };

  const handleCancel = () => {
    setActiveSelection(null);
    setSearchTerm("");
  };

  const handleConfirm = () => {
    if (activeSelection && selectedPlayerId) {
      const player = players.find(p => p.id.toString() === selectedPlayerId);
      onAssign(
        parseInt(selectedPlayerId), 
        activeSelection.team, 
        activeSelection.sport as any, 
        price
      );
      setToast({ msg: `Assigned ${player?.name} as Captain!`, type: 'success' });
      setActiveSelection(null);
    }
  };

  const handleRemoveWrapper = (id: number, name: string) => {
      onRemove(id);
      setToast({ msg: `Removed ${name} from captaincy.`, type: 'info' });
  };

  // Filter unsold players for the dropdown
  const unsoldPlayers = useMemo(() => {
    return players
      .filter(p => !p.team)
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 50); // Limit results for performance
  }, [players, searchTerm]);

  const getSportIcon = (sport: string) => {
      switch(sport) {
          case 'Cricket': return '🏏';
          case 'Badminton': return '🏸';
          case 'TT': return '🏓';
          default: return '🏅';
      }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' : 'bg-slate-800/90 border-slate-600 text-slate-200'}`}>
                <div className={`p-1 rounded-full ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
                    {toast.type === 'success' ? <Check className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <span className="font-medium">{toast.msg}</span>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {teams.map(team => {
          const assignedCount = players.filter(p => p.team === team.name && p.captainFor).length;
          const progressPercent = (assignedCount / 3) * 100;

          return (
          <div key={team.name} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
            {/* Team Header */}
            <div className="bg-slate-800/50 px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                    <Trophy className="w-5 h-5" />
                 </div>
                 <h3 className="font-bold text-white text-lg truncate">{team.name}</h3>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                      <span>Captains Assigned</span>
                      <span className={assignedCount === 3 ? "text-emerald-400" : "text-slate-400"}>{assignedCount}/3</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full transition-all duration-500 ease-out ${assignedCount === 3 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                  </div>
              </div>
            </div>
            
            <div className="p-4 space-y-3 bg-slate-900/50 flex-1">
              {['Cricket', 'Badminton', 'TT'].map((sport) => {
                const captain = players.find(p => p.team === team.name && p.captainFor === sport);
                const isEditing = activeSelection?.team === team.name && activeSelection?.sport === sport;

                return (
                  <div key={sport}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                       <span className="text-base">{getSportIcon(sport)}</span>
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{sport}</span>
                    </div>

                    {captain ? (
                      // ASSIGNED STATE (Success Look)
                      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between group hover:bg-emerald-900/30 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="bg-emerald-500/20 p-1.5 rounded text-emerald-400">
                               <Check className="w-4 h-4" />
                           </div>
                           <div>
                               <div className="font-bold text-emerald-100 text-sm leading-tight">{captain.name}</div>
                               <div className="text-[10px] text-emerald-400/70 font-mono">Sold: {captain.price}</div>
                           </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveWrapper(captain.id, captain.name)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove Captain"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : isEditing ? (
                      // EDITING STATE
                      <div className="bg-slate-800 rounded-lg p-3 border border-indigo-500/50 shadow-lg shadow-indigo-900/20 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                         <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                            <input 
                              type="text" 
                              placeholder="Search player..." 
                              className="w-full bg-slate-900 text-sm text-white border border-slate-700 rounded-lg py-2 pl-8 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-600"
                              autoFocus
                              value={searchTerm}
                              onChange={e => setSearchTerm(e.target.value)}
                            />
                         </div>
                         
                         {searchTerm.length > 0 && (
                             <div className="w-full bg-slate-900 border border-slate-700 rounded-lg max-h-32 overflow-y-auto custom-scrollbar">
                                {unsoldPlayers.length === 0 ? (
                                    <div className="p-2 text-sm text-slate-500 text-center">No players found</div>
                                ) : (
                                    unsoldPlayers.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => setSelectedPlayerId(p.id.toString())}
                                            className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                                                selectedPlayerId === p.id.toString() 
                                                ? 'bg-indigo-600 text-white' 
                                                : 'text-slate-300 hover:bg-slate-800'
                                            }`}
                                        >
                                            <span>{p.name}</span>
                                            {selectedPlayerId === p.id.toString() && <Check className="w-3 h-3" />}
                                        </div>
                                    ))
                                )}
                             </div>
                         )}

                         <div className="flex gap-2">
                             <div className="relative flex-1">
                                <span className="absolute left-2.5 top-2 text-slate-500 text-sm">$</span>
                                <input 
                                  type="number" 
                                  className="w-full bg-slate-900 text-sm text-white border border-slate-700 rounded-lg py-1.5 pl-6 outline-none font-mono"
                                  placeholder="Cost"
                                  value={price}
                                  onChange={e => setPrice(Number(e.target.value))}
                                />
                             </div>
                             <button 
                               onClick={handleConfirm}
                               disabled={!selectedPlayerId}
                               className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                             >
                                <Check className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={handleCancel}
                               className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-3 transition-colors"
                             >
                                <X className="w-4 h-4" />
                             </button>
                         </div>
                      </div>
                    ) : (
                      // EMPTY STATE
                      <button 
                        onClick={() => handleOpenSelection(team.name, sport)}
                        className="w-full py-3 border border-dashed border-slate-700 text-slate-500 text-sm rounded-lg hover:border-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2 group"
                      >
                         <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                            <span className="text-xs">+</span>
                         </div>
                         Assign
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

export default CaptainAssignment;