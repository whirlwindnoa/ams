import sqlite3 from 'sqlite3';

class Database {
    constructor(name) {
        this.name = name;
        this.#init();
    }

    async #init() {
        console.log(process.env.DATABASE_PATH);
        var connection = await new Promise((resolve, reject) => {
            // connect to the database
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
                elevation INTEGER NOT NULL DEFAULT 0 CHECK (elevation IN (0, 2)),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`
        )
        .then(async () => {
            // whatever, make it add admin user with id 1 later
        });

        this.run(
            `CREATE TABLE IF NOT EXISTS sessions (
                token TEXT NOT NULL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`
        );

        return connection;
    }

    // returns a template function for all three methods (run, get, all)
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
