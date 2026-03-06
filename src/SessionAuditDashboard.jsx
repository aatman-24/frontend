import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Activity,
    BarChart3,
    Clock,
    ChevronRight,
    ArrowRight,
    Search,
    Filter,
    LayoutGrid,
    List as ListIcon,
    RefreshCw
} from 'lucide-react';

const ORDERS_API = import.meta.env.VITE_ORDERS_API_URL || 'http://localhost:8082';

const SessionAuditDashboard = ({ onSelectSession }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${ORDERS_API}/sessions`);
            setSessions(res.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch session audit records. Ensure backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const filteredSessions = sessions
        .filter(s =>
            s.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.algoId.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[600px]">
            <Activity size={48} className="text-blue-500 animate-spin mb-4" />
            <p className="text-zinc-500 font-black tracking-widest animate-pulse">INDEXING_SESSION_VAULT...</p>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-700 max-w-7xl mx-auto py-10">
            <header className="flex items-center justify-between mb-12 border-b border-zinc-800/50 pb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Session.<span className="text-blue-500">Audit</span></h1>
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-black text-emerald-400 uppercase">Live_History</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-1">
                        Viewing all recorded trading instances for the current cycle
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={fetchSessions}
                        className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <div className="h-10 w-[250px] bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-center px-4 gap-3 focus-within:border-blue-500/50 transition-all">
                        <Search size={14} className="text-zinc-600" />
                        <input
                            type="text"
                            placeholder="SEARCH_BY_ID_OR_ALGO..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none text-[10px] font-black tracking-widest text-zinc-300 w-full placeholder:text-zinc-700"
                        />
                    </div>
                </div>
            </header>

            {error && (
                <div className="mb-8 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                    <Activity size={14} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {filteredSessions.length === 0 ? (
                    <div className="h-60 rounded-2xl border border-dashed border-zinc-800 flex flex-col items-center justify-center opacity-30">
                        <BarChart3 size={32} className="mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest">No matching sessions found</p>
                    </div>
                ) : (
                    filteredSessions.map((session) => (
                        <div
                            key={session.sessionId}
                            onClick={() => onSelectSession(session.sessionId, session.algoId)}
                            className="group relative flex items-center justify-between p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 hover:bg-blue-600/[0.03] hover:border-blue-500/30 transition-all cursor-pointer overflow-hidden"
                        >
                            {/* Accent line on hover */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>

                            <div className="flex items-center gap-8 z-10 w-full">
                                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 group-hover:border-blue-500/20 transition-all">
                                    <Clock size={24} className="text-zinc-600 group-hover:text-blue-500 transition-colors" />
                                </div>

                                <div className="grid grid-cols-4 flex-1 items-center gap-12">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Session_Identity</p>
                                        <p className="text-sm font-black font-mono text-zinc-300 group-hover:text-white transition-colors">
                                            #{session.sessionId.slice(-8).toUpperCase()}
                                        </p>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Asset_Module</p>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-black text-zinc-300 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-all font-mono">
                                                {session.sessionId.split('_')[0]}
                                            </span>
                                            <span className="text-[8px] font-black text-zinc-700 uppercase">/</span>
                                            <span className="text-[10px] font-black text-zinc-500 uppercase">
                                                {session.algoId === 'MULTILEG_DELTA_STRANGLE' ? 'STRANGLE' : session.algoId}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-center">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Trade_Density</p>
                                        <p className="text-sm font-black font-mono text-zinc-300 group-hover:text-blue-400 transition-colors">
                                            {session.tradeCount} <span className="text-[10px] text-zinc-700">EXECS</span>
                                        </p>
                                    </div>

                                    <div className="space-y-1 text-right">
                                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Initialization</p>
                                        <p className="text-[11px] font-black text-zinc-400 group-hover:text-zinc-300 transition-colors">
                                            {new Date(session.startTime.includes('Z') ? session.startTime : session.startTime + 'Z').toLocaleTimeString('en-IN', {
                                                timeZone: 'Asia/Kolkata',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                                hour12: true
                                            })}
                                        </p>
                                    </div>
                                </div>

                                <div className="ml-8 pr-4">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-500 transition-all">
                                        <ChevronRight size={18} className="text-zinc-600 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <footer className="mt-12 flex justify-center">
                <div className="flex items-center gap-8 px-6 py-3 rounded-full bg-zinc-900/50 border border-zinc-800/50 text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-blue-500"></div> Total Sessions: {sessions.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div> System Status: Operational
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default SessionAuditDashboard;
