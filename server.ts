import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { SessionManager, WhatsAppBotInstance } from './src/server/sessionManager.js';
import firebaseConfig from './firebase-applet-config.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Init server-side Firebase
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

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

// Auto-activate any connected bots upon server startup
async function autoStartActiveSessions() {
  console.log('[SYS] scanning for active bots to reconnect...');
  try {
    const sessionsCol = collection(db, 'sessions');
    const snap = await getDocs(sessionsCol);
    for (const sDoc of snap.docs) {
      const data = sDoc.data();
      // If session was connected, let's restore the handshake automatically
      if (data.status === 'Connected' || data.status === 'Connecting') {
        const id = sDoc.id;
        console.log(`[SYS] Reconnecting active session ID: ${id}`);
        const inst = SessionManager.getOrCreateInstance(id);
        bindBotEvents(id, inst);
        inst.connect().catch(e => {
          console.error(`[SYS] Failed to reconnect ${id}:`, e);
        });
      }
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
    
    // Reflect disconnected status directly in Firestore
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, { status: 'Disconnected' });

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

    // Delete Firestore nested credentials
    const credsDocRef = doc(db, 'sessions', sessionId, 'auth', 'creds');
    await deleteDoc(credsDocRef).catch(() => {});

    // Delete keys subcollection keys
    const keysColRef = collection(db, 'sessions', sessionId, 'keys');
    const keysSnap = await getDocs(keysColRef).catch(() => null);
    if (keysSnap) {
      const deleteTasks = keysSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteTasks);
    }

    // Clear logs subcollection
    const logsColRef = collection(db, 'sessions', sessionId, 'logs');
    const logsSnap = await getDocs(logsColRef).catch(() => null);
    if (logsSnap) {
      const deleteLogs = logsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteLogs);
    }

    // Reset status and stats on parent
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      status: 'Disconnected',
      phoneNumber: '',
      'stats.msgs': 0,
      'stats.replies': 0,
      'stats.cmds': 0
    });

    res.json({ success: true, message: 'Session authentication tokens and cache cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Set up WebSocket server handshake
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

// Self Keep-Alive / Auto Ping loop (Every 5 minutes to maintain WebSockets and cold starts)
function startAutoPingDaemon() {
  const hostUrl = process.env.APP_URL || 'http://localhost:3000/api/health';
  console.log(`[SYS] Initializing auto-ping warm loop targeting: ${hostUrl}`);
  
  setInterval(async () => {
    try {
      console.log('[SYS] Sending auto-ping request to avoid system sleep cycles...');
      const response = await fetch(hostUrl);
      const data = await response.json();
      console.log(`[SYS] Self-ping returned: ${response.status} - `, data);
    } catch (err: any) {
      console.warn(`[SYS] Warm loop ping returned error: ${err.message}`);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Integrate Vite's developer mode SPA proxying or Production builds
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
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
    console.log(`=========================================`);
    
    // Fire up deamons
    startAutoPingDaemon();
    autoStartActiveSessions();
  });
}

// Handle terminations
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
