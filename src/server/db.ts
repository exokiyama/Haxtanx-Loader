import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { BotSession, LogEntry } from '../types.js';

const { Pool } = pg;

export const ADMIN_USERNAME = 'haxtanx';
export const ADMIN_PASSWORD = 'papa%hamza';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const LOCAL_DB_PATH = path.join(DATA_DIR, 'supabase_db.json');

interface LocalDbSchema {
  users: Array<{ id: string; username: string; email: string; password_hash: string; created_at: number }>;
  bot_sessions: Record<string, BotSession>;
  baileys_creds: Record<string, any>;
  baileys_keys: Record<string, Record<string, any>>;
  bot_logs: Record<string, LogEntry[]>;
}

let localDb: LocalDbSchema = {
  users: [],
  bot_sessions: {},
  baileys_creds: {},
  baileys_keys: {},
  bot_logs: {}
};

const pgConnString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
let pgPool: pg.Pool | null = null;

if (pgConnString) {
  console.log('[DB] Found Postgres Connection string. Initializing Postgres Client Pool...');
  pgPool = new Pool({
    connectionString: pgConnString,
    ssl: { rejectUnauthorized: false },
    // FIX: Increased timeouts and limited pool size for Railway
    connectionTimeoutMillis: 30000,   // was 10000 — Railway needs more headroom
    idleTimeoutMillis: 60000,         // release idle connections after 60s
    max: 5,                           // Railway free tier caps connections; keep this low
    allowExitOnIdle: false,
  });
  pgPool.on('error', (err) => {
    console.error('[DB] Unexpected error on Postgres client pool:', err);
  });
} else {
  console.log('[DB] No Postgres Connection string found. Using local JSON database cache fallback.');
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      localDb = { ...localDb, ...JSON.parse(content) };
      console.log(`[DB] Loaded local database: ${localDb.users.length} users, ${Object.keys(localDb.bot_sessions).length} sessions.`);
    } catch (err) {
      console.error('[DB] Failed to read local database. Starting fresh:', err);
    }
  }
}

function saveLocalDb() {
  if (pgPool) return;
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to persist local JSON database:', err);
  }
}

// FIX: Generic retry wrapper for transient pg failures (connection timeouts, pool exhaustion)
async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isRetryable =
        err.message?.includes('timeout') ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('connect') ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT';
      if (!isRetryable || attempt === maxAttempts) break;
      const backoff = attempt * 1500; // 1.5s, 3s
      console.warn(`[DB] ${label} attempt ${attempt} failed (${err.message}). Retrying in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

export async function initDb() {
  if (pgPool) {
    try {
      const client = await pgPool.connect();
      console.log('[DB] Connecting to Postgres successfully. Verifying database tables schema...');
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR PRIMARY KEY,
            username VARCHAR UNIQUE NOT NULL,
            email VARCHAR UNIQUE NOT NULL,
            password_hash VARCHAR NOT NULL,
            created_at BIGINT NOT NULL
          );
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS bot_sessions (
            id VARCHAR PRIMARY KEY,
            owner_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            status VARCHAR NOT NULL,
            payload TEXT NOT NULL,
            created_at BIGINT NOT NULL
          );
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS baileys_creds (
            session_id VARCHAR PRIMARY KEY,
            data TEXT NOT NULL
          );
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS baileys_keys (
            session_id VARCHAR NOT NULL,
            key_id VARCHAR NOT NULL,
            val TEXT NOT NULL,
            PRIMARY KEY (session_id, key_id)
          );
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS bot_logs (
            id VARCHAR PRIMARY KEY,
            session_id VARCHAR NOT NULL,
            level VARCHAR NOT NULL,
            message TEXT NOT NULL,
            timestamp BIGINT NOT NULL
          );
        `);
        console.log('[DB] Postgres database tables validated and synchronized with excellence!');
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[DB] Failed to connect or initialize Postgres tables. Falling back to local file!', err);
      pgPool = null;
    }
  }

  try {
    const adminExists = await getUser(ADMIN_USERNAME);
    if (!adminExists) {
      console.log(`[DB] Admin account '${ADMIN_USERNAME}' not present. Provisioning...`);
      await registerUser(ADMIN_USERNAME, 'haxtanx@nexuswa.com', ADMIN_PASSWORD);
    }
  } catch (err) {
    console.error('[DB] Admin auto-provisioning exception:', err);
  }
}

