import React, { useState, useEffect } from 'react';
import { BotSession, LogEntry } from '../types';
import { BotConfigPanel } from './BotConfigPanel';
import { LogTerminal } from './LogTerminal';
import { BotStatsWidget } from './BotStatsWidget';
import { TemplateFilesManager } from './TemplateFilesManager';
import { supabase } from '../lib/supabase';
import { LogOut, Play, Square, RefreshCcw, Wifi, WifiOff, RefreshCw, KeyRound, Smartphone, Layers, AlertCircle, Copy, Check } from 'lucide-react';

// Use standard client-side qrcode generator library dynamically to display WhatsApp login QR codes
import QRCode from 'qrcode';

interface ActiveSessionViewProps {
  session: BotSession;
  onBack: () => void;
}

export const ActiveSessionView: React.FC<ActiveSessionViewProps> = ({ session, onBack }) => {
  const [sessionStatus, setSessionStatus] = useState<BotSession['status']>(session.status);
  const [wsQr, setWsQr] = useState<string | null>(null);
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [wsPairing, setWsPairing] = useState<string | null>(null);
  const [pairPhone, setPairPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hook WebSockets to stream QR updates in real time
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', sessionId: session.id }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'status') {
          if (parsed.data) setSessionStatus(parsed.data);
          if (parsed.qr) setWsQr(parsed.qr);
          if (parsed.pairing) setWsPairing(parsed.pairing);
        } else if (parsed.type === 'qr') {
          setWsQr(parsed.data);
        } else if (parsed.type === 'pairing') {
          setWsPairing(parsed.data);
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [session.id]);

  // Generate QR Canvas Blob helper for crisp representation
  useEffect(() => {
    if (!wsQr) {
      setQrBlobUrl(null);
      return;
    }
    QRCode.toDataURL(wsQr, { margin: 2, scale: 6 })
      .then(url => setQrBlobUrl(url))
      .catch(err => console.error('QR creation failed:', err));
  }, [wsQr]);

  const handleStartBot = async () => {
    setLoading(true);
    setWsQr(null);
    setWsPairing(null);
    try {
      await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: session.id,
          phoneNumberToPair: pairPhone.trim() || undefined
        })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async () => {
    setLoading(true);
    try {
      await fetch('/api/sessions/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      });
      setSessionStatus('Disconnected');
      setWsQr(null);
      setWsPairing(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeAuth = async () => {
    if (!confirm('Are you absolutely sure you want to clear credentials cache? This will reset all linked WhatsApp sessions.')) return;
    setLoading(true);
    try {
      await fetch('/api/sessions/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      });
      setSessionStatus('Disconnected');
      setWsQr(null);
      setWsPairing(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!wsPairing) return;
    navigator.clipboard.writeText(wsPairing);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteSession = async () => {
    if (!confirm('Permanently delete this WhatsApp Bot profile configuration?')) return;
    setLoading(true);
    try {
      // Force stop it first
      await fetch('/api/sessions/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      }).catch(() => {});

      // Delete Bot profile config
      const { error } = await supabase.from('sessions').delete().eq('id', session.id);
      if (error) throw error;
      onBack();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (sessionStatus) {
      case 'Connected':
        return (
          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
            <Wifi className="w-3.5 h-3.5" /> Connected
          </span>
        );
      case 'Connecting':
        return (
          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting
          </span>
        );
      case 'Error':
        return (
          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-[#262626] text-gray-400 border border-zinc-800">
            <WifiOff className="w-3.5 h-3.5" /> Offline
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* 1. Header Back & Quick Configuration actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-[#141414] border border-[#262626] p-5 rounded-xl shadow-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="h-9 px-4 bg-[#262626] border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all rounded-lg text-xs font-semibold text-zinc-300 cursor-pointer"
          >
            &larr; Back to Profiles
          </button>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🤖 {session.name}
            </h2>
            <p className="text-xs text-gray-500">
              Session Profile Identification Key: <code className="bg-[#0A0A0A] border border-[#262626] px-1.5 py-0.5 rounded text-[10px] text-gray-450">{session.id}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {getStatusBadge()}

          {sessionStatus === 'Disconnected' || sessionStatus === 'Error' ? (
            <button
              onClick={handleStartBot}
              disabled={loading}
              className="h-10 px-5 bg-[#25D366] hover:bg-opacity-95 text-black rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-[#25D366]/10 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Spin Up Session
            </button>
          ) : (
            <button
              onClick={handleStopBot}
              disabled={loading}
              className="h-10 px-5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" /> Disconnect Bot
            </button>
          )}

          <button
            onClick={handleWipeAuth}
            disabled={loading}
            title="Clean all tokens"
            className="h-10 px-4 bg-[#262626] hover:bg-zinc-800 hover:text-white border border-[#262626] text-slate-350 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Wipe Tokens
          </button>

          <button
            onClick={handleDeleteSession}
            disabled={loading}
            className="h-10 px-4 bg-[#0A0A0A] hover:bg-red-950/45 hover:text-red-400 border border-[#262626] rounded-lg text-xs font-semibold cursor-pointer text-gray-400"
          >
            Purge Profile
          </button>
        </div>
      </div>

      {session.errorReason && sessionStatus === 'Error' && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-6 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Engine Crash: </span> {session.errorReason}
          </div>
        </div>
      )}

      {/* 2. QR Code Pairing Screen (When offline or connecting) */}
      {(sessionStatus === 'Connecting' || sessionStatus === 'Disconnected') && (
        <div className="bg-[#141414] border border-[#262626] rounded-xl p-8 mb-8 text-center flex flex-col items-center max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-48 h-48 bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />
          
          <h3 className="text-base font-bold text-white mb-2 flex items-center justify-center gap-1.5 font-sans">
            🔑 Haxtanx Session Generator
          </h3>
          <p className="text-xs text-slate-400 max-w-lg mb-6 leading-relaxed">
            Choose between QR Scan or Phone Pairing Code .
          </p>

          {sessionStatus === 'Connecting' && !wsQr && !wsPairing ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <span className="w-8 h-8 border-3 border-[#25D366]/30 border-t-[#25D366] rounded-full animate-spin mb-4" />
              <p className="text-xs text-[#25D366] font-semibold animate-pulse tracking-wide font-mono">
                [HAX] COMPILING SECURE CONNECTION WITH DADDY HAAMZA BOT...
              </p>
              <p className="text-[10px] text-gray-500 mt-1 max-w-xs">
                Generating WhatsApp secure authorization by using baileys. This will takes about 5-10 seconds.
              </p>
            </div>
          ) : sessionStatus === 'Disconnected' && !wsQr && !wsPairing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-2 text-left">
              
              {/* Option A: QR Scanning */}
              <div className="bg-[#0A0A0A] border border-[#262626] p-6 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#25D366] tracking-wider mb-2 flex items-center gap-1 font-mono">
                    <Smartphone className="w-3.5 h-3.5" /> OPTION A: QR CODE
                  </span>
                  <h4 className="text-xs font-bold text-white mb-1.5">Scan with Linked Devices</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Instantly load WhatsApp on your server by pointing your phone camera at the screen QR.
                  </p>
                </div>
                
                <button
                  onClick={handleStartBot}
                  disabled={loading}
                  className="w-full mt-6 py-2.5 bg-[#25D366] hover:bg-opacity-90 text-black text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Spin up and Get QR
                    </>
                  )}
                </button>
              </div>

              {/* Option B: Pairing Code PIN (CLI Pairing) */}
              <div className="bg-[#0A0A0A] border border-[#262626] p-6 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-pink-500 tracking-wider mb-2 flex items-center gap-1 font-mono">
                    <KeyRound className="w-3.5 h-3.5" /> OPTION B:PAIRING CODE
                  </span>
                  <h4 className="text-xs font-bold text-white mb-1.5">Pair with Mobile Number</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Generate an 8 digit code to authorize without scanning QR an active display screen.
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Phone Number (With Country Code)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 923248974661"
                    value={pairPhone}
                    onChange={(e) => setPairPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-[#141414] border border-[#262626] rounded-md text-xs text-white placeholder:text-gray-650 outline-none focus:border-[#25D366] transition-colors"
                  />
                  
                  <button
                    onClick={handleStartBot}
                    disabled={loading || !pairPhone.trim()}
                    className="w-full mt-3 py-2.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" /> Spin up and Get Pairing Code
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full mt-2">
              
              {/* Left Side: QR Display */}
              <div className="bg-[#0A0A0A] border border-[#262626] p-6 rounded-xl flex flex-col items-center h-full justify-between">
                <span className="text-[10px] font-bold text-gray-500 tracking-wider mb-3 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-[#25D366]" /> METHOD A: SCAN QR
                </span>
                
                {qrBlobUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-800">
                      <img src={qrBlobUrl} alt="WhatsApp QR Code" className="w-44 h-44 rounded-md select-none" />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-3 text-center leading-normal">
                      Settings &rsaquo; Linked Devices &rsaquo; Link a Device
                    </p>
                  </div>
                ) : (
                  <div className="py-12 text-center text-[11px] text-gray-500 italic font-mono animate-pulse">
                    No QR code requested or queued.
                  </div>
                )}
              </div>

              {/* Right Side: Pairing Code Display */}
              <div className="bg-[#0A0A0A] border border-[#262626] p-6 rounded-xl flex flex-col items-center h-full justify-between">
                <span className="text-[10px] font-bold text-gray-500 tracking-wider mb-3 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-pink-500" /> METHOD B: PAIRING CODE
                </span>

                {wsPairing ? (
                  <div className="flex flex-col items-center w-full py-2">
                    <div className="bg-pink-500/5 border-2 border-pink-500/20 text-pink-400 font-mono text-xl font-extrabold px-6 py-3.5 tracking-widest rounded-xl flex items-center gap-2 relative group select-all">
                      {wsPairing}
                      <button
                        onClick={handleCopyPairingCode}
                        className="text-pink-500 hover:text-white p-1 hover:bg-zinc-800 rounded transition-all cursor-pointer"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 text-center mt-3 max-w-xs leading-normal">
                      Take this authentication key and paste it inside WhatsApp &rsaquo; Linked Devices .
                    </p>
                  </div>
                ) : (
                  <div className="w-full font-sans text-center">
                    <p className="text-[11px] text-gray-500 leading-normal mb-3 max-w-xs mx-auto">
                      Need a temporary Pairing CODE? Supply your terminal target phone and click requesting.
                    </p>
                    <input
                      type="text"
                      placeholder="e.g. 923248974661"
                      value={pairPhone}
                      onChange={(e) => setPairPhone(e.target.value)}
                      className="w-full text-center text-xs bg-[#141414] border border-[#262626] rounded-lg py-2 px-3 text-slate-200 outline-none mb-2"
                    />
                    <button
                      onClick={handleStartBot}
                      disabled={loading || !pairPhone.trim()}
                      className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      {loading ? (
                        <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Generate Pairing Code'
                      )}
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* 3. Stats Summary Cards (When connected) */}
      <BotStatsWidget session={session} />

      {/* 4. Terminal and Config layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Terminal panel */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-505 mb-3 select-none">
            📋 Terminal Feed Output
          </h3>
          <LogTerminal sessionId={session.id} isConnected={sessionStatus === 'Connected'} />
        </div>

        {/* Configuration settings panel */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-550 mb-3 select-none">
            ⚙️ Bot Settings and Triggers
          </h3>
          <div className="bg-[#141414] border border-[#262626] rounded-xl p-5 shadow-2xl">
            <h4 className="text-xs font-semibold uppercase text-slate-350 mb-1">
              Engine Parameters config panel
            </h4>
            <p className="text-[11px] text-gray-550 mb-4">
              Sync bot properties down to our active database storage. Changes apply instantly.
            </p>
            <BotConfigPanel session={session} />
          </div>
        </div>

      </div>

      {/* 5. Txt Templates File Manager */}
      <TemplateFilesManager />

    </div>
  );
};
