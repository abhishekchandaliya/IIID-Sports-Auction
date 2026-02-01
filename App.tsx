import React, { useState, useEffect, useMemo } from 'react';
import { Tab, Player, ActivityLog, TournamentConfig } from './types';
import { INITIAL_TEAMS, DEFAULT_CONFIG } from './constants';
import { calculateTeamStats, normalizeRating, parseCurrency } from './utils';
import Dashboard from './components/Dashboard';
import AuctionConsole from './components/AuctionConsole';
import RosterView from './components/RosterView';
import FileUploader from './components/FileUploader';
import CaptainAssignment from './components/CaptainAssignment';
import { LayoutDashboard, Gavel, Users, Settings, Trophy, UploadCloud, Trash2, Crown, Lock, Unlock, Download, ChevronDown, Database, Menu, X, Save, Settings2, AlertCircle, CheckCircle, ShieldCheck, Scale } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- FIREBASE IMPORTS ---
import { ref, onValue, set, update, remove } from 'firebase/database';
import { db } from './firebaseConfig';

// Helper to safely get value from row with fuzzy key matching
const getRowValue = (row: any, ...candidates: string[]) => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
        const foundKey = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
        if (foundKey !== undefined) return row[foundKey];
    }
    return undefined;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [players, setPlayers] = useState<Player[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Configuration State
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [tempConfig, setTempConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [configSaved, setConfigSaved] = useState(false);
  
  // Settings UI State
  const [settingsSportTab, setSettingsSportTab] = useState<'Cricket' | 'Badminton' | 'TT'>('Cricket');

  // Navigation State
  const [targetTeam, setTargetTeam] = useState<string | null>(null);
  
  // SYNCED STATE: Current Auction Player ID
  const [currentAuctionPlayerId, setCurrentAuctionPlayerId] = useState<string>(""); 
  
  // Audit Trail / Recent Activity
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  // --- FIREBASE LISTENERS (The "Brain") ---
  useEffect(() => {
    // 1. Listen for Players Data
    const playersRef = ref(db, 'players');
    const unsubscribePlayers = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedPlayers = Object.values(data) as Player[];
        // Sort by ID to keep consistent order
        loadedPlayers.sort((a, b) => a.id - b.id);
        setPlayers(loadedPlayers);
        setDataLoaded(true);
      } else {
        setPlayers([]);
        setDataLoaded(false);
      }
    });

    // 2. Listen for Configuration
    const configRef = ref(db, 'config');
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setConfig(data);
            setTempConfig(data);
        }
    });

    // 3. Listen for Current Auction Player (Syncs the big screen)
    const currentRef = ref(db, 'current_auction_id');
    const unsubscribeCurrent = onValue(currentRef, (snapshot) => {
        const id = snapshot.val();
        setCurrentAuctionPlayerId(id ? String(id) : "");
    });

    // 4. Listen for Activity Log
    const activityRef = ref(db, 'activity_log');
    const unsubscribeActivity = onValue(activityRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const logs = Object.values(data) as ActivityLog[];
            // Sort by timestamp desc
            logs.sort((a, b) => b.timestamp - a.timestamp);
            setRecentActivity(logs.slice(0, 10)); // Keep last 10
        } else {
            setRecentActivity([]);
        }
    });

    return () => {
        unsubscribePlayers();
        unsubscribeConfig();
        unsubscribeCurrent();
        unsubscribeActivity();
    };
  }, []);

  // --- FIREBASE ACTIONS ---

  const logToFirebase = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
      const newLogRef = ref(db, `activity_log/${Date.now()}`);
      set(newLogRef, {
          ...log,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now()
      });
  };

  // Syncs the "Current Player" to all devices when Admin selects one
  const handleCurrentPlayerChange = (id: string) => {
      set(ref(db, 'current_auction_id'), id);
  };

  // Derive Team Stats locally based on synced players
  const teams = useMemo(() => {
    return INITIAL_TEAMS.map(initialTeam => {
      return calculateTeamStats(initialTeam.name, players, config);
    });
  }, [players, config]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "ABCD2026") { 
        setIsAdmin(true);
        setLoginError(false);
        setPasswordInput("");
    } else {
        setLoginError(true);
    }
  };

  const handleLogout = () => {
      setIsAdmin(false);
      setActiveTab(Tab.DASHBOARD);
  };

  const handleTeamSelect = (teamName: string) => {
      setTargetTeam(teamName);
      setActiveTab(Tab.ROSTER);
      setMobileMenuOpen(false);
  };

  const switchTab = (tab: Tab) => {
      setActiveTab(tab);
      setMobileMenuOpen(false);
  }

  // Handle Master CSV Load -> Upload to Firebase
  const handleMasterLoad = (rawData: any[]) => {
    const parsedPlayers: Player[] = rawData
        .filter((row: any) => {
             const name = getRowValue(row, 'Player Name', 'Name', 'Player');
             return name && typeof name === 'string' && name.trim() !== '';
        })
        .map((row: any, index: number) => {
            const pName = getRowValue(row, 'Player Name', 'Name', 'Player');
            const pTeam = getRowValue(row, 'Team', 'Winning Team');
            const pPriceVal = getRowValue(row, 'Auction Value', 'Price');
            const pPrice = parseCurrency(pPriceVal || '0');
            const pContact = getRowValue(row, 'Contact No', 'Mobile', 'Contact');
            
            const cricket = getRowValue(row, 'Cricket', 'Cric'); 
            const badminton = getRowValue(row, 'Badminton', 'Bad');
            const tt = getRowValue(row, 'TT', 'Table Tennis');

            let matchedTeam = null;
            if (pTeam) {
                const cleanTeam = pTeam.trim();
                const found = INITIAL_TEAMS.find(t => t.name.toLowerCase() === cleanTeam.toLowerCase());
                if (found) matchedTeam = found.name;
            }

            return {
                id: index + 1, 
                name: pName.trim(),
                team: matchedTeam,
                price: matchedTeam ? pPrice : 0, 
                cricket: normalizeRating(cricket),
                badminton: normalizeRating(badminton),
                tt: normalizeRating(tt),
                contactNo: pContact ? String(pContact).trim() : 'N/A'
            };
        });

    if (parsedPlayers.length === 0) {
        alert("No valid player data found.");
        return;
    }

    // FIREBASE UPLOAD
    const updates: any = {};
    parsedPlayers.forEach(p => {
        updates[`players/${p.id}`] = p;
    });
    
    update(ref(db), updates)
        .then(() => alert(`Uploaded ${parsedPlayers.length} players to Cloud!`))
        .catch(e => alert("Upload failed: " + e.message));
  };

  // Handle Sport Load -> Append/Merge to Firebase
  const handleSportLoad = (sport: 'cricket' | 'badminton' | 'tt', rawData: any[]) => {
      const newPlayers = [...players];
      let nextId = newPlayers.length > 0 ? Math.max(...newPlayers.map(p => p.id)) + 1 : 1;
      const updates: any = {};

      rawData.forEach(row => {
           const name = getRowValue(row, 'Player Name', 'Name', 'Player');
           if (!name || typeof name !== 'string' || !name.trim()) return;
           
           const cleanName = name.trim();
           let rating = getRowValue(row, sport, 'Grade', 'Category');
           const contact = getRowValue(row, 'Contact No', 'Mobile');

           if (!rating) {
               const values = Object.values(row);
               rating = values.find(v => typeof v === 'string' && ['A','B','C'].includes(v.toUpperCase().trim()));
           }

           const normalizedRating = normalizeRating(rating || '0');
           const existingPlayer = newPlayers.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
           
           if (existingPlayer) {
               updates[`players/${existingPlayer.id}/${sport}`] = normalizedRating;
               if(contact) updates[`players/${existingPlayer.id}/contactNo`] = String(contact).trim();
           } else {
               const newP = {
                   id: nextId++,
                   name: cleanName,
                   team: null,
                   price: 0,
                   cricket: sport === 'cricket' ? normalizedRating : '0',
                   badminton: sport === 'badminton' ? normalizedRating : '0',
                   tt: sport === 'tt' ? normalizedRating : '0',
                   contactNo: contact ? String(contact).trim() : 'N/A'
               };
               updates[`players/${newP.id}`] = newP;
               newPlayers.push(newP as Player); 
           }
      });

      update(ref(db), updates);
  };

  const handleSellPlayer = (playerId: number, teamName: string, price: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const updates: any = {};
    updates[`players/${playerId}/team`] = teamName;
    updates[`players/${playerId}/price`] = price;
    updates[`current_auction_id`] = null; // Clear active player

    update(ref(db), updates).then(() => {
        logToFirebase({
            type: 'sale',
            message: `💰 SOLD: ${player.name} to ${teamName} for **${price}**`,
            details: { playerName: player.name, teamName, price }
        });
    });
  };

  const handleUnsellPlayer = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      const prevTeam = player.team;

      update(ref(db, `players/${playerId}`), { team: null, price: 0, captainFor: null })
      .then(() => {
          logToFirebase({
            type: 'revert',
            message: `❌ REVERTED: ${player.name} removed from ${prevTeam}`,
            details: { playerName: player.name, teamName: prevTeam, price: 0 }
          });
      });
  };

  const handleUpdatePlayer = (playerId: number, teamName: string, price: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;

      update(ref(db, `players/${playerId}`), { team: teamName, price: price })
      .then(() => {
          logToFirebase({
              type: 'correction',
              message: `🛠️ CORRECTION: ${player.name} updated to ${teamName} @ **${price}**`,
              details: { playerName: player.name, teamName, price }
          });
      });
  };

  const handleAssignCaptain = (playerId: number, teamName: string, sport: 'Cricket' | 'Badminton' | 'TT', price: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    update(ref(db, `players/${playerId}`), {
        team: teamName,
        price: price,
        captainFor: sport
    }).then(() => {
        logToFirebase({
            type: 'captain',
            message: `👑 CAPTAIN: ${player.name} assigned to ${teamName} (${sport}) for **${price}**`,
            details: { playerName: player.name, teamName, price }
        });
    });
  };

  const handleRemoveCaptain = (playerId: number) => {
      update(ref(db, `players/${playerId}`), {
          team: null,
          price: 0,
          captainFor: null
      });
  };

  const handleSaveConfig = (e: React.FormEvent) => {
      e.preventDefault();
      set(ref(db, 'config'), tempConfig);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleReset = () => {
    if(confirm("Are you sure you want to reset all auction data? This cannot be undone.")) {
        remove(ref(db, 'players'));
        remove(ref(db, 'current_auction_id'));
        remove(ref(db, 'activity_log'));
        location.reload();
    }
  };

  // Helper for exports
  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  };

  const handleExport = (format: 'csv' | 'json' | 'xml' | 'xlsx' | 'ods') => {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `auction_data_${timestamp}`;
      const exportData = [...players].sort((a, b) => (a.team || "zz").localeCompare(b.team || "zz"));

      if (format === 'json') {
          downloadFile(JSON.stringify(exportData, null, 2), `${fileName}.json`, 'application/json');
      } else if (format === 'xlsx') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Auction Data");
          XLSX.writeFile(wb, `${fileName}.${format}`);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-2 rounded-lg shadow-lg shadow-amber-900/40">
                <Trophy className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-lg md:text-2xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
              IIID Sports Auction 2026
            </h1>
            {isAdmin ? (
                <span className="hidden md:inline-flex ml-2 px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px] border border-emerald-500/30 uppercase tracking-wide font-bold">Admin Mode</span>
            ) : (
                <span className="hidden md:inline-flex ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 text-[10px] border border-slate-700 uppercase tracking-wide font-bold">Viewer Mode</span>
            )}
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <nav className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                <button onClick={() => switchTab(Tab.DASHBOARD)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.DASHBOARD ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                    <LayoutDashboard className="w-4 h-4" /> <span>Dashboard</span>
                </button>
                {isAdmin && (
                    <button onClick={() => switchTab(Tab.AUCTION)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.AUCTION ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                        <Gavel className="w-4 h-4" /> <span>Console</span>
                    </button>
                )}
                <button onClick={() => switchTab(Tab.ROSTER)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.ROSTER ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                    <Users className="w-4 h-4" /> <span>Teams</span>
                </button>
                <button onClick={() => switchTab(Tab.SETTINGS)} className={`p-2 rounded-lg transition-all ${activeTab === Tab.SETTINGS ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                    {isAdmin ? <Settings className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
            </nav>
            <div className="h-6 w-px bg-slate-700"></div>
            {isAdmin ? (
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Logout"><Unlock className="w-5 h-5" /></button>
            ) : (
                <button onClick={() => switchTab(Tab.SETTINGS)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Admin Login"><Lock className="w-5 h-5" /></button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
             {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {mobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-slate-900 border-b border-slate-800 p-4 shadow-2xl z-50">
                <nav className="flex flex-col gap-2">
                    <button onClick={() => switchTab(Tab.DASHBOARD)} className="p-3 rounded-lg text-left font-bold text-slate-300 hover:bg-slate-800">Dashboard</button>
                    {isAdmin && <button onClick={() => switchTab(Tab.AUCTION)} className="p-3 rounded-lg text-left font-bold text-slate-300 hover:bg-slate-800">Auction Console</button>}
                    <button onClick={() => switchTab(Tab.ROSTER)} className="p-3 rounded-lg text-left font-bold text-slate-300 hover:bg-slate-800">Teams</button>
                    <button onClick={() => switchTab(Tab.SETTINGS)} className="p-3 rounded-lg text-left font-bold text-slate-300 hover:bg-slate-800">Settings</button>
                </nav>
            </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-[1600px]">
        
        {!dataLoaded && activeTab !== Tab.SETTINGS ? (
           <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in duration-700">
                <div className="bg-slate-900 p-8 rounded-full shadow-2xl shadow-indigo-500/20 border border-slate-800">
                    <Database className="w-16 h-16 text-indigo-500 mb-2" />
                </div>
                <div>
                    <h2 className="text-4xl font-black text-white mb-2">Initialize Database</h2>
                    <p className="text-slate-400 max-w-lg mx-auto text-lg">
                        Welcome to Sports Auction Pro. Please upload your player list to begin.
                    </p>
                </div>
                
                <div className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 shadow-xl">
                      <FileUploader label="Upload Master Player.csv" onDataLoaded={handleMasterLoad} />
                      <div className="mt-8 pt-8 border-t border-slate-800">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Or upload specific sports</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <FileUploader label="Cricket" variant="compact" onDataLoaded={(d) => handleSportLoad('cricket', d)} />
                            <FileUploader label="Badminton" variant="compact" onDataLoaded={(d) => handleSportLoad('badminton', d)} />
                            <FileUploader label="TT" variant="compact" onDataLoaded={(d) => handleSportLoad('tt', d)} />
                        </div>
                      </div>
                </div>
           </div>
        ) : (
            <>
                {activeTab === Tab.DASHBOARD && (
                    <Dashboard 
                        teams={teams} 
                        players={players} 
                        onTeamSelect={handleTeamSelect} 
                        currentAuctionPlayerId={currentAuctionPlayerId}
                        config={config}
                    />
                )}
                {/* Auction Console: Pass onSelectPlayer to sync ID to Firebase */}
                {activeTab === Tab.AUCTION && isAdmin && (
                    <AuctionConsole 
                        players={players} 
                        teams={teams} 
                        onSellPlayer={handleSellPlayer} 
                        onUnsellPlayer={handleUnsellPlayer}
                        onUpdatePlayer={handleUpdatePlayer}
                        isReadOnly={!isAdmin} 
                        currentPlayerId={currentAuctionPlayerId}
                        onSelectPlayer={handleCurrentPlayerChange} 
                        recentActivity={recentActivity}
                        config={config}
                    />
                )}
                {activeTab === Tab.ROSTER && <RosterView players={players} teams={teams} recentActivity={recentActivity} targetTeam={targetTeam} config={config} />}
                {activeTab === Tab.SETTINGS && (
                    <div className="max-w-5xl mx-auto pt-6 pb-20">

                        {!isAdmin ? (
                            <div className="max-w-md mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-center">
                                <div className="inline-flex p-4 bg-slate-800 rounded-full mb-6 text-indigo-400 border border-slate-700">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <h2 className="text-3xl font-black text-white mb-3">Admin Access</h2>
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <input type="password" placeholder="Password" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-5 py-4 text-white text-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
                                    {loginError && <p className="text-red-400 text-sm font-medium">Incorrect password.</p>}
                                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg">Unlock Admin Controls</button>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* CONFIG FORM */}
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-indigo-500/30 shadow-xl">
                                    <h3 className="text-2xl font-black text-white mb-6">Tournament Setup</h3>
                                    <form onSubmit={handleSaveConfig} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Purse Limit</label>
                                                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-4 text-white" value={tempConfig.purseLimit} onChange={(e) => setTempConfig({...tempConfig, purseLimit: parseInt(e.target.value) || 0})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Squad Size</label>
                                                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-4 text-white" value={tempConfig.maxSquadSize} onChange={(e) => setTempConfig({...tempConfig, maxSquadSize: parseInt(e.target.value) || 0})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Base Price</label>
                                                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-4 text-white" value={tempConfig.basePrice} onChange={(e) => setTempConfig({...tempConfig, basePrice: parseInt(e.target.value) || 0})} />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-4">
                                            {configSaved && <span className="text-emerald-400 font-bold flex items-center"><CheckCircle className="w-5 h-5 mr-2"/> Saved!</span>}
                                            <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2"><Save className="w-5 h-5" /> Save Rules</button>
                                        </div>
                                    </form>
                                </div>

                                {/* CAPTAINS */}
                                <div className="bg-slate-800/50 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-xl">
                                    <h3 className="text-2xl font-black text-white mb-6">Team Captains</h3>
                                    <CaptainAssignment players={players} teams={teams} onAssign={handleAssignCaptain} onRemove={handleRemoveCaptain} />
                                </div>

                                {/* EXPORT & RESET */}
                                <div className="bg-slate-800/50 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-xl">
                                    <h3 className="text-2xl font-black text-white mb-6">Data Management</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                        <button onClick={() => handleExport('xlsx')} className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-900 border border-slate-700 hover:border-emerald-500 rounded-2xl transition-all"><span className="text-3xl">📊</span><span className="font-bold text-slate-300">Excel</span></button>
                                        <button onClick={() => handleExport('csv')} className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-2xl transition-all"><span className="text-3xl">📄</span><span className="font-bold text-slate-300">CSV</span></button>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-700/50">
                                        <button onClick={handleReset} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white shadow-xl rounded-xl font-black text-lg flex items-center justify-center gap-3"><Trash2 className="w-6 h-6" /> FACTORY RESET SYSTEM</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </>
        )}

      </main>
    </div>
  );
};

export default App;