// ============================================
// Auth & User Database Handlers
// ============================================

export async function getUser(usernameOrEmail: string) {
  const normalized = usernameOrEmail.toLowerCase().trim();
  if (pgPool) {
    try {
      const res = await withRetry(
        () => pgPool!.query(
          'SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $2 LIMIT 1',
          [normalized, normalized]
        ),
        'getUser'
      );
      if (res.rows.length > 0) {
        const u = res.rows[0];
        return { id: u.id, username: u.username, email: u.email, password_hash: u.password_hash, created_at: Number(u.created_at) };
      }
      return null;
    } catch (err) {
      console.error('[DB] getUser failed:', err);
      return null;
    }
  } else {
    return localDb.users.find(u => u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized) || null;
  }
}

export async function registerUser(username: string, email: string, password_hash: string) {
  const cleanedUsername = username.trim();
  const cleanedEmail = email.toLowerCase().trim();
  const newUserId = 'user_' + Math.random().toString(36).substring(2, 10);
  const now = Date.now();

  if (pgPool) {
    try {
      await withRetry(
        () => pgPool!.query(
          'INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
          [newUserId, cleanedUsername, cleanedEmail, password_hash, now]
        ),
        'registerUser'
      );
      return { id: newUserId, username: cleanedUsername, email: cleanedEmail };
    } catch (err: any) {
      console.error('[DB] registerUser failed:', err);
      throw new Error(err.message || 'Registration failed');
    }
  } else {
    const duplicate = localDb.users.find(
      u => u.username.toLowerCase() === cleanedUsername.toLowerCase() || u.email.toLowerCase() === cleanedEmail
    );
    if (duplicate) throw new Error('Username or Email already registered');
    const newUser = { id: newUserId, username: cleanedUsername, email: cleanedEmail, password_hash, created_at: now };
    localDb.users.push(newUser);
    saveLocalDb();
    return { id: newUserId, username: cleanedUsername, email: cleanedEmail };
  }
}

// ============================================
// Bot Sessions Database Handlers
// ============================================

export async function getSessions(ownerId: string): Promise<BotSession[]> {
  if (pgPool) {
    try {
      const res = await withRetry(
        () => pgPool!.query('SELECT payload FROM bot_sessions WHERE owner_id = $1', [ownerId]),
        'getSessions'
      );
      return res.rows.map(row => JSON.parse(row.payload) as BotSession);
    } catch (err) {
      console.error('[DB] getSessions failed:', err);
      return [];
    }
  } else {
    return Object.values(localDb.bot_sessions).filter(s => s.ownerId === ownerId);
  }
}

export async function getAllActiveSessions(): Promise<BotSession[]> {
  if (pgPool) {
    try {
      const res = await withRetry(
        () => pgPool!.query("SELECT payload FROM bot_sessions WHERE status IN ('Connected', 'Connecting')"),
        'getAllActiveSessions'
      );
      return res.rows.map(row => JSON.parse(row.payload) as BotSession);
    } catch (err) {
      console.error('[DB] getAllActiveSessions failed:', err);
      return [];
    }
  } else {
    return Object.values(localDb.bot_sessions).filter(s => s.status === 'Connected' || s.status === 'Connecting');
  }
}

export async function getSession(sessionId: string): Promise<BotSession | null> {
  if (pgPool) {
    try {
      const res = await withRetry(
        () => pgPool!.query('SELECT payload FROM bot_sessions WHERE id = $1 LIMIT 1', [sessionId]),
        'getSession'
      );
      if (res.rows.length > 0) return JSON.parse(res.rows[0].payload) as BotSession;
      return null;
    } catch (err) {
      console.error('[DB] getSession failed:', err);
      return null;
    }
  } else {
    return localDb.bot_sessions[sessionId] || null;
  }
}

