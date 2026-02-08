import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Player, TeamStats, ActivityLog, TournamentConfig } from '../types';
import { Search, Gavel, Shuffle, Sparkles, X, ChevronRight, Lock, Ban, User, ArrowRight, Minus, Plus, Star, Scale, PenTool, CheckCircle, AlertTriangle, Clock, AlertOctagon, Wallet, Play, Target, Users, RefreshCw, Dice5, ChevronDown, ChevronUp, Layers, RotateCcw, BarChart3 } from 'lucide-react';
import PlayerImage from './PlayerImage';
import { getSportColor, shuffleArray } from '../utils';

interface AuctionConsoleProps {
  players: Player[];
  teams: TeamStats[];
  onSellPlayer: (playerId: number, teamName: string, price: number) => void;
  onUnsellPlayer: (playerId: number) => void;
  onMarkUnsold: (playerId: number) => void;
  onUpdatePlayer: (playerId: number, teamName: string, price: number) => void;
  isReadOnly?: boolean;
  currentPlayerId: string;
  onSelectPlayer: (id: string) => void;
  recentActivity: ActivityLog[];
  config: TournamentConfig;
  sports: string[];
  categories: string[];
}

const AuctionConsole: React.FC<AuctionConsoleProps> = ({ 
    players, teams, onSellPlayer, onUnsellPlayer, onMarkUnsold, onUpdatePlayer, isReadOnly = false,
    currentPlayerId, onSelectPlayer, recentActivity, config, sports, categories
}) => {
  // --- EXISTING STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [winningTeam, setWinningTeam] = useState("");
  const [bidPrice, setBidPrice] = useState(config.basePrice);
  const [error, setError] = useState<string | null>(null);
  const [fairPlayError, setFairPlayError] = useState<string | null>(null);
  const [overrideFairPlay, setOverrideFairPlay] = useState(false);
  
  // Correction Manager State
  const [correctionSearch, setCorrectionSearch] = useState("");
  const [correctionPlayerId, setCorrectionPlayerId] = useState<string>("");
  const [correctionTeam, setCorrectionTeam] = useState("");
  const [correctionPrice, setCorrectionPrice] = useState(0);

  // --- RANDOMIZER / AUTO-FILL STATE ---
  const [showRandomizer, setShowRandomizer] = useState(false);
  const [randomizerMode, setRandomizerMode] = useState<'lucky' | 'targeted' | 'distributor'>('lucky');
  
  // Mode 1: Lucky Draw State
  const [rSport, setRSport] = useState<string>('all');
  const [rGrade, setRGrade] = useState<string>('all');
  const [poolSource, setPoolSource] = useState<'available' | 'unsold'>('available');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinName, setSpinName] = useState("Ready?");
  const [spinWinner, setSpinWinner] = useState<Player | null>(null);
  const [selectionOrigin, setSelectionOrigin] = useState<'randomizer' | 'manual'>('manual');

  // Mode 2: Targeted Fill State (The Matrix)
  const [targetFillTeam, setTargetFillTeam] = useState("");
  const [fillRequests, setFillRequests] = useState<Record<string, Record<string, number>>>({});
  const [batchPreview, setBatchPreview] = useState<{player: Player, covered: string[]}[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [targetPoolType, setTargetPoolType] = useState<'LIVE' | 'LOTTERY'>('LIVE');
  const [expandedSports, setExpandedSports] = useState<string[]>([]); // For UI accordion

  // Mode 3: Global Distributor State
  const [distributeLimits, setDistributeLimits] = useState<Record<string, number>>({});
  const [distributionPreview, setDistributionPreview] = useState<Record<string, Player[]>>({});
  const [expandedDistTeam, setExpandedDistTeam] = useState<string | null>(null);
  const [lastDistBatchIds, setLastDistBatchIds] = useState<number[]>([]);

  // Post-Sale Overlay
  const [lastSale, setLastSale] = useState<{player: Player, team: string, price: number, remainingPurse: number} | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- EFFECTS ---
  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);
  useEffect(() => { if (!isReadOnly) setBidPrice(config.basePrice); }, [config.basePrice, currentPlayerId, isReadOnly]);
  
  // Initialize Distribute Limits when sports change
  useEffect(() => {
      const initial: Record<string, number> = {};
      sports.forEach(s => initial[s] = 0);
      setDistributeLimits(initial);
  }, [sports]);

  // Reset requests when team changes
  useEffect(() => { setFillRequests({}); }, [targetFillTeam]);

  // Expand all sports by default
  useEffect(() => { setExpandedSports(sports); }, [sports]);

  // Derived State
  const selectedPlayer = useMemo(() => players.find(p => p.id.toString() === currentPlayerId), [currentPlayerId, players]);
  const unsoldPlayers = useMemo(() => players.filter(p => !p.team && p.status !== 'sold' && p.name.toLowerCase().includes(searchTerm.toLowerCase())), [players, searchTerm]);
  const soldPlayers = useMemo(() => correctionSearch ? players.filter(p => p.team && p.name.toLowerCase().includes(correctionSearch.toLowerCase())) : [], [players, correctionSearch]);
  
  const recentlySoldList = useMemo(() => {
    const list: Player[] = [];
    const ids = new Set<string>();
    recentActivity.forEach(log => {
        if (log.type === 'sale' && log.details?.playerName) {
            const p = players.find(pl => pl.name === log.details!.playerName && pl.team);
            if (p && !ids.has(p.name)) { list.push(p); ids.add(p.name); }
        }
    });
    return list.slice(0, 10);
  }, [recentActivity, players]);

  // --- TARGETED FILL HELPERS ---
  const selectedTargetTeamData = useMemo(() => teams.find(t => t.name === targetFillTeam), [targetFillTeam, teams]);

  // Calculate detailed stats for the selected pool
  const poolAvailability = useMemo(() => {
      const counts: Record<string, Record<string, number>> = {};
      const pool = players.filter(p => p.auctionType === targetPoolType && !p.team && (p.status === 'available' || p.status === 'unsold'));
      
      sports.forEach(s => {
          counts[s] = {};
          categories.forEach(c => {
              counts[s][c] = pool.filter(p => p.ratings[s] === c).length;
          });
      });
      return { counts, total: pool.length };
  }, [players, targetPoolType, sports, categories]);

  // --- GLOBAL DISTRIBUTOR HELPERS ---
  const getPoolStats = (type: 'LIVE' | 'LOTTERY') => {
      const pool = players.filter(p => p.auctionType === type && !p.team && (p.status === 'available' || p.status === 'unsold'));
      const counts: Record<string, number> = {};
      sports.forEach(s => {
          counts[s] = pool.filter(p => p.ratings[s] && p.ratings[s] !== '0').length;
      });
      return { total: pool.length, counts, pool };
  };

  const lotteryStats = useMemo(() => getPoolStats('LOTTERY'), [players, sports]);
  const liveStats = useMemo(() => getPoolStats('LIVE'), [players, sports]);

  const handleDistributePreview = () => {
    // 1. Get Base Pool
    let availableLotteryPlayers = [...lotteryStats.pool];
    
    // Shuffle initially to ensure randomness
    availableLotteryPlayers = shuffleArray(availableLotteryPlayers);

    // 2. Simulation State
    const distribution: Record<string, Player[]> = {};
    teams.forEach(t => distribution[t.name] = []);
    
    // Deep copy teams to track temp stats during simulation
    const simTeams = teams.map(t => ({
        ...t,
        tempCount: t.playerCount,
        tempSportCounts: JSON.parse(JSON.stringify(t.sportStats))
    }));

    // 3. Iterate Per Sport Request (Fair Play Loop)
    for (const sport of sports) {
        const limit = distributeLimits[sport] || 0;
        if (limit <= 0) continue;

        // We need to distribute 'limit' players of 'sport' to EVERY team
        // Iterate 'limit' times (rounds)
        for (let round = 0; round < limit; round++) {
            // Round Robin through teams to be fair
            for (const team of simTeams) {
                // Find a candidate for this team and sport
                const candidateIndex = availableLotteryPlayers.findIndex(p => {
                    // MUST match the requested sport
                    if (!p.ratings[sport] || p.ratings[sport] === '0') return false;
                    
                    // Check Squad Size
                    if (team.tempCount >= config.maxSquadSize) return false;
                    
                    // Check Sport Max Limit
                    const sportLimit = config.sportLimits[sport]?.max || 999;
                    const currentSportCount = team.tempSportCounts[sport]?.total || 0;
                    if (currentSportCount >= sportLimit) return false;

                    return true;
                });

                if (candidateIndex !== -1) {
                    const candidate = availableLotteryPlayers[candidateIndex];
                    
                    // Assign
                    distribution[team.name].push(candidate);
                    
                    // Update Temp Stats
                    team.tempCount++;
                    // Update stats for ALL sports this player plays (since they occupy slots)
                    sports.forEach(s => {
                        if (candidate.ratings[s] && candidate.ratings[s] !== '0') {
                            if(!team.tempSportCounts[s]) team.tempSportCounts[s] = { total: 0, categoryCounts: {} };
                            team.tempSportCounts[s].total++;
                        }
                    });

                    // Remove from eligible pool so they aren't picked again
                    availableLotteryPlayers.splice(candidateIndex, 1);
                }
            }
        }
    }

    setDistributionPreview(distribution);
  };

  const handleConfirmDistribution = () => {
      const allAssignedIds: number[] = [];
      Object.entries(distributionPreview).forEach(([teamName, players]) => {
          (players as Player[]).forEach(p => {
              onSellPlayer(p.id, teamName, config.basePrice);
              allAssignedIds.push(p.id);
          });
      });
      setLastDistBatchIds(allAssignedIds);
      setDistributionPreview({});
      setDistributeLimits(prev => {
          const reset: Record<string, number> = {};
          sports.forEach(s => reset[s] = 0);
          return reset;
      });
      alert(`Successfully distributed ${allAssignedIds.length} players!`);
  };

  const handleUndoDistribution = () => {
      if (lastDistBatchIds.length === 0) return;
      if (confirm(`Undo the last batch of ${lastDistBatchIds.length} assignments?`)) {
          lastDistBatchIds.forEach(id => onUnsellPlayer(id));
          setLastDistBatchIds([]);
          alert("Reverted distribution.");
      }
  };


  const toggleSportExpand = (s: string) => {
      setExpandedSports(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const updateFillRequest = (sport: string, category: string, delta: number) => {
      setFillRequests(prev => {
          const sportReqs = prev[sport] || {};
          const current = sportReqs[category] || 0;
          const next = Math.max(0, current + delta);
          return { ...prev, [sport]: { ...sportReqs, [category]: next } };
      });
  };

  const getTotalRequests = () => {
      let total = 0;
      Object.values(fillRequests).forEach(sportReqs => {
          Object.values(sportReqs).forEach(count => total += count);
      });
      return total;
  };

  const handlePreviewBatch = () => {
      if (!targetFillTeam) { setBatchError("Please select a team first."); return; }
      const demands: {sport: string, category: string}[] = [];
      Object.entries(fillRequests).forEach(([sport, catCounts]) => {
          Object.entries(catCounts).forEach(([cat, count]) => {
              for(let i=0; i<count; i++) demands.push({sport, category: cat});
          });
      });
      if (demands.length === 0) { setBatchError("No players requested."); return; }
      const pool = shuffleArray<Player>(
          players.filter(p => p.auctionType === targetPoolType && !p.team && (p.status === 'available' || p.status === 'unsold'))
      );
      const selectedBatch: {player: Player, covered: string[]}[] = [];
      const usedIds = new Set<number>();
      let missingCount = 0;
      for (const demand of demands) {
          const candidate = pool.find(p => !usedIds.has(p.id) && p.ratings[demand.sport] === demand.category);
          if (candidate) {
              usedIds.add(candidate.id);
              selectedBatch.push({ player: candidate, covered: [`${demand.sport} (Grade ${demand.category})`] });
          } else {
              missingCount++;
          }
      }
      if (selectedBatch.length === 0) { setBatchError(`No eligible players found matching your specific Grade criteria in ${targetPoolType} pool.`); return; }
      if (missingCount > 0) { setBatchError(`Could only find ${selectedBatch.length} players. ${missingCount} requests could not be filled (insufficient stock).`); } else { setBatchError(null); }
      setBatchPreview(selectedBatch);
  };

  const handleConfirmBatch = () => {
      if (!batchPreview || !targetFillTeam) return;
      batchPreview.forEach(item => { onSellPlayer(item.player.id, targetFillTeam, config.basePrice); });
      setBatchPreview(null); setFillRequests({}); setBatchError(null);
  };


  // --- LUCKY DRAW HELPERS ---
  const eligibleRandomPlayers = useMemo(() => {
     return players.filter(p => {
         if (poolSource === 'available' && p.status !== 'available') return false;
         if (poolSource === 'unsold' && p.status !== 'unsold') return false;
         if (p.team) return false; 
         if (p.auctionType !== 'LIVE') return false;
         if (rSport !== 'all' && (!p.ratings[rSport] || p.ratings[rSport] === '0')) return false;
         if (rGrade !== 'all') {
             if (rSport === 'all') return Object.values(p.ratings).includes(rGrade);
             return p.ratings[rSport] === rGrade;
         }
         return true;
     });
  }, [players, rSport, rGrade, poolSource]);

  const handleSpin = () => {
    if (eligibleRandomPlayers.length === 0) return;
    setIsSpinning(true); setSpinWinner(null);
    let speed = 50, counter = 0;
    const run = () => {
        const candidate = eligibleRandomPlayers[Math.floor(Math.random() * eligibleRandomPlayers.length)];
        setSpinName(candidate.name);
        counter++;
        if (counter < 25) {
             if (counter > 15) speed += 40;
             timerRef.current = setTimeout(run, speed);
        } else {
             setSpinWinner(candidate); setIsSpinning(false);
        }
    };
    run();
  };

  // --- VALIDATION & SALE LOGIC ---
  useEffect(() => {
      setFairPlayError(null);
      setOverrideFairPlay(false);
      if (selectedPlayer && winningTeam) {
          const targetTeam = teams.find(t => t.name === winningTeam);
          if (targetTeam) {
              // 1. Check Max Sport Limits
              for (const sport of sports) {
                  if (selectedPlayer.ratings[sport] && selectedPlayer.ratings[sport] !== '0') {
                      const limit = config.sportLimits?.[sport]?.max || 999;
                      const currentCount = targetTeam.sportStats[sport]?.total || 0;
                      if (currentCount >= limit) {
                           setFairPlayError(`🚫 MAX SQUAD LIMIT: ${winningTeam} already has ${currentCount} ${sport} players (Max ${limit}).`);
                           return; 
                      }
                  }
              }
              // 2. Check Fair Play Quotas (Category Limits)
              if (config.categoryLimits) {
                for (const sport of sports) {
                    const rating = selectedPlayer.ratings[sport];
                    if (rating && rating !== '0' && config.categoryLimits[sport]) {
                        const limit = config.categoryLimits[sport][rating];
                        const currentCount = targetTeam.sportStats[sport]?.categoryCounts[rating] || 0;
                        if (currentCount >= limit) {
                            const othersLagging = teams.filter(t => t.name !== winningTeam).some(t => (t.sportStats[sport]?.categoryCounts[rating] || 0) < limit);
                            if (othersLagging) {
                                setFairPlayError(`⚠️ FAIR PLAY QUOTA: All teams must have ${limit} Grade '${rating}' players before you can buy more.`);
                                return;
                            }
                        }
                    }
                }
              }
          }
      }
  }, [winningTeam, selectedPlayer, teams, config, sports]);

  const selectedCorrectionPlayer = useMemo(() => players.find(p => p.id.toString() === correctionPlayerId), [correctionPlayerId, players]);
  useEffect(() => {
      if (selectedCorrectionPlayer?.team) {
          setCorrectionTeam(selectedCorrectionPlayer.team);
          setCorrectionPrice(selectedCorrectionPlayer.price);
      }
  }, [selectedCorrectionPlayer]);

  const handleSell = () => {
    if (isReadOnly || !selectedPlayer || !winningTeam) { setError("Select team."); return; }
    const team = teams.find(t => t.name === winningTeam);
    if (!team) return;
    if (team.playerCount >= config.maxSquadSize) { setError("Team Full!"); return; }
    const emptySlots = Math.max(0, config.maxSquadSize - team.playerCount - 1); 
    const reserve = emptySlots * config.basePrice;
    const maxBid = team.availableBalance - reserve;
    if (bidPrice > maxBid) { setError(`Insufficient Funds. Max Bid: ${maxBid}`); return; }
    onSellPlayer(selectedPlayer.id, winningTeam, bidPrice);
    setLastSale({ player: selectedPlayer, team: winningTeam, price: bidPrice, remainingPurse: team.disposableBalance - bidPrice });
    setError(null);
  };

  const handlePostSaleContinue = () => {
      setLastSale(null); onSelectPlayer(""); setWinningTeam(""); setBidPrice(config.basePrice); 
      if (selectionOrigin === 'randomizer') { setShowRandomizer(true); setSpinWinner(null); setSpinName("Ready?"); }
  };

  const handleMarkUnsoldAction = () => {
      if (!selectedPlayer) return;
      onMarkUnsold(selectedPlayer.id);
      onSelectPlayer(""); setWinningTeam(""); setBidPrice(config.basePrice); setError(null);
      if (selectionOrigin === 'randomizer') { setShowRandomizer(true); setSpinWinner(null); setSpinName("Ready?"); }
  }


  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[700px]">
      
      {/* SIDEBAR */}
      <div className="lg:col-span-3 flex flex-col gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 h-full overflow-hidden shadow-xl lg:order-1 order-2">
        {!isReadOnly && <button onClick={() => { setShowRandomizer(true); onSelectPlayer(""); setSpinWinner(null); setLastSale(null); setBatchPreview(null); }} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white rounded-xl font-bold flex justify-center gap-2 shadow-lg shadow-indigo-900/30 transition-all"><Sparkles className="w-5 h-5" /> Automation Hub</button>}
        <div className="relative"><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" /><input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {unsoldPlayers.map(p => (
              <button key={p.id} onClick={() => { onSelectPlayer(p.id.toString()); setSelectionOrigin('manual'); setShowRandomizer(false); setError(null); setLastSale(null); }} className={`w-full text-left px-4 py-3 rounded-xl border flex justify-between ${currentPlayerId === p.id.toString() ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-800 text-slate-200'}`}>
                <div>
                    <span className="font-bold text-sm block">{p.name}</span>
                    <span className="text-[10px] opacity-60 flex gap-2">
                        <span>#{p.id}</span>
                        {p.status === 'unsold' && <span className="text-amber-400 font-bold">Unsold</span>}
                        {p.auctionType === 'LOTTERY' && <span className="text-blue-400 font-bold flex items-center gap-1"><Dice5 className="w-3 h-3"/> Lottery</span>}
                    </span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            ))}
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="lg:col-span-9 h-full flex flex-col relative lg:order-2 order-1 min-h-[500px]">
        
        {showRandomizer ? (
            <div className="h-full bg-slate-900 rounded-2xl border border-slate-700 flex flex-col relative overflow-hidden">
                {/* Header / Tabs */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-20">
                    <div className="flex bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setRandomizerMode('lucky')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${randomizerMode === 'lucky' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                            <Shuffle className="w-4 h-4" /> Lucky Draw
                        </button>
                        <button onClick={() => setRandomizerMode('targeted')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${randomizerMode === 'targeted' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                            <Target className="w-4 h-4" /> Targeted Fill
                        </button>
                        <button onClick={() => setRandomizerMode('distributor')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${randomizerMode === 'distributor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                            <Layers className="w-4 h-4" /> Global Distributor
                        </button>
                    </div>
                    <button onClick={() => setShowRandomizer(false)}><X className="text-slate-400 hover:text-white" /></button>
                </div>

                {/* MODE 1: LUCKY DRAW */}
                {randomizerMode === 'lucky' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 relative animate-in fade-in zoom-in-95">
                        <div className="flex gap-4 mb-8 z-10 flex-wrap justify-center">
                            <select value={poolSource} onChange={(e) => setPoolSource(e.target.value as any)} disabled={isSpinning} className="bg-slate-800 border-slate-700 text-white rounded px-4 py-2 font-bold"><option value="available">Fresh Pool (Live)</option><option value="unsold">Unsold Pool (Live)</option></select>
                            <select value={rSport} onChange={(e) => setRSport(e.target.value)} disabled={isSpinning} className="bg-slate-800 border-slate-700 text-white rounded px-4 py-2"><option value="all">All Sports</option>{sports.map(s => <option key={s} value={s}>{s}</option>)}</select>
                            <select value={rGrade} onChange={(e) => setRGrade(e.target.value)} disabled={isSpinning} className="bg-slate-800 border-slate-700 text-white rounded px-4 py-2"><option value="all">Any Grade</option>{categories.map(c => <option key={c} value={c}>Grade {c}</option>)}</select>
                        </div>
                        <div className="mb-16 text-center z-10 w-full min-h-[200px] flex items-center justify-center">
                            {spinWinner ? (
                                <div className="animate-in zoom-in">
                                    <div className="text-emerald-400 font-bold tracking-widest uppercase mb-4 animate-pulse">Winner</div>
                                    <h1 className="text-6xl md:text-8xl font-black text-white mb-8">{spinWinner.name}</h1>
                                    <div className="flex justify-center gap-3">
                                        {sports.map((s, i) => {
                                            const r = spinWinner.ratings[s];
                                            if(!r || r==='0') return null;
                                            return <span key={s} className={`px-4 py-1 rounded-full font-bold text-sm text-white ${getSportColor(i).bg}`}>{s}: {r}</span>
                                        })}
                                    </div>
                                </div>
                            ) : eligibleRandomPlayers.length === 0 ? (
                                <div className="text-slate-500 text-2xl font-bold">No LIVE players found in {poolSource} pool.</div>
                            ) : (
                                <h1 className="text-6xl md:text-9xl font-black text-slate-800">{spinName}</h1>
                            )}
                        </div>
                        <div className="z-10 h-20">
                            {spinWinner ? (
                                <button onClick={() => { onSelectPlayer(spinWinner.id.toString()); setSelectionOrigin('randomizer'); setShowRandomizer(false); }} className="px-10 py-4 bg-emerald-600 text-white rounded-full font-bold text-xl flex items-center gap-3">Start Bidding <ArrowRight /></button>
                            ) : (
                                <button onClick={handleSpin} disabled={isSpinning || eligibleRandomPlayers.length === 0} className="px-16 py-6 bg-indigo-600 text-white rounded-full font-black text-2xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">{isSpinning ? '...' : 'SPIN'}</button>
                            )}
                        </div>
                    </div>
                )}

                {/* MODE 2: TARGETED FILL (THE MATRIX) */}
                {randomizerMode === 'targeted' && (
                    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in slide-in-from-right-4">
                        {!batchPreview ? (
                            <div className="max-w-6xl mx-auto">
                                <h3 className="text-2xl font-black text-white mb-6">Targeted Team Filler</h3>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                    {/* 1. TEAM & POOL SELECTOR (Left Col) */}
                                    <div className="md:col-span-4 lg:col-span-3 space-y-6">
                                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                                            <div className="mb-4">
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Pool Source</label>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setTargetPoolType('LIVE')} className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 ${targetPoolType === 'LIVE' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}><Gavel className="w-4 h-4"/> Live</button>
                                                    <button onClick={() => setTargetPoolType('LOTTERY')} className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 ${targetPoolType === 'LOTTERY' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}><Dice5 className="w-4 h-4"/> Lottery</button>
                                                </div>
                                                <div className="text-center mt-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Available: <span className="text-white">{poolAvailability.total}</span></div>
                                            </div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Select Target Team</label>
                                            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                                {teams.map(t => (
                                                    <button key={t.name} onClick={() => setTargetFillTeam(t.name)} className={`p-3 rounded-xl border text-left transition-all ${targetFillTeam === t.name ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-500/30' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                                        <div className="font-bold text-sm truncate">{t.name}</div>
                                                        <div className="text-xs opacity-70 mt-1 flex justify-between"><span>Size: {t.playerCount}</span><span className="font-mono">{t.disposableBalance}</span></div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={handlePreviewBatch} disabled={getTotalRequests() === 0} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"><Play className="w-5 h-5 fill-current" /> Preview Batch</button>
                                        {batchError && <div className="p-3 bg-red-900/30 text-red-200 text-xs font-bold rounded-lg border border-red-500/30">{batchError}</div>}
                                    </div>

                                    {/* 2. THE MATRIX (Right Col) */}
                                    <div className="md:col-span-8 lg:col-span-9">
                                        {selectedTargetTeamData ? (
                                            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                                                <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                                                    <h4 className="font-bold text-white flex items-center gap-2"><Target className="w-5 h-5 text-emerald-400" /> <span className="truncate">{selectedTargetTeamData.name} Wishlist</span></h4>
                                                    <span className="text-xs font-bold text-slate-500 uppercase">Requests: {getTotalRequests()}</span>
                                                </div>
                                                <div className="p-4 space-y-4">
                                                    {sports.map((sport, i) => {
                                                        const isExpanded = expandedSports.includes(sport);
                                                        const colors = getSportColor(i);
                                                        const teamSportStats = selectedTargetTeamData.sportStats[sport] || { total: 0, categoryCounts: {} };
                                                        return (
                                                            <div key={sport} className={`border rounded-xl overflow-hidden ${colors.border} bg-slate-900/30`}>
                                                                <button onClick={() => toggleSportExpand(sport)} className={`w-full flex items-center justify-between p-3 ${colors.soft} hover:brightness-110 transition-all`}>
                                                                    <div className="flex items-center gap-3"><span className={`font-black uppercase text-sm ${colors.text}`}>{sport}</span><span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded text-white/70">Team has: {teamSportStats.total}</span></div>
                                                                    {isExpanded ? <ChevronUp className={`w-4 h-4 ${colors.text}`}/> : <ChevronDown className={`w-4 h-4 ${colors.text}`}/>}
                                                                </button>
                                                                {isExpanded && (
                                                                    <div className="divide-y divide-slate-800/50">
                                                                        {categories.map(cat => {
                                                                            const reqCount = fillRequests[sport]?.[cat] || 0;
                                                                            const availCount = poolAvailability.counts[sport]?.[cat] || 0;
                                                                            const haveCount = teamSportStats.categoryCounts[cat] || 0;
                                                                            return (
                                                                                <div key={cat} className="flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors">
                                                                                    <div className="flex items-center gap-4 w-1/3"><span className="text-sm font-bold text-slate-300 w-16">Grade {cat}</span><span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">Have: {haveCount}</span></div>
                                                                                    <div className="w-1/3 text-center"><span className={`text-[10px] font-bold uppercase tracking-wider ${availCount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>Avail: {availCount}</span></div>
                                                                                    <div className="flex items-center gap-2 w-1/3 justify-end">
                                                                                        <button onClick={() => updateFillRequest(sport, cat, -1)} className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-colors"><Minus className="w-3 h-3" /></button>
                                                                                        <span className={`w-6 text-center font-bold ${reqCount > 0 ? 'text-white' : 'text-slate-600'}`}>{reqCount}</span>
                                                                                        <button onClick={() => updateFillRequest(sport, cat, 1)} className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-colors"><Plus className="w-3 h-3" /></button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl p-12">
                                                <Target className="w-16 h-16 mb-4 opacity-30" />
                                                <p className="font-bold text-lg">Select a team to build wishlist</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                                <div className="bg-slate-900 p-4 border-b border-slate-800 flex items-center justify-between"><h3 className="font-black text-white text-lg flex items-center gap-2"><Sparkles className="text-amber-400" /> Confirm Batch Assignment</h3><div className="text-sm font-bold text-slate-400">Target: <span className="text-emerald-400">{targetFillTeam}</span> ({targetPoolType})</div></div>
                                <div className="max-h-[400px] overflow-y-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-900 text-slate-500 uppercase text-xs font-bold sticky top-0"><tr><th className="p-4">Player</th><th className="p-4">Selection Criteria</th><th className="p-4 text-right">Price</th></tr></thead><tbody className="divide-y divide-slate-800">{batchPreview.map((item, idx) => (<tr key={idx}><td className="p-4 font-bold text-white">{item.player.name}</td><td className="p-4"><div className="flex flex-wrap gap-2">{item.covered.map((reason, i) => (<span key={i} className="px-2 py-1 rounded text-xs font-bold border bg-indigo-900/30 text-indigo-300 border-indigo-500/30">{reason}</span>))}</div></td><td className="p-4 text-right font-mono text-emerald-400">{config.basePrice}</td></tr>))}</tbody></table></div>
                                <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3"><button onClick={() => setBatchPreview(null)} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800">Cancel</button><button onClick={handleConfirmBatch} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Confirm & Assign ({batchPreview.length})</button></div>
                            </div>
                        )}
                    </div>
                )}

                {/* MODE 3: GLOBAL DISTRIBUTOR */}
                {randomizerMode === 'distributor' && (
                    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in slide-in-from-right-4">
                         
                         {/* 1. Pool Statistics Dual Dashboard */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                             {/* Lottery Stats */}
                             <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-3 opacity-10"><Dice5 className="w-16 h-16 text-blue-400"/></div>
                                 <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Lottery Pool Stats</h4>
                                 <div className="flex items-end gap-4 mb-4">
                                     <div className="text-4xl font-black text-white">{lotteryStats.total}</div>
                                     <div className="text-xs text-slate-500 mb-1 font-bold uppercase">Players Available</div>
                                 </div>
                                 <div className="flex flex-wrap gap-2">
                                     {sports.map((s, i) => (
                                         <div key={s} className={`px-2 py-1 rounded text-[10px] font-bold border ${getSportColor(i).soft} ${getSportColor(i).border} ${getSportColor(i).text}`}>
                                             {s}: {lotteryStats.counts[s] || 0}
                                         </div>
                                     ))}
                                 </div>
                             </div>

                             {/* Live Stats */}
                             <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-3 opacity-10"><Gavel className="w-16 h-16 text-indigo-400"/></div>
                                 <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Live Pool Stats</h4>
                                 <div className="flex items-end gap-4 mb-4">
                                     <div className="text-4xl font-black text-white">{liveStats.total}</div>
                                     <div className="text-xs text-slate-500 mb-1 font-bold uppercase">Players Available</div>
                                 </div>
                                 <div className="flex flex-wrap gap-2">
                                     {sports.map((s, i) => (
                                         <div key={s} className={`px-2 py-1 rounded text-[10px] font-bold border ${getSportColor(i).soft} ${getSportColor(i).border} ${getSportColor(i).text}`}>
                                             {s}: {liveStats.counts[s] || 0}
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </div>

                         {/* 2. Controls & Preview */}
                         <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 mb-8">
                             {Object.keys(distributionPreview).length === 0 ? (
                                 <div>
                                     <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2"><Scale className="w-5 h-5 text-emerald-400" /> Fair Play Distribution</h3>
                                     <p className="text-xs text-slate-400 mb-6">Specify how many players of each sport should be assigned to <strong className="text-white">EVERY TEAM</strong> in this round.</p>
                                     
                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                         {sports.map((s, i) => (
                                             <div key={s} className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                                 <label className={`text-[10px] font-bold uppercase block mb-2 ${getSportColor(i).text}`}>Distribute {s}</label>
                                                 <div className="flex items-center gap-3">
                                                     <button onClick={() => setDistributeLimits(prev => ({...prev, [s]: Math.max(0, (prev[s]||0)-1)}))} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700"><Minus className="w-4 h-4"/></button>
                                                     <div className="flex-1 text-center font-black text-xl text-white">{distributeLimits[s] || 0}</div>
                                                     <button onClick={() => setDistributeLimits(prev => ({...prev, [s]: (prev[s]||0)+1}))} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center border border-slate-700"><Plus className="w-4 h-4"/></button>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>

                                     <button onClick={handleDistributePreview} disabled={lotteryStats.total === 0} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all">
                                         <Sparkles className="w-5 h-5" /> Generate Distribution Preview
                                     </button>
                                 </div>
                             ) : (
                                 <div className="flex gap-4">
                                     <button onClick={() => setDistributionPreview({})} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold">Discard</button>
                                     <button onClick={handleConfirmDistribution} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                                         <CheckCircle className="w-5 h-5" /> Confirm & Commit Round
                                     </button>
                                 </div>
                             )}

                             {/* UNDO BUTTON */}
                             {lastDistBatchIds.length > 0 && Object.keys(distributionPreview).length === 0 && (
                                 <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                                     <button onClick={handleUndoDistribution} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                                         <RotateCcw className="w-3 h-3"/> Undo Last Batch ({lastDistBatchIds.length} players)
                                     </button>
                                 </div>
                             )}
                         </div>

                         {/* 3. Preview Table */}
                         {Object.keys(distributionPreview).length > 0 && (
                             <div className="space-y-2 animate-in slide-in-from-bottom-4">
                                 <div className="flex justify-between items-end mb-2">
                                     <h4 className="text-white font-bold">Distribution Master Preview</h4>
                                     <span className="text-xs text-slate-500 font-bold uppercase">Showing Assignments</span>
                                 </div>
                                 <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                                     <table className="w-full text-left text-sm">
                                         <thead className="bg-slate-900 text-slate-500 font-bold text-[10px] uppercase">
                                             <tr>
                                                 <th className="p-4">Team</th>
                                                 <th className="p-4 text-center">Added</th>
                                                 <th className="p-4">Breakdown</th>
                                                 <th className="p-4 text-right">New Total</th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-800">
                                             {teams.map(team => {
                                                 const addedPlayers = distributionPreview[team.name] || [];
                                                 const sportBreakdown: string[] = [];
                                                 
                                                 // Calculate Summary stats for this batch
                                                 if(addedPlayers.length > 0) {
                                                     sports.forEach(s => {
                                                         const count = addedPlayers.filter(p => p.ratings[s] && p.ratings[s] !== '0').length;
                                                         if (count > 0) sportBreakdown.push(`${count} ${s.slice(0,2)}`);
                                                     });
                                                 }

                                                 return (
                                                     <tr key={team.name} className="hover:bg-slate-900/50 transition-colors">
                                                         <td className="p-4 font-bold text-white">{team.name}</td>
                                                         <td className="p-4 text-center">
                                                             <span className={`px-2 py-1 rounded text-xs font-bold ${addedPlayers.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                                 +{addedPlayers.length}
                                                             </span>
                                                         </td>
                                                         <td className="p-4 font-mono text-xs text-slate-400">
                                                             {sportBreakdown.length > 0 ? sportBreakdown.join(', ') : '-'}
                                                         </td>
                                                         <td className="p-4 text-right font-mono font-bold text-indigo-400">
                                                             {team.playerCount + addedPlayers.length}
                                                         </td>
                                                     </tr>
                                                 );
                                             })}
                                         </tbody>
                                     </table>
                                 </div>
                             </div>
                         )}
                    </div>
                )}
            </div>
        ) : lastSale ? (
            /* SALE SUMMARY OVERLAY */
            <div className="h-full flex flex-col items-center justify-center bg-slate-900 rounded-3xl border border-slate-700 p-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
                <div className="text-center z-10">
                    <h1 className="text-6xl md:text-8xl font-black text-emerald-500 mb-2 drop-shadow-2xl tracking-tighter">SOLD!</h1>
                    <div className="text-4xl md:text-6xl text-white font-bold mb-8">{lastSale.player.name}</div>
                    
                    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 w-full max-w-xl mx-auto space-y-6 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                            <span className="text-slate-400 uppercase font-bold text-sm tracking-widest">Sold To</span>
                            <span className="text-indigo-400 font-black text-3xl">{lastSale.team}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                            <span className="text-slate-400 uppercase font-bold text-sm tracking-widest">Price</span>
                            <span className="text-white font-black text-4xl font-mono">₹{lastSale.price}</span>
                        </div>
                        <div className="pt-2">
                            <div className="flex justify-between items-center bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Wallet className="w-5 h-5" />
                                    <span className="text-xs uppercase font-bold tracking-wider">New Purse Balance</span>
                                </div>
                                <span className="text-emerald-300 font-mono font-black text-2xl">₹{lastSale.remainingPurse}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-12 justify-center">
                        <button onClick={handlePostSaleContinue} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg flex items-center gap-2 transition-all">
                            Continue <ChevronRight className="w-5 h-5" />
                        </button>
                        {selectionOrigin === 'randomizer' && randomizerMode === 'lucky' && (
                            <button onClick={handlePostSaleContinue} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                                <Shuffle className="w-5 h-5" /> Next Spin
                            </button>
                        )}
                        {selectionOrigin === 'randomizer' && randomizerMode === 'targeted' && (
                            <button onClick={handlePostSaleContinue} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all">
                                <Target className="w-5 h-5" /> Fill More
                            </button>
                        )}
                    </div>
                </div>
            </div>
        ) : selectedPlayer ? (
          <div className="h-full flex flex-col gap-4 animate-in slide-in-from-bottom-8">
            {/* HERO CARD */}
            <div className="flex-[2] bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 p-6 relative flex items-center justify-center">
               <button onClick={() => onSelectPlayer("")} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><X /></button>
               <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-12">
                   <div className="w-64 h-64 rounded-2xl border-4 border-slate-600/50 overflow-hidden bg-slate-800 relative shadow-2xl">
                        <PlayerImage name={selectedPlayer.name} className="w-full h-full object-cover" />
                   </div>
                   <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <div className={`inline-block px-3 py-1 text-xs font-bold uppercase rounded-full mb-2 ${selectedPlayer.status === 'unsold' ? 'bg-amber-900/50 text-amber-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                {selectedPlayer.status === 'unsold' ? 'Re-Auctioning (Unsold)' : 'Now Auctioning'}
                            </div>
                            {selectedPlayer.auctionType === 'LOTTERY' && (
                                <div className="inline-block px-3 py-1 text-xs font-bold uppercase rounded-full mb-2 ml-2 bg-blue-900/50 text-blue-400 border border-blue-500/30">
                                    LOTTERY TIER
                                </div>
                            )}
                            <h1 className="text-6xl font-black text-white leading-tight">{selectedPlayer.name}</h1>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                           {sports.map((sport, i) => {
                               const rating = selectedPlayer.ratings[sport];
                               if (!rating || rating === '0') return null;
                               const colors = getSportColor(i);
                               return <div key={sport} className={`px-4 py-2 rounded-xl border-2 text-lg font-black uppercase shadow-lg ${colors.bg} ${colors.border} text-white`}>{sport}: {rating}</div>
                           })}
                        </div>
                        <div className="pt-2"><span className="text-slate-400 text-sm uppercase font-bold">Base Price</span><div className="text-3xl font-mono font-black text-emerald-400">{config.basePrice}</div></div>
                   </div>
               </div>
            </div>

            {/* CONTROLS */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-center">
                {error && <div className="mb-4 p-3 bg-red-900/30 text-red-200 rounded-lg text-center font-bold">{error}</div>}
                {fairPlayError && <div className="mb-4 p-4 bg-amber-900/20 text-amber-100 rounded-lg flex gap-3"><Scale className="text-amber-500" /><div><p className="font-bold text-sm">{fairPlayError}</p><label className="flex gap-2 mt-2 cursor-pointer"><input type="checkbox" checked={overrideFairPlay} onChange={e => setOverrideFairPlay(e.target.checked)} /><span className="text-xs font-bold text-amber-400 uppercase">Override Rule</span></label></div></div>}
                
                {!isReadOnly ? (
                    <div className="flex flex-col md:flex-row items-end gap-4 h-full">
                        <div className="w-full md:flex-[2] h-full flex flex-col">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2">Team</label>
                            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto max-h-[160px] custom-scrollbar">
                                {teams.map(t => (
                                    <button key={t.name} onClick={() => setWinningTeam(t.name)} disabled={t.disposableBalance <= 0} className={`p-3 rounded-xl border text-left ${winningTeam === t.name ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'} ${t.disposableBalance<=0?'opacity-50':''}`}>
                                        <div className="font-bold text-sm truncate">{t.name}</div><div className="text-xs font-mono opacity-80">${t.disposableBalance}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2">Bid</label>
                            <div className="flex h-[88px]"><button onClick={() => setBidPrice(p => Math.max(0, p-5))} className="px-3 bg-slate-800 border border-slate-700 rounded-l-2xl text-slate-300"><Minus /></button><input type="number" className="w-full bg-slate-950 border-y border-slate-700 text-center text-white text-4xl font-black" value={bidPrice} onChange={e => setBidPrice(parseInt(e.target.value)||0)} /><button onClick={() => setBidPrice(p => p+5)} className="px-3 bg-slate-800 border border-slate-700 rounded-r-2xl text-slate-300"><Plus /></button></div>
                        </div>
                        <div className="w-full md:flex-1 flex gap-2 h-[88px]">
                             <button onClick={() => { onSelectPlayer(""); setWinningTeam(""); }} className="aspect-square bg-slate-800 border-2 border-slate-700 text-slate-400 hover:text-red-400 rounded-2xl flex flex-col items-center justify-center"><Ban /><span className="text-[10px] font-bold">PASS</span></button>
                             <div className="flex-1 flex flex-col gap-2 h-full">
                                <button onClick={handleSell} disabled={!!fairPlayError && !overrideFairPlay} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"><Gavel className="w-5 h-5" /> SOLD</button>
                                <button onClick={handleMarkUnsoldAction} className="h-10 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"><AlertOctagon className="w-4 h-4" /> MARK UNSOLD</button>
                             </div>
                        </div>
                    </div>
                ) : <div className="text-center opacity-50"><Gavel className="w-16 h-16 mx-auto mb-4" /><h3>Waiting for Auctioneer</h3></div>}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-slate-900/50 rounded-3xl border border-slate-800/50 flex flex-col items-center justify-center text-slate-600">
              <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center mb-6"><Gavel className="w-12 h-12" /></div>
              <h2 className="text-3xl font-black text-slate-700">Ready</h2>
          </div>
        )}

        {/* CORRECTION MANAGER */}
        {!isReadOnly && (
            <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer font-bold text-slate-500 hover:text-white"><PenTool className="w-4 h-4" /> Correction Manager</summary>
                    <div className="pt-4 mt-4 border-t border-slate-800 space-y-4">
                        <div className="flex gap-4">
                            <select className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm" onChange={e => setCorrectionPlayerId(e.target.value)} value={correctionPlayerId}><option value="">Recently Sold</option>{recentlySoldList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}</select>
                            <input type="text" placeholder="Search sold players..." className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm" value={correctionSearch} onChange={e => { setCorrectionSearch(e.target.value); setCorrectionPlayerId(""); }} />
                        </div>
                        {correctionSearch && !correctionPlayerId && (
                            <div className="bg-slate-800 p-2 rounded max-h-32 overflow-y-auto">{soldPlayers.map(p => <div key={p.id} onClick={() => { setCorrectionPlayerId(p.id.toString()); setCorrectionSearch(""); }} className="p-2 hover:bg-slate-700 cursor-pointer text-sm text-slate-300">{p.name} ({p.team})</div>)}</div>
                        )}
                        {selectedCorrectionPlayer && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded flex justify-between items-center">
                                <div><div className="text-xs text-slate-400 font-bold uppercase">Editing</div><div className="font-black text-white">{selectedCorrectionPlayer.name}</div></div>
                                <div className="flex gap-2">
                                    <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-sm" value={correctionTeam} onChange={e => setCorrectionTeam(e.target.value)}>{teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}</select>
                                    <input 
                                        type="number" 
                                        className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-sm" 
                                        value={correctionPrice} 
                                        onChange={e => setCorrectionPrice(parseInt(e.target.value) || 0)} 
                                    />
                                    <button onClick={() => { onUpdatePlayer(parseInt(correctionPlayerId), correctionTeam, correctionPrice); setCorrectionPlayerId(""); }} className="bg-indigo-600 px-3 rounded text-white text-xs font-bold">Save</button>
                                    <button 
                                        onClick={() => { 
                                            if (confirm("Revert this sale? This will refund the purse and reset the player.")) { 
                                                onUnsellPlayer(parseInt(correctionPlayerId)); 
                                                setCorrectionPlayerId(""); 
                                            } 
                                        }} 
                                        className="bg-red-600 px-3 rounded text-white text-xs font-bold"
                                    >
                                        Unsell
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