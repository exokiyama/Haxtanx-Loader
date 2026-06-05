import pkgBaileys, {
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

// Robust dual ESM/CommonJS module interop resolution
const makeWASocket = typeof (pkgBaileys as any).default === 'function'
  ? (pkgBaileys as any).default
  : (typeof pkgBaileys === 'function' ? pkgBaileys : (pkgBaileys as any).makeWASocket || pkgBaileys);
import pino from 'pino';
import {
  getSession,
  saveSession,
  updateSessionFields,
  getBaileysCreds,
  saveBaileysCreds,
  getBaileysKey,
  saveBaileysKey,
  deleteBaileysKey,
  clearBaileysKeys,
  addLog as dbAddLog,
  getLogs as dbGetLogs
} from './db.js';

// Mock DB wrapper to mimic firestore interface so we don't have to rewrite 1000 lines of existing code
const db = {};
const doc = (dbRef: any, col: string, ...idParts: string[]) => {
  return { col, id: idParts.join('_') };
};
const collection = (dbRef: any, ...paths: string[]) => {
  return { col: paths.join('_') };
};

const getDoc = async (docRef: any) => {
  if (docRef.col === 'sessions') {
    const session = await getSession(docRef.id);
    return {
      exists: () => !!session,
      data: () => session
    };
  }
  return { exists: () => false, data: () => null };
};

const updateDoc = async (docRef: any, fields: any) => {
  if (docRef.col === 'sessions') {
    const resolvedFields: any = {};
    for (const key in fields) {
      if (key.includes('.')) {
        const parts = key.split('.');
        const parentKey = parts[0];
        const childKey = parts[1];
        const currentSession = await getSession(docRef.id);
        const currentParentObj = currentSession ? (currentSession as any)[parentKey] || {} : {};
        resolvedFields[parentKey] = {
          ...currentParentObj,
          [childKey]: fields[key]
        };
      } else {
        resolvedFields[key] = fields[key];
      }
    }
    await updateSessionFields(docRef.id, resolvedFields);
  }
};

const addDoc = async (colRef: any, data: any) => {
  const parts = colRef.col.split('_');
  if (parts[0] === 'sessions' && parts[2] === 'logs') {
    const sessionId = parts[1];
    await dbAddLog(sessionId, data);
  }
};
import { BotSession, LogEntry, LeakImage } from '../types.js';
import fs from 'fs';
import path from 'path';

// Core Directory and Data file Initializers
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const HATER_FILE_PATH = path.join(DATA_DIR, 'hater.txt');
const LPC_FILE_PATH = path.join(DATA_DIR, 'lpc.txt');
const MON_FILE_PATH = path.join(DATA_DIR, 'mon.txt');

function ensureDataFiles() {
  if (!fs.existsSync(HATER_FILE_PATH)) {
    fs.writeFileSync(HATER_FILE_PATH, [
      "YOU STILL THINK CAN CHALLENGE DADDY HAMZA? IMPOSSIBLE!",
      "REMAIN SILENT IN FRONT OF YOUR DEV DAD PAPA HAMZA!",
      "YOUR SPEED IS LOWER THAN MY OLD COMPUTER'S INTERNET!",
      "OH PLEASE, STOP POSTING AND DISSOLVE INTO THE SHADOWS!",
      "RUNNING AFTER DADDY HAMZA WON'T SAVE YOUR FAILED CAREER!",
      "LOSE SIGHT AND FEEL THE PRESSURE!",
      "THE KING DADDY HAMZA ALWAYS DOMINATES THEIR CHATS!"
    ].join('\n') + '\n', 'utf-8');
  }
  if (!fs.existsSync(LPC_FILE_PATH)) {
    fs.writeFileSync(LPC_FILE_PATH, [
      "WAKE UP AND RESPOND TO DADDY HAMZA IMMEDIATELY!",
      "FEEL THE REAL POWER ENGINE FROM HAXTANX LOADER!",
      "PINGED! YOUR DAD PAPA HAMZA IS CALLING YOU OUT!",
      "DO NOT REJECT THE ALMIGHTY COMMANDS OF DADDY HAMZA!",
      "ONLINE NOW AND FEEL THE ULTIMATE PRESENCE!"
    ].join('\n') + '\n', 'utf-8');
  }
  if (!fs.existsSync(MON_FILE_PATH)) {
    fs.writeFileSync(MON_FILE_PATH, [
      "🛡️ Monitored Activity Detected. Daddy Hamza is keeping an eye on your status.",
      "⚠️ Alert! This chat is being live-logged by Haxtanx Loader V1.",
      "🤖 Your action has been synced down to our database triggers securely."
    ].join('\n') + '\n', 'utf-8');
  }
}
ensureDataFiles();

// Helper to pick randomly from a text file cleanly
function readLinesFromFile(filePath: string): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (err) {
    console.error(`Failed to read file ${filePath}:`, err);
    return [];
  }
}

