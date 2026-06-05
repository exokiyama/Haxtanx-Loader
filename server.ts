import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import fs from 'fs';

import {
  initDb,
  getSessions as dbGetSessions,
  getAllActiveSessions,
  getSession as dbGetSession,
  saveSession as dbSaveSession,
  updateSessionFields as dbUpdateSessionFields,
  deleteSession as dbDeleteSession,
  deleteBaileysCreds,
  clearBaileysKeys,
  getLogs as dbGetLogs,
  clearLogs as dbClearLogs,
  getUser,
  registerUser,
  ADMIN_USERNAME,
  ADMIN_PASSWORD
} from './src/server/db.js';

import { SessionManager, WhatsAppBotInstance } from './src/server/sessionManager.js';

// Support both ESM (tsx development) and bundled CJS (node production) environments
let _filename = '';
let _dirname = '';

try {
  _filename = __filename;
  _dirname = __dirname;
} catch {
  // Safe ESM fallback for development environment compilation
  try {
    _filename = fileURLToPath(import.meta.url);
    _dirname = path.dirname(_filename);
  } catch {
    _filename = path.join(process.cwd(), 'server.ts');
    _dirname = process.cwd();
  }
}

const app = express();
app.use(express.json());

const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket subscriptions registry: sessionId -> Set of WebSockets
const wssClients = new Map<string, Set<WebSocket>>();

// Helper to broadcast messages to all connected WebSockets subscribed to a given sessionId
function broadcastToSession(sessionId: string, payload: any) {
  const clients = wssClients.get(sessionId);
  if (clients && clients.size > 0) {
    const rawMessage = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(rawMessage);
      }
    }
  }
}

// Hook WebSocket event receivers to stream updates
function bindBotEvents(sessionId: string, inst: WhatsAppBotInstance) {
  inst.registerCallbacks({
    onQR: (qr) => {
      broadcastToSession(sessionId, { type: 'qr', data: qr });
    },
    onPairing: (code) => {
      broadcastToSession(sessionId, { type: 'pairing', data: code });
    },
    onStatus: (status, err) => {
      broadcastToSession(sessionId, { type: 'status', data: status, error: err });
    },
    onLog: (log) => {
      broadcastToSession(sessionId, { type: 'log', data: log });
    }
  });
}

// Auto-activate any connected/active bots upon server startup
async function autoStartActiveSessions() {
  console.log('[SYS] scanning for active bots to reconnect...');
  try {
    const active = await getAllActiveSessions();
    console.log(`[SYS] Found ${active.length} active bot configurations to restore connection.`);
    for (const data of active) {
      console.log(`[SYS] Reconnecting active session ID: ${data.id}`);
      const inst = SessionManager.getOrCreateInstance(data.id);
      bindBotEvents(data.id, inst);
      inst.connect().catch(e => {
        console.error(`[SYS] Failed to reconnect ${data.id}:`, e);
      });
    }
  } catch (err) {
    console.error('[SYS] Failed to scan database active sessions:', err);
  }
}