export async function saveSession(session: BotSession): Promise<void> {
  if (pgPool) {
    try {
      const payloadStr = JSON.stringify(session);
      await withRetry(
        () => pgPool!.query(
          `INSERT INTO bot_sessions (id, owner_id, name, status, payload, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET owner_id = $2, name = $3, status = $4, payload = $5`,
          [session.id, session.ownerId, session.name, session.status, payloadStr, session.createdAt || Date.now()]
        ),
        'saveSession'
      );
    } catch (err) {
      console.error('[DB] saveSession failed:', err);
    }
  } else {
    localDb.bot_sessions[session.id] = { ...session };
    saveLocalDb();
  }
}

export async function updateSessionFields(sessionId: string, fields: Partial<BotSession>): Promise<void> {
  const current = await getSession(sessionId);
  if (!current) return;
  const merged = { ...current, ...fields };
  await saveSession(merged);
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (pgPool) {
    try {
      await withRetry(() => pgPool!.query('DELETE FROM bot_sessions WHERE id = $1', [sessionId]), 'deleteSession');
    } catch (err) {
      console.error('[DB] deleteSession failed:', err);
    }
  } else {
    delete localDb.bot_sessions[sessionId];
    saveLocalDb();
  }
}

// ============================================
// Baileys Authentication Credentials Handlers
// ============================================

export async function getBaileysCreds(sessionId: string): Promise<any | null> {
  if (pgPool) {
    try {
      const res = await withRetry(
        () => pgPool!.query('SELECT data FROM baileys_creds WHERE session_id = $1 LIMIT 1', [sessionId]),
        'getBaileysCreds'
      );
      if (res.rows.length > 0) return JSON.parse(res.rows[0].data);
      return null;
    } catch (err) {
      console.error('[DB] getBaileysCreds failed:', err);
      return null;
    }
  } else {
    return localDb.baileys_creds[sessionId] || null;
  }
}

export async function saveBaileysCreds(sessionId: string, data: any): Promise<void> {
  if (pgPool) {
    try {
      // FIX: retry on transient connection failures during creds save
      await withRetry(
        () => pgPool!.query(
          `INSERT INTO baileys_creds (session_id, data) VALUES ($1, $2)
           ON CONFLICT (session_id) DO UPDATE SET data = $2`,
          [sessionId, JSON.stringify(data)]
        ),
        'saveBaileysCreds'
      );
    } catch (err) {
      // FIX: log but do NOT throw — a failed creds save must not crash the session
      console.error('[DB] saveBaileysCreds failed (non-fatal):', err);
    }
  } else {
    localDb.baileys_creds[sessionId] = data;
    saveLocalDb();
  }
}

export async function deleteBaileysCreds(sessionId: string): Promise<void> {
  if (pgPool) {
    try {
      await withRetry(() => pgPool!.query('DELETE FROM baileys_creds WHERE session_id = $1', [sessionId]), 'deleteBaileysCreds');
    } catch (err) {
      console.error('[DB] deleteBaileysCreds failed:', err);
    }
  } else {
    delete localDb.baileys_creds[sessionId];
    saveLocalDb();
  }
}

// ============================================
// Baileys Keys Authentication Handlers
// ============================================

export async function getBaileysKey(sessionId: string, keyId: string): Promise<any | null> {
  if (pgPool) {
    try {
      const res = await withRetry(
        () => pgPool!.query(
          'SELECT val FROM baileys_keys WHERE session_id = $1 AND key_id = $2 LIMIT 1',
          [sessionId, keyId]
        ),
        'getBaileysKey'
      );
      if (res.rows.length > 0) return JSON.parse(res.rows[0].val);
      return null;
    } catch (err) {
      console.error('[DB] getBaileysKey failed:', err);
      return null;
    }
  } else {
    const sessKeys = localDb.baileys_keys[sessionId];
    return sessKeys ? (sessKeys[keyId] || null) : null;
  }
}

