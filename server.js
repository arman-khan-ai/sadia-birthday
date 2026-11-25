const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Read .env locally if present
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(ADMIN_PASSWORD|DATABASE_URL)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is missing in Environment Variables!");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json({ limit: "25mb" }));
app.use(express.static(__dirname));

let adminToken = null;

// Automatically create tables in Neon on startup
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      date TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS music (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
}

function requireAdmin(req, res, next) {
  if (!adminToken || req.get("x-admin-token") !== adminToken) {
    return res.status(401).json({ error: "Admin login required." });
  }
  next();
}

// Get all wishes from Neon
app.get("/api/wishes", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, message, date FROM wishes ORDER BY date ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load wishes." });
  }
});

// Save a new wish to Neon
app.post("/api/wishes", async (req, res) => {
  try {
    const { name, message } = req.body;
    if (typeof name !== "string" || typeof message !== "string" || !name.trim() || !message.trim()) {
      return res.status(400).json({ error: "Please enter your name and birthday wish." });
    }
    if (name.trim().length > 50 || message.trim().length > 300) {
      return res.status(400).json({ error: "Name or message is too long." });
    }
    const wish = {
      id: crypto.randomUUID(),
      name: name.trim(),
      message: message.trim(),
      date: new Date().toISOString()
    };
    await pool.query(
      "INSERT INTO wishes (id, name, message, date) VALUES ($1, $2, $3, $4)",
      [wish.id, wish.name, wish.message, wish.date]
    );
    res.status(201).json({ success: true, wish });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save your wish." });
  }
});

// Admin login
app.post("/api/admin/login", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  const supplied = typeof req.body.password === "string" ? req.body.password : "";
  if (!expected) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is missing from your environment variables." });
  }
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "That admin password is not correct." });
  }
  adminToken = crypto.randomBytes(32).toString("hex");
  res.json({ success: true, token: adminToken });
});

// Admin logout
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  adminToken = null;
  res.json({ success: true });
});

// Edit wish in Neon
app.put("/api/admin/wishes/:id", requireAdmin, async (req, res) => {
  try {
    const { name, message } = req.body;
    if (typeof name !== "string" || typeof message !== "string" || !name.trim() || !message.trim()) {
      return res.status(400).json({ error: "Name and wish cannot be empty." });
    }
    const cleanName = name.trim().slice(0, 50);
    const cleanMessage = message.trim().slice(0, 300);
    const result = await pool.query(
      "UPDATE wishes SET name = $1, message = $2 WHERE id = $3 RETURNING id, name, message, date",
      [cleanName, cleanMessage, req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Wish not found." });
    }
    res.json({ success: true, wish: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update wish." });
  }
});

// Delete wish from Neon
app.delete("/api/admin/wishes/:id", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM wishes WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Wish not found." });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete wish." });
  }
});

// Get saved birthday song from Neon
app.get("/api/music", async (req, res) => {
  try {
    const result = await pool.query("SELECT title, data FROM music WHERE id = 1");
    if (result.rowCount === 0) {
      return res.json({ src: "" });
    }
    res.json({ src: result.rows[0].data, title: result.rows[0].title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not read song." });
  }
});

// Upload and save birthday song in Neon
app.post("/api/admin/music", requireAdmin, async (req, res) => {
  try {
    const { name, data } = req.body;
    if (typeof data !== "string" || !data.startsWith("data:audio/")) {
      return res.status(400).json({ error: "Choose a valid audio file." });
    }
    const match = data.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!match) {
      return res.status(400).json({ error: "Invalid audio data." });
    }
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 20 * 1024 * 1024) {
      return res.status(413).json({ error: "Song must be under 20 MB." });
    }
    const title = (name || "A song for Sadia").replace(/[<>]/g, "").slice(0, 100);
    await pool.query(
      `INSERT INTO music (id, title, data)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, data = EXCLUDED.data`,
      [title, data]
    );
    res.json({ success: true, src: data, title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not upload song." });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Birthday website running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to Neon database:", err);
    process.exit(1);
  });