// REST Control APIs
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Start a WhatsApp bot connection sequence
app.post('/api/sessions/start', async (req, res) => {
  const { sessionId, phoneNumberToPair } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId parameter' });
    return;
  }

  try {
    console.log(`[REST] Booting session: ${sessionId}`);
    const inst = SessionManager.getOrCreateInstance(sessionId);
    bindBotEvents(sessionId, inst);
    
    // Non-blocking trigger connect
    inst.connect(phoneNumberToPair);
    
    res.json({ success: true, message: 'Bot session boot requested successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Shutdown a WhatsApp Bot
app.post('/api/sessions/stop', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId parameter' });
    return;
  }

  try {
    console.log(`[REST] Shutting down session: ${sessionId}`);
    const inst = SessionManager.getInstance(sessionId);
    if (inst) {
      inst.shutdown();
      SessionManager.removeInstance(sessionId);
    }
    
    // Refactored Database Status updates
    await dbUpdateSessionFields(sessionId, { status: 'Disconnected' });

    res.json({ success: true, message: 'Bot session terminated.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Wipes auth credentials and restarts for pairing
app.post('/api/sessions/wipe', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId' });
    return;
  }

  try {
    console.log(`[REST] Wiping auth credentials for: ${sessionId}`);
    
    // Shut down if active
    const inst = SessionManager.getInstance(sessionId);
    if (inst) {
      inst.shutdown();
      SessionManager.removeInstance(sessionId);
    }

    // Delete Postgres/file auth details
    await deleteBaileysCreds(sessionId).catch(() => {});
    await clearBaileysKeys(sessionId).catch(() => {});
    await dbClearLogs(sessionId).catch(() => {});

    // Reset status and stats
    await dbUpdateSessionFields(sessionId, {
      status: 'Disconnected',
      phoneNumber: '',
      stats: {
        msgs: 0,
        replies: 0,
        cmds: 0,
        start: 0
      }
    });

    res.json({ success: true, message: 'Session authentication tokens and cache cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =======================================================
// Supabase-Style Proxied REST APIs for Client Integration
// =======================================================

// User registration Endpoint
app.post('/api/supabase/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email and password are required fields.' });
    return;
  }
  try {
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const newUser = await registerUser(username, email, passwordHash);
    res.json({ success: true, user: newUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// User sign-in Endpoint (supports standard users and root admin credentials)
app.post('/api/supabase/auth/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;
  if (!emailOrUsername || !password) {
    res.status(400).json({ error: 'Email/Username and password are required fields.' });
    return;
  }
  try {
    const normalizedName = emailOrUsername.toLowerCase().trim();
    if (normalizedName === ADMIN_USERNAME.toLowerCase() && password === ADMIN_PASSWORD) {
      // Auto success login for root administrator
      res.json({
        success: true,
        user: {
          id: 'admin_root',
          username: ADMIN_USERNAME,
          email: 'haxtanx@nexuswa.com',
          isAdmin: true
        }
      });
      return;
    }

    const fetchedUser = await getUser(emailOrUsername);
    if (!fetchedUser) {
      res.status(401).json({ error: 'Authentication failed. Account not found.' });
      return;
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (fetchedUser.password_hash === passwordHash) {
      res.json({
        success: true,
        user: {
          id: fetchedUser.id,
          username: fetchedUser.username,
          email: fetchedUser.email,
          isAdmin: fetchedUser.username === ADMIN_USERNAME
        }
      });
    } else {
      res.status(401).json({ error: 'Authentication failed. Password does not match.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot config retrieval list
app.get('/api/supabase/sessions', async (req, res) => {
  const { ownerId } = req.query;
  if (!ownerId) {
    res.status(400).json({ error: 'Missing ownerId parameter' });
    return;
  }
  try {
    const sessions = await dbGetSessions(ownerId as string);
    res.json({ success: true, sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot config profile storage
app.post('/api/supabase/sessions/create', async (req, res) => {
  const { session } = req.body;
  if (!session || !session.id) {
    res.status(400).json({ error: 'Invalid session profile configuration payload.' });
    return;
  }
  try {
    await dbSaveSession(session);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot config field updates
app.post('/api/supabase/sessions/update', async (req, res) => {
  const { sessionId, fields } = req.body;
  if (!sessionId || !fields) {
    res.status(400).json({ error: 'Missing sessionId or update fields payload.' });
    return;
  }
  try {
    await dbUpdateSessionFields(sessionId, fields);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot config deletion
app.post('/api/supabase/sessions/delete', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId parameters.' });
    return;
  }
  try {
    await dbDeleteSession(sessionId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot session logs retrieval
app.get('/api/supabase/sessions/:id/logs', async (req, res) => {
  const { id } = req.params;
  try {
    const logs = await dbGetLogs(id, 50);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =======================================================

// Set up WebSocket server handshake to map browser screens
wss.on('connection', (ws) => {
  let currSessionId: string | null = null;

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'subscribe' && parsed.sessionId) {
        currSessionId = parsed.sessionId;
        
        let clients = wssClients.get(currSessionId);
        if (!clients) {
          clients = new Set();
          wssClients.set(currSessionId, clients);
        }
        clients.add(ws);

        // Send back immediate live state if instance is running
        const inst = SessionManager.getInstance(currSessionId);
        if (inst) {
          ws.send(JSON.stringify({
            type: 'status',
            data: inst.isConnected ? 'Connected' : 'Connecting',
            qr: inst.qrCode,
            pairing: inst.pairingCode
          }));
        }
      }
    } catch {}
  });

  ws.on('close', () => {
    if (currSessionId) {
      const clients = wssClients.get(currSessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          wssClients.delete(currSessionId);
        }
      }
    }
  });
});

// Self Keep-Alive / Auto Ping loop (Every 5 minutes to maintain WebSockets and avoid cold starts)
function startAutoPingDaemon() {
  let hostUrl = process.env.APP_URL || 'http://localhost:3000/api/health';
  if (hostUrl && !hostUrl.startsWith('http://') && !hostUrl.startsWith('https://')) {
    hostUrl = 'https://' + hostUrl;
  }
  try {
    const parsed = new URL(hostUrl);
    if (parsed.pathname === '/') {
      hostUrl = new URL('/api/health', hostUrl).toString();
    }
  } catch (err) {
    // Fallback if parsing fails
  }
  console.log(`[SYS] Initializing auto-ping warm loop targeting: ${hostUrl}`);
  
  setInterval(async () => {
    try {
      console.log('[SYS] Sending auto-ping request to avoid system sleep cycles...');
      const response = await fetch(hostUrl);
      const data = await response.json().catch(() => ({ status: 'unknown_payload' }));
      console.log(`[SYS] Self-ping returned status: ${response.status}`);
    } catch (err: any) {
      console.warn(`[SYS] Warm loop ping returned error: ${err.message}`);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Integrate Vite's developer mode SPA proxying or Production builds
async function startServer() {
  // Initialize SQL schema tables or JSON databases
  await initDb();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Dynamically locate production static assets directory based on bundle location
    let distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(path.join(_dirname, 'index.html'))) {
      distPath = _dirname;
    } else if (fs.existsSync(path.join(_dirname, 'dist', 'index.html'))) {
      distPath = path.join(_dirname, 'dist');
    }
    console.log(`[SYS] Serving production static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind server listener
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`  Fullstack WhatsApp Dashboard Active!`);
    console.log(`  Url: http://localhost:${PORT}`);
    console.log(`  Targeting PORT 3000 ingress channel.`);
    console.log(`=========================================`);
    
    // Start active warm elements
    startAutoPingDaemon();
    autoStartActiveSessions();
  });
}

// Handle termination signals cleanly
const cleanShutdown = () => {
  console.log('[SYS] Shutting down Express server. Purging bot resources...');
  SessionManager.shutdownAll();
  process.exit(0);
};
process.on('SIGINT', cleanShutdown);
process.on('SIGTERM', cleanShutdown);

startServer().catch(err => {
  console.error('[SYS] Fatal server bootstrap crash:', err);
  process.exit(1);
});
