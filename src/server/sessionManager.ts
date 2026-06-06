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
  getLogs as dbGetLogs,
  getAllActiveSessions
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
const MENT_FILE_PATH = path.join(DATA_DIR, 'ment.txt');
const HTR_FILE_PATH = path.join(DATA_DIR, 'htr.txt');

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
  if (!fs.existsSync(MENT_FILE_PATH)) {
    fs.writeFileSync(MENT_FILE_PATH, [
      "🛡️ Alert! Please review WhatsApp bot configurations.",
      "⚠️ Urgent notice: Server execution state is active.",
      "🤖 Status Ping: Bot triggers are monitoring activity."
    ].join('\n') + '\n', 'utf-8');
  }
  if (!fs.existsSync(HTR_FILE_PATH)) {
    fs.writeFileSync(HTR_FILE_PATH, [
      "is that your best shot? try harder!",
      "you have absolutely zero speed. get lost!",
      "shut up and listen to your developer daddy!",
      "not even worth wasting my words on you."
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

  // Temp Spammer active state timers mapped by Chat Jid
  private tempIntervals = new Map<string, NodeJS.Timeout>();

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

    // HTR (Hater Target Responder) check
    if (config.htrTargets && config.htrTargets.includes(senderPhone)) {
      const isSticker = getContentType(msg.message) === 'stickerMessage' || !!msg.message?.stickerMessage;
      let replyText = '';

      if (isSticker) {
        const responses = ["sticker piyara hai", "sticker ab mera hua", "sticker bohot cute hai", "sticker steal kr rha hu"];
        replyText = responses[Math.floor(Math.random() * responses.length)];
      } else if (text === '..') {
        const responses = ["huh", "what", "what do u want", "bolna kya chahte ho?", "kya kaam hai?"];
        replyText = responses[Math.floor(Math.random() * responses.length)];
      } else if (text && /^\d+$/.test(text.replace(/[\s-().]/g, ''))) {
        const responses = ["number ka kya krna", "numbers ka kya kam", "ginti q suna rhe ho?", "mje maths ni ati"];
        replyText = responses[Math.floor(Math.random() * responses.length)];
      } else {
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount >= 2) {
          const htrLines = readLinesFromFile(HTR_FILE_PATH);
          const rawText = htrLines.length > 0 
            ? htrLines[Math.floor(Math.random() * htrLines.length)] 
            : 'yooo bro';
          
          const emojis = ['😂', '🔥', '👀', '🤫', '💀', '🤡', '🤖', '🤪', '🤬', '👏', '👻', '👑', '👿', '🛡️'];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
          const hname = config.hname || '';
          const namePart = hname ? hname + ' ' : '';
          replyText = `${namePart}${rawText} ${randomEmoji}`;
        }
      }

      if (replyText) {
        try {
          const delaysSec = [1, 2, 3];
          const chosenDelay = config.delays?.htr || delaysSec[Math.floor(Math.random() * delaysSec.length)];
          
          await this.sock.sendPresenceUpdate('composing', from).catch(() => {});
          await delay(chosenDelay * 1000);
          
          await this.sock.sendMessage(from, { 
            text: replyText,
            mentions: [senderNorm]
          }, { quoted: msg });

          const sessionRef = doc(db, 'sessions', this.sessionId);
          await updateDoc(sessionRef, { 'stats.replies': config.stats.replies + 1 }).catch(() => {});
          await this.addLog('success', `[HTR] Replied to target user +${senderPhone} (delay ${chosenDelay}s): "${replyText}"`);
        } catch (err: any) {
          await this.addLog('error', `HTR reply failed: ${err.message}`);
        } finally {
          await this.sock.sendPresenceUpdate('paused', from).catch(() => {});
        }
        return;
      }
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

    const defaultDelays = [9000, 12000, 15000];
    const delayMs = config.delays?.hax 
      ? (config.delays.hax * 1000) 
      : defaultDelays[Math.floor(Math.random() * defaultDelays.length)];
    
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

    const defaultLpcDelays = [8000, 10000, 12000];
    const delayMs = config.delays?.lpc 
      ? (config.delays.lpc * 1000) 
      : defaultLpcDelays[Math.floor(Math.random() * defaultLpcDelays.length)];

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

      case 'addbot': {
        const isMain = config.owners?.includes(senderPhone) || senderPhone === config.phoneNumber;
        const isHamza = senderPhone === '923012345678' || senderPhone === '923078440536' || senderPhone === '923000867825'; // Fallback admin numbers
        
        if (!isMain && !isHamza) {
          return reply('❌ Unauthorized: Only the main administrator can provision new WhatsApp bot nodes.');
        }

        const rawPhone = args[1]?.trim();
        const phone = rawPhone?.replace(/\D/g, '');
        if (!phone || phone.length < 10 || phone.length > 15) {
          return reply(`❌ Usage: ${prefix}addbot 92XXXXXXXXXX (Include country code, no + or spaces)`);
        }

        const activeSessions = SessionManager.getActiveSessionIds();
        const nextIndex = activeSessions.length + 1;
        const newId = `Bot_${nextIndex}_${Math.random().toString(36).substring(2, 6)}`;

        await reply(`⏳ [ Initializing ${newId.replace('_', ' ')}... ]`);

        const newSessionPayload: BotSession = {
          id: newId,
          ownerId: config.ownerId || 'admin_root',
          name: `WhatsApp Node ${nextIndex}`,
          phoneNumber: phone,
          status: 'Connecting',
          botEnabled: true,
          botMode: 'all',
          processFromMe: false,
          delays: {
            ment: 10,
            leak: 30,
            hax: 12,
            lpc: 10,
            htr: 2,
            temp: 5
          },
          stats: {
            msgs: 0,
            replies: 0,
            cmds: 0,
            start: Date.now()
          },
          allowedGroups: [],
          responseTexts: [
            "🛡️ Monitored Activity Detected. Daddy Hamza is keeping an eye on your status.",
            "⚡ NexusWA Engine v1 running at peak latency response speed.",
            "⚙️ Systems diagnostics checked. Connection secure."
          ],
          owners: config.owners || [senderPhone],
          monitors: [],
          blocked: [],
          muted: [],
          mentUsers: [],
          leakImages: [],
          prefix: '%',
          haterNames: [],
          hname: 'Eren',
          hrtext: 'yooo bro',
          htrEnabled: false,
          htrTargets: [],
          tempTexts: [],
          createdAt: Date.now()
        };

        // Save session setup persistently inside database (PostgreSQL/Supabase or JSON fallback)
        await saveSession(newSessionPayload);

        // Spawn instance and trigger auto-connection in pairing mode
        const newSession = SessionManager.getOrCreateInstance(newId);
        newSession.connect(phone);

        // Fetch pairing code and reply gracefully after a brief delay
        setTimeout(async () => {
          try {
            let pairingCode = newSession.pairingCode;
            if (!pairingCode) {
              pairingCode = await newSession.sock.requestPairingCode(phone);
              newSession.pairingCode = pairingCode;
            }
            
            await reply(`╔════════════════════════╗\n` +
                        `    🛰️  𝐍𝐎𝐃𝐄  𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄🇩\n` +
                        `╚════════════════════════╝\n` +
                        `┃ 🆔 𝐍𝐚𝐦𝐞: ${newId.replace('_', ' ')}\n` +
                        `┃ 📱 𝐍𝐮𝐦: ${phone}\n` +
                        `┃ 🔑 𝐂𝐨𝐝𝐞: *${pairingCode}*\n` +
                        `╚════════════════════════╝`);
            
            // Re-save session status state as Connecting
            await updateSessionFields(newId, { status: 'Connecting' }).catch(() => {});
          } catch (e: any) {
            await reply(`❌ Failure generating pairing: ${e.message}. Launch bot via panel.`);
          }
        }, 5000);
        break;
      }

      case 'help': {
        const activePrefix = config.prefix || '%';
        const watermark = getRandomWatermark();
        const helpText = `╔══════════════════════════╗\n` +
          `   👑  *𝙉𝙀开𝙐𝙎𝙒𝘼 𝙇𝙊𝘼𝘿𝙀𝙍 𝘽𝙊𝙏*  👑   \n` +
          `      *𝖣𝖤𝖖𝖤𝖫𝖮𝖯𝖤𝖣 𝖡𝖸 𝖣𝖠𝖣𝖣𝖸 𝖧𝖠𝖬𝖹𝖠*       \n` +
          `╚══════════════════════════╝\n\n` +
          `🛡️ *ᴀᴄᴛɪᴠᴇ ᴘʀᴇғɪx:*  \`${activePrefix}\`\n\n` +
          `👥 *⚙️ 𝘾𝙊𝙉𝙏𝙍𝙊𝙇 & 𝙎𝙀𝙏𝙏𝙄𝙉𝙂𝙎:*\n` +
          `◽ \`${activePrefix}help\` - Displays this guide\n` +
          `◽ \`${activePrefix}ping\` - Check live handshake latency\n` +
          `◽ \`${activePrefix}pre <char>\` - Change prefix (e.g. \`${activePrefix}pre !\`)\n` +
          `◽ \`${activePrefix}stats\` - View session logs & metrics\n` +
          `◽ \`${activePrefix}set del <type> <seconds>\` - Set latency delay for [ment|hax|lpc|leak|htr|temp]\n\n` +
          `👑 *👤 𝙊𝙦𝙉𝙀𝙍𝙎𝙃𝙄𝙋:*\n` +
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
          `👿 *🔥 𝙃𝘼𝙏𝙀𝙍 𝙎𝙋𝘼𝙈𝙈𝙀规𝙍 (𝙗𝙖𝙘𝙠𝙜𝙧𝙤𝙪𝙣𝙙):*\n` +
          `◽ \`hax start\` / \`${activePrefix}hax start\` - Boot fast hater loops (9s/12s/15s)\n` +
          `◽ \`stop hax\` / \`${activePrefix}hax stop\` - Shutdown hater loops\n` +
          `◽ \`${activePrefix}addhatxt <text>\` - Append line inside hater.txt\n` +
          `◽ \`${activePrefix}rmhatxt <text>\` - Remove line from hater.txt\n` +
          `◽ \`${activePrefix}addtext <text>\` - (Legacy) Append hater line\n` +
          `◽ \`${activePrefix}addhater <name>\` - Register user name in haters DB\n` +
          `◽ \`${activePrefix}rmhater <name>\` - Wipe hater name from DB\n` +
          `◽ \`${activePrefix}haters\` - Show haters database\n\n` +
          `👿 *🔑 𝙃𝙏𝙍 (𝙃𝘼𝙏𝙀𝙍 𝙏𝘼𝙍𝙂𝙀𝙏 𝙍𝙀𝙎𝙋𝙊𝙉𝘿𝙀𝙍):*\n` +
          `◽ \`${activePrefix}add htr <phone_or_reply>\` - Auto-tag & reply to this hater number\n` +
          `◽ \`${activePrefix}rm htr <phone_or_reply>\` - Remove number from HTR auto-reply list\n` +
          `◽ \`${activePrefix}add hname <name>\` - Set hater target response prefix title\n` +
          `◽ \`${activePrefix}add hrtext <text>\` - Append custom response text inside htr.txt\n\n` +
          `⚔️ *💥 𝙇𝙋𝘾 𝙎𝙋𝘼𝙈𝙈𝙀𝙍 (𝙗𝙖𝙘𝙠𝙜𝙧𝙤𝙪𝙣𝙙):*\n` +
          `◽ \`.lpc @user\` - Initialize pings with tags from lpc.txt\n` +
          `◽ \`stop lpc\` / \`stopall\` - Stop LPC spamming instantly\n` +
          `◽ \`${activePrefix}add lptxt <text>\` - Append line inside lpc.txt\n` +
          `◽ \`${activePrefix}rm lptxt <text>\` - Remove line from lpc.txt\n\n` +
          `🎯 *🔥 𝙏𝙀𝙈𝙋 𝙎𝙋𝘼𝙈𝙈𝙀𝙍 (𝙗𝙖𝙘𝙠𝙜𝙧𝙤𝙪𝙣𝙙):*\n` +
          `◽ \`${activePrefix}temp add <text>\` - Register new spam template\n` +
          `◽ \`${activePrefix}temp start\` - Blast registered templates on delay (5s)\n` +
          `◽ \`${activePrefix}temp stop\` - Stop active temp loop in this chat\n` +
          `◽ \`${activePrefix}temp clear\` - Clear active templates database\n\n` +
          `🖼️ *🎞️ 𝙇𝙀𝘼𝙆 & 𝙂𝙍𝙊𝙐𝙋𝙎:*\n` +
          `◽ \`${activePrefix}leak [start|stop]\` - Looping images + texts\n` +
          `◽ \`${activePrefix}ment [start|stop]\` - Regular loop group tags\n` +
          `◽ \`${activePrefix}join <group-link>\` - Join group via URL\n` +
          `◽ \`${activePrefix}left\` - Exit current group immediately\n` +
          `◽ \`${activePrefix}nuke\` - Groups wipeout\n\n` +
          `💻 _Cloud Synchronization Panel:_ https://ai.studio/build\n\n` +
          `${watermark}`;
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
                caption: `${pick.text}\n\n${getRandomWatermark()}`
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
              
              const mentLines = readLinesFromFile(MENT_FILE_PATH);
              const randomText = mentLines.length > 0 
                ? mentLines[Math.floor(Math.random() * mentLines.length)] 
                : this.getRandomText(config);
              
              await this.sock.sendMessage(chatJid, {
                text: `${randomText}\n\n${getRandomWatermark()}`,
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

      case 'set': {
        const sub = args[1]?.toLowerCase();
        if (sub === 'del') {
          const type = args[2]?.toLowerCase();
          const secsStr = args[3];
          const secs = parseInt(secsStr, 10);
          
          const allowedTypes = ['ment', 'hax', 'lpc', 'leak', 'htr', 'temp'];
          if (!type || !allowedTypes.includes(type) || isNaN(secs) || secs <= 0) {
            return reply(`❌ Usage: ${prefix}set del [ment|hax|lpc|leak|htr|temp] [seconds]\nExample: ${prefix}set del htr 2`);
          }
          
          const updatedDelays = {
            ...(config.delays || {}),
            [type]: secs
          };
          await updateDoc(sessionRef, { delays: updatedDelays });
          await reply(`✅ Delay for *${type}* is now set to *${secs}s*!`);
        } else {
          await reply(`❌ Unknown set sub-command. Usage: ${prefix}set del [type] [seconds]`);
        }
        break;
      }

      case 'add': {
        const sub = args[1]?.toLowerCase();
        const content = args.slice(2).join(' ').trim();
        
        if (sub === 'lptxt') {
          if (!content) return reply(`❌ Usage: ${prefix}add lptxt [text]`);
          const resolved = content.replace(/\\n/g, '\n');
          try {
            fs.appendFileSync(LPC_FILE_PATH, resolved + '\n', 'utf-8');
            await reply('✅ Text successfully appended inside lpc.txt file!');
          } catch (e: any) {
            await reply(`❌ Failed to append: ${e.message}`);
          }
        } else if (sub === 'hatxt') {
          if (!content) return reply(`❌ Usage: ${prefix}add hatxt [text]`);
          const resolved = content.replace(/\\n/g, '\n');
          try {
            fs.appendFileSync(HATER_FILE_PATH, resolved + '\n', 'utf-8');
            await reply('✅ Text successfully appended inside hater.txt file!');
          } catch (e: any) {
            await reply(`❌ Failed to append: ${e.message}`);
          }
        } else if (sub === 'htr') {
          const rawPhone = content.replace(/\D/g, '');
          let phone = rawPhone;
          if (!phone) {
            const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
            const parsedMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (quotedSender) {
              phone = quotedSender.split('@')[0];
            } else if (parsedMentions.length > 0) {
              phone = parsedMentions[0].split('@')[0];
            }
          }
          if (!phone) return reply(`❌ Specify phone target number or reply to user message to add as HTR target.`);
          const updated = Array.from(new Set([...(config.htrTargets || []), phone]));
          await updateDoc(sessionRef, { htrTargets: updated });
          await reply(`✅ Added +${phone} to the HTR (Hater Target Responder) list.`);
        } else if (sub === 'hname') {
          if (!content) return reply(`❌ Usage: ${prefix}add hname [name]`);
          await updateDoc(sessionRef, { hname: content });
          await reply(`✅ HTR Hname set to *${content}*.`);
        } else if (sub === 'hrtext') {
          if (!content) return reply(`❌ Usage: ${prefix}add hrtext [text]`);
          await updateDoc(sessionRef, { hrtext: content });
          try {
            fs.appendFileSync(HTR_FILE_PATH, content + '\n', 'utf-8');
          } catch {}
          await reply(`✅ HTR response text set and synced to htr.txt.`);
        } else {
          await reply(`❌ Unknown add command. Options: lptxt, hatxt, htr, hname, hrtext`);
        }
        break;
      }
      
      case 'rm': {
        const sub = args[1]?.toLowerCase();
        const content = args.slice(2).join(' ').trim();
        
        if (sub === 'lptxt') {
          if (!content) return reply(`❌ Specify EXACT text line to remove from lpc.txt.`);
          try {
            const lines = readLinesFromFile(LPC_FILE_PATH);
            const filtered = lines.filter(l => l !== content);
            fs.writeFileSync(LPC_FILE_PATH, filtered.join('\n') + '\n', 'utf-8');
            await reply('✅ Cleaned line from lpc.txt!');
          } catch (e: any) {
            await reply(`❌ Failed: ${e.message}`);
          }
        } else if (sub === 'hatxt') {
          if (!content) return reply(`❌ Specify EXACT text line to remove from hater.txt.`);
          try {
            const lines = readLinesFromFile(HATER_FILE_PATH);
            const filtered = lines.filter(l => l !== content);
            fs.writeFileSync(HATER_FILE_PATH, filtered.join('\n') + '\n', 'utf-8');
            await reply('✅ Cleaned line from hater.txt!');
          } catch (e: any) {
            await reply(`❌ Failed: ${e.message}`);
          }
        } else if (sub === 'htr') {
          let phone = content.replace(/\D/g, '');
          if (!phone) {
            const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
            const parsedMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (quotedSender) {
              phone = quotedSender.split('@')[0];
            } else if (parsedMentions.length > 0) {
              phone = parsedMentions[0].split('@')[0];
            }
          }
          if (!phone) return reply(`❌ Specify phone target number or reply to user message to remove from HTR list.`);
          const updated = (config.htrTargets || []).filter(h => h !== phone);
          await updateDoc(sessionRef, { htrTargets: updated });
          await reply(`✅ Removed +${phone} from HTR targets.`);
        } else if (sub === 'temp') {
          await updateDoc(sessionRef, { tempTexts: [] });
          await reply('✅ Temporary templates list cleared.');
        } else {
          await reply(`❌ Unknown remove command. Options: lptxt, hatxt, htr, temp`);
        }
        break;
      }

      case 'temp': {
        const action = args[1]?.toLowerCase();
        const content = args.slice(2).join(' ').trim();
        
        if (action === 'add') {
          if (!content) return reply(`❌ Usage: ${prefix}temp add [text]`);
          const templates = config.tempTexts || [];
          templates.push(content);
          await updateDoc(sessionRef, { tempTexts: templates });
          await reply(`✅ Added template. Total active templates: ${templates.length}`);
        } else if (action === 'start') {
          const templates = config.tempTexts || [];
          if (templates.length === 0) {
            return reply(`❌ Temporary templates list is empty! Please add a template using \`${prefix}temp add <text>\`.`);
          }
          if (this.tempIntervals.has(chatJid)) {
            return reply('⚠️ Temporary Spammer is already active in this chat.');
          }
          
          const delaySec = config.delays?.temp || 5;
          const interval = setInterval(async () => {
            if (!this.isConnected) {
              const timer = this.tempIntervals.get(chatJid);
              if (timer) clearInterval(timer);
              this.tempIntervals.delete(chatJid);
              return;
            }
            try {
              const activeTemplates = config.tempTexts || [];
              if (activeTemplates.length === 0) return;
              const pickText = activeTemplates[Math.floor(Math.random() * activeTemplates.length)];
              const textToSend = `${pickText}\n\n${getRandomWatermark()}`;
              await this.sock.sendMessage(chatJid, { text: textToSend });
            } catch (err: any) {
              await this.addLog('error', `Temp Spammer error: ${err.message}`);
            }
          }, delaySec * 1000);
          
          this.tempIntervals.set(chatJid, interval);
          await reply(`✅ *TEMP SPAM INITIALIZED* - Blasting templates list on every ${delaySec}s in this chat.`);
        } else if (action === 'stop') {
          const interval = this.tempIntervals.get(chatJid);
          if (interval) {
            clearInterval(interval);
            this.tempIntervals.delete(chatJid);
            await reply('✅ Stopped temp spammer loop in this chat.');
          } else {
            await reply('❌ Temporary Spammer is not active in this chat.');
          }
        } else if (action === 'rm' || action === 'clear') {
          await updateDoc(sessionRef, { tempTexts: [] });
          await reply('✅ Temporary templates list cleared.');
        } else {
          await reply(`🎯 *Temp Spammer Guide*:\nUsage: ${prefix}temp [add|start|stop|clear]\nExample: ${prefix}temp add Eren is back!`);
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
    if (this.haxTimer) {
      clearTimeout(this.haxTimer);
      this.haxTimer = null;
    }
    if (this.lpcTimer) {
      clearTimeout(this.lpcTimer);
      this.lpcTimer = null;
    }
    for (const interval of this.tempIntervals.values()) {
      clearInterval(interval);
    }
    this.tempIntervals.clear();
    
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
  private globalBinder: ((sessionId: string, inst: WhatsAppBotInstance) => void) | null = null;

  constructor() {
    // Background Supervisor Loop: checks every 45 seconds to keep all active bots "always connected"
    setInterval(async () => {
      try {
        const active = await getAllActiveSessions();
        for (const data of active) {
          const inst = this.getOrCreateInstance(data.id);
          // If marked active/connected but not connected in-memory, auto-wake it up
          if (!inst.isConnected && data.status !== 'Disconnected') {
            console.log(`[Supervisor] Bot node ${data.id} (+${data.phoneNumber}) is offline but marked ${data.status}. Spawining auto-reconnect...`);
            inst.connect().catch((err) => {
              console.error(`[Supervisor] Auto-reconnect failed for ${data.id}:`, err);
            });
          }
        }
      } catch (err) {
        console.error('[Supervisor] Keep-alive daemon error:', err);
      }
    }, 45000);
  }

  public registerGlobalBinder(binder: (sessionId: string, inst: WhatsAppBotInstance) => void) {
    this.globalBinder = binder;
  }

  public getOrCreateInstance(sessionId: string): WhatsAppBotInstance {
    let inst = this.activeInstances.get(sessionId);
    if (!inst) {
      inst = new WhatsAppBotInstance(sessionId);
      this.activeInstances.set(sessionId, inst);
      if (this.globalBinder) {
        try {
          this.globalBinder(sessionId, inst);
        } catch (err) {
          console.error(`[SessionManager] Fail to bind events for ${sessionId} during creation:`, err);
        }
      }
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
