const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const CLEANUP_INTERVAL_MS = 2 * 60 * 60 * 1000;

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  let ownerHash = req.cookies.owner_hash;
  if (!ownerHash) {
    ownerHash = crypto.randomBytes(16).toString('hex');
    res.cookie('owner_hash', ownerHash, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }
  req.ownerHash = ownerHash;
  next();
});

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPage(todos) {
  const items = todos
    .map(
      (t) => `
      <li class="${t.is_done ? 'done' : ''}">
        <form method="post" action="/todos/${t.id}/toggle" class="inline">
          <button type="submit" aria-label="toggle">${t.is_done ? '☑' : '☐'}</button>
        </form>
        <span>${escapeHtml(t.title)}</span>
        <form method="post" action="/todos/${t.id}/delete" class="inline">
          <button type="submit" aria-label="delete">✕</button>
        </form>
      </li>`
    )
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>To-Do POC</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
  .warning { background: #fff3cd; border: 1px solid #ffe69c; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.9rem; }
  ul { list-style: none; padding: 0; }
  li { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid #eee; }
  li.done span { text-decoration: line-through; color: #888; }
  .inline { display: inline; }
  form.add { display: flex; gap: 0.5rem; margin: 1rem 0; }
  form.add input { flex: 1; padding: 0.4rem; }
  button { cursor: pointer; }
</style>
</head>
<body>
  <h1>To-Do (POC)</h1>
  <p class="warning">⚠️ Esta lista se borra automáticamente cada 2 horas &mdash; es un proof of concept.</p>
  <form class="add" method="post" action="/todos">
    <input type="text" name="title" placeholder="Nueva tarea" required maxlength="200">
    <button type="submit">Agregar</button>
  </form>
  <ul>${items}</ul>
</body>
</html>`;
}

app.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, title, is_done FROM todos WHERE owner_hash = $1 ORDER BY id',
      [req.ownerHash]
    );
    res.send(renderPage(rows));
  } catch (err) {
    next(err);
  }
});

app.post('/todos', async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    if (title) {
      await pool.query(
        'INSERT INTO todos (title, owner_hash) VALUES ($1, $2)',
        [title, req.ownerHash]
      );
    }
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.post('/todos/:id/toggle', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE todos SET is_done = NOT is_done WHERE id = $1 AND owner_hash = $2',
      [req.params.id, req.ownerHash]
    );
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.post('/todos/:id/delete', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM todos WHERE id = $1 AND owner_hash = $2',
      [req.params.id, req.ownerHash]
    );
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});

setInterval(() => {
  pool.query('DELETE FROM todos').catch((err) => {
    console.error('cleanup job failed', err);
  });
}, CLEANUP_INTERVAL_MS);
