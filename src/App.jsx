import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, ShieldAlert, Cpu, BarChart3, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const NO_SPINNERS_STYLE = `
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; appearance: none; }
`;

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8085/api/test/strangle';
const ORDERS_API = import.meta.env.VITE_ORDERS_API_URL || 'http://localhost:8082';
const WS_URL = API_BASE.replace('/api/test/strangle', '/ws-trading');

const INDICES = [
  { key: 'NIFTY', name: 'Nifty 50', type: 'MULTILEG_DELTA_STRANGLE', colorText: 'text-blue-500', colorGrad: 'from-blue-500/20', lotSize: 50 },
  { key: 'BANKNIFTY', name: 'Bank Nifty', type: 'MULTILEG_DELTA_STRANGLE', colorText: 'text-purple-500', colorGrad: 'from-purple-500/20', lotSize: 15 },
  { key: 'FINNIFTY', name: 'Fin Nifty', type: 'MULTILEG_DELTA_STRANGLE', colorText: 'text-indigo-500', colorGrad: 'from-indigo-500/20', lotSize: 40 },
  { key: 'SENSEX', name: 'Sensex', type: 'MULTILEG_DELTA_STRANGLE', colorText: 'text-fuchsia-500', colorGrad: 'from-fuchsia-500/20', lotSize: 10 },
  { key: 'CRUDEOIL', name: 'Crude Oil', type: 'MULTILEG_DELTA_STRANGLE', colorText: 'text-amber-500', colorGrad: 'from-amber-500/20', lotSize: 100 }
];

const getExpectedPositions = (indexKey, center) => {
  if (!center) return [];

  let step = 50;
  let safety = 300;

  if (indexKey === 'CRUDEOIL') { step = 50; safety = 400; }
  else if (indexKey === 'NIFTY') { step = 50; safety = 300; }
  else if (indexKey === 'BANKNIFTY') { step = 100; safety = 500; }
  else if (indexKey === 'FINNIFTY') { step = 50; safety = 300; }
  else if (indexKey === 'SENSEX') { step = 100; safety = 500; }

  // Base Logic: Match backend MultiLegDeltaNeutralStrangleStrategy
  let basePE, baseCE;
  if (center % step === 0) {
    basePE = baseCE = center;
  } else {
    const half = step / 2;
    basePE = center - half;
    baseCE = center + half;
  }

  const legs = [];
  for (let i = 0; i < 3; i++) {
    legs.push({ strike: baseCE + (i * step), type: 'CE', side: 'SELL' });
    legs.push({ strike: basePE - (i * step), type: 'PE', side: 'SELL' });
  }

  // Safety Hedges
  legs.push({ strike: baseCE + safety, type: 'CE', side: 'BUY' });
  legs.push({ strike: basePE - safety, type: 'PE', side: 'BUY' });

  return legs;
};

