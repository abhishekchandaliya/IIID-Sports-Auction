import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove } from 'firebase/database';
import { Download, Trash2, Search, Gavel, Users, Settings, RefreshCw, Upload } from 'lucide-react';

// --- 1. PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyAD1ilsOepW7lElZQ9QJwWkjmSlimyO0HQ",
  authDomain: "iiid-auction.firebaseapp.com",
  databaseURL: "https://iiid-auction-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iiid-auction",
  storageBucket: "iiid-auction.firebasestorage.app",
  messagingSenderId: "393415599195",
  appId: "1:393415599195:web:fd5f7d4d7991df54470b7e"  
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- CONSTANTS ---
const TEAMS = [
  "Aditya Avengers", "Alfen Royals", "Lantern Legends", 
  "Primark Superkings", "Sai Kripa Soldiers", "Taluka Fighters"
];

const CONFIG = {
  purseLimit: 10000,
  squadSize: 25,
  basePrice: 10
};

// --- APP COMPONENT ---
export default function App() {
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState('dashboard'); // dashboard, auction, teams, settings
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");

  // --- REAL-TIME SYNC (The Magic) ---
  useEffect(() => {
    const playersRef = ref(db, 'players');
    // Listen for changes from the cloud
    onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object back to array
        const loadedPlayers = Object.values(data);
        setPlayers(loadedPlayers);
      } else {
        setPlayers([]);
      }
    });
    
    // Listen for current player selection
    const currentRef = ref(db, 'current_auction_id');
    onValue(currentRef, (snapshot) => {
      const id = snapshot.val();
      if (id) {
        // Find the player in our local list (even if not synced perfectly yet)
        // We defer this slightly to ensure players are loaded
      }
    });
  }, []);

  // Sync Current Player ID changes
  useEffect(() => {
    if (players.length > 0) {
      const currentRef = ref(db, 'current_auction_id');
      onValue(currentRef, (snapshot) => {
        const id = snapshot.val();
        if (id) {
          const p = players.find(p => p.ID === id);
          setCurrentPlayer(p || null);
        } else {
          setCurrentPlayer(null);
        }
      });
    }
  }, [players]);


  // --- ACTIONS ---

  const handleUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const newPlayers = [];
        
        for(let i=1; i<lines.length; i++) {
          if(!lines[i].trim()) continue;
          const row = lines[i].split(',');
          const p = { ID: Date.now() + i, Team: null, Price: 0, SoldTime: null };
          
          headers.forEach((h, idx) => {
            const val = row[idx]?.trim();
            if(h.includes('name')) p.Name = val;
            else if(h.includes('cric')) p.Cricket = val || '0';
            else if(h.includes('bad')) p.Badminton = val || '0';
            else if(h.includes('tt') || h.includes('table')) p.TT = val || '0';
            else if(h.includes('mobile')) p.Mobile = val;
          });
          
          if(p.Name) newPlayers.push(p);
        }

        // UPLOAD TO FIREBASE
        const updates = {};
        newPlayers.forEach(p => {
          updates['/players/' + p.ID] = p;
        });
        update(ref(db), updates);
        alert(`Uploaded ${newPlayers.length} players to Cloud!`);
      };
      reader.readAsText(file);
    }
  };

  const spinWheel = (sport, grade) => {
    const pool = players.filter(p => !p.Team); // Unsold only
    // Add filters here if needed
    if (pool.length === 0) return alert("No players left!");
    
    const random = pool[Math.floor(Math.random() * pool.length)];
    // Update Cloud
    set(ref(db, 'current_auction_id'), random.ID);
  };

  const sellPlayer = (team, price) => {
    if(!currentPlayer) return;
    
    const updated = { ...currentPlayer, Team: team, Price: parseInt(price), SoldTime: new Date().toISOString() };
    
    // 1. Update Player in DB
    set(ref(db, 'players/' + currentPlayer.ID), updated);
    
    // 2. Clear Current Auction
    set(ref(db, 'current_auction_id'), null);
  };

  const unsellPlayer = (player) => {
    const updated = { ...player, Team: null, Price: 0, SoldTime: null };
    set(ref(db, 'players/' + player.ID), updated);
  };

  const resetData = () => {
    if(confirm("Delete ALL data from Cloud?")) {
      remove(ref(db, 'players'));
      remove(ref(db, 'current_auction_id'));
      location.reload();
    }
  };

  // --- STATS CALC ---
  const getTeamStats = (teamName) => {
    const roster = players.filter(p => p.Team === teamName);
    const spent = roster.reduce((sum, p) => sum + (p.Price || 0), 0);
    const count = roster.length;
    const remaining = CONFIG.purseLimit - spent;
    return { roster, spent, count, remaining };
  };

  // --- RENDER HELPERS ---
  const renderBadge = (sport, val) => {
    if(!val || val === '0') return null;
    let color = 'bg-gray-600';
    if(sport === 'Cric') color = 'bg-blue-600';
    if(sport === 'Bad') color = 'bg-green-600';
    if(sport === 'TT') color = 'bg-orange-600';
    return <span className={`${color} px-2 py-0.5 rounded text-xs mr-2`}>{sport}: {val}</span>;
  };

  // --- VIEWS ---

  if (!isAdmin && view === 'settings') {
     // Simple Admin Login
     return (
       <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
         <div className="bg-slate-800 p-8 rounded-xl border border-slate-700">
           <h2 className="text-2xl font-bold mb-4">Admin Access</h2>
           <input 
             type="password" 
             className="w-full bg-slate-900 border border-slate-600 p-2 rounded mb-4"
             placeholder="Enter Password"
             onChange={e => setPassword(e.target.value)}
           />
           <div className="flex gap-2">
            <button onClick={() => setView('dashboard')} className="flex-1 bg-gray-600 p-2 rounded">Back</button>
            <button onClick={() => { if(password==='ABCD2026') setIsAdmin(true); }} className="flex-1 bg-blue-600 p-2 rounded">Login</button>
           </div>
         </div>
       </div>
     )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* NAVBAR */}
      <nav className="border-b border-slate-800 bg-slate-900 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
              <Gavel size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              IIID AUCTION 2026
            </h1>
          </div>
          <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
            {['dashboard', 'auction', 'teams', 'settings'].map(t => (
              <button 
                key={t}
                onClick={() => setView(t)}
                className={`px-4 py-2 rounded-md capitalize transition-all ${view === t ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        
        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* LIVE CARD */}
            {currentPlayer && (
               <div className="bg-gradient-to-r from-red-900/50 to-slate-900 border border-red-500/30 p-6 rounded-2xl flex justify-between items-center animate-pulse">
                 <div className="flex items-center gap-4">
                   <div className="h-3 w-3 bg-red-500 rounded-full animate-ping"></div>
                   <div>
                     <div className="text-red-400 text-xs font-bold tracking-widest">LIVE AUCTION</div>
                     <div className="text-3xl font-black text-white">{currentPlayer.Name}</div>
                   </div>
                 </div>
                 <button onClick={() => setView('auction')} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-full font-bold">
                   Go to Console →
                 </button>
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-sm">Total Sold</div>
                <div className="text-4xl font-bold text-white">{players.filter(p => p.Team).length}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-sm">Remaining Players</div>
                <div className="text-4xl font-bold text-blue-400">{players.filter(p => !p.Team).length}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                 <div className="text-slate-400 text-sm">Highest Bid</div>
                 <div className="text-4xl font-bold text-green-400">₹{Math.max(...players.map(p => p.Price), 0)}L</div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 bg-slate-800/50 border-b border-slate-800 font-bold">Leaderboard</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="p-4">Team</th>
                    <th className="p-4">Purse Left</th>
                    <th className="p-4">Squad</th>
                    <th className="p-4">Cric</th>
                    <th className="p-4">Bad</th>
                    <th className="p-4">TT</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAMS.map(team => {
                    const stats = getTeamStats(team);
                    return (
                      <tr key={team} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="p-4 font-medium text-white">{team}</td>
                        <td className="p-4 font-mono text-green-400">₹{stats.remaining}L</td>
                        <td className="p-4">{stats.count}/{CONFIG.squadSize}</td>
                        <td className="p-4 text-slate-400">{stats.roster.filter(p => p.Cricket !== '0').length}</td>
                        <td className="p-4 text-slate-400">{stats.roster.filter(p => p.Badminton !== '0').length}</td>
                        <td className="p-4 text-slate-400">{stats.roster.filter(p => p.TT !== '0').length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUCTION CONSOLE */}
        {view === 'auction' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[80vh]">
            {/* LEFT: CONTROLS */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 h-full flex flex-col justify-center items-center text-center">
                 {!currentPlayer ? (
                   <>
                    <div className="text-6xl mb-4">🎰</div>
                    <h2 className="text-2xl font-bold mb-4">Ready to Spin?</h2>
                    <button 
                      onClick={() => spinWheel()}
                      disabled={!isAdmin}
                      className={`w-full py-4 rounded-xl font-bold text-xl shadow-lg transition-transform active:scale-95 ${isAdmin ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110' : 'bg-slate-700 cursor-not-allowed'}`}
                    >
                      {isAdmin ? "SPIN WHEEL" : "Admin Login Required"}
                    </button>
                    <p className="mt-4 text-slate-500 text-sm">Selects a random unsold player</p>
                   </>
                 ) : (
                    <div className="w-full">
                      <div className="w-64 h-64 bg-slate-800 mx-auto rounded-xl overflow-hidden mb-6 relative border-4 border-slate-700">
                        {/* Placeholder for Image logic if you add it back */}
                         <div className="absolute inset-0 flex items-center justify-center text-6xl">👤</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-left bg-slate-800 p-4 rounded-lg">
                        <div className="text-slate-400 text-xs uppercase">Cricket</div>
                        <div className="font-bold">{currentPlayer.Cricket}</div>
                        <div className="text-slate-400 text-xs uppercase">Badminton</div>
                        <div className="font-bold">{currentPlayer.Badminton}</div>
                        <div className="text-slate-400 text-xs uppercase">TT</div>
                        <div className="font-bold">{currentPlayer.TT}</div>
                      </div>
                    </div>
                 )}
              </div>
            </div>

            {/* RIGHT: PLAYER CARD & BIDDING */}
            <div className="lg:col-span-8">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Gavel size={200} />
                </div>
                
                {currentPlayer ? (
                  <>
                    <div className="flex-1 flex flex-col justify-center items-center z-10">
                      <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 text-center mb-6 leading-tight drop-shadow-2xl">
                        {currentPlayer.Name}
                      </h1>
                      <div className="flex gap-3 mb-8">
                        {renderBadge('Cric', currentPlayer.Cricket)}
                        {renderBadge('Bad', currentPlayer.Badminton)}
                        {renderBadge('TT', currentPlayer.TT)}
                      </div>
                      <div className="bg-slate-800/80 px-8 py-3 rounded-full border border-slate-600 backdrop-blur-sm">
                        <span className="text-slate-400 mr-2">Base Price:</span>
                        <span className="text-2xl font-bold text-white">₹{CONFIG.basePrice}L</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="z-10 mt-auto pt-8 border-t border-slate-800">
                        <h3 className="text-slate-400 text-sm mb-4 uppercase tracking-wider font-bold">Bidding Control</h3>
                        <div className="flex gap-4">
                          <select id="team-select" className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 flex-1">
                            {TEAMS.map(t => {
                               const s = getTeamStats(t);
                               return <option key={t} value={t} disabled={s.remaining < CONFIG.basePrice}>{t} (₹{s.remaining}L)</option>
                            })}
                          </select>
                          <input id="price-input" type="number" defaultValue={CONFIG.basePrice} step={5} className="bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 w-32 font-mono text-center" />
                          <button 
                            onClick={() => {
                              const t = document.getElementById('team-select').value;
                              const p = document.getElementById('price-input').value;
                              sellPlayer(t, p);
                            }}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-3 rounded-lg shadow-lg shadow-green-900/20"
                          >
                            SOLD 🔨
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-600">
                    <div className="text-center">
                      <p className="text-xl">Waiting for Auctioneer...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TEAMS VIEW */}
        {view === 'teams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TEAMS.map(team => {
              const { roster, spent, count, remaining } = getTeamStats(team);
              return (
                <div key={team} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 bg-slate-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-lg">{team}</h3>
                    <div className="text-sm bg-slate-900 px-3 py-1 rounded-full border border-slate-700 text-green-400">₹{remaining}L left</div>
                  </div>
                  <div className="p-4 max-h-60 overflow-y-auto">
                    {roster.length === 0 ? <p className="text-slate-600 text-sm italic">No players yet.</p> : (
                      <table className="w-full text-sm">
                        <tbody>
                          {roster.map(p => (
                            <tr key={p.ID} className="border-b border-slate-800/50 last:border-0">
                              <td className="py-2">{p.Name}</td>
                              <td className="py-2 text-right font-mono text-slate-400">₹{p.Price}L</td>
                              {isAdmin && (
                                <td className="py-2 text-right">
                                  <button onClick={() => unsellPlayer(p)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="p-2 bg-slate-950 text-xs text-center text-slate-500 border-t border-slate-800">
                    {count}/{CONFIG.squadSize} Players
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SETTINGS VIEW */}
        {view === 'settings' && isAdmin && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Upload size={20}/> Upload Data</h3>
              <p className="text-slate-400 text-sm mb-4">Upload your CSV file. Headers must include: Name, Cricket, Badminton, TT, Mobile.</p>
              <input type="file" accept=".csv" onChange={handleUpload} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"/>
            </div>

            <div className="bg-red-900/20 p-6 rounded-xl border border-red-900/50">
              <h3 className="font-bold text-lg text-red-500 mb-4 flex items-center gap-2"><Trash2 size={20}/> Danger Zone</h3>
              <button onClick={resetData} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg">
                FACTORY RESET (Clear Database)
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
