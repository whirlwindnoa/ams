"use strict";

import 'dotenv/config';

import { fileURLToPath } from 'url';

import fs from 'fs';
import path from 'path';
import express from 'express';
import art from 'express-art-template';
import cookieParser from 'cookie-parser';

import db from './src/db.js'
import { cookieCache } from './src/stores.js';
import portalRouter from './src/portal.js';
import authRouter from './src/auth.js';

if(!fs.existsSync('.env')) {
    fs.copyFileSync('.env.template', '.env');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.engine('art', art);
app.set("views", "./views");
app.set('view engine', 'art');
app.set('view options', {
    debug: process.env.NODE_ENV !== 'production',
    ignore: ['Math', 'Date', 'JSON', 'encodeURIComponent', 'unescape', 'btoa', 'atob'],
    minimize: false
});

app.use(express.static(path.join(__dirname, '/static')));

app.use(cookieParser());
app.use(async (req, res, next) => { // on every request to the server
    if (req.cookies.token) {
        if (!cookieCache[req.cookies.token]) {
            const token = req.cookies.token;
            const session = await db.get('SELECT * FROM sessions WHERE token = ?', [token]);

            if (session) {
                const user = await db.get('SELECT * FROM users WHERE id = ?', [session.user_id]);

                if(user) {
                    if(session.expires - Date.now() < 6.048e+8) { // 1 week, refresh session
                        await db.run('UPDATE sessions SET expires = ? WHERE token = ?', [Date.now() + 2.628e+9, token]); // month
                        res.cookie('token', token, { maxAge: 2.628e+9, httpOnly: true, secure: env.NODE_ENV === "production", domain: `.${env.DOMAIN}`, sameSite: 'lax' });
                    }
                    delete user.password; 
                    req.user = user; // assign the session user to req for access
                    user.token = token;
                    cookieCache[token] = user;
                }
            } else { // delete token from cache and cookie
                res.clearCookie('token');
                delete cookieCache[token];
            }
        }
        else {
            req.user = cookieCache[req.cookies.token];
        }
    }

    next();
});

app.use('/api/auth', authRouter); // routing to auth related endpoints
app.use(portalRouter); // routing to render pages

app.listen(process.env.PORT, () => {
    console.log("application listening on port 3000");
});