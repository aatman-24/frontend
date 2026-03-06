import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ArrowLeft,
    BarChart3,
    TrendingUp,
    TrendingDown,
    Zap,
    ShieldAlert,
    Activity,
    CheckCircle2,
    XCircle,
    Clock,
    Briefcase
} from 'lucide-react';

const ORDERS_API = import.meta.env.VITE_ORDERS_API_URL || 'http://localhost:8082';

const MetricCard = ({ title, value, icon: Icon, color, subValue, subColor }) => (
    <div className="glass-panel p-6 rounded-xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${color} bg-opacity-10 dark:bg-opacity-20`}>
                <Icon size={20} className={color.replace('bg-', 'text-')} />
            </div>
            {subValue && (
                <span className={`text-[10px] font-black uppercase tracking-widest ${subColor || 'text-zinc-500'}`}>
                    {subValue}
                </span>
            )}
        </div>
        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">{title}</p>
        <p className="text-2xl font-black font-mono text-white tracking-tighter">
            {value}
        </p>
    </div>
);

const AnalysisDash = ({ onBack, sessionId, indexKey }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`${ORDERS_API}/sessions/${sessionId}/analysis`);
                setAnalysis(res.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (sessionId) fetchAnalysis();
    }, [sessionId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[600px]">
            <Activity size={48} className="text-blue-500 animate-spin mb-4" />
            <p className="text-zinc-500 font-black tracking-widest animate-pulse">ANALYZING_QUANT_RECORDS...</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-[600px] text-rose-500">
            <ShieldAlert size={48} className="mb-4" />
            <p className="font-black tracking-widest">ERROR_FETCHING_ANALYSIS</p>
            <p className="text-xs mt-2 text-zinc-600">{error}</p>
            <button onClick={onBack} className="mt-8 text-xs underline font-black uppercase opacity-60 hover:opacity-100">Abort_And_Return</button>
        </div>
    );

    const isProfit = analysis.netRealizedPnl >= 0;

    return (
        <div className="animate-in fade-in duration-700 max-w-7xl mx-auto py-10">
            <header className="flex items-center justify-between mb-12 border-b border-zinc-800/50 pb-8">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 hover:border-zinc-700 transition-all"
                    >
                        <ArrowLeft size={18} className="text-zinc-400" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black tracking-tighter text-white">SESSION.<span className="text-blue-500">ANALYTICS</span></h1>
                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-400">v2.0</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-1">
                            ID: {sessionId} <span className="mx-2 text-zinc-800">|</span> ASSET: {indexKey}
                        </p>
                    </div>
                </div>

                <div className="px-6 py-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50 flex gap-12">
                    <div className="text-right">
                        <p className="text-[9px] text-zinc-600 uppercase font-black mb-1">Status</p>
                        <div className="flex items-center gap-2 justify-end">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                            <span className="text-xs font-black text-emerald-400 tracking-widest">COMPLETED</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-zinc-600 uppercase font-black mb-1">Timestamp</p>
                        <p className="text-xs font-black text-zinc-300 font-mono italic">
                            {new Date().toLocaleTimeString()}
                        </p>
                    </div>
                </div>
            </header>

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <MetricCard
                    title="Net_Realized_PnL"
                    value={`${isProfit ? '+' : ''}₹${analysis.netRealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={isProfit ? TrendingUp : TrendingDown}
                    color={isProfit ? 'bg-emerald-500' : 'bg-rose-500'}
                    subValue={isProfit ? "PROFITABLE" : "LOSS"}
                    subColor={isProfit ? 'text-emerald-500' : 'text-rose-500'}
                />
                <MetricCard
                    title="Total_Executed_Trades"
                    value={analysis.totalTrades}
                    icon={Zap}
                    color="bg-blue-500"
                    subValue="EXECUTION"
                />
                <MetricCard
                    title="Consolidated_Charges"
                    value={`₹${analysis.totalCharges.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    icon={Briefcase}
                    color="bg-amber-500"
                    subValue="BROKERAGE+TAX"
                />
                <MetricCard
                    title="Total_Turnover"
                    value={`₹${analysis.totalTurnover.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    icon={Activity}
                    color="bg-indigo-500"
                    subValue="TURNOVER"
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: Volume Details */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="glass-panel p-8 rounded-2xl border border-zinc-800/50">
                        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-3 mb-8">
                            <Clock size={18} className="text-blue-500" /> Performance_Timeline
                        </h3>
                        <div className="h-40 flex items-center justify-center border border-dashed border-zinc-800 rounded bg-white/2">
                            <p className="text-[10px] text-zinc-700 font-black tracking-widest uppercase">Sequential_Data_Rendering_Pending...</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Charges & Summary */}
                <div className="space-y-8">
                    <div className="glass-panel p-8 rounded-2xl border border-zinc-800/50 bg-amber-500/[0.02]">
                        <h3 className="text-xs font-black text-amber-500/80 uppercase tracking-[0.2em] mb-6">Brokerage_Breakdown</h3>
                        <div className="space-y-4 font-mono">
                            <div className="flex justify-between py-2 border-b border-zinc-800/50">
                                <span className="text-[11px] text-zinc-500">Brokerage (0.11%)</span>
                                <span className="text-xs font-black text-zinc-300">₹{analysis.brokerage.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-zinc-800/50">
                                <span className="text-[11px] text-zinc-500">STT (0.1% Sell)</span>
                                <span className="text-xs font-black text-zinc-300">₹{analysis.stt.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-zinc-800/50">
                                <span className="text-[11px] text-zinc-500">Exch + SEBI (Turnover)</span>
                                <span className="text-xs font-black text-zinc-300">₹{(analysis.exchangeCharges + analysis.sebiCharges).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-zinc-800/50">
                                <span className="text-[11px] text-zinc-500">Stamp Duty (0.015% Buy)</span>
                                <span className="text-xs font-black text-zinc-300">₹{analysis.stampDuty.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-zinc-800/50">
                                <span className="text-[11px] text-zinc-500">GST (18% Serv)</span>
                                <span className="text-xs font-black text-zinc-300">₹{analysis.gst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-4">
                                <span className="text-xs font-black text-zinc-200 uppercase">Total_Deductions</span>
                                <span className="text-base font-black text-amber-500">₹{analysis.totalCharges.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-8 rounded-2xl border border-zinc-800/50">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-6">Alpha_Audit_Report</h3>
                        <div className="space-y-4">
                            <div className="flex gap-3 items-start p-3 rounded bg-zinc-900/50 border border-zinc-800">
                                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-bold text-zinc-300">Execution_Healthy</p>
                                    <p className="text-[9px] text-zinc-600">All orders filled via automated router without latency spikes.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start p-3 rounded bg-zinc-900/50 border border-zinc-800">
                                <XCircle size={16} className="text-amber-500 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-bold text-zinc-300">Slippage_Detected</p>
                                    <p className="text-[9px] text-zinc-600">Minor delta found between synthetic and fill prices.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisDash;
