import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import "./ws.js";
import { broadcast } from "./ws.js";

const app = express();
app.use(cors());
app.use(express.json());

// open SQLite DB
const db = new Database("./DB/bot.db", { verbose: console.log });

// GET orders
app.get("/orders", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET logs
app.get("/logs", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM logs ORDER BY id DESC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save order
app.post("/api/save-order", (req, res) => {
  try {
    const order = req.body;

    const stmt = db.prepare(`
      INSERT INTO orders (
        symbol, order_id, position_id, side, order_type, leverage, amount_usdt,
        open_time, open_price, ai_prediction, ai_reason,
        latest_update_time, latest_price, tlsl, target_profit_percent,
        status, close_reason, close_time, close_price, pnl_usdt, pnl_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      order.symbol,
      order.order_id,
      order.position_id,
      order.side,
      order.order_type,
      order.leverage,
      order.amount_usdt,
      order.open_time,
      order.open_price,
      order.ai_prediction,
      order.ai_reason,
      order.latest_update_time,
      order.latest_price,
      order.tlsl,
      order.target_profit_percent,
      order.status,
      order.close_reason,
      order.close_time,
      order.close_price,
      order.pnl_usdt,
      order.pnl_percent
    );

    // Notify dashboard
    broadcast({ type: "orders_updated" });

    res.json({
      success: true,
      lastInsertRowid: result.lastInsertRowid
    });

  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).json({ error: err.message });
  }
});


// start backend
app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});
