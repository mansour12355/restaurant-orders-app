// Configuration
const API_URL = '/api';
const WS_URL = `ws://${window.location.host}`;


// State
let currentUser = null;
let orders = [];
let menuItems = [];
let currentView = 'orders';
let currentFilter = 'all';
let editingMenuItem = null;
let ws = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupLoginForm();
});

// ==================== AUTHENTICATION ====================

async function checkSession() {
    try {
        const response = await fetch(`${API_URL}/auth/session`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.authenticated) {
            currentUser = data.user;
            showDashboard();
        }
    } catch (error) {
        console.error('Session check failed:', error);
    }
}

function setupLoginForm() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                currentUser = data.user;
                showDashboard();
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    });
}

async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        currentUser = null;
        if (ws) ws.close();

        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('loginForm').reset();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function showDashboard() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('dashboard').style.display = 'grid';
    document.getElementById('adminName').textContent = currentUser.username;

    initializeWebSocket();
    setupDashboard();
    fetchOrders();
    fetchMenu();
}

// ==================== WEBSOCKET ====================

function initializeWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('✅ WebSocket connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (currentUser) {
            setTimeout(initializeWebSocket, 3000);
        }
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_order':
            orders.unshift(data.order);
            renderOrders();
            updatePendingBadge();
            showNotification('New order received! 🔔');
            break;
        case 'order_updated':
            const index = orders.findIndex(o => o.id === data.order.id);
            if (index !== -1) {
                orders[index] = data.order;
                renderOrders();
                updatePendingBadge();
            }
            break;
        case 'menu_updated':
            fetchMenu();
            break;
    }
}

function showNotification(message) {
    // Simple notification (could be enhanced with a toast library)
    console.log('📢', message);
}

// ==================== DASHBOARD SETUP ====================

function setupDashboard() {
    // View switching
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.getAttribute('onclick')) return; // Skip logout button

            e.preventDefault();
            const view = item.dataset.view;
            if (view) switchView(view);
        });
    });

    // Status filter
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.status;
            renderOrders();
        });
    });

    // Add menu item button
    document.getElementById('addMenuItemBtn').addEventListener('click', () => {
        editingMenuItem = null;
        openMenuItemModal();
    });

    // Menu item form
    document.getElementById('cancelMenuItem').addEventListener('click', closeMenuItemModal);
    document.getElementById('menuItemForm').addEventListener('submit', handleMenuItemSubmit);
}

function switchView(view) {
    currentView = view;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === view) {
            item.classList.add('active');
        }
    });

    // Update content
    document.getElementById('ordersView').style.display = view === 'orders' ? 'block' : 'none';
    document.getElementById('menuView').style.display = view === 'menu' ? 'block' : 'none';

    // Update header
    document.getElementById('viewTitle').textContent = view === 'orders' ? 'Orders Management' : 'Menu Management';
    document.getElementById('addMenuItemBtn').style.display = view === 'menu' ? 'block' : 'none';
}

// ==================== ORDERS ====================

async function fetchOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            credentials: 'include'
        });

        if (response.ok) {
            orders = await response.json();
            renderOrders();
            updatePendingBadge();
        }
    } catch (error) {
        console.error('Error fetching orders:', error);
    }
}

function updatePendingBadge() {
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    document.getElementById('pendingBadge').textContent = pendingCount;
}

