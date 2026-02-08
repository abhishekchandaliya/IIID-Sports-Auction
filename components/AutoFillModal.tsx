import React from 'react';
import { AutoFillAssignment } from '../types';
import { X, Check, AlertTriangle, ArrowRight } from 'lucide-react';

interface AutoFillModalProps {
  isOpen: boolean;
  assignments: AutoFillAssignment[];
  onClose: () => void;
  onConfirm: () => void;
}

const AutoFillModal: React.FC<AutoFillModalProps> = ({ isOpen, assignments, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-800/50 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500" /> Auto-Fill Wizard
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Preview proposed assignments before committing.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0">
          {assignments.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Check className="w-16 h-16 mx-auto mb-4 text-emerald-500 opacity-50" />
              <h3 className="text-lg font-bold text-white">No Deficits Found</h3>
              <p>All teams meet minimum sport requirements and squad sizes.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-4">Player</th>
                  <th className="p-4">Logic / Reason</th>
                  <th className="p-4">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {assignments.map((a) => (
                  <tr key={a.playerId} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-bold text-white">{a.playerName}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        a.reason.toLowerCase().includes('needed') 
                          ? 'bg-amber-900/30 text-amber-400 border border-amber-500/30' 
                          : 'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                      }`}>
                        {a.reason}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-emerald-400 flex items-center gap-2">
                       {a.teamName} <ArrowRight className="w-3 h-3 opacity-50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-800/30 rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-6 py-3 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            disabled={assignments.length === 0}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="w-5 h-5" /> Confirm & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoFillModal;