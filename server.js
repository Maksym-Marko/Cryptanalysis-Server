import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import "./ws.js";
import { broadcast } from "./ws.js";
import dbConnection from "./DB/dbConnection.js";

const app = express();
app.use(cors());
app.use(express.json());

const db = dbConnection();

// GET /orders with filters
app.get("/orders", (req, res) => {
  try {
    const { status, symbol, side } = req.query;

    let query = "SELECT * FROM orders WHERE 1=1";
    const params = [];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    if (symbol) {
      query += " AND symbol = ?";
      params.push(symbol);
    }

    if (side) {
      query += " AND side = ?";
      params.push(side);
    }

    query += " ORDER BY id DESC";

    const rows = db.prepare(query).all(...params);
    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET order by order_id
app.get("/orders/:order_id", (req, res) => {
  try {
    const order_id = req.params.order_id;

    const row = db.prepare(`
      SELECT * FROM orders
      WHERE order_id = ?
      LIMIT 1
    `).get(order_id);

    if (!row) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(row);

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

// POST save log
app.post("/api/save-log", (req, res) => {
  try {
    const log = req.body;

    const stmt = db.prepare(`
      INSERT INTO logs (
        action, status, message, order_index, order_id, clientOrderId, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      log.action,            // required
      log.status ?? null,
      log.message ?? null,
      log.order_index ?? null,
      log.order_id ?? null,
      log.clientOrderId ?? null,
      log.timestamp ?? Math.floor(Date.now() / 1000) // Unix seconds
    );

    // Notify dashboard to reload logs
    broadcast({ type: "logs_updated" });

    res.json({
      success: true,
      lastInsertRowid: result.lastInsertRowid
    });

  } catch (err) {
    console.error("Error saving log:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE order by order_id (partial update)
app.put("/orders/:order_id", (req, res) => {
  try {
    const order_id = req.params.order_id;
    const data = req.body; // fields to update

    // Convert body keys to SQL fields:   { status: "closed", pnl_usdt: 12 }
    const fields = Object.keys(data);
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields provided for update" });
    }

    // Build "field = ?" parts:
    const setClause = fields.map(f => `${f} = ?`).join(", ");
    const values = fields.map(f => data[f]);

    const stmt = db.prepare(`
      UPDATE orders
      SET ${setClause}
      WHERE order_id = ?
    `);

    const result = stmt.run(...values, order_id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Notify dashboard to reload logs
    broadcast({ type: "orders_updated" });

    return res.json({ success: true });

  } catch (err) {
    console.error("Update order failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// start backend
app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});
