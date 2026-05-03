const express = require('express');
const mysql = require('mysql2');
const app = express();

app.use(express.static('public'));
const PORT = 3000;

const pool = mysql.createPool({
    host: 'localhost',
    user: 'demo',
    password: '1234',
    database: 'Cars',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
    } else {
        console.log('Successfully connected to the Cars database!');
        connection.release();
    }
});

// --- NEW TEST ROUTE ---
app.get('/ping', (req, res) => {
    console.log("-> /ping route was requested!");
    res.send("PONG! Express is working perfectly.");
});

app.get('/api/inventory', (req, res) => {
    console.log("-> /api/inventory requested. Asking MySQL for data...");
    
    const query = 'SELECT * FROM AvailableInventoryByBodyType';
    
    pool.query(query, (err, results) => {
        if (err) {
            console.error("-> MySQL Error:", err);
            return res.status(500).send('Database connection error');
        }
        
        console.log("-> Success! Data received from MySQL. Sending to browser...");
        res.json(results);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is listening on all network interfaces at port ${PORT}`);
});

