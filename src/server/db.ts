import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { BotSession, LogEntry } from '../types.js';

const { Pool } = pg;

// Define default admin credentials
export const ADMIN_USERNAME = 'haxtanx';
export const ADMIN_PASSWORD = 'papa%hamza';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const LOCAL_DB_PATH = path.join(DATA_DIR, 'supabase_db.json');

// Interface for serialized schemas
interface LocalDbSchema {
  users: Array<{ id: string; username: string; email: string; password_hash: string; created_at: number }>;
  bot_sessions: Record<string, BotSession>;
  baileys_creds: Record<string, any>;
  baileys_keys: Record<string, Record<string, any>>;
  bot_logs: Record<string, LogEntry[]>;
}

// In-Memory fallback cache
let localDb: LocalDbSchema = {
  users: [],
  bot_sessions: {},
  baileys_creds: {},
  baileys_keys: {},
  bot_logs: {}
};

// Check if PostgreSQL config is present
const pgConnString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
let pgPool: pg.Pool | null = null;

// Initialize connection pool
if (pgConnString) {
  console.log('[DB] Found Postgres Connection string. Initializing Postgres Client Pool...');
  pgPool = new Pool({
    connectionString: pgConnString,
    ssl: pgConnString.includes('supabase') || pgConnString.includes('localhost') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });
  pgPool.on('error', (err) => {
    console.error('[DB] Unexpected error on Postgres client pool:', err);
  });
} else {
  console.log('[DB] No Postgres Connection string found. Using local JSON database cache fallback.');
  // Load local database from file if exists
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      localDb = { ...localDb, ...JSON.parse(content) };
      console.log(`[DB] Successfully loaded local database with ${localDb.users.length} users and ${Object.keys(localDb.bot_sessions).length} bot sessions.`);
    } catch (err) {
      console.error('[DB] Failed to read local database file. Initializing a new blank one:', err);
    }
  }
}

// Write local JSON database changes
function saveLocalDb() {
  if (pgPool) return; // Not using local database
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to persist local JSON database:', err);
  }
}

// Ensure database tables exist
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
      console.error('[DB] Failed to connect or initialize Postgres tables. Temporarily falling back to local file!', err);
      pgPool = null; // Mark pool as inactive so we fallback to local file
    }
  }

  // Always pre-populate the administrator user 'haxtanx' if not already created
  try {
    const adminExists = await getUser(ADMIN_USERNAME);
    if (!adminExists) {
      console.log(`[DB] Admin account '${ADMIN_USERNAME}' not present on boot. Provisioning account...`);
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
      const res = await pgPool.query(
        'SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $2 LIMIT 1',
        [normalized, normalized]
      );
      if (res.rows.length > 0) {
        const u = res.rows[0];
        return {
          id: u.id,
          username: u.username,
          email: u.email,
          password_hash: u.password_hash,
          created_at: Number(u.created_at)
        };
      }
      return null;
    } catch (err) {
      console.error('[DB] getUser failed:', err);
      return null;
    }
  } else {
    const found = localDb.users.find(
      u => u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized
    );
    return found || null;
  }
}

export async function registerUser(username: string, email: string, password_hash: string) {
  const cleanedUsername = username.trim();
  const cleanedEmail = email.toLowerCase().trim();
  const newUserId = 'user_' + Math.random().toString(36).substring(2, 10);
  const now = Date.now();

  if (pgPool) {
    try {
      await pgPool.query(
        'INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
        [newUserId, cleanedUsername, cleanedEmail, password_hash, now]
      );
      return { id: newUserId, username: cleanedUsername, email: cleanedEmail };
    } catch (err: any) {
      console.error('[DB] registerUser failed:', err);
      throw new Error(err.message || 'Registration failed');
    }
  } else {
    // Check duplicates locally
    const duplicate = localDb.users.find(
      u => u.username.toLowerCase() === cleanedUsername.toLowerCase() || u.email.toLowerCase() === cleanedEmail
    );
    if (duplicate) {
      throw new Error('Username or Email already registered');
    }
    const newUser = {
      id: newUserId,
      username: cleanedUsername,
      email: cleanedEmail,
      password_hash,
      created_at: now
    };
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
      const res = await pgPool.query('SELECT payload FROM bot_sessions WHERE owner_id = $1', [ownerId]);
      return res.rows.map(row => JSON.parse(row.payload) as BotSession);
    } catch (err) {
      console.error('[DB] getSessions failed:', err);
      return [];
    }
  } else {
    return Object.values(localDb.bot_sessions).filter(s => s.ownerId === ownerId);
  }
}

