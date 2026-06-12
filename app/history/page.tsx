"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DebateHistorySummary {
  id: string;
  createdAt: number;
  ideaText: string;
  roomId: string;
  roomName: string;
  score: number;
  category: string;
}

export default function HistoryPage() {
  const [debates, setDebates] = useState<DebateHistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history summaries from SQLite database API
  async function fetchHistory() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/history");
      if (!res.ok) {
        throw new Error("Failed to load debate history dockets.");
      }
      const data = await res.json();
      if (data.success) {
        setDebates(data.debates || []);
      } else {
        throw new Error(data.error || "Unknown error loading history.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error retrieving history database");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  // Delete a single history item
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to permanently delete this debate record from local history?")) {
      return;
    }

    try {
      const res = await fetch(`/api/history?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Refresh local list state
        setDebates((prev) => prev.filter((d) => d.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete record.");
      }
    } catch (err) {
      console.error("Delete database record error:", err);
      alert("Error deleting database record.");
    }
  };

  // Clear all history records
  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to permanently delete ALL debate records from local history? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch("/api/history?clear=true", {
        method: "DELETE",
      });
      if (res.ok) {
        setDebates([]);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to clear dockets.");
      }
    } catch (err) {
      console.error("Clear database failed:", err);
      alert("Error clearing history dockets.");
    }
  };

  return (
    <div className="min-h-screen bg-[#16181A] text-[#ECE8E1] flex flex-col antialiased font-sans">
      
      {/* Top Bar Header */}
      <header className="border-b border-zinc-800 bg-[#1F2226]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪞</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-serif text-white flex items-center gap-2">
                MIRRORROOM <span className="text-[9px] bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/30 px-1.5 py-0.5 rounded-sm font-mono tracking-widest uppercase">TRIBUNAL ARCHIVE</span>
              </h1>
              <p className="text-[10px] text-[#9A9A92] font-mono tracking-wider uppercase">Docket Deliberation Database</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 font-mono text-xs">
            <Link href="/" className="hover:text-white text-[#9A9A92] transition-colors flex items-center gap-1.5">
              ⚖️ RETURN TO INQUESTS
            </Link>
            {debates.length > 0 && (
              <>
                <span className="text-[#D4A24E]">•</span>
                <button 
                  onClick={handleClearAll} 
                  className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  ⚠️ CLEAR ALL ARCHIVES
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold font-serif text-white">HISTORICAL DOCKET INDEX</h2>
            <p className="text-xs text-[#9A9A92] font-mono tracking-wider uppercase mt-1">
              Archived simulated focus group deliberations and scored verdicts ({debates.length} dockets)
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-[#1F2226] p-5 border border-rose-900/30 text-rose-400 rounded-xl font-mono text-xs">
            ⚠️ DATABASE ACCESS FAILURE: {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#9A9A92] text-xs font-mono gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D4A24E]" />
            LOADING CASE HISTORY FILES...
          </div>
        ) : debates.length === 0 ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-[#1F2226]/40 border border-dashed border-zinc-800/80 rounded-2xl text-center p-8 gap-4">
            <span className="text-5xl">📂</span>
            <div className="space-y-1">
              <h3 className="text-lg font-serif text-white font-semibold">No Inquest History Found</h3>
              <p className="text-sm text-[#9A9A92] max-w-sm leading-relaxed">
                You haven't run any focus group simulations yet. Start a new deliberation to build your database docket list.
              </p>
            </div>
            <Link 
              href="/" 
              className="bg-[#D4A24E] hover:bg-[#ECE8E1] text-[#16181A] px-4 py-2.5 rounded-lg font-mono font-bold tracking-wider text-xs uppercase transition-colors"
            >
              ⚖️ START FIRST INQUEST
            </Link>
          </div>
        ) : (
          // History index list table
          <div className="bg-[#1F2226] border border-zinc-800/60 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800/80 text-[10px] font-mono text-[#9A9A92] bg-[#16181A]/40 uppercase tracking-widest">
                    <th className="py-4 px-6 font-semibold">DATE & DOCKET NO.</th>
                    <th className="py-4 px-6 font-semibold">INQUEST PANEL</th>
                    <th className="py-4 px-6 font-semibold">CONCEPT / IDEA TEXT</th>
                    <th className="py-4 px-6 font-semibold text-center">SCORE</th>
                    <th className="py-4 px-6 font-semibold text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 text-sm font-sans">
                  {debates.map((d) => {
                    const dateStr = new Date(d.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    
                    const scoreColor = d.score >= 70 ? "text-emerald-500 border-emerald-950/40 bg-emerald-950/10" : d.score >= 40 ? "text-amber-500 border-amber-950/40 bg-amber-950/10" : "text-rose-500 border-rose-950/40 bg-rose-950/10";
                    
                    return (
                      <tr key={d.id} className="hover:bg-[#16181A]/20 transition-colors">
                        {/* Date */}
                        <td className="py-4 px-6 font-mono text-xs text-[#9A9A92] space-y-0.5">
                          <div className="text-white font-semibold">{dateStr}</div>
                          <div className="text-[9px] uppercase tracking-wider">NO: {d.id.substring(0, 8).toUpperCase()}</div>
                        </td>
                        
                        {/* Room Panel */}
                        <td className="py-4 px-6 font-serif text-white font-medium">
                          {d.roomName}
                        </td>
                        
                        {/* Concept Idea */}
                        <td className="py-4 px-6 text-xs text-[#ECE8E1]/80 max-w-sm font-light leading-relaxed truncate">
                          "{d.ideaText}"
                        </td>
                        
                        {/* Score Stamp Badge */}
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-block border font-mono text-xs font-bold px-2 py-1 rounded-sm tracking-wider ${scoreColor}`}>
                            {d.score} / 100
                          </span>
                        </td>
                        
                        {/* Actions */}
                        <td className="py-4 px-6 text-right font-mono text-xs space-x-3">
                          <Link 
                            href={`/?h=${d.id}`}
                            className="text-[#D4A24E] hover:text-[#ECE8E1] transition-colors hover:underline font-bold"
                          >
                            OPEN
                          </Link>
                          <button 
                            onClick={(e) => handleDelete(d.id, e)}
                            className="text-rose-400 hover:text-rose-300 transition-colors hover:underline font-semibold cursor-pointer"
                          >
                            DELETE
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
      
      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-[#1F2226]/20 py-6 mt-12 text-center text-xs text-[#9A9A92]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono">
          <p>© {new Date().getFullYear()} MIRRORROOM. TRIBUNAL ARCHIVES SECURED LOCALLY.</p>
          <p>POWERED BY SQLITE3 ENGINE PERSISTENCE.</p>
        </div>
      </footer>
    </div>
  );
}
