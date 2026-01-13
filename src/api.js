import express from 'express';
import db from './db.js';

import { cookieCache } from './stores.js';
import { venueUpload } from './upload.js';

import fs from 'fs';
import path from 'path';

const router = express.Router();

// elevations
// 0 - unapproved account
// 1 - regular staff
// 2 - admin/manager
// 3 - superuser

async function refreshUserCacheForUserId(userId) {
  const fresh = await db.get('SELECT id, email, elevation FROM users WHERE id = ?', [userId]);
  if (!fresh) return;
  const sessions = await db.all('SELECT token FROM sessions WHERE user_id = ?', [userId]);

  for (const s of sessions) {
    const token = s.token;
    if (cookieCache[token]) {
      cookieCache[token] = { ...cookieCache[token], ...fresh, token };
    }
  }
}

// venue management stuff  including file uplaod 
router.post('/venues/create', venueUpload.single('image'), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.elevation < 3) return res.status(403).json({ error: 'Insufficient permissions' });

    const { name, location, capacity } = req.body || {};
    const cap = Number(capacity);

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Invalid venue name' });
    }
    if (!location || typeof location !== 'string' || location.trim().length < 2) {
      return res.status(400).json({ error: 'Invalid venue location' });
    }
    if (!Number.isInteger(cap) || cap < 1) {
      return res.status(400).json({ error: 'Invalid capacity' });
    }

    const imagePath = req.file ? `/uploads/venues/${req.file.filename}` : null;

    await db.run(
      `INSERT INTO venues (name, location, capacity, image) VALUES (?, ?, ?, ?)`,
      [name.trim(), location.trim(), cap, imagePath]
    );

    const row = await db.get(`SELECT last_insert_rowid() AS id`);
    const venue = await db.get(`SELECT * FROM venues WHERE id = ?`, [row.id]);

    return res.json({ success: true, venue });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/venues/:id/delete', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.elevation < 2) return res.status(403).json({ error: 'Admins only' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid venue id' });
    }

    const venue = await db.get(`SELECT image FROM venues WHERE id = ?`, [id]);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    if (venue.image) {
      const imagePath = path.join(process.cwd(), 'static', venue.image);

      fs.unlink(imagePath, err => {
        if (err && err.code !== 'ENOENT') {
          console.error('Failed to delete image:', err);
        }
      });
    }

    await db.run(`DELETE FROM venues WHERE id = ?`, [id]);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// USER MANAGEMENT ROUTES!!!!!!!!!!!!!!!!!!!!!!!!!!
router.delete('/users/:id', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!req.user || req.user.elevation < 2) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.id === Number(req.params.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.elevation >= req.user.elevation) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    await db.run('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [req.user.id, `Deleted user with email ${user.email}`]);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/promote', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!req.user || req.user.elevation < 2) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.elevation == 2) {
      return res.status(400).json({ error: 'User is already at highest elevation' });
    }
    if (user.elevation >= req.user.elevation) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await db.run('UPDATE users SET elevation = elevation + 1 WHERE id = ?', [id]);

    refreshUserCacheForUserId(id);

    await db.run('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [req.user.id, `Promoted user with email ${user.email} to Manager`]);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/demote', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!req.user || req.user.elevation < 2) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.elevation == 0) {
      return res.status(400).json({ error: 'User is already at lowest elevation' });
    } 
    if (user.elevation >= req.user.elevation) {

      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await db.run('UPDATE users SET elevation = elevation - 1 WHERE id = ?', [id]);

    refreshUserCacheForUserId(id);

    await db.run('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [req.user.id, `Demoted user with email ${user.email} to Staff`]);
    
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// EVENT API ROUTES!!!!!!!!!!!!!!!!!!!!!!!!!!
// all events
router.get('/events', async (req, res) => {
	try {
    const events = await db.all(`
      SELECT
        events.*,
        users.email AS added_by_email
      FROM events
      LEFT JOIN users ON users.id = events.added_by
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

    const { name, date, time, booked, status, capacity, venue } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'Invalid or missing name (min 3 chars)' });
    }

    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      return res.status(400).json({ error: 'Invalid capacity' });
    }

    if (booked > cap) {
      return res.status(400).json({ error: 'Booked seats cannot exceed capacity' });
    }

    // time fomrating stuff millis into human readable date and time 
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

    await db.run(`INSERT INTO events (name, date, booked, capacity, status, venue, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,[name.trim(), unixTime, booked, cap, status, venue, req.user.id]);

    await db.run('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [req.user.id, `Added event ${name}`]);
    return res.redirect('/dashboard/events');

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// delete event
router.delete('/events/:id', express.urlencoded({ extended: false }), async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ error: 'Authentication required' });

		const id = Number(req.params.id);
		if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

		const ev = await db.get('SELECT * FROM events WHERE id = ?', [id]);
		if (!ev) return res.status(404).json({ error: 'Event not found' });

		// allow deletion if admin/staff or creator
		if (!(req.user.elevation == 2 || req.user.id === ev.added_by)) {
			return res.status(403).json({ error: 'Insufficient permissions' });
		}

		await db.run('DELETE FROM events WHERE id = ?', [id]);
    await db.run('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [req.user.id, `Deleted event ${ev.name}`]);
		return res.json({ success: true });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

// edit event
router.post('/events/:id/edit', express.urlencoded({ extended: false }), async (req, res) => {
  try {
		if (!req.user) return res.status(401).json({ error: 'Authentication required' });

		const id = Number(req.params.id);
		if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

		const ev = await db.get('SELECT * FROM events WHERE id = ?', [id]);
		if (!ev) return res.status(404).json({ error: 'Event not found' });

		// allow editing if admin/staff or creator
		if (!(req.user.elevation == 2 || req.user.id === ev.added_by)) {
			return res.status(403).json({ error: 'Insufficient permissions' });
		}

    const { name, date, time, booked, status, capacity, venue } = req.body || {};

    if (capacity > 9999) {
      return res.status(400).json({ error: 'You cannot have higher capacity than 9999' });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'Invalid or missing name (min 3 chars)' });
    }

    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      return res.status(400).json({ error: 'Invalid capacity' });
    }

    if (booked > cap) {
      return res.status(400).json({ error: 'Booked seats cannot exceed capacity' });
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

    await db.run(`UPDATE events SET name = ?, date = ?, booked = ?, capacity = ?, status = ?, venue = ? WHERE id = ?`,[name.trim(), unixTime, booked, cap, status, venue, id]);
    await db.run('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [req.user.id, `Edited event ${ev.name} into ${name}`]);
    return res.redirect('/dashboard/events');
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: 'Internal server error' });
	}
});

export default router;