// For system bot scans (reconnect all on restart)
export async function getAllActiveSessions(): Promise<BotSession[]> {
  if (pgPool) {
    try {
      const res = await pgPool.query("SELECT payload FROM bot_sessions WHERE status IN ('Connected', 'Connecting')");
      return res.rows.map(row => JSON.parse(row.payload) as BotSession);
    } catch (err) {
      console.error('[DB] getAllActiveSessions failed:', err);
      return [];
    }
  } else {
    return Object.values(localDb.bot_sessions).filter(
      s => s.status === 'Connected' || s.status === 'Connecting'
    );
  }
}

export async function getSession(sessionId: string): Promise<BotSession | null> {
  if (pgPool) {
    try {
      const res = await pgPool.query('SELECT payload FROM bot_sessions WHERE id = $1 LIMIT 1', [sessionId]);
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].payload) as BotSession;
      }
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
      await pgPool.query(
        `INSERT INTO bot_sessions (id, owner_id, name, status, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET owner_id = $2, name = $3, status = $4, payload = $5`,
        [session.id, session.ownerId, session.name, session.status, payloadStr, session.createdAt || Date.now()]
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
      await pgPool.query('DELETE FROM bot_sessions WHERE id = $1', [sessionId]);
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
      const res = await pgPool.query('SELECT data FROM baileys_creds WHERE session_id = $1 LIMIT 1', [sessionId]);
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].data);
      }
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
      const dataStr = JSON.stringify(data);
      await pgPool.query(
        `INSERT INTO baileys_creds (session_id, data) VALUES ($1, $2)
         ON CONFLICT (session_id) DO UPDATE SET data = $2`,
        [sessionId, dataStr]
      );
    } catch (err) {
      console.error('[DB] saveBaileysCreds failed:', err);
    }
  } else {
    localDb.baileys_creds[sessionId] = data;
    saveLocalDb();
  }
}

export async function deleteBaileysCreds(sessionId: string): Promise<void> {
  if (pgPool) {
    try {
      await pgPool.query('DELETE FROM baileys_creds WHERE session_id = $1', [sessionId]);
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
      const res = await pgPool.query(
        'SELECT val FROM baileys_keys WHERE session_id = $1 AND key_id = $2 LIMIT 1',
        [sessionId, keyId]
      );
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].val);
      }
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
      const valStr = JSON.stringify(val);
      await pgPool.query(
        `INSERT INTO baileys_keys (session_id, key_id, val) VALUES ($1, $2, $3)
         ON CONFLICT (session_id, key_id) DO UPDATE SET val = $3`,
        [sessionId, keyId, valStr]
      );
    } catch (err) {
      console.error('[DB] saveBaileysKey failed:', err);
    }
  } else {
    if (!localDb.baileys_keys[sessionId]) {
      localDb.baileys_keys[sessionId] = {};
    }
    localDb.baileys_keys[sessionId][keyId] = val;
    saveLocalDb();
  }
}

export async function deleteBaileysKey(sessionId: string, keyId: string): Promise<void> {
  if (pgPool) {
    try {
      await pgPool.query('DELETE FROM baileys_keys WHERE session_id = $1 AND key_id = $2', [sessionId, keyId]);
    } catch (err) {
      console.error('[DB] deleteBaileysKey failed:', err);
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
      await pgPool.query('DELETE FROM baileys_keys WHERE session_id = $1', [sessionId]);
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
      const res = await pgPool.query(
        'SELECT * FROM bot_logs WHERE session_id = $1 ORDER BY timestamp DESC LIMIT $2',
        [sessionId, limitAmount]
      );
      // Map to standard LogEntry layout
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
      await pgPool.query(
        'INSERT INTO bot_logs (id, session_id, level, message, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [entry.id, sessionId, entry.level, entry.message, entry.timestamp]
      );
    } catch (err) {
      console.error('[DB] addLog failed:', err);
    }
  } else {
    if (!localDb.bot_logs[sessionId]) {
      localDb.bot_logs[sessionId] = [];
    }
    const list = localDb.bot_logs[sessionId];
    list.push(entry);
    // Cap to 100 logs per session inside local DB file to avoid bloat
    if (list.length > 100) {
      localDb.bot_logs[sessionId] = list.slice(-100);
    }
    saveLocalDb();
  }
}

export async function clearLogs(sessionId: string): Promise<void> {
  if (pgPool) {
    try {
      await pgPool.query('DELETE FROM bot_logs WHERE session_id = $1', [sessionId]);
    } catch (err) {
      console.error('[DB] clearLogs failed:', err);
    }
  } else {
    delete localDb.bot_logs[sessionId];
    saveLocalDb();
  }
}