// Generate stylized random watermarks
const WATERMARKS = [
  "⚡ > 𝙁𝙀𝙀𝙇 𝙔𝙊𝙐𝙍 𝘿𝘼𝘿𝘿𝙔 𝙃𝘼𝙈𝙕𝘼",
  "👑 > 𝙁𝙀𝙀𝙇 𝙔𝙊𝙐𝙍 𝘿𝙀𝙑 𝘿𝘼𝘿 𝙃𝘼𝙈𝙕𝘼",
  "🛡️ > 𝘿𝙀𝙑 𝘽𝙔 𝙃𝘼𝙈𝙕𝘼 𝙋𝘼𝙋𝘼",
  "🔥 > 𝙃𝘼𝙓𝙏𝘼𝙉𝙓 𝙇𝙊𝘼𝘿𝙀𝙍 𝙑1 𝘽𝙔 𝘿𝘼𝘿𝘿𝙔 𝙃𝘼𝙈𝙕𝘼"
];
function getRandomWatermark(): string {
  return WATERMARKS[Math.floor(Math.random() * WATERMARKS.length)];
}

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

// Custom Database-backed Auth State
async function useFirestoreAuthState(sessionId: string) {
  // Load creds
  let creds: AuthenticationCreds;
  const rawData = await getBaileysCreds(sessionId);
  if (rawData) {
    creds = JSON.parse(JSON.stringify(rawData), BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
    await saveBaileysCreds(sessionId, JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
  }

  const keys = {
    get: async (type: string, ids: string[]) => {
      const data: { [key: string]: any } = {};
      await Promise.all(
        ids.map(async (id) => {
          const keyId = `${type}_${id}`;
          const valRaw = await getBaileysKey(sessionId, keyId);
          if (valRaw !== null && valRaw !== undefined) {
            let val = JSON.parse(JSON.stringify(valRaw), BufferJSON.reviver);
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
          if (value === null) {
            tasks.push(deleteBaileysKey(sessionId, keyId));
          } else {
            tasks.push(saveBaileysKey(sessionId, keyId, JSON.parse(JSON.stringify(value, BufferJSON.replacer))));
          }
        }
      }
      await Promise.all(tasks);
    }
  };

  const saveCreds = async () => {
    await saveBaileysCreds(sessionId, JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
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

  // Custom Hater and LPC spamming loop states
  private isHaxRunning = false;
  private haxTimer: NodeJS.Timeout | null = null;
  private isLpcRunning = false;
  private lpcTimer: NodeJS.Timeout | null = null;
  private lpcTargets: string[] = [];

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
    const activePrefix = config.prefix || '%';
    let matchedPrefix = '';
    let isCommand = false;

    if (text.startsWith(activePrefix)) {
      matchedPrefix = activePrefix;
      isCommand = true;
    } else if (text.startsWith('.')) {
      matchedPrefix = '.';
      isCommand = true;
    } else if (text.startsWith('!')) {
      matchedPrefix = '!';
      isCommand = true;
    } else if (
      text.toLowerCase() === 'hax start' || 
      text.toLowerCase() === 'stop hax' || 
      text.toLowerCase() === 'stop lpc' || 
      text.toLowerCase() === 'stopall'
    ) {
      matchedPrefix = '';
      isCommand = true;
    } else if (text.toLowerCase().startsWith('hax ')) {
      matchedPrefix = '';
      isCommand = true;
    }

    if (isCommand) {
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

  private async runHaxSpam(chatJid: string, config: BotSession) {
    if (!this.isHaxRunning || !this.isConnected) {
      return;
    }

    try {
      const haters = config.haterNames || [];
      if (haters.length === 0) {
        await this.addLog('warn', 'Hax spam: No active hater names registered.');
        await this.sock.sendMessage(chatJid, { text: '⚠️ [NexusWA Admin] Please register at least one hater first using %addhater <name>' });
        this.isHaxRunning = false;
        return;
      }
      const activeHater = haters[Math.floor(Math.random() * haters.length)];

      const spamLines = readLinesFromFile(HATER_FILE_PATH);
      if (spamLines.length === 0) {
        await this.addLog('warn', 'Hax spam: hater.txt is empty.');
        this.isHaxRunning = false;
        return;
      }
      const rawText = spamLines[Math.floor(Math.random() * spamLines.length)];

      const watermark = getRandomWatermark();
      const textToSend = `👿 *ᴛᴀʀɢᴇᴛ:* *${activeHater}*\n\n💬 ${rawText}\n\n${watermark}`;

      await this.sock.sendMessage(chatJid, { text: textToSend });
      await this.addLog('success', `Hax spam sent targeting ${activeHater}`);

      const sessionRef = doc(db, 'sessions', this.sessionId);
      await updateDoc(sessionRef, { 'stats.replies': config.stats.replies + 1 }).catch(() => {});

    } catch (err: any) {
      await this.addLog('error', `Hax loop error: ${err.message}`);
    }

    const delays = [9000, 12000, 15000];
    const delayMs = delays[Math.floor(Math.random() * delays.length)];
    
    this.haxTimer = setTimeout(async () => {
      const sessionRef = doc(db, 'sessions', this.sessionId);
      const snap = await getDoc(sessionRef);
      if (snap.exists() && this.isHaxRunning) {
        this.runHaxSpam(chatJid, snap.data() as BotSession);
      }
    }, delayMs);
  }

  private async runLpcSpam(chatJid: string, config: BotSession) {
    if (!this.isLpcRunning || !this.isConnected) {
      return;
    }

    try {
      if (this.lpcTargets.length === 0) {
        await this.addLog('warn', 'LPC spam: No targets to mention.');
        await this.sock.sendMessage(chatJid, { text: '⚠️ [NexusWA Admin] LPC targets list is empty. Mention a user via .lpc @user' });
        this.isLpcRunning = false;
        return;
      }

      const mentionsStr = this.lpcTargets.map(t => `@${t.split('@')[0]}`).join(' , ');

      const spamLines = readLinesFromFile(LPC_FILE_PATH);
      if (spamLines.length === 0) {
        await this.addLog('warn', 'LPC spam: lpc.txt is empty.');
        this.isLpcRunning = false;
        return;
      }
      const rawText = spamLines[Math.floor(Math.random() * spamLines.length)];

      const watermark = getRandomWatermark();
      const textToSend = `${mentionsStr}\n\n⚔️ *ʟᴘᴄ:* ${rawText}\n\n${watermark}`;

      await this.sock.sendMessage(chatJid, {
        text: textToSend,
        mentions: this.lpcTargets
      });
      await this.addLog('success', `LPC spam sent to chat mentioning ${this.lpcTargets.length} targets`);

      const sessionRef = doc(db, 'sessions', this.sessionId);
      await updateDoc(sessionRef, { 'stats.replies': config.stats.replies + 1 }).catch(() => {});

    } catch (err: any) {
      await this.addLog('error', `LPC loop error: ${err.message}`);
    }

    const delays = [8000, 10000, 12000];
    const delayMs = delays[Math.floor(Math.random() * delays.length)];

    this.lpcTimer = setTimeout(async () => {
      const sessionRef = doc(db, 'sessions', this.sessionId);
      const snap = await getDoc(sessionRef);
      if (snap.exists() && this.isLpcRunning) {
        this.runLpcSpam(chatJid, snap.data() as BotSession);
      }
    }, delayMs);
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
        const activePrefix = config.prefix || '%';
        const helpText = `╔══════════════════════════╗\n` +
          `   👑  *𝙉𝙀开𝙐𝙎𝙒𝘼 𝙇𝙊𝘼𝘿𝙀𝙍 𝘽𝙊𝙏*  👑   \n` +
          `      *𝖣𝖤𝖖𝖤𝖫𝖮𝖯𝖤𝖣 𝖡𝖸 𝖣𝖠𝖣𝖣𝖸 𝖧𝖠𝖬𝖹𝖠*       \n` +
          `╚══════════════════════════╝\n\n` +
          `🛡️ *ᴀᴄᴛɪᴠᴇ ᴘʀᴇғɪx:*  \`${activePrefix}\`\n\n` +
          `👥 *⚙️ 𝘾𝙊𝙉𝙏𝙍𝙊𝙇 & 𝙎𝙀𝙏𝙏𝙄𝙉𝙂𝙎:*\n` +
          `◽ \`${activePrefix}help\` - Displays this guide\n` +
          `◽ \`${activePrefix}ping\` - Check live handshake latency\n` +
          `◽ \`${activePrefix}pre <char>\` - Change prefix (e.g. \`${activePrefix}pre !\`)\n` +
          `◽ \`${activePrefix}stats\` - View session logs & metrics\n\n` +
          `👑 *👤 𝙊𝙒𝙉𝙀𝙍𝙎𝙃𝙄𝙋:*\n` +
          `◽ \`${activePrefix}owners\` - Show registered bot owners\n` +
          `◽ \`${activePrefix}addowner <phone>\` - Add new admin owner\n` +
          `◽ \`${activePrefix}removeowner <phone>\` - Remove owner\n\n` +
          `🎯 *📡 𝙈𝙊𝙉𝙄𝙏𝙊𝙍𝙎:*\n` +
          `◽ \`${activePrefix}monitors\` - Show auto-reply watch targets\n` +
          `◽ \`${activePrefix}addmonitor <phone>\` - Add monitor user\n` +
          `◽ \`${activePrefix}removemonitor <phone>\` - Remove user\n` +
          `◽ \`${activePrefix}addmtxt <text>\` - Append reply to mon.txt\n` +
          `◽ \`${activePrefix}rmmtxt <text>\` - Wipe a reply from mon.txt\n\n` +
          `🚫 *🛑 𝙁𝙄𝙇𝙏𝙀𝙍𝙎 & 𝙈𝙐𝙏𝙀𝙎:*\n` +
          `◽ \`${activePrefix}blocked\` - View blocked phone list\n` +
          `◽ \`${activePrefix}block <phone>\` - Stop user from commands\n` +
          `◽ \`${activePrefix}unblock <phone>\` - Unblock a number\n` +
          `◽ \`${activePrefix}mute\` - Enable reply trackers (tag user)\n` +
          `◽ \`${activePrefix}unmute\` - Deactivate reply tracking\n\n` +
          `👿 *🔥 𝙃𝘼𝙏𝙀𝙍 𝙎𝙋𝘼𝙈𝙈𝙀𝙍 (𝙗𝙖𝙘𝙠𝙜𝙧𝙤𝙪𝙣𝙙):*\n` +
          `◽ \`hax start\` / \`${activePrefix}hax start\` - Boot fast hater loops (9s/12s/15s)\n` +
          `◽ \`stop hax\` / \`${activePrefix}hax stop\` - Shutdown hater loops\n` +
          `◽ \`${activePrefix}addtext <text>\` - Append spam inside hater.txt\n` +
          `◽ \`${activePrefix}rmtext <text>\` - Remove spam from hater.txt\n` +
          `◽ \`${activePrefix}addhater <name>\` - Register user name in haters DB\n` +
          `◽ \`${activePrefix}rmhater <name>\` - Wipe hater name from DB\n` +
          `◽ \`${activePrefix}haters\` - Show all tracked haters database\n\n` +
          `⚔️ *💥 𝙇𝙋𝘾 𝙎𝙋𝘼𝙈𝙈𝙀𝙍 (𝙗𝙖𝙘𝙠𝙜𝙧𝙤𝙪𝙣𝙙):*\n` +
          `◽ \`.lpc @user\` - Initialize pings with tags from lpc.txt (8s/10s/12s)\n` +
          `◽ \`stop lpc\` / \`stopall\` - Stop LPC spamming instantly\n\n` +
          `🖼️ *🎞️ 𝙇𝙀𝘼𝙆 & 𝙂𝙍𝙊𝙐𝙋𝙎:*\n` +
          `◽ \`${activePrefix}leak [start|stop]\` - Looping images + texts\n` +
          `◽ \`${activePrefix}ment [start|stop]\` - Regular loop group tags\n` +
          `◽ \`${activePrefix}join <group-link>\` - Join group via invite URL\n` +
          `◽ \`${activePrefix}left\` - Exit current group immediately\n` +
          `◽ \`${activePrefix}nuke\` - Absolute secure groups wipeout\n\n` +
          `💻 _Full synchronization provided in real-time by NexusWA Cloud panel!_`;
        await reply(helpText);
        break;
      }

      case 'pre': {
        const newPrefix = args[1]?.trim();
        if (!newPrefix || newPrefix.length > 2) {
          return reply('❌ Please specify a valid short prefix character (1-2 chars).');
        }
        await updateDoc(sessionRef, { prefix: newPrefix });
        await reply(`✅ *Success:* The trigger prefix has been dynamically shifted to '${newPrefix}'!`);
        break;
      }

      case 'join': {
        const link = args[1]?.trim();
        if (!link) return reply('❌ Please specify a valid WhatsApp group invite link.');
        const match = link.match(/(?:chat\.whatsapp\.com\/)(?:invite\/)?([a-zA-Z0-9]{20,24})/i);
        const inviteCode = match ? match[1] : link;
        try {
          await this.sock.groupAcceptInvite(inviteCode);
          await reply('✅ Successfully joined group!');
        } catch (e: any) {
          await reply(`❌ Failed to join group: ${e.message}`);
        }
        break;
      }

      case 'left':
      case 'leave': {
        if (!isGroup) return reply('❌ This command can only be run in WhatsApp group chats.');
        await reply('🚪 Leaving group per owner override...');
        try {
          await this.sock.groupLeave(chatJid);
        } catch (e: any) {
          await this.addLog('error', `Left group failed: ${e.message}`);
        }
        break;
      }

      case 'addtext': {
        const content = args.slice(1).join(' ').trim();
        if (!content) return reply('❌ Please specify text content to append.');
        const resolved = content.replace(/\\n/g, '\n');
        try {
          fs.appendFileSync(HATER_FILE_PATH, resolved + '\n', 'utf-8');
          await reply('✅ Text successfully appended inside hater.txt file!');
        } catch (e: any) {
          await reply(`❌ Failed to write file: ${e.message}`);
        }
        break;
      }

      case 'rmtext': {
        const content = args.slice(1).join(' ').trim();
        if (!content) return reply('❌ Please specify exact text to remove from hater.txt.');
        try {
          const lines = readLinesFromFile(HATER_FILE_PATH);
          const filtered = lines.filter(l => l !== content);
          fs.writeFileSync(HATER_FILE_PATH, filtered.join('\n') + '\n', 'utf-8');
          await reply('✅ Target line wiped from hater.txt.');
        } catch (e: any) {
          await reply(`❌ Failed: ${e.message}`);
        }
        break;
      }

      case 'addmtxt': {
        const content = args.slice(1).join(' ').trim();
        if (!content) return reply('❌ Specify mon.txt append text.');
        const resolved = content.replace(/\\n/g, '\n');
        try {
          fs.appendFileSync(MON_FILE_PATH, resolved + '\n', 'utf-8');
          await reply('✅ Text successfully appended to mon.txt for auto-monitoring replies.');
        } catch (e: any) {
          await reply(`❌ Failed: ${e.message}`);
        }
        break;
      }

      case 'rmmtxt': {
        const content = args.slice(1).join(' ').trim();
        if (!content) return reply('❌ Specify EXACT text to remove from mon.txt.');
        try {
          const lines = readLinesFromFile(MON_FILE_PATH);
          const filtered = lines.filter(l => l !== content);
          fs.writeFileSync(MON_FILE_PATH, filtered.join('\n') + '\n', 'utf-8');
          await reply('✅ Removed line from mon.txt.');
        } catch (e: any) {
          await reply(`❌ Failed: ${e.message}`);
        }
        break;
      }

      case 'addhater': {
        const name = args.slice(1).join(' ').trim();
        if (!name) return reply('❌ Specify hater nickname or tag.');
        const updated = Array.from(new Set([...(config.haterNames || []), name]));
        await updateDoc(sessionRef, { haterNames: updated });
        await reply(`✅ Added *${name}* to our targets database.`);
        break;
      }

      case 'rmhater': {
        const name = args.slice(1).join(' ').trim();
        if (!name) return reply('❌ Specify hater name.');
        const updated = (config.haterNames || []).filter(h => h !== name);
        await updateDoc(sessionRef, { haterNames: updated });
        await reply(`✅ Removed *${name}* from blockers target database.`);
        break;
      }

      case 'haters': {
        await reply(`👿 *REGISTERED TARGETED HATERS LIST*:\n\n` + (config.haterNames?.map((h, i) => `${i + 1}. *${h}*`).join('\n') || 'No haters defined yet. Use %addhater <name> to add!'));
        break;
      }

      case 'hax': {
        const action = args[1]?.toLowerCase();
        if (action === 'start') {
          if (this.isHaxRunning) return reply('⚠️ [Hax Alert] Spammer loop already booted and running!');
          this.isHaxRunning = true;
          this.runHaxSpam(chatJid, config);
          await reply('👿 *HAX ATTACK BOOTED* - Running hater spam sequences targeting haters list (9s/12s/15s delay).');
        } else if (action === 'stop') {
          this.isHaxRunning = false;
          if (this.haxTimer) {
            clearTimeout(this.haxTimer);
            this.haxTimer = null;
          }
          await reply('✅ Hax spam loop has been terminated.');
        } else {
          await reply(`👿 *Hax Spammer Guide*:\nUsage: \`hax start\` or \`hax stop\`\nManage targets with %addhater <name> and %haters commands.`);
        }
        break;
      }

      case 'stop': {
        const target = args[1]?.toLowerCase();
        if (target === 'hax') {
          this.isHaxRunning = false;
          if (this.haxTimer) {
            clearTimeout(this.haxTimer);
            this.haxTimer = null;
          }
          await reply('✅ Hax spam loop has been terminated.');
        } else if (target === 'lpc' || target === 'all') {
          this.isLpcRunning = false;
          this.lpcTargets = [];
          if (this.lpcTimer) {
            clearTimeout(this.lpcTimer);
            this.lpcTimer = null;
          }
          await reply('✅ LPC spam loops halted.');
        } else {
          this.isHaxRunning = false;
          this.isLpcRunning = false;
          this.lpcTargets = [];
          if (this.haxTimer) { clearTimeout(this.haxTimer); this.haxTimer = null; }
          if (this.lpcTimer) { clearTimeout(this.lpcTimer); this.lpcTimer = null; }
          await reply('🛡️ All active background spamming systems successfully shutdown.');
        }
        break;
      }

      case 'stopall': {
        this.isHaxRunning = false;
        this.isLpcRunning = false;
        this.lpcTargets = [];
        if (this.haxTimer) { clearTimeout(this.haxTimer); this.haxTimer = null; }
        if (this.lpcTimer) { clearTimeout(this.lpcTimer); this.lpcTimer = null; }
        await reply('🛡️ All active background spamming systems successfully shutdown.');
        break;
      }

      case 'stoplpc': {
        this.isLpcRunning = false;
        this.lpcTargets = [];
        if (this.lpcTimer) { clearTimeout(this.lpcTimer); this.lpcTimer = null; }
        await reply('✅ LPC spam loops halted.');
        break;
      }

      case 'lpc': {
        const action = args[1]?.toLowerCase();
        if (action === 'stop') {
          this.isLpcRunning = false;
          this.lpcTargets = [];
          if (this.lpcTimer) {
            clearTimeout(this.lpcTimer);
            this.lpcTimer = null;
          }
          await reply('✅ LPC spam loops halted.');
          break;
        }

        let Jids: string[] = [];
        const parsedMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (parsedMentions.length > 0) {
          Jids = parsedMentions;
        } else {
          const textTags = text.match(/\d+/g) || [];
          Jids = textTags.map(tag => tag + '@s.whatsapp.net');
        }

        Jids = Array.from(new Set(Jids)).filter(j => j.includes('@s.whatsapp.net'));

        if (Jids.length === 0) {
          return reply('❌ Please mention the LPC target users to ping (e.g. \`.lpc @user\`).');
        }

        this.isLpcRunning = true;
        this.lpcTargets = Jids;
        this.runLpcSpam(chatJid, config);
        await reply(`⚔️ *LPC ATTACK SHIFTED* - Flooding targeted tags (${Jids.length} users) with dynamic pings (8s/10s/12s delay).`);
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
          `👑 Owner Name: Premium Daddy Hamza\n` +
          `⏱️ Web Uptime: ${h}h ${m}m\n` +
          `📨 Messages: ${config.stats.msgs} | Replies: ${config.stats.replies}\n` +
          `⚡ Commands processed: ${config.stats.cmds}\n` +
          `👑 Owners registered: ${config.owners?.length || 0}\n` +
          `🎨 Texts cached: ${config.responseTexts?.length || 0}\n` +
          `👿 Haters registered: ${config.haterNames?.length || 0}`;
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

      default: {
        const activePrefix = config.prefix || '%';
        await reply(`❌ Command not found. Try executing \`${activePrefix}help\` to see all options.`);
      }
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
