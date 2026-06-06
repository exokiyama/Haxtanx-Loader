import React, { useState } from 'react';
import { BotSession, LeakImage } from '../types';
import { supabase } from '../lib/supabase';
import { Plus, Trash, Save, HelpCircle, AlertTriangle } from 'lucide-react';

interface BotConfigPanelProps {
  session: BotSession;
}

export const BotConfigPanel: React.FC<BotConfigPanelProps> = ({ session }) => {
  const [newText, setNewText] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newMonitor, setNewMonitor] = useState('');
  const [newBlocked, setNewBlocked] = useState('');
  const [newMuted, setNewMuted] = useState('');
  const [newGroupJid, setNewGroupJid] = useState('');

  // Ment targets
  const [newMentUser, setNewMentUser] = useState('');

  // HTR targets
  const [newHtrTarget, setNewHtrTarget] = useState('');

  // Leak images (Unlimited)
  const [leakImgUrl, setLeakImgUrl] = useState('');
  const [leakImgCaption, setLeakImgCaption] = useState('');

  // Custom delay sliders
  const [mentDelay, setMentDelay] = useState(session.delays?.ment || 10);
  const [leakDelay, setLeakDelay] = useState(session.delays?.leak || 30);
  const [haxDelay, setHaxDelay] = useState(session.delays?.hax || 12);
  const [lpcDelay, setLpcDelay] = useState(session.delays?.lpc || 10);
  const [htrDelay, setHtrDelay] = useState(session.delays?.htr || 2);
  const [tempDelay, setTempDelay] = useState(session.delays?.temp || 5);

  // HTR Parameters
  const [hname, setHname] = useState(session.hname || 'Eren');
  const [hrtext, setHrtext] = useState(session.hrtext || 'yooo bro');

  const updateFields = async (fields: Partial<BotSession>) => {
    try {
      const { error } = await supabase.from('sessions').update(fields).eq('id', session.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update session parameter fields:', err);
    }
  };

  const handleAddItem = async (listName: keyof BotSession, value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    const cleanValue = value.replace(/\s+/g, '').trim();
    const currentList = (session[listName] as string[]) || [];
    if (currentList.includes(cleanValue)) {
      alert('This entry is currently registered.');
      return;
    }
    await updateFields({ [listName]: [...currentList, cleanValue] });
    setter('');
  };

  const handleRemoveItem = async (listName: keyof BotSession, index: number) => {
    const currentList = (session[listName] as string[]) || [];
    const updated = currentList.filter((_, i) => i !== index);
    await updateFields({ [listName]: updated });
  };

  // Add response phrase
  const handleAddResponseText = async () => {
    if (!newText.trim()) return;
    const currentList = session.responseTexts || [];
    await updateFields({ responseTexts: [...currentList, newText.trim()] });
    setNewText('');
  };

  // Add leak image payload
  const handleAddLeakImage = async () => {
    if (!leakImgUrl.trim() || !leakImgCaption.trim()) {
      alert('URL and Caption are required!');
      return;
    }
    const currentList = session.leakImages || [];
    const newImage: LeakImage = {
      id: Date.now(),
      url: leakImgUrl.trim(),
      text: leakImgCaption.trim(),
      added: Date.now()
    };
    await updateFields({ leakImages: [...currentList, newImage] });
    setLeakImgUrl('');
    setLeakImgCaption('');
  };

  const handleSaveDelays = async () => {
    await updateFields({
      delays: {
        ment: Number(mentDelay),
        leak: Number(leakDelay),
        hax: Number(haxDelay),
        lpc: Number(lpcDelay),
        htr: Number(htrDelay),
        temp: Number(tempDelay)
      }
    });
  };

  const handleSaveHtrInfo = async () => {
    await updateFields({
      hname: hname.trim(),
      hrtext: hrtext.trim()
    });
    alert('HTR parameters saved successfully.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      
      {/* 1. Core Bot Modes and Parameters */}
      <div className="bg-[#141414] border border-[#262626] rounded-xl p-5 shadow-2xl">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          ⚙️ Target Delays and Parameters
        </h3>

        <div className="space-y-5">
          {/* Engine Custom Timers */}
          <div className="bg-[#0D0D0D] p-4 rounded-lg border border-[#262626]">
            <h4 className="text-xs font-semibold text-slate-305 mb-3 uppercase tracking-wider">
              ⏱️ Dedicated Loop Timers
            </h4>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Mentions Trigger Interval: <strong className="text-[#25D366]">{mentDelay}s</strong></span>
                  <span>Min: 5s / Max: 120s</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="120"
                  value={mentDelay}
                  onChange={(e) => setMentDelay(Number(e.target.value))}
                  className="w-full accent-[#25D366] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Image Leak Trigger Interval: <strong className="text-pink-400">{leakDelay}s</strong></span>
                  <span>Min: 10s / Max: 300s</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="300"
                  value={leakDelay}
                  onChange={(e) => setLeakDelay(Number(e.target.value))}
                  className="w-full accent-pink-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Hax Spammer Loop Delay: <strong className="text-amber-400">{haxDelay}s</strong></span>
                  <span>Min: 2s / Max: 60s</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="60"
                  value={haxDelay}
                  onChange={(e) => setHaxDelay(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>LPC Mentions Loop Delay: <strong className="text-violet-400">{lpcDelay}s</strong></span>
                  <span>Min: 2s / Max: 60s</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="60"
                  value={lpcDelay}
                  onChange={(e) => setLpcDelay(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-violet-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>HTR Response Delay: <strong className="text-rose-400">{htrDelay}s</strong></span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="15"
                    value={htrDelay}
                    onChange={(e) => setHtrDelay(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-rose-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Temp Spammer Delay: <strong className="text-emerald-400">{tempDelay}s</strong></span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="30"
                    value={tempDelay}
                    onChange={(e) => setTempDelay(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveDelays}
                className="w-full mt-2 py-2 px-3 bg-[#25D366] hover:bg-opacity-90 text-xs font-bold text-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-3 h-3" /> Save Timers and Apply to Active Bot
              </button>
            </div>
          </div>

          {/* HTR (Hater-Target-Responder) Parameters */}
          <div className="bg-[#0D0D0D] p-4 rounded-lg border border-[#262626]">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-semibold text-slate-305 uppercase tracking-wider flex items-center gap-1">
                🔪 HTR Responder Parameters
              </h4>
              <button
                onClick={() => updateFields({ htrEnabled: !session.htrEnabled })}
                className={`py-0.5 px-2.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  session.htrEnabled ? 'bg-rose-500/10 text-rose-450 border border-rose-500/30' : 'bg-[#0A0A0A] text-zinc-500 border border-[#262626]'
                }`}
              >
                {session.htrEnabled ? '● HTR ACTIVE' : '● HTR DISABLED'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wide mb-1">Hater Display Name (hname)</label>
                <input
                  type="text"
                  placeholder="e.g. Eren"
                  value={hname}
                  onChange={(e) => setHname(e.target.value)}
                  className="w-full text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-1.5 px-3 text-slate-200 outline-none focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wide mb-1">Random Default Responder Text (hrtext)</label>
                <input
                  type="text"
                  placeholder="e.g. yooo bro"
                  value={hrtext}
                  onChange={(e) => setHrtext(e.target.value)}
                  className="w-full text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-1.5 px-3 text-slate-200 outline-none focus:border-red-500/50"
                />
              </div>

              <button
                onClick={handleSaveHtrInfo}
                className="w-full py-1.5 px-3 bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 hover:text-white border border-rose-500/20 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Save className="w-3.5 h-3.5" /> Save HTR Settings
              </button>
            </div>
          </div>

          {/* Bot Modes dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Response Scope Mode</label>
              <select
                value={session.botMode}
                onChange={(e) => updateFields({ botMode: e.target.value as any })}
                className="w-full text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2 px-3 text-slate-200 outline-none focus:border-gray-550"
              >
                <option value="all">Respond Everywhere (All)</option>
                <option value="group">Groups Only</option>
                <option value="dm">Direct Messages Only (DMs)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Engine Switch status</label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => updateFields({ botEnabled: !session.botEnabled })}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold select-none cursor-pointer transition-all ${
                    session.botEnabled ? 'bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {session.botEnabled ? '🟢 Operational' : '🔴 Deactivated'}
                </button>
                <button
                  onClick={() => updateFields({ processFromMe: !session.processFromMe })}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold select-none cursor-pointer transition-all ${
                    session.processFromMe ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'bg-[#262626] text-gray-300 border border-[#333]'
                  }`}
                >
                  {session.processFromMe ? 'Process Self' : 'Ignore Self'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Response Phrases list */}
        <div className="mt-6 bg-[#0D0D0D] p-4 rounded-lg border border-[#262626]">
          <label className="block text-xs font-semibold text-slate-350 mb-2 uppercase tracking-wide">
            📖 Response Phrase cached list ({session.responseTexts?.length || 0})
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter new speech or message phrase..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2 px-3 text-slate-200 outline-none focus:border-gray-550"
            />
            <button
              onClick={handleAddResponseText}
              className="py-2 px-3 bg-[#262626] hover:bg-zinc-800 rounded-lg text-slate-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
            {session.responseTexts?.map((phrase, i) => (
              <div key={i} className="flex justify-between items-center text-xs bg-[#111111] p-2 rounded border border-[#262626]">
                <span className="text-slate-300 line-clamp-2">#{i + 1}. {phrase}</span>
                <button
                  onClick={() => handleRemoveItem('responseTexts', i)}
                  className="text-gray-505 hover:text-red-400 p-1 cursor-pointer"
                >
                  <Trash className="w-3 h-3" />
                </button>
              </div>
            ))}
            {(!session.responseTexts || session.responseTexts.length === 0) && (
              <p className="text-xs text-slate-600 italic">No custom speech phrases saved. Defaults to "Hello!"</p>
            )}
          </div>
        </div>

        {/* 3. Unlimited Images for the Leak Command System */}
        <div className="mt-6 bg-[#0D0D0D] p-4 rounded-lg border border-[#262626]">
          <label className="block text-xs font-semibold text-slate-350 mb-2 uppercase tracking-wide">
            🖼️ Image Leaker Pool ({session.leakImages?.length || 0})
          </label>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Direct image URL (.jpg, .png, .gif)"
              value={leakImgUrl}
              onChange={(e) => setLeakImgUrl(e.target.value)}
              className="w-full text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2 px-3 text-slate-200 outline-none focus:border-[#25D366]"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Caption text..."
                value={leakImgCaption}
                onChange={(e) => setLeakImgCaption(e.target.value)}
                className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2 px-3 text-slate-200 outline-none focus:border-[#25D366]"
              />
              <button
                onClick={handleAddLeakImage}
                className="py-2 px-3 bg-[#262626] hover:bg-zinc-800 rounded-lg text-slate-200 cursor-pointer text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-44 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
            {session.leakImages?.map((img, i) => (
              <div key={img.id} className="flex gap-3 items-center text-xs bg-[#111111] p-2 rounded border border-[#262626] justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <img src={img.url} alt="Leak" className="w-8 h-8 rounded object-cover bg-[#0A0A0A]/85" />
                  <div className="overflow-hidden">
                    <p className="text-gray-500 font-medium truncate text-[10px]">{img.url}</p>
                    <p className="text-slate-200 truncate">{img.text}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveItem('leakImages', i)}
                  className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {(!session.leakImages || session.leakImages.length === 0) && (
              <p className="text-xs text-slate-600 italic">No image leaker configs loaded. Add some above!</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Key Configurations registries */}
      <div className="space-y-6">
        
        {/* Mentions User Targets */}
        <div className="bg-[#141414] border border-[#262626] rounded-xl p-5 shadow-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            🎯 Ment Target List ({session.mentUsers?.length || 0})
          </h3>
          <p className="text-[11px] text-gray-500 mb-3">
            Target WhatsApp numbers will receive looping alert tags during active command sequences.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 923248974661"
              value={newMentUser}
              onChange={(e) => setNewMentUser(e.target.value)}
              className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2 px-3 text-slate-200 outline-none focus:border-gray-500"
            />
            <button
              onClick={() => handleAddItem('mentUsers', newMentUser, setNewMentUser)}
              className="py-2 px-3 bg-[#25D366] hover:bg-opacity-95 text-xs font-bold text-black rounded-lg cursor-pointer"
            >
              Add User
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto scrollbar-hide">
            {session.mentUsers?.map((num, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-[#0A0A0A] text-slate-300 border border-[#262626] px-2.5 py-1 rounded-full">
                +{num}
                <button onClick={() => handleRemoveItem('mentUsers', i)} className="text-zinc-500 hover:text-red-400 cursor-pointer">
                  &times;
                </button>
              </span>
            ))}
            {(!session.mentUsers || session.mentUsers.length === 0) && (
              <p className="text-xs text-slate-600 italic">No targets loaded.</p>
            )}
          </div>
        </div>

        {/* Group Filter permissions whitelist */}
        <div className="bg-[#141414] border border-[#262626] rounded-xl p-5 shadow-2xl">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            👥 Target Allowed Groups
          </h3>
          <p className="text-[11px] text-gray-500 mb-3">
            If groups are defined, replies logic will lock to the given JIDs. Default empty responds in ALL.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Group JID e.g. 1203632cf@g.us"
              value={newGroupJid}
              onChange={(e) => setNewGroupJid(e.target.value)}
              className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-2 px-3 text-slate-200 outline-none focus:border-gray-500"
            />
            <button
              onClick={() => handleAddItem('allowedGroups', newGroupJid, setNewGroupJid)}
              className="py-2 px-3 bg-[#25D366] hover:bg-opacity-95 text-xs font-bold text-black rounded-lg cursor-pointer"
            >
              Allow Group
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto scrollbar-hide">
            {session.allowedGroups?.map((jid, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-[#0A0A0A] text-slate-300 border border-[#262626] px-2.5 py-1 rounded-full">
                {jid}
                <button onClick={() => handleRemoveItem('allowedGroups', i)} className="text-[#25D366] hover:text-red-400 cursor-pointer">
                  &times;
                </button>
              </span>
            ))}
            {(!session.allowedGroups || session.allowedGroups.length === 0) && (
              <p className="text-xs text-slate-600 italic">Allowed in ALL groups.</p>
            )}
          </div>
        </div>

        {/* Owners, Monitors, Blocked, Muted lists */}
        <div className="bg-[#141414] border border-[#262626] rounded-xl p-5 shadow-2xl space-y-5">
          
          {/* Owners block */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              👑 Bot Owners (Total: {session.owners?.length || 0})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Phone (e.g. 923249112233)"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-1.5 px-3 text-slate-200 outline-none"
              />
              <button
                onClick={() => handleAddItem('owners', newOwner, setNewOwner)}
                className="bg-[#262626] text-[#E5E5E5] hover:bg-zinc-800 px-3 py-1 bg-none rounded text-xs font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-hide">
              {session.owners?.map((item, i) => (
                <div key={i} className="text-[11px] bg-[#0A0A0A] text-slate-300 border border-[#262626] px-2 py-0.5 rounded flex items-center gap-1">
                  +{item}
                  <button onClick={() => handleRemoveItem('owners', i)} className="text-zinc-500 font-bold hover:text-red-500 cursor-pointer">&times;</button>
                </div>
              ))}
            </div>
          </div>

          {/* Monitors block */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              🎯 Monitored Numbers ({session.monitors?.length || 0})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Phone (e.g. 923249112233)"
                value={newMonitor}
                onChange={(e) => setNewMonitor(e.target.value)}
                className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-1.5 px-3 text-slate-200 outline-none"
              />
              <button
                onClick={() => handleAddItem('monitors', newMonitor, setNewMonitor)}
                className="bg-[#262626] text-[#E5E5E5] hover:bg-zinc-800 px-3 py-1 bg-none rounded text-xs font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-hide">
              {session.monitors?.map((item, i) => (
                <div key={i} className="text-[11px] bg-[#0A0A0A] text-slate-300 border border-[#262626] px-2 py-0.5 rounded flex items-center gap-1">
                  +{item}
                  <button onClick={() => handleRemoveItem('monitors', i)} className="text-zinc-500 font-bold hover:text-red-500 cursor-pointer">&times;</button>
                </div>
              ))}
            </div>
          </div>

          {/* Blocked block */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              🚫 Blocked Users ({session.blocked?.length || 0})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Phone"
                value={newBlocked}
                onChange={(e) => setNewBlocked(e.target.value)}
                className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-1.5 px-3 text-slate-200 outline-none"
              />
              <button
                onClick={() => handleAddItem('blocked', newBlocked, setNewBlocked)}
                className="bg-[#262626] text-[#E5E5E5] hover:bg-zinc-800 px-3 py-1 bg-none rounded text-xs font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-hide">
              {session.blocked?.map((item, i) => (
                <div key={i} className="text-[11px] bg-[#0A0A0A] text-slate-300 border border-[#262626] px-2 py-0.5 rounded flex items-center gap-1">
                  +{item}
                  <button onClick={() => handleRemoveItem('blocked', i)} className="text-zinc-500 font-bold hover:text-red-500 cursor-pointer">&times;</button>
                </div>
              ))}
            </div>
          </div>

          {/* Muted target block */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              🔇 Muted Auto-Replying Targets ({session.muted?.length || 0})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Phone"
                value={newMuted}
                onChange={(e) => setNewMuted(e.target.value)}
                className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-1.5 px-3 text-slate-200 outline-none"
              />
              <button
                onClick={() => handleAddItem('muted', newMuted, setNewMuted)}
                className="bg-[#262626] text-[#E5E5E5] hover:bg-zinc-800 px-3 py-1 bg-none rounded text-xs font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-hide">
              {session.muted?.map((item, i) => (
                <div key={i} className="text-[11px] bg-[#0A0A0A] text-slate-300 border border-[#262626] px-2 py-0.5 rounded flex items-center gap-1">
                  +{item}
                  <button onClick={() => handleRemoveItem('muted', i)} className="text-zinc-500 font-bold hover:text-red-500 cursor-pointer">&times;</button>
                </div>
              ))}
            </div>
          </div>

          {/* HTR Targets block */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-rose-455 mb-2 flex items-center gap-1">
              🔪 HTR Targeted Numbers ({session.htrTargets?.length || 0})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Target Phone (e.g. 923012345678)"
                value={newHtrTarget}
                onChange={(e) => setNewHtrTarget(e.target.value)}
                className="flex-1 text-xs bg-[#0A0A0A] border border-[#262626] rounded-lg py-1.5 px-3 text-slate-200 outline-none focus:border-rose-500/50"
              />
              <button
                onClick={() => handleAddItem('htrTargets', newHtrTarget, setNewHtrTarget)}
                className="bg-[#262626] text-[#E5E5E5] hover:bg-zinc-800 px-3 py-1 bg-none rounded text-xs font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto scrollbar-hide">
              {session.htrTargets?.map((item, i) => (
                <div key={i} className="text-[11px] bg-[#0A0A0A] text-slate-300 border border-[#262626] px-2 py-0.5 rounded flex items-center gap-1">
                  +{item}
                  <button onClick={() => handleRemoveItem('htrTargets', i)} className="text-zinc-400 hover:text-rose-500 font-bold cursor-pointer">&times;</button>
                </div>
              ))}
              {(!session.htrTargets || session.htrTargets.length === 0) && (
                <p className="text-[10px] text-zinc-500 italic">No HTR targets added. Tag them using .add htr from WhatsApp or enter above.</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
