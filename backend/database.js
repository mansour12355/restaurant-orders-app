const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'restaurant.db');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Menu items table
      db.run(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          category TEXT NOT NULL,
          image_url TEXT,
          available INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Orders table
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          customer_email TEXT,
          total_amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Order items table
      db.run(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          menu_item_id INTEGER NOT NULL,
          menu_item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          price REAL NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          seedDatabase().then(resolve).catch(reject);
        }
      });
    });
  });
}

async function seedDatabase() {
  return new Promise((resolve, reject) => {
    // Check if admin user exists
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        // Create admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          ['admin', hashedPassword, 'admin'],
          (err) => {
            if (err) console.error('Error creating admin user:', err);
          }
        );
      }

      // Check if menu items exist
      db.get('SELECT id FROM menu_items LIMIT 1', [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          // Seed menu items
          const menuItems = [
            {
              name: 'Classic Burger',
              description: 'Juicy beef patty with lettuce, tomato, and special sauce',
              price: 12.99,
              category: 'Burgers',
              image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'
            },
            {
              name: 'Cheeseburger Deluxe',
              description: 'Double beef patty with cheddar cheese, bacon, and caramelized onions',
              price: 15.99,
              category: 'Burgers',
              image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400'
            },
            {
              name: 'Veggie Burger',
              description: 'Plant-based patty with avocado, sprouts, and chipotle mayo',
              price: 11.99,
              category: 'Burgers',
              image_url: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400'
            },
            {
              name: 'Margherita Pizza',
              description: 'Fresh mozzarella, basil, and tomato sauce on thin crust',
              price: 14.99,
              category: 'Pizza',
              image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400'
            },
            {
              name: 'Pepperoni Pizza',
              description: 'Classic pepperoni with mozzarella and marinara',
              price: 16.99,
              category: 'Pizza',
              image_url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400'
            },
            {
              name: 'BBQ Chicken Pizza',
              description: 'Grilled chicken, BBQ sauce, red onions, and cilantro',
              price: 17.99,
              category: 'Pizza',
              image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400'
            },
            {
              name: 'Caesar Salad',
              description: 'Romaine lettuce, parmesan, croutons, and Caesar dressing',
              price: 9.99,
              category: 'Salads',
              image_url: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400'
            },
            {
              name: 'Greek Salad',
              description: 'Tomatoes, cucumbers, olives, feta cheese, and olive oil',
              price: 10.99,
              category: 'Salads',
              image_url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400'
            },
            {
              name: 'French Fries',
              description: 'Crispy golden fries with sea salt',
              price: 4.99,
              category: 'Sides',
              image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400'
            },
            {
              name: 'Onion Rings',
              description: 'Beer-battered onion rings with ranch dip',
              price: 5.99,
              category: 'Sides',
              image_url: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400'
            },
            {
              name: 'Coca Cola',
              description: 'Classic Coca Cola (330ml)',
              price: 2.99,
              category: 'Drinks',
              image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400'
            },
            {
              name: 'Fresh Lemonade',
              description: 'Homemade lemonade with mint',
              price: 3.99,
              category: 'Drinks',
              image_url: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?w=400'
            }
          ];

          const stmt = db.prepare(
            'INSERT INTO menu_items (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)'
          );

          menuItems.forEach(item => {
            stmt.run(item.name, item.description, item.price, item.category, item.image_url);
          });

          stmt.finalize((err) => {
            if (err) {
              reject(err);
            } else {
              console.log('✅ Database seeded with sample data');
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  });
}

module.exports = { db, initializeDatabase };
