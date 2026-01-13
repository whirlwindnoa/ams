import sqlite3 from 'sqlite3';

class Database {
    constructor(name) {
        this.name = name;
        this.#init();
    }

    async #init() {
        var connection = await new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(process.env.DATABASE_PATH, sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                console.log('connected to the database');
                resolve();
            });
        });

        // create tables & fill them out
        // elevation -> (0: normal user, 1: staff, 2: admin)
        this.run(
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                elevation INTEGER NOT NULL DEFAULT 0 CHECK (elevation IN (0, 1, 2, 3)),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`
        )
        .then(async () => {
            const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@admin.com';
            const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123';

            await this.run('INSERT OR IGNORE INTO users (email, password, elevation, created_at) VALUES (?, ?, 3, ?)', [adminEmail, adminPassword, Date.now()]);
        });

        this.run(
            `CREATE TABLE IF NOT EXISTS sessions (
                token TEXT NOT NULL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`
        );

        this.run(
            `CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date DATETIME,
                booked INTEGER NOT NULL DEFAULT 0,
                capacity INTEGER NOT NULL,
                status TEXT NOT NULL,
                added_by INTEGER NOT NULL,
                venue INTEGER,
                FOREIGN KEY (venue) REFERENCES venues(id) ON DELETE CASCADE,
                FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
            )`
        );

        this.run(
            `CREATE TABLE IF NOT EXISTS venues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                capacity INTEGER NOT NULL,
                image TEXT
            )`
        );

        this.run(
            `CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )`
        );

        return connection;
    }

    // returns a template function for all three methods
    // run -> no return value
    // get -> first matching result
    // all -> all matching results
    #query(method) {
        return (query, params = []) => new Promise((resolve, reject) => {
            this.db[method](query, params, (err, result) => {
                if (err) {
                    console.error(err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    // assign the return value of the template function to actual methods
    run = this.#query('run');
    get = this.#query('get');
    all = this.#query('all');
}

export default new Database('AMS');
