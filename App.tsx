import React, { useState, useEffect, useMemo } from 'react';
import { Tab, Player, TeamStats, ActivityLog, TournamentConfig } from './types';
import { INITIAL_TEAMS, DEFAULT_CONFIG } from './constants';
import { calculateTeamStats, normalizeRating, parseCurrency } from './utils';
import Dashboard from './components/Dashboard';
import AuctionConsole from './components/AuctionConsole';
import RosterView from './components/RosterView';
import FileUploader from './components/FileUploader';
import CaptainAssignment from './components/CaptainAssignment';
import DeveloperProfile from './components/DeveloperProfile';
import { LayoutDashboard, Gavel, Users, Settings, Trophy, UploadCloud, Trash2, Crown, Lock, Unlock, Download, ChevronDown, Database, Menu, X, Save, Settings2, AlertCircle, CheckCircle, ShieldCheck, Scale } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const [isAdmin, setIsAdmin] = useState(false); // Default: False (Public View)
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Configuration State
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [tempConfig, setTempConfig] = useState<TournamentConfig>(DEFAULT_CONFIG); // For form inputs
  const [configSaved, setConfigSaved] = useState(false);
  
  // Settings UI State
  const [settingsSportTab, setSettingsSportTab] = useState<'Cricket' | 'Badminton' | 'TT'>('Cricket');

  // Navigation State
  const [targetTeam, setTargetTeam] = useState<string | null>(null);
  const [currentAuctionPlayerId, setCurrentAuctionPlayerId] = useState<string>(""); 
  
  // Audit Trail / Recent Activity
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  // Helper to add activity
  const addActivity = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
      const newLog: ActivityLog = {
          ...log,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now()
      };
      setRecentActivity(prev => [newLog, ...prev].slice(0, 8)); // Keep last 8 entries
  };

  // Derive Team Stats from Player Data using dynamic config
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
      // Redirect to Dashboard immediately upon logout to prevent access to restricted views
      setActiveTab(Tab.DASHBOARD);
  };

  // Navigation Handler
  const handleTeamSelect = (teamName: string) => {
      setTargetTeam(teamName);
      setActiveTab(Tab.ROSTER);
      setMobileMenuOpen(false);
  };

  const switchTab = (tab: Tab) => {
      setActiveTab(tab);
      setMobileMenuOpen(false);
  }

  // Handle Master CSV Data Load
  const handleMasterLoad = (rawData: any[]) => {
    console.log("Raw CSV Data:", rawData); 

    const parsedPlayers: Player[] = rawData
        .filter((row: any) => {
             const name = getRowValue(row, 'Player Name', 'Name', 'Player', 'PlayerName');
             return name && typeof name === 'string' && name.trim() !== '';
        })
        .map((row: any, index: number) => {
            const pName = getRowValue(row, 'Player Name', 'Name', 'Player');
            const pTeam = getRowValue(row, 'Team', 'Winning Team', 'Sold To');
            const pPriceVal = getRowValue(row, 'Auction Value', 'Price', 'Sold Price', 'Amount');
            const pPrice = parseCurrency(pPriceVal || '0');
            const pContact = getRowValue(row, 'Contact No', 'Mobile', 'Phone', 'Contact', 'Ph', 'Cell');
            
            const cricket = getRowValue(row, 'Cricket', 'Cric', 'Batting', 'Bowling'); 
            const badminton = getRowValue(row, 'Badminton', 'Bad', 'Shuttle');
            const tt = getRowValue(row, 'TT', 'Table Tennis', 'TableTennis');

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
        alert("No valid player data found. Please check your CSV headers.");
        return;
    }

    setPlayers(parsedPlayers);
    setDataLoaded(true);
    alert(`Successfully loaded ${parsedPlayers.length} players!`);
  };

  // Handle Individual Sport Load (Merging)
  const handleSportLoad = (sport: 'cricket' | 'badminton' | 'tt', rawData: any[]) => {
      setPlayers(prevPlayers => {
          const newPlayers = [...prevPlayers];
          let nextId = newPlayers.length > 0 ? Math.max(...newPlayers.map(p => p.id)) + 1 : 1;

          rawData.forEach(row => {
               const name = getRowValue(row, 'Player Name', 'Name', 'Player');
               if (!name || typeof name !== 'string' || !name.trim()) return;
               
               const cleanName = name.trim();
               let rating = getRowValue(row, sport, 'Grade', 'Rating', 'Category');
               const contact = getRowValue(row, 'Contact No', 'Mobile', 'Phone', 'Contact', 'Ph', 'Cell');

               if (!rating) {
                   const values = Object.values(row);
                   rating = values.find(v => typeof v === 'string' && ['A','B','C'].includes(v.toUpperCase().trim()));
               }

               const normalizedRating = normalizeRating(rating || '0');
               const existingIndex = newPlayers.findIndex(p => p.name.toLowerCase() === cleanName.toLowerCase());
               
               if (existingIndex >= 0) {
                   newPlayers[existingIndex] = {
                       ...newPlayers[existingIndex],
                       [sport]: normalizedRating
                   };
                   if (contact) newPlayers[existingIndex].contactNo = String(contact).trim();
               } else {
                   newPlayers.push({
                       id: nextId++,
                       name: cleanName,
                       team: null,
                       price: 0,
                       cricket: sport === 'cricket' ? normalizedRating : '0',
                       badminton: sport === 'badminton' ? normalizedRating : '0',
                       tt: sport === 'tt' ? normalizedRating : '0',
                       contactNo: contact ? String(contact).trim() : 'N/A'
                   });
               }
          });
          return newPlayers;
      });
      setDataLoaded(true);
  };

  const handleSellPlayer = (playerId: number, teamName: string, price: number) => {
    let sold: Player | null = null;
    setPlayers(prev => prev.map(p => {
        if (p.id === playerId) {
            sold = { ...p, team: teamName, price: price };
            return sold;
        }
        return p;
    }));
    
    if (sold) {
        const s = sold as Player;
        addActivity({
            type: 'sale',
            message: `💰 SOLD: ${s.name} to ${teamName} for **${price}**`,
            details: { playerName: s.name, teamName, price }
        });
    }
  };

  // Correction Manager: Unsell (Updated to log Revert)
  const handleUnsellPlayer = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      const prevTeam = player.team;

      setPlayers(prev => prev.map(p => {
          if (p.id === playerId) {
              return { ...p, team: null, price: 0, captainFor: undefined };
          }
          return p;
      }));

      addActivity({
          type: 'revert',
          message: `❌ REVERTED: ${player.name} removed from ${prevTeam}`,
          details: { playerName: player.name, teamName: prevTeam, price: 0 }
      });
  };

  // Correction Manager: Update (Updated to log Correction)
  const handleUpdatePlayer = (playerId: number, teamName: string, price: number) => {
      const player = players.find(p => p.id === playerId);
      setPlayers(prev => prev.map(p => {
          if (p.id === playerId) {
              return { ...p, team: teamName, price: price };
          }
          return p;
      }));

      if(player) {
          addActivity({
              type: 'correction',
              message: `🛠️ CORRECTION: ${player.name} updated to ${teamName} @ **${price}**`,
              details: { playerName: player.name, teamName, price }
          });
      }
  };

  const handleAssignCaptain = (playerId: number, teamName: string, sport: 'Cricket' | 'Badminton' | 'TT', price: number) => {
    let sold: Player | null = null;
    setPlayers(prev => prev.map(p => {
        if (p.id === playerId) {
            sold = { 
                ...p, 
                team: teamName, 
                price: price, 
                captainFor: sport 
            };
            return sold;
        }
        if (p.team === teamName && p.captainFor === sport) {
            return { 
                ...p, 
                team: null, 
                price: 0,
                captainFor: undefined 
            };
        }
        return p;
    }));

    if (sold) {
        const s = sold as Player;
        addActivity({
            type: 'captain',
            message: `👑 CAPTAIN: ${s.name} assigned to ${teamName} (${sport}) for **${price}**`,
            details: { playerName: s.name, teamName, price }
        });
    }
  };

  const handleRemoveCaptain = (playerId: number) => {
      setPlayers(prev => prev.map(p => {
          if (p.id === playerId) {
              return { 
                  ...p, 
                  team: null, 
                  price: 0, 
                  captainFor: undefined 
              };
          }
          return p;
      }));
  };

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
      
      const exportData = [...players].sort((a, b) => {
          const teamA = a.team || "zz_unsold"; 
          const teamB = b.team || "zz_unsold";
          if (teamA !== teamB) return teamA.localeCompare(teamB);
          return a.name.localeCompare(b.name);
      });

      if (format === 'json') {
          const jsonContent = JSON.stringify(exportData, null, 2);
          downloadFile(jsonContent, `${fileName}.json`, 'application/json');
      } 
      else if (format === 'csv') {
           const csv = window.Papa.unparse(exportData);
           downloadFile(csv, `${fileName}.csv`, 'text/csv');
      }
      else if (format === 'xml') {
          let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<players>\n';
          exportData.forEach(p => {
              xml += `  <player>\n`;
              Object.entries(p).forEach(([key, val]) => {
                  xml += `    <${key}>${val}</${key}>\n`;
              });
              xml += `  </player>\n`;
          });
          xml += '</players>';
          downloadFile(xml, `${fileName}.xml`, 'application/xml');
      }
      else if (format === 'xlsx' || format === 'ods') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Auction Data");
          XLSX.writeFile(wb, `${fileName}.${format}`);
      }
  };

  // Load state from local storage on mount
  useEffect(() => {
    // 1. Players
    const savedPlayers = localStorage.getItem('sports_auction_players');
    if (savedPlayers) {
        try {
            const parsed = JSON.parse(savedPlayers);
            if (parsed.length > 0) {
                setPlayers(parsed);
                setDataLoaded(true);
            }
        } catch (e) {
            console.error("Failed to load players");
        }
    }

    // 2. Config
    const savedConfig = localStorage.getItem('sports_auction_config');
    if (savedConfig) {
        try {
            const parsedConfig = JSON.parse(savedConfig);
            // Ensure backwards compatibility by merging with default
            setConfig({...DEFAULT_CONFIG, ...parsedConfig});
            setTempConfig({...DEFAULT_CONFIG, ...parsedConfig});
        } catch (e) {
            console.error("Failed to load config");
        }
    }
  }, []);

  // Save players when changed
  useEffect(() => {
    if (dataLoaded) {
        localStorage.setItem('sports_auction_players', JSON.stringify(players));
    }
  }, [players, dataLoaded]);

  const handleSaveConfig = (e: React.FormEvent) => {
      e.preventDefault();
      setConfig(tempConfig);
      localStorage.setItem('sports_auction_config', JSON.stringify(tempConfig));
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleReset = () => {
    if(confirm("Are you sure you want to reset all auction data? This cannot be undone.")) {
        localStorage.removeItem('sports_auction_players');
        // We do NOT remove the config, user probably wants to keep their rules
        window.location.reload();
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
                <button
                    onClick={() => switchTab(Tab.DASHBOARD)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === Tab.DASHBOARD ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                </button>
                
                {/* RESTRICTED: Auction Console only for Admins */}
                {isAdmin && (
                    <button
                        onClick={() => switchTab(Tab.AUCTION)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === Tab.AUCTION ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                        <Gavel className="w-4 h-4" />
                        <span>Console</span>
                    </button>
                )}

                <button
                    onClick={() => switchTab(Tab.ROSTER)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === Tab.ROSTER ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Teams</span>
                </button>

                <button
                    onClick={() => switchTab(Tab.SETTINGS)}
                    className={`p-2 rounded-lg transition-all ${
                        activeTab === Tab.SETTINGS ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                    title={isAdmin ? "Tournament Settings" : "Admin Login"}
                >
                    {isAdmin ? <Settings className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
            </nav>
            
            <div className="h-6 w-px bg-slate-700"></div>

            {isAdmin ? (
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Logout">
                    <Unlock className="w-5 h-5" />
                </button>
            ) : (
                <button onClick={() => switchTab(Tab.SETTINGS)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Admin Login">
                    <Lock className="w-5 h-5" />
                </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
             {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-slate-900 border-b border-slate-800 p-4 shadow-2xl z-50 animate-in slide-in-from-top-2 overflow-y-auto max-h-[85vh]">
                <nav className="flex flex-col gap-2">
                    <button onClick={() => switchTab(Tab.DASHBOARD)} className={`p-3 rounded-lg text-left font-bold ${activeTab === Tab.DASHBOARD ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Dashboard</button>
                    {isAdmin && (
                        <button onClick={() => switchTab(Tab.AUCTION)} className={`p-3 rounded-lg text-left font-bold ${activeTab === Tab.AUCTION ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Auction Console</button>
                    )}
                    <button onClick={() => switchTab(Tab.ROSTER)} className={`p-3 rounded-lg text-left font-bold ${activeTab === Tab.ROSTER ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Teams</button>
                    <button onClick={() => switchTab(Tab.SETTINGS)} className={`p-3 rounded-lg text-left font-bold ${activeTab === Tab.SETTINGS ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                        {isAdmin ? 'Settings & Admin' : 'Admin Login'}
                    </button>
                    {isAdmin && (
                        <button onClick={handleLogout} className="p-3 rounded-lg text-left font-bold text-red-400 hover:bg-slate-800">Logout</button>
                    )}
                    
                    {/* DEVELOPER PROFILE IN MOBILE MENU (SIDEBAR EQUIVALENT) */}
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <DeveloperProfile players={players} />
                    </div>
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
                        Welcome to Sports Auction Pro. Please upload your player list to begin the auction.
                    </p>
                </div>
                
                <div className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 shadow-xl">
                     <FileUploader 
                        label="Upload Master Player.csv" 
                        onDataLoaded={handleMasterLoad} 
                    />
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
                {/* PROTECTED ROUTE: Auction Console */}
                {activeTab === Tab.AUCTION && isAdmin && (
                    <AuctionConsole 
                        players={players} 
                        teams={teams} 
                        onSellPlayer={handleSellPlayer} 
                        onUnsellPlayer={handleUnsellPlayer}
                        onUpdatePlayer={handleUpdatePlayer}
                        isReadOnly={!isAdmin} 
                        currentPlayerId={currentAuctionPlayerId}
                        onSelectPlayer={setCurrentAuctionPlayerId}
                        recentActivity={recentActivity}
                        config={config}
                    />
                )}
                {activeTab === Tab.ROSTER && <RosterView players={players} teams={teams} recentActivity={recentActivity} targetTeam={targetTeam} config={config} />}
                {activeTab === Tab.SETTINGS && (
                    <div className="max-w-5xl mx-auto pt-6 pb-20">
                        
                        {/* DEVELOPER PROFILE IN SETTINGS (VISIBLE TO ALL) */}
                        <div className="mb-8 flex justify-center">
                            <DeveloperProfile players={players} variant="full" />
                        </div>

                        {!isAdmin ? (
                            <div className="max-w-md mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-center animate-in zoom-in-95 duration-300">
                                <div className="inline-flex p-4 bg-slate-800 rounded-full mb-6 text-indigo-400 border border-slate-700">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <h2 className="text-3xl font-black text-white mb-3">Admin Access</h2>
                                <p className="text-slate-400 mb-8">Enter the secure password to manage the auction tournament.</p>
                                
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <input 
                                        type="password" 
                                        placeholder="Password" 
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-5 py-4 text-white text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        autoFocus
                                    />
                                    {loginError && <p className="text-red-400 text-sm font-medium">Incorrect password. Please try again.</p>}
                                    <button 
                                        type="submit"
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/30 hover:shadow-indigo-900/50"
                                    >
                                        Unlock Admin Controls
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                
                                {/* 1. TOURNAMENT CONFIGURATION */}
                                <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 p-1 rounded-2xl border border-indigo-500/30 shadow-xl">
                                    <details open className="group">
                                        <summary className="p-6 cursor-pointer flex items-center justify-between hover:bg-slate-800/50 rounded-xl transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                                                    <Settings2 className="w-8 h-8 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black text-white">Tournament Setup</h3>
                                                    <p className="text-slate-400">Configure global rules, budget limits, and auction settings.</p>
                                                </div>
                                            </div>
                                            <ChevronDown className="w-6 h-6 text-slate-500 group-open:rotate-180 transition-transform" />
                                        </summary>

                                        <div className="p-6 md:p-8 pt-2 border-t border-slate-800/50">
                                            <form onSubmit={handleSaveConfig} className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Team Purse Limit</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                                                            <input 
                                                                type="number" 
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-8 pr-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                                                value={tempConfig.purseLimit}
                                                                onChange={(e) => setTempConfig({...tempConfig, purseLimit: parseInt(e.target.value) || 0})}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">Total budget allocated per team.</p>
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Max Squad Size</label>
                                                        <div className="relative">
                                                            <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                                            <input 
                                                                type="number" 
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                                                value={tempConfig.maxSquadSize}
                                                                onChange={(e) => setTempConfig({...tempConfig, maxSquadSize: parseInt(e.target.value) || 0})}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">Maximum players allowed per team.</p>
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Default Base Price</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                                                            <input 
                                                                type="number" 
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-8 pr-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                                                value={tempConfig.basePrice}
                                                                onChange={(e) => setTempConfig({...tempConfig, basePrice: parseInt(e.target.value) || 0})}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">Starting bid and reserve price.</p>
                                                    </div>
                                                </div>

                                                {/* FAIR PLAY SECTION */}
                                                <div className="pt-4 mt-2 border-t border-slate-800/50">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Scale className="w-5 h-5 text-indigo-400" />
                                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">⚖️ Fair Play Limits (Per Sport Category)</h4>
                                                    </div>
                                                    
                                                    {/* Tabs for Sport Selection */}
                                                    <div className="flex items-center gap-2 mb-4 bg-slate-900 p-1 rounded-xl w-fit border border-slate-800">
                                                        {(['Cricket', 'Badminton', 'TT'] as const).map(sport => (
                                                            <button 
                                                                type="button"
                                                                key={sport}
                                                                onClick={() => setSettingsSportTab(sport)}
                                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                                    settingsSportTab === sport 
                                                                    ? 'bg-slate-700 text-white shadow-md' 
                                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                                                }`}
                                                            >
                                                                {sport}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 animate-in fade-in">
                                                        <div className="grid grid-cols-3 gap-6">
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Grade 'A' ({settingsSportTab})</label>
                                                                <input 
                                                                    type="number" 
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                                                    value={tempConfig.categoryLimits[settingsSportTab].A}
                                                                    onChange={(e) => setTempConfig({
                                                                        ...tempConfig, 
                                                                        categoryLimits: { 
                                                                            ...tempConfig.categoryLimits, 
                                                                            [settingsSportTab]: { 
                                                                                ...tempConfig.categoryLimits[settingsSportTab], 
                                                                                A: parseInt(e.target.value) || 0 
                                                                            } 
                                                                        }
                                                                    })}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Grade 'B' ({settingsSportTab})</label>
                                                                <input 
                                                                    type="number" 
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                                                    value={tempConfig.categoryLimits[settingsSportTab].B}
                                                                    onChange={(e) => setTempConfig({
                                                                        ...tempConfig, 
                                                                        categoryLimits: { 
                                                                            ...tempConfig.categoryLimits, 
                                                                            [settingsSportTab]: { 
                                                                                ...tempConfig.categoryLimits[settingsSportTab], 
                                                                                B: parseInt(e.target.value) || 0 
                                                                            } 
                                                                        }
                                                                    })}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Grade 'C' ({settingsSportTab})</label>
                                                                <input 
                                                                    type="number" 
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                                                    value={tempConfig.categoryLimits[settingsSportTab].C}
                                                                    onChange={(e) => setTempConfig({
                                                                        ...tempConfig, 
                                                                        categoryLimits: { 
                                                                            ...tempConfig.categoryLimits, 
                                                                            [settingsSportTab]: { 
                                                                                ...tempConfig.categoryLimits[settingsSportTab], 
                                                                                C: parseInt(e.target.value) || 0 
                                                                            } 
                                                                        }
                                                                    })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-2 ml-1">
                                                        * "Fair Play" prevents a team from buying more players of a specific grade in the selected sport until ALL other teams have reached the same count.
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-end gap-4">
                                                     {configSaved && (
                                                         <div className="flex items-center gap-2 text-emerald-400 animate-in fade-in">
                                                             <CheckCircle className="w-5 h-5" />
                                                             <span className="font-bold">Tournament Rules Updated!</span>
                                                         </div>
                                                     )}
                                                     <button 
                                                        type="submit"
                                                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-900/30 flex items-center gap-2 transition-all active:scale-95"
                                                     >
                                                         <Save className="w-5 h-5" />
                                                         Save Rules
                                                     </button>
                                                </div>
                                            </form>
                                            
                                            <div className="mt-6 p-4 bg-amber-900/20 border border-amber-500/20 rounded-xl flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-amber-200/80">
                                                    <strong>Warning:</strong> Changing these rules mid-auction will immediately affect all team calculations and budget validations. Ensure all admins are aware of rule changes.
                                                </p>
                                            </div>
                                        </div>
                                    </details>
                                </div>

                                {/* Captain Assignment Section */}
                                <div className="bg-slate-800/50 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-xl">
                                    <div className="flex items-center gap-4 mb-8 border-b border-slate-700/50 pb-6">
                                        <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                            <Crown className="w-8 h-8 text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white">Team Captains</h3>
                                            <p className="text-slate-400">Pre-assign captains to teams before the main auction begins.</p>
                                        </div>
                                    </div>
                                    <CaptainAssignment 
                                        players={players} 
                                        teams={teams} 
                                        onAssign={handleAssignCaptain}
                                        onRemove={handleRemoveCaptain}
                                    />
                                </div>

                                {/* Data Export Section */}
                                <div className="bg-slate-800/50 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-xl">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                            <Download className="w-8 h-8 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white">Export Data</h3>
                                            <p className="text-slate-400">Download final auction results including private contact details.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <button onClick={() => handleExport('xlsx')} className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:bg-slate-800 rounded-2xl transition-all group">
                                            <span className="text-3xl">📊</span>
                                            <span className="font-bold text-slate-300 group-hover:text-white">Excel Report</span>
                                        </button>
                                        <button onClick={() => handleExport('csv')} className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-900 border border-slate-700 hover:border-blue-500 hover:bg-slate-800 rounded-2xl transition-all group">
                                            <span className="text-3xl">📄</span>
                                            <span className="font-bold text-slate-300 group-hover:text-white">CSV Raw</span>
                                        </button>
                                        <button onClick={() => handleExport('json')} className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-900 border border-slate-700 hover:border-yellow-500 hover:bg-slate-800 rounded-2xl transition-all group">
                                            <span className="text-3xl">📦</span>
                                            <span className="font-bold text-slate-300 group-hover:text-white">JSON</span>
                                        </button>
                                        <button onClick={() => handleExport('xml')} className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-900 border border-slate-700 hover:border-orange-500 hover:bg-slate-800 rounded-2xl transition-all group">
                                            <span className="text-3xl">📝</span>
                                            <span className="font-bold text-slate-300 group-hover:text-white">XML</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Data Management Section */}
                                <details className="group bg-slate-800/50 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
                                    <summary className="p-6 md:p-8 cursor-pointer flex items-center justify-between hover:bg-slate-800 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <Database className="w-6 h-6 text-indigo-400" />
                                            <div>
                                                <h3 className="text-xl font-bold text-white group-open:text-indigo-300 transition-colors">Advanced Database Tools</h3>
                                                <p className="text-slate-400 text-sm group-open:hidden">Append data or reset system.</p>
                                            </div>
                                        </div>
                                        <ChevronDown className="w-6 h-6 text-slate-500 group-open:rotate-180 transition-transform" />
                                    </summary>
                                    
                                    <div className="p-6 md:p-8 pt-0 border-t border-slate-700/50 bg-slate-900/30">
                                        <div className="space-y-8 mt-6">
                                            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                                                <h4 className="text-md font-bold text-slate-300 mb-4 flex items-center gap-2">
                                                    <UploadCloud className="w-5 h-5" /> Append/Merge Data
                                                </h4>
                                                <div className="mb-4">
                                                    <FileUploader label="Upload Master List" onDataLoaded={handleMasterLoad} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <FileUploader label="Cricket" variant="compact" onDataLoaded={(d) => handleSportLoad('cricket', d)} />
                                                    <FileUploader label="Badminton" variant="compact" onDataLoaded={(d) => handleSportLoad('badminton', d)} />
                                                    <FileUploader label="TT" variant="compact" onDataLoaded={(d) => handleSportLoad('tt', d)} />
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-slate-700/50">
                                                <button 
                                                    onClick={handleReset}
                                                    className="w-full py-5 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/30 rounded-xl font-black text-lg transition-all transform hover:scale-[1.01] flex items-center justify-center gap-3"
                                                >
                                                    <Trash2 className="w-6 h-6" />
                                                    FACTORY RESET SYSTEM
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </details>
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