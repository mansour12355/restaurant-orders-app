const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { db, initializeDatabase } = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'restaurant-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));


// Serve static files from frontend
app.use(express.static(path.join(__dirname, 'frontend')));


// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket client connected');
    clients.add(ws);

    ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Broadcast to all connected clients
function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Check session
app.get('/api/auth/session', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                role: req.session.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== MENU ROUTES ====================

// Get all menu items
app.get('/api/menu', (req, res) => {
    const { category, available } = req.query;
    let query = 'SELECT * FROM menu_items';
    const params = [];

    if (category || available !== undefined) {
        query += ' WHERE';
        if (category) {
            query += ' category = ?';
            params.push(category);
        }
        if (available !== undefined) {
            if (category) query += ' AND';
            query += ' available = ?';
            params.push(available === 'true' ? 1 : 0);
        }
    }

    query += ' ORDER BY category, name';

    db.all(query, params, (err, items) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(items);
    });
});

// Get single menu item
app.get('/api/menu/:id', (req, res) => {
    db.get('SELECT * FROM menu_items WHERE id = ?', [req.params.id], (err, item) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!item) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json(item);
    });
});

// Create menu item (admin only)
app.post('/api/menu', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, description, price, category, image_url } = req.body;

    if (!name || !price || !category) {
        return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    db.run(
        'INSERT INTO menu_items (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)',
        [name, description, price, category, image_url],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            db.get('SELECT * FROM menu_items WHERE id = ?', [this.lastID], (err, item) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                broadcast({ type: 'menu_updated', action: 'created', item });
                res.status(201).json(item);
            });
        }
    );
});

// Update menu item (admin only)
app.put('/api/menu/:id', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, description, price, category, image_url, available } = req.body;

    db.run(
        `UPDATE menu_items 
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         price = COALESCE(?, price),
         category = COALESCE(?, category),
         image_url = COALESCE(?, image_url),
         available = COALESCE(?, available)
     WHERE id = ?`,
        [name, description, price, category, image_url, available, req.params.id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Menu item not found' });
            }

            db.get('SELECT * FROM menu_items WHERE id = ?', [req.params.id], (err, item) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                broadcast({ type: 'menu_updated', action: 'updated', item });
                res.json(item);
            });
        }
    );
});

// Delete menu item (admin only)
app.delete('/api/menu/:id', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        broadcast({ type: 'menu_updated', action: 'deleted', id: req.params.id });
        res.json({ success: true, message: 'Menu item deleted' });
    });
});

// ==================== ORDER ROUTES ====================

// Get all orders (admin only)
app.get('/api/orders', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.query;
    let query = 'SELECT * FROM orders';
    const params = [];

    if (status) {
        query += ' WHERE status = ?';
        params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, orders) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        // Get order items for each order
        const ordersWithItems = [];
        let processed = 0;

        if (orders.length === 0) {
            return res.json([]);
        }

        orders.forEach(order => {
            db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id], (err, items) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                ordersWithItems.push({ ...order, items });
                processed++;

                if (processed === orders.length) {
                    res.json(ordersWithItems);
                }
            });
        });
    });
});

// Get single order
app.get('/api/orders/:id', (req, res) => {
    db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id], (err, items) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ ...order, items });
        });
    });
});

// Create order
app.post('/api/orders', (req, res) => {
    const { customer_name, customer_phone, customer_email, items, total_amount, notes } = req.body;

    if (!customer_name || !customer_phone || !items || items.length === 0 || !total_amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.run(
        `INSERT INTO orders (customer_name, customer_phone, customer_email, total_amount, notes, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
        [customer_name, customer_phone, customer_email, total_amount, notes],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            const orderId = this.lastID;
            const stmt = db.prepare(
                'INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, price) VALUES (?, ?, ?, ?, ?)'
            );

            items.forEach(item => {
                stmt.run(orderId, item.menuItemId, item.name, item.quantity, item.price);
            });

            stmt.finalize((err) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (err, orderItems) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }

                        const fullOrder = { ...order, items: orderItems };
                        broadcast({ type: 'new_order', order: fullOrder });
                        res.status(201).json(fullOrder);
                    });
                });
            });
        }
    );
});

// Update order status (admin only)
app.put('/api/orders/:id/status', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.run(
        'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, req.params.id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Order not found' });
            }

            db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                db.all('SELECT * FROM order_items WHERE order_id = ?', [req.params.id], (err, items) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    const fullOrder = { ...order, items };
                    broadcast({ type: 'order_updated', order: fullOrder });
                    res.json(fullOrder);
                });
            });
        }
    );
});

// ==================== INITIALIZE & START ====================

initializeDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════╗
║   🍔 Restaurant Orders Server Ready    ║
╠════════════════════════════════════════╣
║  Server: http://localhost:${PORT}       ║
║  Admin:  http://localhost:${PORT}/admin.html
║                                        ║
║  Default Admin Credentials:            ║
║  Username: admin                       ║
║  Password: admin123                    ║
╚════════════════════════════════════════╝
      `);
        });
    })
    .catch(err => {
        console.error('❌ Failed to initialize database:', err);
        process.exit(1);
    });
