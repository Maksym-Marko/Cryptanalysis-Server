import db from './dbConnection.js';

function readLogs(limit = 100) {
    try {
        return db.prepare(`
            SELECT * FROM logs
            ORDER BY id DESC
            LIMIT ?
        `).all(limit);

    } catch (err) {
        console.error('Error reading logs:', err.message);
        return [];
    }
}

export default readLogs;

/*
const logs = readLogs(50);
*/