const StrategyCard = React.memo(({ name, type, status, onStart, onStop, loading, strategyPrice, syntheticPremium, pnl, netPremium, trades, settings, onUpdateSetting }) => {
  const isActive = status === 'RUNNING';

  return (
    <div className={`glass-panel p-6 rounded-lg transition-all duration-300 border-l-4 ${isActive ? 'border-l-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-l-zinc-800'}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-white uppercase tracking-wider">{name}</h3>
          <p className="text-sm text-blue-400 font-mono mt-1 flex items-center gap-1">
            <Cpu size={14} /> {type}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`px-3 py-1.5 rounded text-xs font-black tracking-widest ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
            {status}
          </div>
          <div className="flex gap-2">
            {pnl !== null && (
              <div className={`text-[12px] font-black font-mono px-2 py-1 rounded bg-black/40 ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                PNL: {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
            {netPremium !== null && (
              <div className="text-[12px] font-black font-mono px-2 py-1 rounded bg-black/40 text-zinc-400">
                PREM: <span className={netPremium <= 0 ? 'text-rose-400' : 'text-emerald-400'}>{netPremium.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-black/40 p-4 rounded border border-zinc-800/50 flex flex-col items-center">
          <p className="text-[10px] uppercase text-zinc-500 font-black mb-1 tracking-[0.2em]">Synthetic Price</p>
          <p className="text-2xl font-black font-mono text-blue-400">
            {strategyPrice?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '--.---'}
          </p>
        </div>
        <div className="bg-black/40 p-4 rounded border border-zinc-800/50 flex flex-col items-center border-l-blue-500/30">
          <p className="text-[10px] uppercase text-zinc-500 font-black mb-1 tracking-[0.2em] text-center">Synthetic Premium</p>
          <p className="text-2xl font-black font-mono text-emerald-400">
            {syntheticPremium?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '--.---'}
          </p>
        </div>
      </div>

      {/* STRATEGY PARAMETERS SECTION */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 mb-8 shadow-inner">
        <style>{NO_SPINNERS_STYLE}</style>
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert size={18} className="text-amber-500" />
          <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">Alpha_Parameters_Override</span>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">Num_Legs</label>
            <input
              type="number"
              value={settings?.numLegs}
              onChange={(e) => onUpdateSetting('numLegs', e.target.value)}
              disabled={isActive}
              className="w-full bg-black border-2 border-zinc-800 rounded-md px-4 py-3 text-lg font-black font-mono text-emerald-400 focus:border-blue-500 focus:bg-blue-500/5 outline-none transition-all disabled:opacity-30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">Safety_Gap</label>
            <input
              type="number"
              value={settings?.safetyGap}
              onChange={(e) => onUpdateSetting('safetyGap', e.target.value)}
              disabled={isActive}
              className="w-full bg-black border-2 border-zinc-800 rounded-md px-4 py-3 text-lg font-black font-mono text-emerald-400 focus:border-blue-500 focus:bg-blue-500/5 outline-none transition-all disabled:opacity-30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest pl-1">Interval</label>
            <input
              type="number"
              value={settings?.interval}
              onChange={(e) => onUpdateSetting('interval', e.target.value)}
              disabled={isActive}
              className="w-full bg-black border-2 border-zinc-800 rounded-md px-4 py-3 text-lg font-black font-mono text-emerald-400 focus:border-blue-500 focus:bg-blue-500/5 outline-none transition-all disabled:opacity-30"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={onStart}
          disabled={isActive || loading}
          className={`flex-[1.5] cyber-button py-3 rounded flex items-center justify-center gap-2 text-base font-black
            ${isActive || loading
              ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}
        >
          {loading ? <Activity size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />} START
        </button>
        <button
          onClick={onStop}
          disabled={!isActive || loading}
          className={`flex-1 cyber-button py-3 rounded flex items-center justify-center gap-2 text-base font-black
            ${!isActive || loading
              ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
              : 'bg-zinc-800 hover:bg-rose-600 border-zinc-700 hover:border-rose-400/50 text-zinc-300 hover:text-white transition-all'}`}
        >
          <Square size={20} fill="currentColor" /> STOP
        </button>
      </div>

      {/* Embedded Order Book */}
      <div className="mt-6 border-t border-zinc-800/50 pt-6">
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-500" /> Recent_Trades
        </h4>
        <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
          <table className="w-full text-left border-collapse font-mono table-fixed">
            <thead className="sticky top-0 bg-[#121418] z-30">
              <tr className="text-zinc-500 uppercase border-b border-zinc-800 text-[10px]">
                <th className="pb-3 px-1 font-black w-[75px]">Time</th>
                <th className="pb-3 px-1 font-black w-[150px]">Symbol</th>
                <th className="pb-3 px-1 font-black w-[45px]">Side</th>
                <th className="pb-3 px-1 font-black text-right w-[45px]">Qty</th>
                <th className="pb-3 px-1 font-black text-right w-[75px]">Price</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {(trades || []).length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-zinc-700 italic text-center text-xs">No trade data for this session</td>
                </tr>
              )}
              {(trades || []).map((t, i) => (
                <tr key={i} className="border-b border-zinc-800/30 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-1 text-zinc-500 whitespace-nowrap overflow-hidden text-ellipsis">
                    {new Date(t.tradedAt || t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </td>
                  <td className="py-3 px-1 text-zinc-100 font-bold truncate" title={t.symbol}>
                    {t.symbol}
                  </td>
                  <td className={`py-3 px-1 font-black ${t.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t.side}
                  </td>
                  <td className="py-3 px-1 text-right text-zinc-300">
                    {t.qty}
                  </td>
                  <td className="py-3 px-1 text-right text-blue-400 font-black">
                    {t.price?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

StrategyCard.displayName = 'StrategyCard';

const OptionChainGrid = React.memo(({ indexKey, activeCenter, positions, isCrude, atmPrices }) => {
  if (!activeCenter || activeCenter <= 0) {
    return (
      <div className="glass-panel rounded-lg overflow-hidden border border-zinc-800 flex flex-col h-full min-h-[600px] items-center justify-center opacity-40">
        <Activity size={48} className="mb-4 text-blue-500 animate-pulse" />
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em] mb-2">Market_Link_Standby</h3>
        <p className="text-[10px] text-zinc-600 font-mono text-center px-12">
          Waiting for live synthetic price calculation to generate matrix for {indexKey}.
        </p>
      </div>
    );
  }

  // UNIQUE STRIKES FROM DATA
  const strikes = React.useMemo(() => {
    const dataStrikes = Object.keys(atmPrices || {})
      .map(k => parseInt(k.split('_')[0]))
      .filter((v, i, a) => a.indexOf(v) === i);

    // BASE VIEWPORT (±15 steps around center)
    const step = (indexKey === 'NIFTY' || indexKey === 'FINNIFTY' || indexKey === 'CRUDEOIL') ? 50 : 100;
    const viewportStrikes = [];
    for (let i = -15; i <= 15; i++) viewportStrikes.push(activeCenter + (i * step));

    // MERGE: Viewport + Actual Data (Sorted)
    return Array.from(new Set([
      ...dataStrikes,
      ...viewportStrikes
    ])).sort((a, b) => a - b)
      .filter(s => Math.abs(s - activeCenter) <= 1500); // Focused range matching backend (±15 strikes)
  }, [atmPrices, activeCenter]);

  // isPosition highlights actual held positions from trades
  const isPosition = (strike, type) => {
    return (positions || []).find(p => p.strike === strike && p.type === type);
  };

  return (
    <div className="glass-panel rounded-lg overflow-hidden border border-zinc-800 flex flex-col h-full min-h-[600px]">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-3">
          <BarChart3 size={18} className="text-accent" /> Tactical_Leg_Deployment
        </h3>
        <div className="flex gap-6 text-[10px] font-black">
          <span className="flex items-center gap-2 text-emerald-500"><div className="w-2 h-2 bg-emerald-500 rounded-full glow-green animate-pulse"></div> ACTIVE_LONG</span>
          <span className="flex items-center gap-2 text-rose-500"><div className="w-2 h-2 bg-rose-500 rounded-full glow-red"></div> ACTIVE_SHORT</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar font-mono pr-1 relative">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20 bg-[#0A0B0D]">
            <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-800 bg-black/40">
              <th className="px-6 py-5 font-black">Call_LTP</th>
              <th className="px-6 py-5 font-black text-center text-zinc-300 bg-zinc-900/50">Strike</th>
              <th className="px-6 py-5 font-black text-right">Put_LTP</th>
            </tr>
          </thead>
          <tbody className="text-[14px]">
            {strikes.map(strike => {
              const cePos = isPosition(strike, 'CE');
              const pePos = isPosition(strike, 'PE');
              const isCenter = strike === activeCenter;

              // Use real prices from WebSocket map, fallback to --- if not available
              const displayCe = atmPrices?.[`${strike}_CE`] ? atmPrices[`${strike}_CE`].toFixed(2) : '---.--';
              const displayPe = atmPrices?.[`${strike}_PE`] ? atmPrices[`${strike}_PE`].toFixed(2) : '---.--';

              return (
                <tr key={strike} className={`hover:bg-white/2 transition-colors group ${isCenter ? 'bg-blue-500/5' : ''}`}>
                  {/* CE Side */}
                  <td className={`px-6 py-4 border-r border-zinc-900/50 relative ${cePos ? 'z-10' : ''}`}>
                    {cePos && (
                      <div className={`absolute inset-0 rounded border-l-4 pointer-events-none ${cePos.side === 'BUY' ? 'border-emerald-500 bg-emerald-500/10' : 'border-rose-500 bg-rose-500/10'}`}></div>
                    )}
                    <span className={`relative text-base ${cePos ? 'font-black text-white' : 'text-zinc-500 opacity-60 group-hover:opacity-100'}`}>
                      {displayCe}
                    </span>
                  </td>

                  {/* Strike Center */}
                  <td className={`px-6 py-4 text-center text-lg font-black border-x border-zinc-800/50 ${isCenter ? 'text-blue-400 bg-blue-500/15 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]' : 'text-zinc-200 bg-zinc-900/40'}`}>
                    {strike}
                  </td>

                  {/* PE Side */}
                  <td className={`px-6 py-4 text-right relative ${pePos ? 'z-10' : ''}`}>
                    {pePos && (
                      <div className={`absolute inset-0 rounded border-r-4 pointer-events-none ${pePos.side === 'BUY' ? 'border-emerald-500 bg-emerald-500/10' : 'border-rose-500 bg-rose-500/10'}`}></div>
                    )}
                    <span className={`relative text-base ${pePos ? 'font-black text-white' : 'text-zinc-500 opacity-60 group-hover:opacity-100'}`}>
                      {displayPe}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-black/40 border-t border-zinc-800 flex justify-between text-[9px] text-zinc-600 font-bold uppercase">
        <span>Matrix_v2.0</span>
        <span className="flex items-center gap-2">
          <span className="animate-pulse text-highlight">Real_Time_Sync: {new Date().toLocaleTimeString()}</span>
          <span className="text-zinc-800">|</span>
          <span>STOMP_OK</span>
        </span>
      </div>
    </div>
  );
});

OptionChainGrid.displayName = 'OptionChainGrid';

function App() {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState({});
  const [prices, setPrices] = useState({});
  const [centers, setCenters] = useState({});
  const [premiums, setPremiums] = useState({});
  const [atmPrices, setAtmPrices] = useState({});
  const [sessionTrades, setSessionTrades] = useState({});
  const [sessionIds, setSessionIds] = useState({}); // indexKey -> [sid, sid]
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('NIFTY');

  // STRATEGY SETTINGS STATE (Designer state for NEW instances)
  const [designerSettings, setDesignerSettings] = useState({
    NIFTY: { numLegs: 3, safetyGap: 300, interval: 25 },
    BANKNIFTY: { numLegs: 3, safetyGap: 500, interval: 50 },
    FINNIFTY: { numLegs: 3, safetyGap: 300, interval: 25 },
    SENSEX: { numLegs: 3, safetyGap: 500, interval: 50 },
    CRUDEOIL: { numLegs: 3, safetyGap: 400, interval: 25 }
  });

  const [sessionSettings, setSessionSettings] = useState({}); // sid -> settings
  const [selectedSessions, setSelectedSessions] = useState({}); // indexKey -> currentActiveSid

  const updateDesignerSetting = (indexKey, key, value) => {
    setDesignerSettings(prev => ({
      ...prev,
      [indexKey]: { ...prev[indexKey], [key]: parseInt(value) || 0 }
    }));
  };

  useEffect(() => {
    // 1. Initial State Fetch
    const fetchInitialData = async () => {
      try {
        for (const idx of INDICES) {
          try {
            const res = await axios.get(`${API_BASE}/prices?index=${idx.key}`);
            setAtmPrices(prev => ({
              ...prev,
              [idx.key]: { ...(prev[idx.key] || {}), ...res.data }
            }));
          } catch (e) {
            // Silence isolated API 404s if index is not actively streaming
          }
        }
        addLog('SYNCED: Latest Price Snapshots Retrieved', 'success');
      } catch (e) {
        console.error('Snapshot failed', e);
      }
    };

    fetchInitialData();

    // 2. Real-Time Link (WebSocket)
    const stompClient = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      debug: (str) => { },
      onConnect: () => {
        addLog('ESTABLISHED: WebSocket Connection', 'success');
        stompClient.subscribe('/topic/market-data', (message) => {
          const update = JSON.parse(message.body);
          const rawIndex = (update.index || '').toUpperCase();
          let indexKey = null;

          if (rawIndex.includes('BANKNIFTY') || rawIndex.includes('BANK')) indexKey = 'BANKNIFTY';
          else if (rawIndex.includes('FINNIFTY') || rawIndex.includes('FIN')) indexKey = 'FINNIFTY';
          else if (rawIndex.includes('SENSEX')) indexKey = 'SENSEX';
          else if (rawIndex.includes('NIFTY')) indexKey = 'NIFTY';
          else if (rawIndex.includes('CRUDE')) indexKey = 'CRUDEOIL';

          if (!indexKey) return;

          if (update.price > 0) setPrices(prev => ({ ...prev, [indexKey]: update.price }));
          if (update.premium > 0) setPremiums(prev => ({ ...prev, [indexKey]: update.premium }));
          if (update.center > 0) setCenters(prev => ({ ...prev, [indexKey]: update.center }));

          if (update.optionPrices) {
            setAtmPrices(prev => ({
              ...prev,
              [indexKey]: { ...(prev[indexKey] || {}), ...update.optionPrices }
            }));
          }
        });

        // 3. Multi-Session Center Sync
        stompClient.subscribe('/topic/session-updates', (message) => {
          const update = JSON.parse(message.body);
          if (update.sessionId && update.activeCenter > 0) {
            setCenters(prev => ({ ...prev, [update.sessionId]: update.activeCenter }));
          }
        });

        // 4. Trade Updates
        stompClient.subscribe('/topic/trades', (message) => {
          const trade = JSON.parse(message.body);
          const sid = trade.sessionId || 'GLOBAL';

          setSessionTrades(prev => ({
            ...prev,
            [sid]: [trade, ...(prev[sid] || [])]
          }));
          addLog(`TRADE: ${trade.side} ${trade.symbol} x ${trade.qty} @ ${trade.price} [${sid.slice(-4)}]`, 'success');
        });
      },
      onStompError: (frame) => {
        console.error('STOMP_ERROR:', frame);
        addLog('ERROR: WebSocket Link Down', 'error');
      },
      onWebSocketClose: () => {
        addLog('OFFLINE: WebSocket Link Closed', 'info');
      }
    });

    stompClient.activate();
    return () => stompClient.deactivate();
  }, []);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [{ msg, type }, ...prev].slice(0, 50));
  };

  const fetchHistoricalTrades = async (sid) => {
    try {
      const res = await axios.get(`${ORDERS_API}/trades?sessionId=${sid}`);
      if (res.data && Array.isArray(res.data)) {
        setSessionTrades(prev => ({
          ...prev,
          [sid]: res.data
        }));
      }
    } catch (err) {
      console.error('Failed to fetch historical trades:', err);
    }
  };

  const handleAction = async (indexKey, action, sessionId = null) => {
    setLoading(prev => ({ ...prev, [sessionId || indexKey]: true }));
    try {
      let url = `${API_BASE}/${action}?index=${indexKey}`;
      if (sessionId) url += `&sessionId=${sessionId}`;

      if (action === 'start') {
        const s = designerSettings[indexKey];
        url += `&numLegs=${s.numLegs}&safetyGap=${s.safetyGap}&interval=${s.interval}`;
      }

      const res = await axios.get(url);

      if (action === 'start') {
        const sid = res.data;
        setSessionIds(prev => ({ ...prev, [indexKey]: [...(prev[indexKey] || []), sid] }));
        setSessionTrades(prev => ({ ...prev, [sid]: [] }));
        setStatus(prev => ({ ...prev, [sid]: 'RUNNING' }));
        setSessionSettings(prev => ({ ...prev, [sid]: { ...designerSettings[indexKey] } }));
        setSelectedSessions(prev => ({ ...prev, [indexKey]: sid }));
        addLog(`DEPLOYED: ${indexKey} | ID: ${sid.slice(-6)}`, 'success');
        setTimeout(() => fetchHistoricalTrades(sid), 1000);
      } else {
        const sid = sessionId;
        setStatus(prev => ({ ...prev, [sid]: 'OFFLINE' }));
        setSessionIds(prev => {
          const updated = (prev[indexKey] || []).filter(id => id !== sid);
          if (selectedSessions[indexKey] === sid) {
            setSelectedSessions(inner => ({ ...inner, [indexKey]: updated[0] || null }));
          }
          return { ...prev, [indexKey]: updated };
        });
        addLog(`TERMINATED: ${indexKey} | ID: ${sid.slice(-6)}`, 'alert');
      }
    } catch (err) {
      addLog(`ERR: ${err.message}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [sessionId || indexKey]: false }));
    }
  };

  const calculateSessionPnL = (indexKey, sid) => {
    const trades = sessionTrades[sid] || [];
    if (trades.length === 0) return null;

    let cashFlow = trades.reduce((acc, t) => {
      const sideMult = t.side === 'SELL' ? 1 : -1;
      return acc + (sideMult * t.qty * t.price);
    }, 0);

    const netPositions = trades.reduce((acc, t) => {
      const sideMult = t.side === 'BUY' ? 1 : -1;
      acc[t.symbol] = (acc[t.symbol] || 0) + (sideMult * t.qty);
      return acc;
    }, {});

    let mtm = 0;
    Object.entries(netPositions).forEach(([symbol, qty]) => {
      if (Math.abs(qty) < 0.001) return;

      const trade = trades.find(t => t.symbol === symbol);
      let key = null;
      if (trade && trade.strike && trade.optionType) {
        key = `${Math.round(trade.strike)}_${trade.optionType}`;
      } else {
        const m = symbol.match(/(\d+)(CE|PE)$/);
        if (m) key = `${m[1]}_${m[2]}`;
      }

      const ltp = key ? atmPrices[indexKey]?.[key] : null;
      if (ltp) mtm += (qty * ltp);
    });

    return cashFlow + mtm;
  };

  const calculateNetPremium = (indexKey, sid) => {
    const trades = sessionTrades[sid] || [];
    if (trades.length === 0) return null;

    const netPositions = trades.reduce((acc, t) => {
      const sideMult = t.side === 'BUY' ? 1 : -1;
      acc[t.symbol] = (acc[t.symbol] || 0) + (sideMult * t.qty);
      return acc;
    }, {});

    let premiumValue = 0;
    Object.entries(netPositions).forEach(([symbol, qty]) => {
      if (Math.abs(qty) < 0.001) return;
      const trade = trades.find(t => t.symbol === symbol);
      let key = null;
      if (trade && trade.strike && trade.optionType) {
        key = `${Math.round(trade.strike)}_${trade.optionType}`;
      } else {
        const m = symbol.match(/(\d+)(CE|PE)$/);
        if (m) key = `${m[1]}_${m[2]}`;
      }
      const ltp = key ? atmPrices[indexKey]?.[key] : null;
      if (ltp) premiumValue += (qty * ltp);
    });
    return premiumValue;
  };

  const getNetPositions = (sid) => {
    const trades = sessionTrades[sid] || [];
    const netQty = {};
    trades.forEach(t => {
      const sideMult = t.side === 'BUY' ? 1 : -1;
      const key = `${Math.round(t.strike)}_${t.optionType}`;
      netQty[key] = (netQty[key] || 0) + (sideMult * t.qty);
    });
    return Object.entries(netQty)
      .filter(([_, qty]) => Math.abs(qty) > 0.001)
      .map(([key, qty]) => {
        const [strike, type] = key.split('_');
        return { strike: parseFloat(strike), type, side: qty > 0 ? 'BUY' : 'SELL', qty: Math.abs(qty) };
      });
  };

  const isAnyRunning = Object.values(status).some(s => s === 'RUNNING');

  return (
    <div className="min-h-screen p-8 bg-[#0A0B0D] text-zinc-100 selection:bg-blue-500/30 font-mono">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 border-b border-zinc-800/50 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600/10 rounded border border-blue-500/30 flex items-center justify-center group">
            <BarChart3 className="text-blue-500 group-hover:scale-110 transition-transform" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white">TERMINAL.<span className="text-blue-500">ALGO</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${isAnyRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                System.{isAnyRunning ? 'Active' : 'Standby'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-8 items-center bg-zinc-900/30 px-6 py-3 rounded-lg border border-zinc-800/50">
          <div className="text-right border-r border-zinc-800 pr-8">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-tight">Signal Interface</p>
            <p className="text-xs font-bold text-emerald-400 tracking-widest">READY</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-tight">Node Cluster</p>
            <p className="text-xs font-bold text-blue-400 tracking-widest">STABLE</p>
          </div>
        </div>
      </header>

      {/* Asset Navigation Tabs */}
      <div className="flex gap-4 mb-12 border-b border-zinc-800/30 pb-6 overflow-x-auto custom-scrollbar no-scrollbar-firefox">
        {INDICES.map(idx => (
          <button
            key={idx.key}
            onClick={() => setActiveTab(idx.key)}
            className={`px-12 py-5 rounded-lg text-lg font-black tracking-[0.25em] transition-all duration-300 border-2 uppercase whitespace-nowrap
              ${activeTab === idx.key
                ? `${idx.colorText} bg-white/10 border-zinc-600 shadow-[0_0_30px_rgba(255,255,255,0.05)] scale-105`
                : 'text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-white/5'
              }`}
          >
            {idx.name}
          </button>
        ))}
      </div>

      <main className="max-w-[1920px] mx-auto pb-24 px-4 h-[calc(100vh-250px)]">
        {INDICES.filter(idx => idx.key === activeTab).map(idx => {
          const sids = sessionIds[idx.key] || [];
          const activeSid = selectedSessions[idx.key];

          return (
            <div key={idx.key} className="flex gap-10 h-full">

              {/* LEFT SIDEBAR: SESSION VERTICAL TABS */}
              <div className="w-[300px] flex flex-col border-r border-zinc-800/50 pr-6 gap-4">
                <div className="mb-4">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Operations_Center</h3>
                  <button
                    onClick={() => handleAction(idx.key, 'start')}
                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 py-4 rounded-lg font-black tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 group"
                  >
                    <Activity size={14} className="group-hover:animate-pulse" /> DEPLOY_NEW_INSTANCE
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-2 px-2">Active_Sessions</h3>
                  {sids.length === 0 && (
                    <div className="px-4 py-8 text-center border border-dashed border-zinc-800 rounded bg-white/2">
                      <p className="text-[9px] text-zinc-700 italic">No nodes deployed</p>
                    </div>
                  )}
                  {sids.map(sid => {
                    const isSelected = activeSid === sid;
                    const pnlVal = calculateSessionPnL(idx.key, sid);
                    return (
                      <button
                        key={sid}
                        onClick={() => setSelectedSessions(prev => ({ ...prev, [idx.key]: sid }))}
                        className={`w-full text-left p-4 rounded-lg border transition-all duration-300 group
                          ${isSelected
                            ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                            : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                          }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[10px] font-black font-mono tracking-tighter ${isSelected ? 'text-blue-400' : 'text-zinc-500'}`}>
                            #{sid.slice(-6).toUpperCase()}
                          </span>
                          <div className={`w-1.5 h-1.5 rounded-full ${status[sid] === 'RUNNING' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-rose-500'}`}></div>
                        </div>
                        {pnlVal !== null && (
                          <div className={`text-xs font-black font-mono ${pnlVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {pnlVal >= 0 ? '+' : ''}{pnlVal.toFixed(0)}
                          </div>
                        )}
                        <div className="text-[9px] text-zinc-600 mt-1 opacity-60 flex gap-2 font-mono">
                          <span>L:{sessionSettings[sid]?.numLegs}</span>
                          <span>I:{sessionSettings[sid]?.interval}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* MAIN CONTENT Area: Selected Session Workspace */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                <div className="grid lg:grid-cols-2 gap-12">

                  {/* LEFT COLUMN: SESSION/IDLE */}
                  <div className="space-y-8">
                    {!activeSid ? (
                      <div className="glass-panel p-12 rounded-lg border border-zinc-800 flex flex-col items-center justify-center h-full min-h-[400px] opacity-40">
                        <ShieldAlert size={48} className="mb-4 text-zinc-500" />
                        <h2 className="text-lg font-black uppercase tracking-[0.3em]">System_Idle</h2>
                        <p className="mt-2 text-[10px] text-zinc-600 font-mono text-center">Deploy a new instance to begin automated trading.</p>
                      </div>
                    ) : (
                      <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <h2 className={`text-xl font-black ${idx.colorText} uppercase tracking-[0.4em] whitespace-nowrap`}>
                              Session_{activeSid.slice(-6).toUpperCase()}
                            </h2>
                            <div className={`h-0.5 w-[100px] bg-gradient-to-r ${idx.colorGrad} to-transparent opacity-20`}></div>
                          </div>
                          <button
                            onClick={() => handleAction(idx.key, 'stop', activeSid)}
                            className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:underline px-4 py-2 bg-rose-500/5 rounded border border-rose-500/20"
                          >
                            Terminate_X
                          </button>
                        </div>

                        <StrategyCard
                          name={idx.name}
                          type={idx.type}
                          status={status[activeSid] || 'OFFLINE'}
                          loading={loading[activeSid]}
                          strategyPrice={prices[idx.key]}
                          syntheticPremium={premiums[idx.key]}
                          pnl={calculateSessionPnL(idx.key, activeSid)}
                          netPremium={calculateNetPremium(idx.key, activeSid)}
                          trades={sessionTrades[activeSid]}
                          settings={sessionSettings[activeSid]}
                          onUpdateSetting={() => { }}
                          onStart={() => { }}
                          onStop={() => handleAction(idx.key, 'stop', activeSid)}
                        />
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: ALWAYS OPTION CHAIN */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-0.5 flex-1 bg-zinc-800/50"></div>
                      <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Live_Market_Matrix</h3>
                      <div className="h-0.5 flex-1 bg-zinc-800/50"></div>
                    </div>
                    <OptionChainGrid
                      indexKey={idx.key}
                      activeCenter={centers[activeSid] || centers[idx.key] || 0}
                      positions={activeSid ? getNetPositions(activeSid) : []}
                      isCrude={idx.key === 'CRUDEOIL'}
                      atmPrices={atmPrices[idx.key]}
                    />
                  </div>

                </div>
              </div>

              {/* PERSISTENT ALGO DESIGNER (FLOATING) */}
              <div className="fixed bottom-12 right-12 z-50 glass-panel p-6 border-blue-500/30 border-2 rounded-xl shadow-2xl w-[320px]">
                <div className="flex items-center gap-3 mb-6">
                  <Cpu className="text-blue-500" size={18} />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-300">New_Instance_Parameters</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1.5 block">Legs</label>
                    <input
                      type="number"
                      value={designerSettings[idx.key].numLegs}
                      onChange={e => updateDesignerSetting(idx.key, 'numLegs', e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded p-2 text-emerald-400 font-black font-mono text-xs focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1.5 block">Safety</label>
                    <input
                      type="number"
                      value={designerSettings[idx.key].safetyGap}
                      onChange={e => updateDesignerSetting(idx.key, 'safetyGap', e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded p-2 text-emerald-400 font-black font-mono text-xs focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1.5 block">Adjustment_Interval</label>
                    <input
                      type="number"
                      value={designerSettings[idx.key].interval}
                      onChange={e => updateDesignerSetting(idx.key, 'interval', e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded p-2 text-emerald-400 font-black font-mono text-xs focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleAction(idx.key, 'start')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded uppercase text-[9px] tracking-[.3em] transition-all shadow-[0_4px_15px_rgba(16,185,129,0.2)]"
                >
                  Confirm_Deployment
                </button>
              </div>

            </div>
          )
        })}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-[#0A0B0D] border-t border-zinc-800 flex items-center justify-between px-8 text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
        <div className="flex gap-8 items-center">
          <span className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-600 rounded-full"></div> Core_Bridge: 8085</span>
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></div> Env: Production_V1</span>
        </div>
        <div className="flex gap-4">
          <span>Buffer: 100%</span>
          <span className="text-zinc-800">|</span>
          <span>© 2026 Atman.Trading.Systems</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
