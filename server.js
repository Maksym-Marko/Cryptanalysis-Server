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


// GET order by id
app.get("/orders/:id", (req, res) => {
  try {
    const id = req.params.id;

    const row = db.prepare(`
      SELECT * FROM orders
      WHERE id = ?
      LIMIT 1
    `).get(id);

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
    const rows = db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 200").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET market state
app.get("/market-state", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM market_state ORDER BY id DESC LIMIT 100").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Insert to market state by symbol
app.post("/market-state", (req, res) => {
  try {
    const marketState = req.body;
    const stmt = db.prepare("INSERT INTO market_state (symbol, price, buyWalls, sellWalls, nearestBuyPrice, nearestBuyStrength, nearestBuyDistance, nearestSellPrice, nearestSellStrength, nearestSellDistance, trend, recentVolatility, position, candles, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const result = stmt.run(marketState.symbol, marketState.price, marketState.buyWalls, marketState.sellWalls, marketState.nearestBuyPrice, marketState.nearestBuyStrength, marketState.nearestBuyDistance, marketState.nearestSellPrice, marketState.nearestSellStrength, marketState.nearestSellDistance, marketState.trend, marketState.recentVolatility, marketState.position || null, marketState.candles || null, marketState.updatedAt);
    
    // Notify dashboard
    broadcast({ type: "market_state_updated" });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE market state by symbol
app.put("/market-state/:symbol", (req, res) => {
  try {
    const symbol = req.params.symbol;
    const data = req.body;
    const stmt = db.prepare("UPDATE market_state SET price = ?, buyWalls = ?, sellWalls = ?, nearestBuyPrice = ?, nearestBuyStrength = ?, nearestBuyDistance = ?, nearestSellPrice = ?, nearestSellStrength = ?, nearestSellDistance = ?, trend = ?, recentVolatility = ?, position = ?, candles = ?, updatedAt = ? WHERE symbol = ?");
    const result = stmt.run(data.price, data.buyWalls, data.sellWalls, data.nearestBuyPrice, data.nearestBuyStrength, data.nearestBuyDistance, data.nearestSellPrice, data.nearestSellStrength, data.nearestSellDistance, data.trend, data.recentVolatility, data.position || null, data.candles || null, data.updatedAt, symbol);
    
    // Notify dashboard
    broadcast({ type: "market_state_updated" });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE market state by symbol
app.delete("/market-state/:symbol", (req, res) => {
  try {
    const symbol = req.params.symbol;
    const stmt = db.prepare("DELETE FROM market_state WHERE symbol = ?");
    const result = stmt.run(symbol);

    // Notify dashboard
    broadcast({ type: "market_state_updated" });

    res.json({ success: true, changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE stale market state entries (older than specified seconds)
app.delete("/market-state/stale/:seconds", (req, res) => {
  try {
    const seconds = parseInt(req.params.seconds);
    const cutoffTime = new Date(Date.now() - seconds * 1000).toISOString();
    
    const stmt = db.prepare("DELETE FROM market_state WHERE updatedAt < ?");
    const result = stmt.run(cutoffTime);

    // Notify dashboard
    broadcast({ type: "market_state_updated" });

    res.json({ 
      success: true, 
      deletedCount: result.changes,
      cutoffTime: cutoffTime
    });
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
        status, close_reason, close_time, close_price, pnl_usdt, pnl_percent, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      order.pnl_percent,
      order.note
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
app.put("/orders/:order_index", (req, res) => {
  try {
    const order_index = req.params.order_index;
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
      WHERE id = ?
    `);

    const result = stmt.run(...values, order_index);

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

// POST save scanner
app.post("/api/save-scanner", (req, res) => {
  try {
    const scanner = req.body;
    const stmt = db.prepare("INSERT INTO scanner (symbol, score, volatility, candles, updatedAt) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(scanner.symbol, scanner.score, scanner.volatility, scanner.candles || null, scanner.updatedAt);

    // Notify dashboard
    broadcast({ type: "scanner_updated" });

    res.json(result);
  } catch (err) {
    console.error("Error saving scanner:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET scanner
app.get("/api/get-scanner", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM scanner ORDER BY id DESC LIMIT 100").all();
    res.json(rows);
  } catch (err) {
    console.error("Error getting scanner:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE scanner by symbol
app.put("/api/update-scanner/:symbol", (req, res) => {
  try {
    const symbol = req.params.symbol;
    const data = req.body;
    const stmt = db.prepare("UPDATE scanner SET score = ?, volatility = ?, candles = ?, updatedAt = ? WHERE symbol = ?");
    const result = stmt.run(data.score, data.volatility, data.candles || null, data.updatedAt, symbol);
    
    // Notify dashboard
    broadcast({ type: "scanner_updated" });

    res.json(result);
  }
  catch (err) {
    console.error("Error updating scanner:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete scanner by symbol
app.delete("/api/delete-scanner/:symbol", (req, res) => {
  try {
    const symbol = req.params.symbol;
    const stmt = db.prepare("DELETE FROM scanner WHERE symbol = ?");
    const result = stmt.run(symbol);

    // Notify dashboard
    broadcast({ type: "scanner_updated" });

    res.json(result);
  } 
  catch (err) {
    console.error("Error deleting scanner:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET settings
app.get("/api/settings", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM settings LIMIT 1").get();
    
    if (!row) {
      return res.status(404).json({ error: "Settings not found" });
    }

    // Parse blackList from JSON string to array
    const settings = {
      ...row,
      blackList: JSON.parse(row.blackList || '[]')
    };

    res.json(settings);
  } catch (err) {
    console.error("Error getting settings:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update settings
app.put("/api/settings", (req, res) => {
  try {
    const { tsls, tps, minVol, maxVol, minVol24, maxVol24, leverage, blackList } = req.body;

    // Convert blackList array to JSON string
    const blackListStr = JSON.stringify(blackList || []);

    const stmt = db.prepare(`
      UPDATE settings 
      SET tsls = ?, tps = ?, minVol = ?, maxVol = ?, minVol24 = ?, maxVol24 = ?, leverage = ?, blackList = ?, updatedAt = ?
      WHERE id = 1
    `);

    const result = stmt.run(
      tsls,
      tps,
      minVol,
      maxVol,
      minVol24,
      maxVol24,
      leverage,
      blackListStr,
      new Date().toISOString()
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Settings not found" });
    }

    // Notify dashboard
    broadcast({ type: "settings_updated" });

    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ error: err.message });
  }
});

// start backend
app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});