export async function saveBaileysKey(sessionId: string, keyId: string, val: any): Promise<void> {
  if (pgPool) {
    try {
      // FIX: retry on transient failures; do NOT throw on final failure
      await withRetry(
        () => pgPool!.query(
          `INSERT INTO baileys_keys (session_id, key_id, val) VALUES ($1, $2, $3)
           ON CONFLICT (session_id, key_id) DO UPDATE SET val = $3`,
          [sessionId, keyId, JSON.stringify(val)]
        ),
        'saveBaileysKey'
      );
    } catch (err) {
      // FIX: log but do NOT throw — individual key save failure must not crash the session
      console.error(`[DB] saveBaileysKey failed for ${sessionId}/${keyId} (non-fatal):`, err);
    }
  } else {
    if (!localDb.baileys_keys[sessionId]) localDb.baileys_keys[sessionId] = {};
    localDb.baileys_keys[sessionId][keyId] = val;
    saveLocalDb();
  }
}

export async function deleteBaileysKey(sessionId: string, keyId: string): Promise<void> {
  if (pgPool) {
    try {
      await withRetry(
        () => pgPool!.query('DELETE FROM baileys_keys WHERE session_id = $1 AND key_id = $2', [sessionId, keyId]),
        'deleteBaileysKey'
      );
    } catch (err) {
      console.error('[DB] deleteBaileysKey failed (non-fatal):', err);
    }
  } else {
    if (localDb.baileys_keys[sessionId]) {
      delete localDb.baileys_keys[sessionId][keyId];
      saveLocalDb();
    }
  }
}

export async function clearBaileysKeys(sessionId: string): Promise<void> {
  if (pgPool) {
    try {
      await withRetry(() => pgPool!.query('DELETE FROM baileys_keys WHERE session_id = $1', [sessionId]), 'clearBaileysKeys');
    } catch (err) {
      console.error('[DB] clearBaileysKeys failed:', err);
    }
  } else {
    delete localDb.baileys_keys[sessionId];
    saveLocalDb();
  }
}

// ============================================
// Bot Operational Logs Database Handlers
// ============================================

export async function getLogs(sessionId: string, limitAmount = 50): Promise<LogEntry[]> {
  if (pgPool) {
    try {
      const res = await withRetry(
        () => pgPool!.query(
          'SELECT * FROM bot_logs WHERE session_id = $1 ORDER BY timestamp DESC LIMIT $2',
          [sessionId, limitAmount]
        ),
        'getLogs'
      );
      return res.rows.map(row => ({
        id: row.id,
        timestamp: Number(row.timestamp),
        level: row.level as any,
        message: row.message
      }));
    } catch (err) {
      console.error('[DB] getLogs failed:', err);
      return [];
    }
  } else {
    const list = localDb.bot_logs[sessionId] || [];
    return list.slice(-limitAmount);
  }
}

export async function addLog(sessionId: string, entry: LogEntry): Promise<void> {
  if (pgPool) {
    try {
      // FIX: No retry on logs — fire and forget, never block on log writes
      pgPool.query(
        'INSERT INTO bot_logs (id, session_id, level, message, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [entry.id, sessionId, entry.level, entry.message, entry.timestamp]
      ).catch(err => console.warn('[DB] addLog fire-and-forget failed:', err));
    } catch (err) {
      // Silently ignore log write failures
    }
  } else {
    if (!localDb.bot_logs[sessionId]) localDb.bot_logs[sessionId] = [];
    const list = localDb.bot_logs[sessionId];
    list.push(entry);
    if (list.length > 100) localDb.bot_logs[sessionId] = list.slice(-100);
    saveLocalDb();
  }
}

export async function clearLogs(sessionId: string): Promise<void> {
  if (pgPool) {
    try {
      await withRetry(() => pgPool!.query('DELETE FROM bot_logs WHERE session_id = $1', [sessionId]), 'clearLogs');
    } catch (err) {
      console.error('[DB] clearLogs failed:', err);
    }
  } else {
    delete localDb.bot_logs[sessionId];
    saveLocalDb();
  }
}