function renderOrders() {
    const ordersGrid = document.getElementById('ordersGrid');

    let filteredOrders = currentFilter === 'all'
        ? orders
        : orders.filter(o => o.status === currentFilter);

    if (filteredOrders.length === 0) {
        ordersGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>No orders found</p>
      </div>
    `;
        return;
    }

    ordersGrid.innerHTML = filteredOrders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <div class="order-info">
          <h3>Order #${order.id}</h3>
          <div class="order-meta">
            <div><strong>Customer:</strong> ${order.customer_name}</div>
            <div><strong>Phone:</strong> ${order.customer_phone}</div>
            ${order.customer_email ? `<div><strong>Email:</strong> ${order.customer_email}</div>` : ''}
            <div><strong>Time:</strong> ${new Date(order.created_at).toLocaleString()}</div>
            ${order.notes ? `<div><strong>Notes:</strong> ${order.notes}</div>` : ''}
          </div>
        </div>
        <span class="order-status-badge status-${order.status}">
          ${order.status}
        </span>
      </div>

      <div class="order-items">
        <h4>Items</h4>
        ${order.items.map(item => `
          <div class="order-item">
            <span>${item.quantity}x ${item.menu_item_name}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>

      <div class="order-total">
        <span>Total:</span>
        <span class="order-total-amount">$${order.total_amount.toFixed(2)}</span>
      </div>

      <div class="order-actions">
        ${order.status === 'pending' ? `
          <button class="btn-primary" onclick="updateOrderStatus(${order.id}, 'preparing')">
            Start Preparing
          </button>
        ` : ''}
        ${order.status === 'preparing' ? `
          <button class="btn-success" onclick="updateOrderStatus(${order.id}, 'ready')">
            Mark as Ready
          </button>
        ` : ''}
        ${order.status === 'ready' ? `
          <button class="btn-success" onclick="updateOrderStatus(${order.id}, 'completed')">
            Complete Order
          </button>
        ` : ''}
        ${order.status !== 'completed' && order.status !== 'cancelled' ? `
          <button class="btn-danger" onclick="updateOrderStatus(${order.id}, 'cancelled')">
            Cancel
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            const updatedOrder = await response.json();
            const index = orders.findIndex(o => o.id === orderId);
            if (index !== -1) {
                orders[index] = updatedOrder;
                renderOrders();
                updatePendingBadge();
            }
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Failed to update order status');
    }
}

// ==================== MENU ====================

async function fetchMenu() {
    try {
        const response = await fetch(`${API_URL}/menu`);
        menuItems = await response.json();
        renderMenuItems();
    } catch (error) {
        console.error('Error fetching menu:', error);
    }
}

function renderMenuItems() {
    const menuGrid = document.getElementById('adminMenuGrid');

    if (menuItems.length === 0) {
        menuGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🍽️</div>
        <p>No menu items found</p>
      </div>
    `;
        return;
    }

    menuGrid.innerHTML = menuItems.map(item => `
    <div class="menu-card">
      <img src="${item.image_url}" alt="${item.name}" class="menu-card-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect fill=%22%231e1e28%22 width=%22400%22 height=%22200%22/%3E%3Ctext fill=%22%23667eea%22 font-family=%22Arial%22 font-size=%2218%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
      <div class="menu-card-content">
        <span class="menu-card-category">${item.category}</span>
        <span class="availability-badge ${item.available ? 'available' : 'unavailable'}">
          ${item.available ? 'Available' : 'Unavailable'}
        </span>
        <div class="menu-card-header">
          <h3>${item.name}</h3>
          <span class="menu-card-price">$${item.price.toFixed(2)}</span>
        </div>
        <p class="menu-card-description">${item.description || 'No description'}</p>
        <div class="menu-card-actions">
          <button class="btn-primary" onclick="editMenuItem(${item.id})">Edit</button>
          <button class="btn-danger" onclick="deleteMenuItem(${item.id})">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openMenuItemModal(item = null) {
    editingMenuItem = item;

    if (item) {
        document.getElementById('menuModalTitle').textContent = 'Edit Menu Item';
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemDescription').value = item.description || '';
        document.getElementById('itemPrice').value = item.price;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemImageUrl').value = item.image_url || '';
        document.getElementById('itemAvailable').checked = item.available === 1;
    } else {
        document.getElementById('menuModalTitle').textContent = 'Add Menu Item';
        document.getElementById('menuItemForm').reset();
    }

    document.getElementById('menuItemModal').classList.add('active');
}

function closeMenuItemModal() {
    document.getElementById('menuItemModal').classList.remove('active');
    document.getElementById('menuItemForm').reset();
    editingMenuItem = null;
}

function editMenuItem(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (item) {
        openMenuItemModal(item);
    }
}

async function handleMenuItemSubmit(e) {
    e.preventDefault();

    const itemData = {
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        category: document.getElementById('itemCategory').value,
        image_url: document.getElementById('itemImageUrl').value,
        available: document.getElementById('itemAvailable').checked ? 1 : 0
    };

    try {
        const url = editingMenuItem
            ? `${API_URL}/menu/${editingMenuItem.id}`
            : `${API_URL}/menu`;

        const method = editingMenuItem ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(itemData)
        });

        if (response.ok) {
            await fetchMenu();
            closeMenuItemModal();
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to save menu item');
        }
    } catch (error) {
        console.error('Error saving menu item:', error);
        alert('Failed to save menu item');
    }
}

async function deleteMenuItem(itemId) {
    if (!confirm('Are you sure you want to delete this menu item?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/menu/${itemId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            await fetchMenu();
        } else {
            alert('Failed to delete menu item');
        }
    } catch (error) {
        console.error('Error deleting menu item:', error);
        alert('Failed to delete menu item');
    }
}
