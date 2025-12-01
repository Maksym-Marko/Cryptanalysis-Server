import Database from "better-sqlite3";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

export default function dbConnection() {
    if (!db) {
        // open database
        db = new Database(__dirname + "/bot.db", {
            verbose: console.log
        });

        // TABLE: orders
        db.prepare(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                symbol TEXT NOT NULL,
                order_id TEXT,
                position_id TEXT,

                side TEXT CHECK(side IN ('LONG', 'SHORT')) NOT NULL,
                order_type TEXT NOT NULL,

                leverage REAL,
                amount_usdt REAL NOT NULL,

                open_time INTEGER NOT NULL,
                open_price REAL NOT NULL,

                ai_prediction TEXT CHECK(ai_prediction IN ('up','down','neutral')),
                ai_reason TEXT,

                latest_update_time INTEGER,
                latest_price REAL,

                tlsl REAL,
                target_profit_percent REAL,

                status TEXT CHECK(status IN ('open','filled','closed','cancelled')) DEFAULT 'open',

                close_reason TEXT,
                close_time INTEGER,
                close_price REAL,

                pnl_usdt REAL,
                pnl_percent REAL,

                note TEXT
            )
        `).run();

        // TABLE: logs
        db.prepare(`
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                status TEXT CHECK(status IN ('success', 'error', 'warning')) DEFAULT 'success',
                message TEXT,
                order_index INTEGER NULL,
                order_id INTEGER NULL,
                clientOrderId TEXT NULL,
                timestamp INTEGER DEFAULT (strftime('%s','now'))
            )
        `).run();

        console.log("✓ Database connected and all tables ensured.");
    }

    return db;
}
