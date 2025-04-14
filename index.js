const ogs = require('open-graph-scraper');
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// 🔹 Alle Themen abrufen
app.get('/api/topics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM topics ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Themen' });
  }
});

// 🔹 Neues Thema manuell anlegen (nur mit Titel)
app.post('/api/topics', async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Titel fehlt' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO topics (title) VALUES ($1) RETURNING *',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Erstellen des Themas' });
  }
});

// 🔹 Einzelnes Thema abrufen
app.get('/api/topics/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM topics WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thema nicht gefunden' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden des Themas' });
  }
});

// 🔹 Kommentar speichern
app.post('/api/topics/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Kommentar fehlt' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO comments (topic_id, text) VALUES ($1, $2) RETURNING *',
      [id, text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Speichern des Kommentars' });
  }
});

// 🔹 Thema über Link einreichen (mit optionalem Kommentar)
app.post('/api/topics/link', async (req, res) => {
  const { url, comment } = req.body;

  if (!url) return res.status(400).json({ error: 'URL fehlt' });

  try {
    // 1. Prüfen, ob Link schon gespeichert ist
    const check = await pool.query('SELECT * FROM topics WHERE url = $1', [url]);

    if (check.rows.length > 0) {
      const topic = check.rows[0];

      // Kommentar hinzufügen (wenn mitgeschickt)
      if (comment && comment.trim()) {
        await pool.query(
          'INSERT INTO comments (topic_id, text) VALUES ($1, $2)',
          [topic.id, comment]
        );
      }

      // Kommentaranzahl zählen
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM comments WHERE topic_id = $1',
        [topic.id]
      );
      const comment_count = parseInt(countResult.rows[0].count, 10);

      return res.status(200).json({
        ...topic,
        comment_count,
        existing: true,
      });
    }

    // 2. Metadaten holen mit Fallback
let title = '';
let description = '';
let image = null;

try {
  const { result } = await ogs({ url });
  console.log('📷 Gefundenes Bild:', result.ogImage?.url);
  if (result.success) {
    title = result.ogTitle || '';
    description = result.ogDescription || '';
    image = result.ogImage?.url || null;
  }
} catch (err) {
  console.warn('⚠️ OpenGraph konnte nicht geladen werden – Fallback aktiviert.');
}

// Fallback-Titel aus URL generieren
if (!title) {
  try {
    const path = new URL(url).pathname;
    const slug = path.split('/').pop()?.split('-') || ['Unbekannter Titel'];
    title = slug
      .filter(part => !part.match(/^id\\d+|\\.html?/)) // id oder .html entfernen
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch (e) {
    title = 'Unbekannter Titel';
  }
}

if (!description) {
  description = 'Keine Beschreibung verfügbar.';
}

// 3. Neues Thema speichern
const insert = await pool.query(
  `INSERT INTO topics (title, url, description, image)
   VALUES ($1, $2, $3, $4) RETURNING *`,
  [title, url, description, image]
);
const newTopic = insert.rows[0];

// 4. Kommentar hinzufügen (wenn mitgeschickt)
if (comment && comment.trim()) {
  await pool.query(
    'INSERT INTO comments (topic_id, text) VALUES ($1, $2)',
    [newTopic.id, comment]
  );
}

    res.status(201).json({
      ...newTopic,
      existing: false,
    });
  } catch (err) {
    console.error('💥 Fehler beim Verarbeiten des Links:', err);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Links' });
  }
  
});

// 🔹 Kommentare zu einem Thema abrufen
app.get('/api/topics/:id/comments', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM comments WHERE topic_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Kommentare' });
  }
});

// 🔸 Server starten
app.listen(PORT, () => {
  console.log(`✅ Backend läuft auf http://localhost:${PORT}`);
});
