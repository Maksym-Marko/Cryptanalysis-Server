import db from './dbConnection.js';

function readOrders(filter = {}) {
    try {
        let query = `SELECT * FROM orders`;
        const conditions = [];
        const params = [];

        if (filter.symbol) {
            conditions.push(`symbol = ?`);
            params.push(filter.symbol);
        }

        if (filter.status) {
            conditions.push(`status = ?`);
            params.push(filter.status);
        }

        if (filter.side) {
            conditions.push(`side = ?`);
            params.push(filter.side);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }

        query += ` ORDER BY id DESC`;

        return db.prepare(query).all(...params);

    } catch (err) {
        console.error('Error reading orders:', err.message);
        return [];
    }
}

export default readOrders;

/*
const rows = readOrders({ symbol: 'TAUSDT' });
const rows = readOrders({ status: 'open' });
*/