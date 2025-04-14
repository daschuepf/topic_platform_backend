const ogs = require('open-graph-scraper');
const express = require('express');
const cors = require('cors');
const pool = require('./db'); // 🔥 Neu hinzugefügt

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ✅ Neue Route mit DB-Anbindung
app.get('/api/topics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM topics ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Fehler beim Laden der Themen');
  }
});
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
      res.status(500).send('Fehler beim Erstellen des Themas');
    }
  });  
 // Einzelnes Thema laden
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
    res.status(500).send('Fehler beim Laden des Themas');
  }
}); 
// Kommentar zu einem Thema speichern
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

app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`);
});
app.post('/api/topics/link', async (req, res) => {
  const { url, comment } = req.body;

  if (!url) return res.status(400).json({ error: 'URL fehlt' });

  try {
    // 1. Prüfen, ob der Link bereits gespeichert ist
    const check = await pool.query('SELECT * FROM topics WHERE url = $1', [url]);
    if (check.rows.length > 0) {
      // 💬 Kommentar hinzufügen, falls mitgeschickt
      if (comment) {
        await pool.query(
          'INSERT INTO comments (topic_id, text) VALUES ($1, $2)',
          [check.rows[0].id, comment]
        );
      }
    
      // Kommentaranzahl ermitteln
const commentCountResult = await pool.query(
  'SELECT COUNT(*) FROM comments WHERE topic_id = $1',
  [check.rows[0].id]
);

const comment_count = parseInt(commentCountResult.rows[0].count, 10);

return res.status(200).json({
  ...check.rows[0],
  comment_count,
  existing: true // 👈 das ist neu!
});


    

    // 2. Metadaten holen
    const { result } = await ogs({ url });

    const title = result.ogTitle || 'Unbekannter Titel';
    const description = result.ogDescription || '';
    const image = result.ogImage?.url || null;

    // 3. Speichern
    const insert = await pool.query(
      `INSERT INTO topics (title, url, description, image)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, url, description, image]
    );
    const newTopic = insert.rows[0];

    if (comment && comment.trim().length > 0) {
      await pool.query(
        `INSERT INTO comments (topic_id, text) VALUES ($1, $2)`,
        [newTopic.id, comment]
      );
    }
    
    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Verarbeiten des Links' });
  }
});
app.get('/api/topics/:id/comments', async (req, res) => {
  const topicId = req.params.id;

  try {
    const result = await pool.query(
      'SELECT * FROM comments WHERE topic_id = $1 ORDER BY created_at ASC',
      [topicId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Laden der Kommentare' });
  }
});
