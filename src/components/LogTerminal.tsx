import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trash2, AlertCircle, FileText, Search, Play, Pause, ChevronRight } from 'lucide-react';

interface LogTerminalProps {
  sessionId: string;
  isConnected: boolean;
}

export const LogTerminal: React.FC<LogTerminalProps> = ({ sessionId, isConnected }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Load snapshot logs
  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, 'sessions', sessionId, 'logs'),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        if (active) {
          const loaded = snap.docs.map(doc => doc.data() as LogEntry);
          // Firestore query is ordered desc, let's reverse to show oldest first in scrolling terminal
          setLogs(loaded.reverse());
        }
      } catch (err) {
        console.error('Failed to load initial logs:', err);
      }
    };

    fetchLogs();

    return () => {
      active = false;
    };
  }, [sessionId]);

  // Hook WebSocket connection to receive real-time operational logs
  useEffect(() => {
    if (!isLive) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Subscribe to this session updates
      ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'log' && parsed.data) {
          const log = parsed.data as LogEntry;
          setLogs(prev => {
            // Cap history to 100 entries to prevent rendering slowing down
            const merged = [...prev, log];
            if (merged.length > 100) {
              return merged.slice(merged.length - 100);
            }
            return merged;
          });
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [sessionId, isLive]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'text-sky-400';
      case 'success': return 'text-emerald-400 font-medium';
      case 'warn': return 'text-yellow-500';
      case 'error': return 'text-red-500 font-semibold';
      case 'cmd': return 'text-fuchsia-400 font-medium';
      case 'msg': return 'text-cyan-300';
      case 'sys': return 'text-slate-400 italic';
      default: return 'text-slate-300';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
      
      {/* Terminal Title / Control bar */}
      <div className="bg-[#0D0D0D] border-b border-[#262626] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 select-none">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#25D366] shadow-[0_0_8px_#25D366]' : 'bg-[#EF4444]'}`}></span>
          Live Bot Output Log Terminal
        </label>
 
        <div className="flex items-center gap-2 flex-wrap">
          {/* Level filters */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="text-[10px] bg-[#0A0A0A] border border-[#262626] rounded px-2.5 py-1 text-slate-300 outline-none"
          >
            <option value="all">levels: ALL</option>
            <option value="msg">Messages only</option>
            <option value="cmd">Commands only</option>
            <option value="success">Successes</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
            <option value="sys">System events</option>
          </select>
 
          {/* Pause / Play live stream */}
          <button
            onClick={() => setIsLive(!isLive)}
            title={isLive ? 'Pause live logs' : 'Resume live logs'}
            className={`p-1.5 rounded bg-[#0A0A0A] border hover:bg-[#262626] cursor-pointer ${
              isLive ? 'border-[#25D366]/30 text-[#25D366]' : 'border-[#262626] text-gray-500'
            }`}
          >
            {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
 
          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-500 pointer-events-none">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Filter console..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-[10px] bg-[#0A0A0A] border border-[#262626] rounded pl-7 pr-3 py-1 text-slate-300 outline-none w-36 focus:border-gray-500 focus:w-44 transition-all"
            />
          </div>
 
          <button
            onClick={handleClearLogs}
            title="Clear display logs"
            className="p-1.5 rounded bg-[#0A0A0A] hover:bg-[#262626] hover:text-red-450 border border-[#262626] text-gray-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
 
      {/* Terminal logs body display screen */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] p-4 bg-[#050505] text-[#E5E5E5] space-y-1.5 leading-relaxed selection:bg-zinc-800 scrollbar-hide">
        
        {/* Helper tip */}
        <div className="text-[10px] text-gray-500 border-b border-[#262626] pb-2 mb-2 italic">
          💡 Commands executed in chats like "ping" or "help" will auto-log directly into this real-time stream.
        </div>
 
        {filteredLogs.map((log) => (
          <div key={log.id} className="group hover:bg-[#141414]/30 py-0.5 rounded px-1 transition-all flex items-start gap-1">
            <span className="text-gray-600 select-none text-[10px] pr-1 pt-0.5 flex items-center">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}{' '}
              <ChevronRight className="w-2.5 h-2.5 ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
            </span>
            
            <span className={`uppercase font-semibold select-none mr-2 text-[9px] px-1 rounded-sm tracking-wider bg-[#0C0C0C] border border-[#262626] ${getLevelColor(log.level)}`}>
              {log.level}
            </span>
 
            <span className={getLevelColor(log.level)}>
              {log.message}
            </span>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 select-none">
            <FileText className="w-8 h-8 mb-2 opacity-30 animate-pulse" />
            <p className="italic">Terminal idle. Waiting for bot activity trigger...</p>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
