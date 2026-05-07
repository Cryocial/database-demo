const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const app = express();

const publicDir = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;

app.use(express.static(publicDir));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'cars-demo-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

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
                '  Windows: open "Services" (services.msc), start "MySQL" or "MySQL80".\n' +
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

// ========================================
// UNPROTECTED ROUTES
// ========================================

app.get('/ping', (req, res) => {
    res.send('PONG! Express is working perfectly.');
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    pool.query(
        'SELECT UserID, FirstName, LastName, UserRole FROM UserInfo WHERE Email = ? AND Password = ?',
        [email, password],
        (err, rows) => {
            if (err) {
                console.error('Login DB error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!rows.length) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            const u = rows[0];
            req.session.user = {
                id: u.UserID,
                name: `${u.FirstName} ${u.LastName}`,
                role: u.UserRole
            };
            res.json({ name: req.session.user.name, role: req.session.user.role });
        }
    );
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    res.json(req.session.user);
});

app.post('/api/register', (req, res) => {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    pool.query('SELECT UserID FROM UserInfo WHERE Email = ?', [email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (rows.length) return res.status(409).json({ error: 'Email is already in use' });

        pool.query(
            `INSERT INTO UserInfo (FirstName, LastName, Phone, Email, Password, AddressID, UserRole)
             VALUES (?, ?, '000-000-0000', ?, ?, 1, 'Buyer')`,
            [firstName, lastName, email, password],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
                        return res.status(400).json({
                            error: 'Password must be 8+ characters and include uppercase, lowercase, a number, and a special character (e.g. Admin123!)'
                        });
                    }
                    console.error('Register error:', err);
                    return res.status(500).json({ error: err.message });
                }
                req.session.user = { id: result.insertId, name: `${firstName} ${lastName}`, role: 'Buyer' };
                res.json({ name: req.session.user.name, role: 'Buyer' });
            }
        );
    });
});

// ========================================
// AUTH MIDDLEWARE (protects all /api/* below)
// ========================================

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

app.use('/api', requireAuth);

// ========================================
// PROTECTED API ROUTES
// ========================================

app.get('/api/inventory', (req, res) => {
    pool.query('SELECT * FROM AvailableInventoryByBodyType', (err, results) => {
        if (err) {
            console.error('-> MySQL Error (inventory):', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.get('/api/monthly-sales', (req, res) => {
    pool.query('SELECT * FROM MonthlySalesByBodyType', (err, results) => {
        if (err) {
            console.error('-> MySQL Error (monthly-sales):', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.get('/api/high-performing-stores', (req, res) => {
    pool.query('SELECT * FROM HighPerformingStores', (err, results) => {
        if (err) {
            console.error('-> MySQL Error (high-performing-stores):', err);
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
            console.error('-> MySQL Error (store-zips):', err);
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
            console.error('-> MySQL Error (vehicles):', err);
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
            console.error('-> MySQL Error (transactions):', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

app.get('/api/stores', (req, res) => {
    pool.query('SELECT StoreID, StoreName FROM Store ORDER BY StoreName', (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

// Admin: list available vehicles
app.get('/api/admin/vehicles', requireAdmin, (req, res) => {
    const query = `
        SELECT v.VehicleID, v.Brand, v.Model, v.Year, v.Price, v.BodyStyle, v.FuelType, s.StoreName
        FROM Vehicle v
        JOIN Store s ON v.StoreID = s.StoreID
        LEFT JOIN Transactions t ON t.VehicleID = v.VehicleID
        WHERE t.TransID IS NULL
        ORDER BY s.StoreName, v.Brand, v.Model
    `;
    pool.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(results);
    });
});

// Admin: insert vehicle
app.post('/api/admin/vehicles', requireAdmin, (req, res) => {
    const {
        Brand, Model, Year, Mileage, Price, ExteriorColor, InteriorColor,
        SeatingCapacity, VehicleCondition, BodyStyle, FuelType, Drivetrain,
        Transmission, MPG, RangeMiles, StoreID
    } = req.body || {};

    if (!Brand || !Model || !Year || Mileage == null || !Price || !VehicleCondition ||
        !BodyStyle || !FuelType || !Drivetrain || !Transmission || !StoreID) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
        INSERT INTO Vehicle (Brand, Model, Year, Mileage, Price, ExteriorColor, InteriorColor,
            SeatingCapacity, VehicleCondition, BodyStyle, FuelType, Drivetrain, Transmission,
            MPG, RangeMiles, StoreID)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    pool.query(sql, [
        Brand, Model, Number(Year), Number(Mileage), Number(Price),
        ExteriorColor || null, InteriorColor || null,
        SeatingCapacity ? Number(SeatingCapacity) : null,
        VehicleCondition, BodyStyle, FuelType, Drivetrain, Transmission,
        MPG ? Number(MPG) : null, RangeMiles ? Number(RangeMiles) : null,
        Number(StoreID)
    ], (err, result) => {
        if (err) {
            console.error('Insert vehicle error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ ok: true, VehicleID: result.insertId });
    });
});

// Admin: delete vehicle (unsold only)
app.delete('/api/admin/vehicles/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid vehicle ID' });

    pool.query('SELECT COUNT(*) AS cnt FROM Transactions WHERE VehicleID = ?', [id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (rows[0].cnt > 0) {
            return res.status(409).json({ error: 'Cannot delete a vehicle that has already been sold' });
        }
        pool.query('DELETE FROM VehicleFeatMap WHERE VehicleID = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            pool.query('DELETE FROM Vehicle WHERE VehicleID = ?', [id], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehicle not found' });
                res.json({ ok: true });
            });
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is listening on all network interfaces at port ${PORT}`);
});
