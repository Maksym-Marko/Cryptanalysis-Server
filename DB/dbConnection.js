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

        // TABLE: market state
        db.prepare(`
            CREATE TABLE IF NOT EXISTS market_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                symbol TEXT NOT NULL,

                price REAL NOT NULL,            -- Current price always exists

                buyWalls INTEGER,               -- Number of buy walls (nullable)
                sellWalls INTEGER,              -- Number of sell walls (nullable)

                nearestBuyPrice REAL,           -- Null if no wall
                nearestBuyStrength REAL,
                nearestBuyDistance REAL,

                nearestSellPrice REAL,          -- Null if no wall
                nearestSellStrength REAL,
                nearestSellDistance REAL,

                trend TEXT,                     -- up/down/neutral (nullable if undefined)

                recentVolatility REAL,          -- Recent Candle volatility

                position TEXT,                  -- Position recommendation (JSON)

                candles TEXT,                   -- Last 3 candles data (JSON)

                updatedAt TEXT NOT NULL         -- Timestamp always exists
            );
        `).run();

        // TABLE: scanner
        db.prepare(`
            CREATE TABLE IF NOT EXISTS scanner (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                score REAL NOT NULL,
                volatility REAL NOT NULL,
                candles TEXT,                   -- Last 3 candles data (JSON)
                updatedAt TEXT NOT NULL
            )
        `).run();

        // TABLE: settings
        db.prepare(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tsls REAL DEFAULT 20,
                tps REAL DEFAULT 60,
                minVol REAL DEFAULT 1.5,
                maxVol REAL DEFAULT 8,
                minVol24 REAL DEFAULT 500000,
                maxVol24 REAL DEFAULT 5000000,
                leverage REAL DEFAULT 2,
                blackList TEXT DEFAULT '[]',
                updatedAt TEXT NOT NULL
            )
        `).run();

        // Initialize settings with default data if table is empty
        const settingsCount = db.prepare(`SELECT COUNT(*) as count FROM settings`).get();
        if (settingsCount.count === 0) {
            db.prepare(`
                INSERT INTO settings (tsls, tps, minVol, maxVol, minVol24, maxVol24, leverage, blackList, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                20,          // tsls
                60,          // tps
                1.5,         // minVol
                8,           // maxVol
                500000,      // minVol24
                5000000,     // maxVol24
                2,           // leverage
                '[]',        // blackList (empty array as JSON string)
                new Date().toISOString()  // updatedAt
            );
            console.log("✓ Settings table initialized with default values.");
        }

        console.log("✓ Database connected and all tables ensured.");
    }

    return db;
}
