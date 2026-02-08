import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';

interface FileUploaderProps {
  label?: string;
  onDataLoaded: (data: any[]) => void;
  variant?: 'default' | 'compact';
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  label = "Upload Master Player.csv", 
  onDataLoaded,
  variant = 'default' 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      setError("Please upload a valid .csv file.");
      return;
    }

    setFileName(file.name);

    if (window.Papa) {
        window.Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                 if (results.data && results.data.length > 0) {
                     onDataLoaded(results.data);
                 }
            },
            error: (err: any) => {
                setError("Failed to parse CSV: " + err.message);
            }
        });
    } else {
        setError("CSV Parser not loaded. Please refresh.");
    }
  };

  const isCompact = variant === 'compact';

  return (
    <div className={`w-full ${isCompact ? '' : 'max-w-md mx-auto'}`}>
        <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden" 
        />
        
        {!fileName ? (
            <button 
                onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed border-slate-600 rounded-xl bg-slate-800/50 hover:bg-slate-800 hover:border-indigo-500 transition-all flex flex-col items-center justify-center group ${isCompact ? 'h-24 p-2' : 'h-32'}`}
            >
                <Upload className={`${isCompact ? 'w-5 h-5' : 'w-8 h-8'} text-slate-400 group-hover:text-indigo-400 mb-2`} />
                <span className={`text-slate-400 font-medium group-hover:text-white ${isCompact ? 'text-xs' : 'text-base'}`}>{label}</span>
                {!isCompact && <span className="text-xs text-slate-600 mt-1">Click to browse</span>}
            </button>
        ) : (
            <div className={`w-full bg-emerald-900/20 border border-emerald-500/30 rounded-xl flex items-center justify-between ${isCompact ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className={`${isCompact ? 'w-4 h-4' : 'w-6 h-6'} text-emerald-400 flex-shrink-0`} />
                    <span className="text-emerald-100 font-medium truncate text-sm">{fileName}</span>
                </div>
                <button onClick={() => { setFileName(null); fileInputRef.current!.value = ''; }} className="text-emerald-400 hover:text-emerald-300">
                    <CheckCircle className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                </button>
            </div>
        )}

        {error && (
            <div className="mt-2 text-sm text-red-400 text-center">
                {error}
            </div>
        )}
    </div>
  );
};

export default FileUploader;
