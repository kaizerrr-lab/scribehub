const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(() => console.log('Database connection successful.'))
    .catch(err => console.error('Database connection failed:', err.message));

app.post('/api/signup', async (req, res) => {
    const { email, password, role } = req.body;
    if (role === 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized role assignment.' });
    }
    try {
        await pool.query(
            'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
            [email, password, 'customer']
        );
        res.json({ success: true, email });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND password = $2',
            [email, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, role: result.rows[0].role, email: result.rows[0].email });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM posts ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/posts/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Post not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/posts', async (req, res) => {
    const { title, content, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO posts (title, content, status) VALUES ($1, $2, $3) RETURNING *',
            [title, content, status || 'Published']
        );
        res.json({ success: true, post: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/posts/:id', async (req, res) => {
    const { title, content, status } = req.body;
    try {
        await pool.query(
            'UPDATE posts SET title = $1, content = $2, status = $3 WHERE id = $4',
            [title, content, status, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// NEW: Toggle post status only
app.patch('/api/posts/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!['Published', 'Draft'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }
    try {
        const result = await pool.query(
            'UPDATE posts SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        if (result.rowCount > 0) {
            res.json({ success: true, post: result.rows[0] });
        } else {
            res.status(404).json({ success: false, error: 'Post not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/posts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM bookmarks WHERE post_id = $1', [req.params.id]);
        const result = await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
        if (result.rowCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Post not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/bookmarks', async (req, res) => {
    const { email, postId } = req.body;
    try {
        await pool.query('INSERT INTO bookmarks (user_email, post_id) VALUES ($1, $2)', [email, postId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/bookmarks', async (req, res) => {
    const { email, postId } = req.body;
    try {
        await pool.query('DELETE FROM bookmarks WHERE user_email = $1 AND post_id = $2', [email, postId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/bookmarks/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const result = await pool.query(
            'SELECT posts.* FROM posts JOIN bookmarks ON posts.id = bookmarks.post_id WHERE bookmarks.user_email = $1 ORDER BY bookmarks.id DESC',
            [email]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ENHANCED: Analytics now includes post counts and user counts
app.get('/api/analytics', async (req, res) => {
    try {
        const userCountResult    = await pool.query('SELECT COUNT(*) FROM users');
        const subCountResult     = await pool.query('SELECT COUNT(*) FROM users WHERE subscribed = TRUE');
        const totalPostsResult   = await pool.query('SELECT COUNT(*) FROM posts');
        const publishedResult    = await pool.query("SELECT COUNT(*) FROM posts WHERE status = 'Published'");
        const draftResult        = await pool.query("SELECT COUNT(*) FROM posts WHERE status = 'Draft'");
        const bookmarkCountResult = await pool.query('SELECT COUNT(*) FROM bookmarks');

        res.json({
            totalViews:    parseInt(userCountResult.rows[0].count),   // kept for backward compat
            totalUsers:    parseInt(userCountResult.rows[0].count),
            subscribers:   parseInt(subCountResult.rows[0].count),
            totalPosts:    parseInt(totalPostsResult.rows[0].count),
            publishedPosts: parseInt(publishedResult.rows[0].count),
            draftPosts:    parseInt(draftResult.rows[0].count),
            totalBookmarks: parseInt(bookmarkCountResult.rows[0].count)
        });
    } catch (err) {
        console.error("Analytics error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/subscription/:email', async (req, res) => {
    try {
        const result = await pool.query('SELECT subscribed FROM users WHERE email = $1', [req.params.email]);
        if (result.rows.length > 0) {
            res.json({ subscribed: result.rows[0].subscribed || false });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/subscription', async (req, res) => {
    const { email, subscribed } = req.body;
    try {
        await pool.query('UPDATE users SET subscribed = $1 WHERE email = $2', [subscribed, email]);
        res.json({ success: true, subscribed });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// NEW: Get all subscribers list (admin use)
app.get('/api/subscribers', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT email FROM users WHERE subscribed = TRUE ORDER BY email ASC"
        );
        res.json({ success: true, subscribers: result.rows, count: result.rows.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => console.log('Running on http://localhost:3000'));
}

module.exports = app;
