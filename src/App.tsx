import React, { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, setDoc, doc, addDoc } from 'firebase/firestore';
import { BotSession } from './types';
import { AuthPanel } from './components/AuthPanel';
import { ActiveSessionView } from './components/ActiveSessionView';
import { Bot, LogOut, Plus, RefreshCw, KeyRound, ArrowRight, User as UserIcon, Power, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotId, setNewBotId] = useState('');
  const [creating, setCreating] = useState(false);

  // Monitor auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
      // Reset navigation state if they log out
      if (!currentUser) {
        setSelectedSessionId(null);
        setSessions([]);
      }
    });
    return unsub;
  }, []);

  // Sync sessions collection from Firestore in real-time
  useEffect(() => {
    if (!user) return;

    const path = 'sessions';
    const q = query(
      collection(db, path),
      where('ownerId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: BotSession[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as BotSession);
        });
        setSessions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return unsub;
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newBotName.trim()) {
      alert('Bot Name is required!');
      return;
    }

    setCreating(true);
    try {
      const generatedId = newBotId.replace(/[^a-zA-Z0-9_\-]/g, '').trim() || 'bot_' + Math.random().toString(36).substring(2, 10);
      const sessionDocRef = doc(db, 'sessions', generatedId);

      const defaultPayload: Omit<BotSession, 'id'> = {
        ownerId: user.uid,
        name: newBotName.trim(),
        status: 'Disconnected',
        botMode: 'all',
        botEnabled: true,
        processFromMe: false,
        delays: { ment: 10, leak: 30 },
        stats: { msgs: 0, replies: 0, cmds: 0, start: Date.now() },
        allowedGroups: null,
        responseTexts: ['Hello! I am currently busy.'],
        owners: [],
        monitors: [],
        blocked: [],
        muted: [],
        mentUsers: [],
        leakImages: [],
        createdAt: Date.now()
      };

      await setDoc(sessionDocRef, defaultPayload);
      
      setNewBotName('');
      setNewBotId('');
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to register configuration profile.');
    } finally {
      setCreating(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center">
        <Bot className="w-10 h-10 text-[#25D366] animate-pulse mb-3" />
        <p className="text-xs text-slate-505 tracking-wider">Acquiring sandbox claims credentials...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPanel onAuthSuccess={() => {}} />;
  }

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] font-sans relative overflow-x-hidden selection:bg-zinc-800">
      
      {/* Decorative gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Primary Global Navigation */}
      <nav className="bg-[#0D0D0D] border-b border-[#262626] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#25D366]/10 border border-[#25D366]/25 rounded-lg flex items-center justify-center text-[#25D366]">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight h-full">HaxtanxWa</span>
              <span className="text-[9px] uppercase font-bold text-[#25D366] bg-[#25D366]/10 px-1.5 py-0.5 rounded ml-2 border border-[#25D366]/25">Orchestrator v2.4</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-[#0A0A0A] pl-3 pr-4 py-1.5 rounded-lg border border-[#262626]">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] font-bold text-slate-300 leading-none">
                  {user.displayName || 'Sandbox Admin'}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5 max-w-[140px] truncate leading-none">
                  {user.email || 'developer_mode'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="h-8 pr-3 pl-2 hover:bg-[#262626] rounded-lg text-slate-400 hover:text-red-405 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container routes */}
      {selectedSession ? (
        <ActiveSessionView
          session={selectedSession}
          onBack={() => setSelectedSessionId(null)}
        />
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-10">
          
          {/* Welcome Billboard banner */}
          <div className="mb-10 bg-[#141414] border border-[#262626] p-8 rounded-xl relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none" />
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              WhatsApp Bot Profiles Dashboard
            </h1>
            <p className="text-xs text-gray-450 max-w-2xl leading-relaxed mb-6">
              Create, provision, and authenticate micro-bot targets dynamically. Every instance operates standard Keep-Alive Warm polling loops and custom E2E key mappings inside Firestore automatically.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-10 px-5 bg-[#25D366] hover:bg-opacity-95 text-black rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 text-black stroke-[3px]" /> Register Bot Profile
            </button>
          </div>

          {/* Sessions grid listing */}
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 select-none">
            Active Bot Profiles ({sessions.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((sess) => {
              const isOnline = sess.status === 'Connected';
              const isPending = sess.status === 'Connecting';

              return (
                <motion.div
                  layout
                  key={sess.id}
                  className="bg-[#141414] border border-[#262626] hover:border-gray-500 transition-all p-5 rounded-xl flex flex-col justify-between h-48 group shadow-xl"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#262626] flex items-center justify-center text-slate-450 group-hover:text-[#25D366] transition-colors">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-[#25D366] transition-colors">
                            {sess.name}
                          </h3>
                          <p className="text-[10px] text-zinc-500">ID: {sess.id}</p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-[10px] font-semibold ${
                        isOnline ? 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20' :
                        isPending ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25 animate-pulse' :
                        'bg-[#0A0A0A] text-zinc-500 border border-[#262626]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#25D366]' : isPending ? 'bg-blue-400' : 'bg-slate-650'}`} />
                        {sess.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 bg-[#0A0A0A]/40 p-2.5 rounded-lg border border-[#262626]">
                      <div className="text-center">
                        <p className="text-[9px] uppercase font-bold text-zinc-650">Seen</p>
                        <p className="text-xs font-bold text-slate-350 mt-0.5">{sess.stats?.msgs || 0}</p>
                      </div>
                      <div className="text-center border-x border-[#262626]">
                        <p className="text-[9px] uppercase font-bold text-zinc-650">Replied</p>
                        <p className="text-xs font-bold text-slate-350 mt-0.5">{sess.stats?.replies || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] uppercase font-bold text-zinc-650">Mode</p>
                        <p className="text-xs font-bold text-slate-350 mt-0.5 uppercase">{sess.botMode}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedSessionId(sess.id)}
                    className="w-full mt-4 h-9 bg-[#0A0A0A] hover:bg-[#25D366] hover:text-black border border-[#262626] hover:border-[#25D366] text-xs font-semibold text-slate-300 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    Open Session Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}

            {sessions.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-[#262626] py-16 text-center rounded-xl flex flex-col items-center justify-center">
                <Bot className="w-12 h-12 text-[#262626] animate-pulse mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">No Bot Configurations Found</h3>
                <p className="text-xs text-gray-500 max-w-sm mb-4 leading-normal font-sans">
                  Create your first WhatsApp bot configuration profile file inside firestore storage to trigger QR scanner sequences.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="py-2 px-4 bg-[#141414] border border-[#262626] hover:border-gray-500 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Profile Configuration
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 5. Create Profile Modal dialog */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-[#262626] rounded-xl p-6 shadow-2xl max-w-md w-full"
            >
              <h3 className="text-md font-bold text-white mb-2 flex items-center gap-1.5">
                🤖 Register Bot Profile
              </h3>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                Provide a friendly name for this instance and an optional specific ID target inside database collections.
              </p>

              <form onSubmit={handleCreateSession} className="space-y-4 font-sans">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">
                    Bot Short Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Agent, Personal Assistant"
                    value={newBotName}
                    onChange={(e) => setNewBotName(e.target.value)}
                    className="w-full text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">
                    Profile custom ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="blank for random system generation ID"
                    value={newBotId}
                    onChange={(e) => setNewBotId(e.target.value)}
                    className="w-full text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2.5 px-3 text-slate-200 outline-none focus:border-gray-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-[#262626] mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="h-9 px-4 bg-[#0A0A0A] border border-[#262626] hover:bg-[#262626] hover:text-white transition-all text-slate-400 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="h-9 px-5 bg-[#25D366] hover:bg-opacity-95 text-black rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {creating ? (
                      <span className="w-4 h-4 border-2 border-black/25 border-t-black rounded-full animate-spin" />
                    ) : (
                      'Initialize Configuration'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistent global footer */}
      <footer className="py-6 mt-16 bg-[#0A0A0A] border-t border-[#262626] text-center text-xs text-gray-500 font-mono">
        <div className="flex justify-center items-center gap-1.5 mb-1 text-slate-400 select-none">
          <ShieldCheck className="w-3.5 h-3.5 text-[#25D366]" /> Multi-Tenant E2E Database Authentication System
        </div>
        Powered by @whiskeysockets/baileys WebSocket connection E2E engine.
      </footer>

    </div>
  );
}
