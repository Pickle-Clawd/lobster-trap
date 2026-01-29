const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'lobster-trap.db');

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS traps (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trap_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT,
    headers TEXT,
    body TEXT,
    query TEXT,
    ip TEXT,
    content_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (trap_id) REFERENCES traps(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_requests_trap_id ON requests(trap_id);
  CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
`);

// Auto-cleanup: delete requests older than 7 days
function cleanup() {
  db.prepare("DELETE FROM requests WHERE created_at < datetime('now', '-7 days')").run();
  db.prepare("DELETE FROM traps WHERE id NOT IN (SELECT DISTINCT trap_id FROM requests) AND created_at < datetime('now', '-7 days')").run();
}
cleanup();
setInterval(cleanup, 60 * 60 * 1000); // every hour

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Parse bodies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.text({ limit: '1mb' }));
app.use(express.raw({ type: '*/*', limit: '1mb' }));

// Home page
app.get('/', (req, res) => {
  const traps = db.prepare('SELECT id, name, created_at FROM traps ORDER BY created_at DESC LIMIT 50').all();
  const counts = {};
  if (traps.length > 0) {
    const ids = traps.map(t => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT trap_id, COUNT(*) as count FROM requests WHERE trap_id IN (${placeholders}) GROUP BY trap_id`).all(...ids);
    for (const row of rows) {
      counts[row.trap_id] = row.count;
    }
  }
  res.render('index', { traps, counts });
});

// Create a new trap
app.post('/traps', (req, res) => {
  const id = uuidv4().split('-')[0];
  const name = (typeof req.body === 'object' && req.body.name) ? req.body.name.slice(0, 100) : '';
  db.prepare('INSERT INTO traps (id, name) VALUES (?, ?)').run(id, name || `Trap ${id}`);
  res.redirect(`/traps/${id}`);
});

// View trap dashboard
app.get('/traps/:id', (req, res) => {
  const trap = db.prepare('SELECT * FROM traps WHERE id = ?').get(req.params.id);
  if (!trap) return res.status(404).render('404');
  const requests = db.prepare('SELECT * FROM requests WHERE trap_id = ? ORDER BY created_at DESC LIMIT 100').all(req.params.id);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.render('dashboard', { trap, requests, baseUrl });
});

// API: get requests as JSON
app.get('/api/traps/:id/requests', (req, res) => {
  const trap = db.prepare('SELECT * FROM traps WHERE id = ?').get(req.params.id);
  if (!trap) return res.status(404).json({ error: 'Trap not found' });
  const requests = db.prepare('SELECT * FROM requests WHERE trap_id = ? ORDER BY created_at DESC LIMIT 100').all(req.params.id);
  res.json({ trap, requests: requests.map(r => ({ ...r, headers: JSON.parse(r.headers || '{}'), query: JSON.parse(r.query || '{}') })) });
});

// Delete a trap
app.delete('/traps/:id', (req, res) => {
  db.prepare('DELETE FROM requests WHERE trap_id = ?').run(req.params.id);
  db.prepare('DELETE FROM traps WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Catch requests - this is the trap endpoint
app.all('/t/:id', (req, res) => {
  app.all(`/t/${req.params.id}/*`, () => {}); // just to define it
  const trap = db.prepare('SELECT * FROM traps WHERE id = ?').get(req.params.id);
  if (!trap) return res.status(404).json({ error: 'Trap not found' });

  let bodyStr = '';
  if (req.body) {
    if (Buffer.isBuffer(req.body)) {
      bodyStr = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      bodyStr = req.body;
    } else {
      bodyStr = JSON.stringify(req.body);
    }
  }

  db.prepare(`
    INSERT INTO requests (trap_id, method, path, headers, body, query, ip, content_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    req.method,
    req.originalUrl,
    JSON.stringify(req.headers),
    bodyStr,
    JSON.stringify(req.query),
    req.ip,
    req.get('content-type') || ''
  );

  res.status(200).json({
    message: 'Request caught! 🦞',
    trap_id: req.params.id,
    method: req.method
  });
});

// Catch requests with subpaths
app.all('/t/:id/*', (req, res) => {
  const trap = db.prepare('SELECT * FROM traps WHERE id = ?').get(req.params.id);
  if (!trap) return res.status(404).json({ error: 'Trap not found' });

  let bodyStr = '';
  if (req.body) {
    if (Buffer.isBuffer(req.body)) {
      bodyStr = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      bodyStr = req.body;
    } else {
      bodyStr = JSON.stringify(req.body);
    }
  }

  db.prepare(`
    INSERT INTO requests (trap_id, method, path, headers, body, query, ip, content_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    req.method,
    req.originalUrl,
    JSON.stringify(req.headers),
    bodyStr,
    JSON.stringify(req.query),
    req.ip,
    req.get('content-type') || ''
  );

  res.status(200).json({
    message: 'Request caught! 🦞',
    trap_id: req.params.id,
    method: req.method
  });
});

// 404
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🦞 Lobster Trap running on port ${PORT}`);
});
