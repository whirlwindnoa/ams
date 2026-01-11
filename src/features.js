import express from 'express';

import db from './db.js';

const router = express.Router();

// all events
router.get('/events', async (req, res) => {
	try {
        const events = await db.all(`
            SELECT
                events.*,
                users.email AS added_by_email
            FROM events
            JOIN users ON users.id = events.added_by
            ORDER BY events.date IS NULL, events.date ASC
        `);
		return res.json({ events });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// get 1 event
router.get('/events/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

		const ev = await db.get('SELECT * FROM events WHERE id = ?', [id]);
		if (!ev) return res.status(404).json({ error: 'Event not found' });
		return res.json({ event: ev });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});


// add event
router.post('/events/add', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { name, date, time, status, capacity, notes } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'Invalid or missing name (min 3 chars)' });
    }

    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      return res.status(400).json({ error: 'Invalid capacity' });
    }

    let unixTime = null;
    if (date) {
      const timePart = time && time.trim() ? time : '00:00';
      const iso = `${date}T${timePart}:00`;
      const ms = Date.parse(iso);

      if (isNaN(ms)) {
        return res.status(400).json({ error: 'Invalid date/time' });
      }

      unixTime = ms;
    }

    await db.run(`INSERT INTO events (name, date, capacity, status, notes, added_by) VALUES (?, ?, ?, ?, ?, ?)`,[name.trim(), unixTime, cap, status, notes || null, req.user.id]);

    return res.redirect('/dashboard/events');

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// delete event
router.delete('/events/:id', async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: 'Authentication required' });

		const id = Number(req.params.id);
		if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

		const ev = await db.get('SELECT * FROM events WHERE id = ?', [id]);
		if (!ev) return res.status(404).json({ error: 'Event not found' });

		// allow deletion if admin/staff or creator
		if (!(req.user.elevation >= 1 || req.user.id === ev.added_by)) {
			return res.status(403).json({ error: 'Insufficient permissions' });
		}

		await db.run('DELETE FROM events WHERE id = ?', [id]);
		return res.json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

export default router;

