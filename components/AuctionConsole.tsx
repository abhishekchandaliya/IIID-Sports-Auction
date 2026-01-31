import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Player, TeamStats, ActivityLog, TournamentConfig } from '../types';
import { Search, Gavel, Shuffle, Sparkles, X, ChevronRight, Lock, Ban, User, ArrowRight, Minus, Plus, RefreshCw, PenTool, CheckCircle, AlertTriangle, Clock, Star, Scale } from 'lucide-react';
import PlayerImage from './PlayerImage';

interface AuctionConsoleProps {
  players: Player[];
  teams: TeamStats[];
  onSellPlayer: (playerId: number, teamName: string, price: number) => void;
  onUnsellPlayer: (playerId: number) => void;
  onUpdatePlayer: (playerId: number, teamName: string, price: number) => void;
  isReadOnly?: boolean;
  currentPlayerId: string;
  onSelectPlayer: (id: string) => void;
  recentActivity: ActivityLog[];
  config: TournamentConfig;
}

const AuctionConsole: React.FC<AuctionConsoleProps> = ({ 
    players, 
    teams, 
    onSellPlayer, 
    onUnsellPlayer,
    onUpdatePlayer,
    isReadOnly = false,
    currentPlayerId,
    onSelectPlayer,
    recentActivity,
    config
}) => {
  // Existing Auction State
  const [searchTerm, setSearchTerm] = useState("");
  const [winningTeam, setWinningTeam] = useState("");
  const [bidPrice, setBidPrice] = useState(config.basePrice);
  const [error, setError] = useState<string | null>(null);

  // Fair Play Validation State
  const [fairPlayError, setFairPlayError] = useState<string | null>(null);
  const [overrideFairPlay, setOverrideFairPlay] = useState(false);

  // Correction Manager State
  const [correctionSearch, setCorrectionSearch] = useState("");
  const [correctionPlayerId, setCorrectionPlayerId] = useState<string>("");
  const [correctionTeam, setCorrectionTeam] = useState("");
  const [correctionPrice, setCorrectionPrice] = useState(0);

  // Randomizer State
  const [showRandomizer, setShowRandomizer] = useState(false);
  const [rSport, setRSport] = useState<'all' | 'cricket' | 'badminton' | 'tt'>('all');
  const [rGrade, setRGrade] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinName, setSpinName] = useState("Ready?");
  const [spinWinner, setSpinWinner] = useState<Player | null>(null);
  
  // Track where the selection came from to enable looping
  const [selectionOrigin, setSelectionOrigin] = useState<'randomizer' | 'manual'>('manual');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Update bid price when config changes or new player selected
  useEffect(() => {
      if (!isReadOnly) {
          setBidPrice(config.basePrice);
      }
  }, [config.basePrice, currentPlayerId, isReadOnly]);

  const selectedPlayer = useMemo(() => {
    if (!currentPlayerId) return null;
    return players.find(p => p.id.toString() === currentPlayerId);
  }, [currentPlayerId, players]);

  // FAIR PLAY CHECK LOGIC - REFINED FOR NESTED CONFIG
  useEffect(() => {
      setFairPlayError(null);
      setOverrideFairPlay(false);

      if (selectedPlayer && winningTeam && config.categoryLimits) {
          const targetTeam = teams.find(t => t.name === winningTeam);
          if (targetTeam) {
              const sports = ['Cricket', 'Badminton', 'TT'] as const;
              
              for (const sport of sports) {
                  // Map Capitalized Sport name to lowercase player/team stat key
                  const sportKey = sport.toLowerCase() as 'cricket' | 'badminton' | 'tt';
                  
                  // Get rating for this sport from player object (e.g. player.cricket = 'A')
                  const rating = selectedPlayer[sportKey]; 
                  
                  if (rating && ['A', 'B', 'C'].includes(rating)) {
                      // Lookup specific limit: config.categoryLimits['Cricket']['A']
                      const limit = config.categoryLimits[sport][rating as 'A' | 'B' | 'C'];
                      
                      // Construct stat key: 'cricketCountA'
                      const countKey = `${sportKey}Count${rating}` as keyof TeamStats;
                      const currentCount = targetTeam[countKey] as number;

                      // Condition: IF current_count >= limit
                      if (currentCount >= limit) {
                          // Check if ANY other team is lagging behind for THIS SPECIFIC SPORT/GRADE
                          const othersLagging = teams.filter(t => t.name !== winningTeam).some(t => (t[countKey] as number) < limit);
                          
                          if (othersLagging) {
                              setFairPlayError(`🚫 ${sport} QUOTA: All teams must have ${limit} Grade '${rating}' players in ${sport} before you can buy more.`);
                              return; // Stop checking other sports, one violation is enough
                          }
                      }
                  }
              }
          }
      }
  }, [winningTeam, selectedPlayer, teams, config.categoryLimits]);

  // Filter unsold players for search list
  const unsoldPlayers = useMemo(() => {
    return players
      .filter(p => !p.team)
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [players, searchTerm]);
  
  // Filter sold players for correction
  const soldPlayers = useMemo(() => {
    const search = correctionSearch.toLowerCase().trim();
    if (!search) return [];
    return players
      .filter(p => p.team)
      .filter(p => p.name.toLowerCase().includes(search));
  }, [players, correctionSearch]);

  // Derive Recently Sold Players for Quick Select
  const recentlySoldList = useMemo(() => {
    const names = new Set<string>();
    const list: Player[] = [];
    
    // Iterate recent activity to find recently modified players
    for (const log of recentActivity) {
        if (log.details?.playerName && !names.has(log.details.playerName)) {
            const player = players.find(p => p.name === log.details!.playerName && p.team); // Only if currently sold
            if (player) {
                names.add(player.name);
                list.push(player);
            }
        }
    }
    return list.slice(0, 10);
  }, [recentActivity, players]);

  // Filter for Randomizer
  const eligibleRandomPlayers = useMemo(() => {
     return players.filter(p => !p.team).filter(p => {
         // Sport filter
         if (rSport === 'cricket' && p.cricket === '0') return false;
         if (rSport === 'badminton' && p.badminton === '0') return false;
         if (rSport === 'tt' && p.tt === '0') return false;

         // Grade filter
         if (rGrade !== 'all') {
             if (rSport === 'all') {
                 // Check if ANY sport matches the grade if sport is ALL
                 return (p.cricket === rGrade || p.badminton === rGrade || p.tt === rGrade);
             } else {
                 // Check specific sport grade
                 return p[rSport as keyof Player] === rGrade;
             }
         }
         return true;
     });
  }, [players, rSport, rGrade]);

  // Check if current player is the Developer (Easter Egg)
  const isDeveloper = useMemo(() => {
      if (!selectedPlayer) return false;
      const n = selectedPlayer.name.toLowerCase();
      return n.includes("abhishek") && n.includes("chandaliya");
  }, [selectedPlayer]);

  const selectedCorrectionPlayer = useMemo(() => {
      if (!correctionPlayerId) return null;
      return players.find(p => p.id.toString() === correctionPlayerId);
  }, [correctionPlayerId, players]);

  // Set initial correction values when a player is selected for correction
  useEffect(() => {
      if (selectedCorrectionPlayer) {
          if (selectedCorrectionPlayer.team) {
              setCorrectionTeam(selectedCorrectionPlayer.team);
              setCorrectionPrice(selectedCorrectionPlayer.price);
          }
      }
  }, [selectedCorrectionPlayer]);

  const handleSell = () => {
    if (isReadOnly) return;
    setError(null);
    if (!selectedPlayer) return;
    
    // Validate Price Logic (Whole numbers only, NO mod 5 restriction)
    if (!Number.isInteger(bidPrice)) {
         setError("Price must be a whole number.");
         return;
    }

    if (!winningTeam) {
      setError("Please select a winning team.");
      return;
    }
    if (bidPrice < 0) {
        setError(`Price cannot be negative.`);
        return;
    }

    const team = teams.find(t => t.name === winningTeam);
    if (!team) {
        setError("Invalid team.");
        return;
    }
    
    if (team.playerCount >= config.maxSquadSize) {
        setError(`Team Full! Max size is ${config.maxSquadSize}.`);
        return;
    }

    // Check budget
    // If team has slots to fill, they must keep reserve for them
    const maxBid = team.playerCount < (config.maxSquadSize - 1)
        ? team.disposableBalance + config.basePrice 
        : team.disposableBalance;

    if (bidPrice > maxBid) {
      setError(`Insufficient funds! Max: ${maxBid}`);
      return;
    }

    if (fairPlayError && !overrideFairPlay) {
        return; // Validation handled by disabled button, but double check here
    }

    onSellPlayer(selectedPlayer.id, winningTeam, bidPrice);
    
    // Reset form
    onSelectPlayer("");
    setWinningTeam("");
    setBidPrice(config.basePrice);
    setSearchTerm("");
    setFairPlayError(null);
    setOverrideFairPlay(false);
    
    // Loop back to randomizer if that's where we came from
    if (selectionOrigin === 'randomizer') {
        setShowRandomizer(true);
        setSpinWinner(null);
        setSpinName("Ready?");
    }
  };

  const handleUnsold = () => {
      onSelectPlayer("");
      setWinningTeam("");
      setBidPrice(config.basePrice);
      setSearchTerm("");
      setError(null);
      setFairPlayError(null);

      // Loop back to randomizer if that's where we came from
      if (selectionOrigin === 'randomizer') {
          setShowRandomizer(true);
          setSpinWinner(null);
          setSpinName("Ready?");
      }
  };

  const handleCorrectionSave = () => {
      if (!correctionPlayerId || !correctionTeam) return;
      onUpdatePlayer(parseInt(correctionPlayerId), correctionTeam, correctionPrice);
      // Reset logic
      setCorrectionPlayerId("");
      setCorrectionSearch("");
  };
  
  const handleCorrectionRevert = () => {
      if (!correctionPlayerId) return;
      // Immediate execution confirmed by user intent
      if (confirm(`CONFIRM REVERT:\n\nUnsell ${selectedCorrectionPlayer?.name}?\n\nThey will be returned to the auction pool.`)) {
          onUnsellPlayer(parseInt(correctionPlayerId));
          // Reset UI immediately
          setCorrectionPlayerId("");
          setCorrectionSearch("");
      }
  };

  const handleSpin = () => {
    if (isReadOnly) return;
    if (eligibleRandomPlayers.length === 0) return;
    setIsSpinning(true);
    setSpinWinner(null);
    setSpinName("");
    
    let speed = 50;
    let counter = 0;
    const maxCount = 25; // How many name flips

    const run = () => {
        const randomIdx = Math.floor(Math.random() * eligibleRandomPlayers.length);
        const candidate = eligibleRandomPlayers[randomIdx];
        setSpinName(candidate.name);
        
        counter++;
        if (counter < maxCount) {
             // Slow down towards the end
             if (counter > maxCount - 8) speed += 40;
             if (counter > maxCount - 4) speed += 80;
             timerRef.current = setTimeout(run, speed);
        } else {
             // Final winner
             setSpinWinner(candidate);
             setIsSpinning(false);
        }
    };
    run();
  };

  const handleSelectWinner = () => {
      if (spinWinner) {
          onSelectPlayer(spinWinner.id.toString());
          setSelectionOrigin('randomizer');
          setShowRandomizer(false);
          setWinningTeam("");
          setBidPrice(config.basePrice);
          setError(null);
      }
  };
  
  const incrementBid = (amount: number) => {
      setBidPrice(prev => prev + amount);
  };
  
  const decrementBid = (amount: number) => {
      setBidPrice(prev => Math.max(0, prev - amount));
  };

  const getSportBadgeColor = (rating: string, type: 'cricket' | 'badminton' | 'tt') => {
    const colors = {
      cricket: 'text-blue-200 bg-blue-600 border-blue-500',
      badminton: 'text-emerald-100 bg-emerald-600 border-emerald-500',
      tt: 'text-orange-100 bg-orange-600 border-orange-500'
    };
    
    if (rating === '0') return 'text-slate-600 border-slate-700 bg-slate-800/50 opacity-20 hidden'; // Hide if 0
    if (['A', 'B', 'C'].includes(rating)) return colors[type];
    return 'text-slate-400 border-slate-600';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[700px]">
      
      {/* LEFT PANEL: Search & Directory */}
      <div className="lg:col-span-3 flex flex-col gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 h-full overflow-hidden shadow-xl lg:order-1 order-2">
        
        {!isReadOnly && (
            <button 
                onClick={() => {
                    setShowRandomizer(true);
                    onSelectPlayer("");
                    setSpinWinner(null);
                    setSpinName("Ready?");
                }}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
                <Shuffle className="w-5 h-5" />
                Random Spin
            </button>
        )}
        
        {isReadOnly && (
             <div className="w-full py-4 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl font-medium flex items-center justify-center gap-2 cursor-not-allowed">
                <Lock className="w-4 h-4" />
                Spectator View
             </div>
        )}

        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search name..."
            className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-600 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {unsoldPlayers.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">No players found</div>
          ) : (
            unsoldPlayers.map(player => (
              <button
                key={player.id}
                onClick={() => {
                    onSelectPlayer(player.id.toString());
                    setSelectionOrigin('manual');
                    setShowRandomizer(false);
                    setWinningTeam("");
                    setBidPrice(config.basePrice);
                    setError(null);
                    setFairPlayError(null);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                  currentPlayerId === player.id.toString() && !showRandomizer
                    ? 'bg-indigo-600 border-indigo-500 shadow-lg ring-1 ring-white/20'
                    : 'bg-slate-800/50 border-slate-800 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col">
                    <span className={`font-bold text-sm ${currentPlayerId === player.id.toString() && !showRandomizer ? 'text-white' : 'text-slate-200'}`}>
                        {player.name}
                    </span>
                    <span className="text-[10px] opacity-60 font-mono">#{player.id}</span>
                </div>
                <ChevronRight className={`w-4 h-4 ${currentPlayerId === player.id.toString() && !showRandomizer ? 'text-white' : 'text-slate-600'}`} />
              </button>
            ))
          )}
        </div>
        <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-800">
            {unsoldPlayers.length} / {players.filter(p => !p.team).length} Remaining
        </div>
      </div>

      {/* RIGHT PANEL: Hero & Controls */}
      <div className="lg:col-span-9 h-full flex flex-col relative lg:order-2 order-1 min-h-[500px]">
        
        {/* Mode 1: Randomizer */}
        {showRandomizer ? (
            <div className="h-full bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center z-20">
                    <div className="flex items-center gap-2 text-purple-400">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="font-bold text-white uppercase tracking-wider">Random Picker</h2>
                    </div>
                    <button onClick={() => setShowRandomizer(false)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center relative overflow-hidden">
                     {/* Background Glow */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

                     {/* Filters */}
                     <div className="flex flex-wrap justify-center gap-4 mb-16 z-10">
                        <select 
                            value={rSport} 
                            onChange={(e) => setRSport(e.target.value as any)}
                            disabled={isSpinning || isReadOnly}
                            className="bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="all">All Sports</option>
                            <option value="cricket">Cricket</option>
                            <option value="badminton">Badminton</option>
                            <option value="tt">Table Tennis</option>
                        </select>
                        <select 
                            value={rGrade} 
                            onChange={(e) => setRGrade(e.target.value as any)}
                            disabled={isSpinning || isReadOnly}
                            className="bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="all">Any Grade</option>
                            <option value="A">Grade A</option>
                            <option value="B">Grade B</option>
                            <option value="C">Grade C</option>
                        </select>
                     </div>

                     {/* Display Area */}
                     <div className="mb-16 text-center z-10 relative w-full">
                        {spinWinner ? (
                            <div className="animate-in zoom-in duration-500">
                                <div className="text-sm text-emerald-400 font-bold tracking-[0.3em] uppercase mb-6 animate-pulse">Winner Selected</div>
                                <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-indigo-300 drop-shadow-2xl mb-8 leading-tight">
                                    {spinWinner.name}
                                </h1>
                                <div className="flex justify-center gap-4">
                                    {spinWinner.cricket !== '0' && <span className="px-4 py-1.5 bg-blue-600 text-white border border-blue-400 rounded-full font-bold shadow-lg shadow-blue-900/40">CR: {spinWinner.cricket}</span>}
                                    {spinWinner.badminton !== '0' && <span className="px-4 py-1.5 bg-emerald-600 text-white border border-emerald-400 rounded-full font-bold shadow-lg shadow-emerald-900/40">BM: {spinWinner.badminton}</span>}
                                    {spinWinner.tt !== '0' && <span className="px-4 py-1.5 bg-orange-600 text-white border border-orange-400 rounded-full font-bold shadow-lg shadow-orange-900/40">TT: {spinWinner.tt}</span>}
                                </div>
                            </div>
                        ) : (
                            <div className={`transition-all duration-100 ${isSpinning ? 'scale-110 blur-[2px]' : 'scale-100'}`}>
                                <h1 className="text-6xl md:text-9xl font-black text-slate-800 tracking-tighter select-none">
                                    {spinName}
                                </h1>
                            </div>
                        )}
                     </div>

                     {/* Actions */}
                     <div className="z-10 h-20">
                        {spinWinner ? (
                            <button 
                                onClick={handleSelectWinner}
                                className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-xl shadow-xl shadow-emerald-900/50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-6 hover:scale-105 transition-transform"
                            >
                                Start Bidding <ArrowRight className="w-6 h-6" />
                            </button>
                        ) : (
                            !isReadOnly && (
                                <button 
                                    onClick={handleSpin}
                                    disabled={isSpinning || eligibleRandomPlayers.length === 0}
                                    className="px-16 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-full font-black text-2xl shadow-2xl shadow-indigo-900/50 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3"
                                >
                                    {isSpinning ? <span className="animate-pulse">Spinning...</span> : 'SPIN'}
                                </button>
                            )
                        )}
                     </div>
                </div>
            </div>
        ) : 

        /* Mode 2: HERO CARD + CONTROLS */
        selectedPlayer ? (
          <div className="h-full flex flex-col gap-4 animate-in slide-in-from-bottom-8 duration-500">
            
            {/* HERO PLAYER CARD (Split Layout) */}
            <div className="flex-[2] bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex items-center justify-center p-6 group">
               
               {/* Background Pattern */}
               <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-slate-950 pointer-events-none" />
               
               {/* Close Button */}
               <button 
                 onClick={() => onSelectPlayer("")}
                 className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors z-20"
               >
                 <X className="w-6 h-6" />
               </button>

               <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-12">
                   
                   {/* Column 1: Image Profile Card */}
                   <div className="flex-shrink-0 relative">
                        <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl border-4 border-slate-600/50 shadow-2xl overflow-hidden bg-slate-800 relative group-hover:scale-105 transition-transform duration-500">
                             <PlayerImage name={selectedPlayer.name} className="w-full h-full object-cover" />
                        </div>
                        {/* Easter Egg Badge */}
                        {isDeveloper && (
                           <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-600 text-white px-4 py-1 rounded-full shadow-lg shadow-amber-500/50 flex items-center gap-1 font-black tracking-widest text-[10px] uppercase whitespace-nowrap z-20">
                               <Star className="w-3 h-3 fill-white text-white" /> CREATOR
                           </div>
                        )}
                   </div>

                   {/* Column 2: Details */}
                   <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-slate-700/50 border border-slate-600 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Now Auctioning
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-xl projector-text leading-tight">
                                {selectedPlayer.name}
                            </h1>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-2">
                           {selectedPlayer.cricket !== '0' && (
                               <div className={`px-4 py-2 rounded-xl border-2 text-lg font-black uppercase tracking-wide shadow-lg ${getSportBadgeColor(selectedPlayer.cricket, 'cricket')}`}>
                                   CR: {selectedPlayer.cricket}
                               </div>
                           )}
                           {selectedPlayer.badminton !== '0' && (
                               <div className={`px-4 py-2 rounded-xl border-2 text-lg font-black uppercase tracking-wide shadow-lg ${getSportBadgeColor(selectedPlayer.badminton, 'badminton')}`}>
                                   BM: {selectedPlayer.badminton}
                               </div>
                           )}
                           {selectedPlayer.tt !== '0' && (
                               <div className={`px-4 py-2 rounded-xl border-2 text-lg font-black uppercase tracking-wide shadow-lg ${getSportBadgeColor(selectedPlayer.tt, 'tt')}`}>
                                   TT: {selectedPlayer.tt}
                               </div>
                           )}
                        </div>

                        <div className="pt-2">
                             <span className="text-slate-400 text-sm uppercase font-bold tracking-widest">Base Price</span>
                             <div className="text-3xl font-mono font-black text-emerald-400">
                                 {config.basePrice}
                             </div>
                        </div>
                   </div>
               </div>
            </div>

            {/* BIDDING CONTROLS - ROW LAYOUT ON DESKTOP */}
            <div className={`flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-center ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg text-center font-bold animate-pulse">
                        {error}
                    </div>
                )}

                {/* FAIR PLAY WARNING */}
                {fairPlayError && (
                    <div className="mb-4 p-4 bg-amber-900/20 border border-amber-500/40 text-amber-100 rounded-lg animate-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <Scale className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm">{fairPlayError}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="override" 
                                        checked={overrideFairPlay} 
                                        onChange={(e) => setOverrideFairPlay(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="override" className="text-xs font-bold text-amber-400 uppercase tracking-wider cursor-pointer select-none">⚠️ Admin Override Fair Play Rules</label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {!isReadOnly ? (
                    <div className="flex flex-col md:flex-row items-end gap-4 h-full">
                        
                        {/* 1. Team Selector */}
                        <div className="w-full md:flex-[2] h-full flex flex-col">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Winning Team</label>
                            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto max-h-[160px] custom-scrollbar">
                                {teams.map(t => (
                                    <button 
                                        key={t.name} 
                                        onClick={() => setWinningTeam(t.name)}
                                        disabled={t.disposableBalance <= 0}
                                        className={`p-3 rounded-xl border text-left transition-all relative ${
                                            winningTeam === t.name 
                                            ? 'bg-indigo-600 border-indigo-500 shadow-md ring-1 ring-white/20' 
                                            : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                                        } ${t.disposableBalance <= 0 ? 'opacity-40 grayscale' : ''}`}
                                    >
                                        <div className={`font-bold text-sm truncate ${winningTeam === t.name ? 'text-white' : 'text-slate-300'}`}>{t.name}</div>
                                        <div className={`text-xs font-mono mt-1 ${winningTeam === t.name ? 'text-indigo-200' : 'text-emerald-400'}`}>${t.disposableBalance}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Price Input (BIG BUTTONS) */}
                        <div className="w-full md:flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bid Price</label>
                            <div className="flex items-center gap-1 h-[88px]">
                                <button 
                                    onClick={() => decrementBid(5)}
                                    className="h-full px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-l-2xl text-slate-300 active:bg-slate-900"
                                >
                                    <Minus className="w-6 h-6" />
                                </button>
                                <input 
                                    type="number" 
                                    min={0}
                                    className="w-full h-full bg-slate-950 border-y border-slate-700 text-center text-white focus:ring-0 focus:outline-none font-black text-4xl shadow-inner font-mono appearance-none"
                                    value={bidPrice}
                                    onChange={(e) => setBidPrice(parseInt(e.target.value) || 0)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSell()}
                                />
                                <button 
                                    onClick={() => incrementBid(5)}
                                    className="h-full px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-r-2xl text-slate-300 active:bg-slate-900"
                                >
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* 3. Actions */}
                        <div className="w-full md:flex-1 flex gap-2 h-[88px]">
                             <button 
                                onClick={handleUnsold}
                                className="h-full aspect-square bg-slate-800 border-2 border-slate-700 hover:border-red-500/50 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
                                title="Pass / Unsold"
                            >
                                <Ban className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase">Pass</span>
                            </button>
                            <button 
                                onClick={handleSell}
                                disabled={!!fairPlayError && !overrideFairPlay}
                                className="h-full flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none text-white rounded-2xl font-black text-2xl shadow-lg shadow-emerald-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Gavel className="w-8 h-8" />
                                SOLD
                            </button>
                        </div>

                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-50">
                        <Gavel className="w-16 h-16 text-slate-700 mb-4" />
                        <h3 className="text-xl font-bold text-slate-500">Auction in Progress</h3>
                    </div>
                )}
            </div>
          </div>
        ) : (
          /* Mode 3: EMPTY STATE (Waiting) */
          <div className="flex-1 bg-slate-900/50 rounded-3xl border border-slate-800/50 flex flex-col items-center justify-center text-slate-600 animate-in fade-in duration-700">
              <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Gavel className="w-12 h-12 text-slate-700" />
              </div>
              <h2 className="text-3xl font-black text-slate-700 mb-2">Ready to Auction</h2>
              <p className="text-lg">Select a player from the list or use the Random Spin.</p>
          </div>
        )}

        {/* 4. CORRECTION MANAGER (Below Main Console) */}
        {!isReadOnly && (
            <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer font-bold text-slate-500 hover:text-white transition-colors">
                        <PenTool className="w-5 h-5" />
                        <span>🛠️ Correction Manager</span>
                        <span className="text-xs font-normal text-slate-600 ml-2">(Fix mistakes, edit prices, or unsell players)</span>
                    </summary>
                    <div className="pt-4 mt-4 border-t border-slate-800">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* Option A: Quick Select from Recent */}
                            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                <label className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Quick Select: Recently Sold
                                </label>
                                <select 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setCorrectionPlayerId(e.target.value);
                                            setCorrectionSearch(""); // Clear search to avoid conflicts
                                        }
                                    }}
                                    value={correctionPlayerId || ""}
                                >
                                    <option value="">-- Select from History --</option>
                                    {recentlySoldList.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.team} - {p.price})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Option B: Search All Sold */}
                            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 relative">
                                <label className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                                    <Search className="w-3 h-3" /> Search All Sold Players
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Type name to search..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                    value={correctionSearch}
                                    onChange={e => {
                                        setCorrectionSearch(e.target.value);
                                        setCorrectionPlayerId(""); // Clear selection on new search
                                    }}
                                />
                                {correctionSearch && !selectedCorrectionPlayer && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                                        {soldPlayers.map(p => (
                                            <div 
                                                key={p.id}
                                                onClick={() => {
                                                    setCorrectionPlayerId(p.id.toString());
                                                    setCorrectionSearch(""); // Clear search input for clean look
                                                }}
                                                className="p-2 text-sm hover:bg-slate-700 cursor-pointer flex justify-between border-b border-slate-700/50 last:border-0"
                                            >
                                                <span className="text-white font-medium">{p.name}</span>
                                                <span className="text-slate-400 text-xs">{p.team}</span>
                                            </div>
                                        ))}
                                        {soldPlayers.length === 0 && <div className="p-2 text-xs text-slate-500 text-center">No results</div>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Card - Confirm Selection */}
                        {selectedCorrectionPlayer && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-xl flex flex-col md:flex-row items-center justify-between mb-4 gap-3 animate-in fade-in">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-full">
                                        <User className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 font-bold uppercase">Currently Editing</div>
                                        <div className="text-lg font-black text-white leading-tight">{selectedCorrectionPlayer.name}</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 text-right">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Sold To</div>
                                        <div className="font-bold text-slate-200">{selectedCorrectionPlayer.team}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Price</div>
                                        <div className="font-mono font-bold text-emerald-400 text-lg">{selectedCorrectionPlayer.price}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Edit Controls - Separated into specific areas */}
                        {correctionPlayerId && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                {/* Zone 1: Edit Details */}
                                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 mb-4">
                                     <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                                         <PenTool className="w-3 h-3" /> Update Sale Details
                                     </h4>
                                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                        <div className="md:col-span-5">
                                            <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">New Team</label>
                                            <select 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                                value={correctionTeam}
                                                onChange={e => setCorrectionTeam(e.target.value)}
                                            >
                                                <option value="">Select Team</option>
                                                {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">New Price</label>
                                            <input 
                                                type="number"
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                                value={correctionPrice}
                                                onChange={e => setCorrectionPrice(parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="md:col-span-4">
                                            <button 
                                                onClick={handleCorrectionSave}
                                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Save Changes
                                            </button>
                                        </div>
                                     </div>
                                </div>

                                {/* Zone 2: Danger Zone (Unsell) - Completely Independent */}
                                 <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
                                     <div className="flex items-start gap-3">
                                        <div className="p-2 bg-red-500/20 rounded-full text-red-400 hidden md:block">
                                            <AlertTriangle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-red-200">Revert Sale (Unsell)</div>
                                            <div className="text-xs text-red-300/70">
                                                This will immediately remove {selectedCorrectionPlayer?.name} from their team and return them to the unsold pool.
                                            </div>
                                        </div>
                                     </div>
                                     <button 
                                        type="button"
                                        onClick={handleCorrectionRevert} 
                                        className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-red-900/30 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                                     >
                                        <AlertTriangle className="w-4 h-4" />
                                        Confirm Unsell
                                     </button>
                                 </div>
                            </div>
                        )}

                    </div>
                </details>
            </div>
        )}
      </div>
    </div>
  );
};

export default AuctionConsole;