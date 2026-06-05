import React, { useState, useEffect } from 'react';
import { BotSession } from '../types';
import { MessageSquare, RefreshCw, Command, Clock, Power, ShieldAlert } from 'lucide-react';

interface BotStatsWidgetProps {
  session: BotSession;
}

export const BotStatsWidget: React.FC<BotStatsWidgetProps> = ({ session }) => {
  const [sessionUptime, setSessionUptime] = useState<string>('0m');

  useEffect(() => {
    const start = session.stats?.start;
    if (!start || session.status !== 'Connected') {
      setSessionUptime('0m');
      return;
    }

    const calcUptime = () => {
      const diffMs = Date.now() - start;
      const diffSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSeconds / 3600);
      const mins = Math.floor((diffSeconds % 3600) / 60);
      if (hours > 0) {
        setSessionUptime(`${hours}h ${mins}m`);
      } else {
        setSessionUptime(`${mins}m`);
      }
    };

    calcUptime();
    const interval = setInterval(calcUptime, 30000); // 30s
    return () => clearInterval(interval);
  }, [session.stats?.start, session.status]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      
      {/* 1. Messages seen */}
      <div className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-[#25D366]/10 border border-[#25D366]/20 rounded-lg flex items-center justify-center text-[#25D366]">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Messages Processed</p>
          <p className="text-xl font-bold text-white mt-0.5">{session.stats?.msgs || 0}</p>
        </div>
      </div>

      {/* 2. Replies sent */}
      <div className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-[#25D366]/15 border border-[#25D366]/30 rounded-lg flex items-center justify-center text-[#25D366]">
          <RefreshCw className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Auto-Replies</p>
          <p className="text-xl font-bold text-white mt-0.5">{session.stats?.replies || 0}</p>
        </div>
      </div>

      {/* 3. Commands processed */}
      <div className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg flex items-center justify-center text-fuchsia-400">
          <Command className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Console Commands</p>
          <p className="text-xl font-bold text-white mt-0.5">{session.stats?.cmds || 0}</p>
        </div>
      </div>

      {/* 4. Active session duration */}
      <div className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-zinc-800/60 border border-zinc-700/50 rounded-lg flex items-center justify-center text-gray-300">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Device Uptime</p>
          <p className="text-xl font-bold text-white mt-0.5">{sessionUptime}</p>
        </div>
      </div>

    </div>
  );
};
