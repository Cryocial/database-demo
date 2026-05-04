const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const app = express();

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
const PORT = Number(process.env.PORT) || 3000;

// Use 127.0.0.1 so Node does not prefer IPv6 (::1) when MySQL only listens on IPv4.
const dbConfig = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'demo',
    password: process.env.MYSQL_PASSWORD || '1234',
    database: process.env.MYSQL_DATABASE || 'Cars',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

function logDbTarget() {
    const { host, port, user, database } = dbConfig;
    console.log(`MySQL target: ${user}@${host}:${port} / ${database}`);
}

function mysqlHelp(err) {
    if (err && err.code === 'ECONNREFUSED') {
        console.error(
            '\n  MySQL refused the connection (nothing listening on that host/port). ' +
                'Start the database server first, then run your DDL.\n' +
                '  Windows: open "Services" (services.msc), start "MySQL" or "MySQL80", ' +
                'or install MySQL / XAMPP / Laragon if you have not yet.\n' +
                '  Override: set MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.\n'
        );
    }
}

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Could not open a MySQL connection:', err.code || err.message);
        mysqlHelp(err);
    } else {
        console.log('Successfully connected to the Cars database.');
        connection.release();
    }
});

logDbTarget();

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
            return res.status(500).json({ error: 'Database error' });
        }

        console.log("-> Success! Data received from MySQL. Sending to browser...");
        res.json(results);
    });
});

app.get('/api/monthly-sales', (req, res) => {
    pool.query('SELECT * FROM MonthlySalesByBodyType', (err, results) => {
        if (err) {
            console.error("-> MySQL Error (monthly-sales):", err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.get('/api/high-performing-stores', (req, res) => {
    pool.query('SELECT * FROM HighPerformingStores', (err, results) => {
        if (err) {
            console.error("-> MySQL Error (high-performing-stores):", err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.get('/api/store-zips', (req, res) => {
    const query = `
        SELECT DISTINCT a.ZipCode, z.City, z.State
        FROM Store s
        JOIN Address a ON s.AddressID = a.AddressID
        JOIN ZipCodeData z ON a.ZipCode = z.ZipCode
        ORDER BY a.ZipCode
    `;
    pool.query(query, (err, results) => {
        if (err) {
            console.error("-> MySQL Error (store-zips):", err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.get('/api/vehicles', (req, res) => {
    const zip = typeof req.query.zip === 'string' ? req.query.zip.trim() : '';
    const query = `
        SELECT
            v.VehicleID,
            v.Brand,
            v.Model,
            v.Year,
            v.Mileage,
            v.ExteriorColor,
            v.InteriorColor,
            v.SeatingCapacity,
            v.Price,
            v.VehicleCondition,
            v.BodyStyle,
            v.FuelType,
            v.Drivetrain,
            v.Transmission,
            v.MPG,
            v.RangeMiles,
            s.StoreName,
            CONCAT_WS(' ', a.StreetNo, a.StreetName,
                IF(a.ApartmentNo IS NULL OR a.ApartmentNo = '', '', CONCAT('#', a.ApartmentNo)),
                z.City, z.State, a.ZipCode) AS StoreAddress,
            a.ZipCode AS StoreZip
        FROM Vehicle v
        JOIN Store s ON v.StoreID = s.StoreID
        JOIN Address a ON s.AddressID = a.AddressID
        JOIN ZipCodeData z ON a.ZipCode = z.ZipCode
        LEFT JOIN Transactions t ON t.VehicleID = v.VehicleID
        WHERE t.TransID IS NULL
        ${zip ? 'AND a.ZipCode = ?' : ''}
        ORDER BY s.StoreName, v.Brand, v.Model
    `;
    const params = zip ? [zip] : [];
    pool.query(query, params, (err, results) => {
        if (err) {
            console.error("-> MySQL Error (vehicles):", err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.get('/api/transactions', (req, res) => {
    const query = `
        SELECT
            t.TransID,
            t.SalePrice,
            t.PurchaseDate,
            CONCAT(u.FirstName, ' ', u.LastName) AS BuyerName,
            u.Email AS BuyerEmail,
            v.VehicleID,
            v.Brand,
            v.Model,
            v.Year,
            v.BodyStyle,
            s.StoreName
        FROM Transactions t
        JOIN UserInfo u ON t.BuyerID = u.UserID
        JOIN Vehicle v ON t.VehicleID = v.VehicleID
        JOIN Store s ON v.StoreID = s.StoreID
        ORDER BY t.PurchaseDate DESC, t.TransID DESC
        LIMIT 75
    `;
    pool.query(query, (err, results) => {
        if (err) {
            console.error("-> MySQL Error (transactions):", err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is listening on all network interfaces at port ${PORT}`);
});

