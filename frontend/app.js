// Configuration
const API_URL = '/api';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;



// State
let menuItems = [];
let cart = [];
let currentOrder = null;
let ws = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    fetchMenu();
    initializeWebSocket();
    setupEventListeners();
});

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
        console.log('WebSocket disconnected. Reconnecting...');
        setTimeout(initializeWebSocket, 3000);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'order_updated':
            if (currentOrder && data.order.id === currentOrder.id) {
                updateOrderStatus(data.order.status);
            }
            break;
        case 'menu_updated':
            fetchMenu();
            break;
    }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Cart
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.getElementById('closeCart').addEventListener('click', closeCart);
    document.getElementById('checkoutBtn').addEventListener('click', openCheckout);

    // Order Modal
    document.getElementById('cancelOrder').addEventListener('click', closeOrderModal);
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);

    // Confirmation Modal
    document.getElementById('closeConfirmation').addEventListener('click', closeConfirmationModal);
}

// ==================== MENU ====================

async function fetchMenu() {
    try {
        const response = await fetch(`${API_URL}/menu?available=true`);
        menuItems = await response.json();
        renderMenu();
        renderCategoryFilter();
    } catch (error) {
        console.error('Error fetching menu:', error);
        document.getElementById('menuGrid').innerHTML = '<p style="text-align: center; color: rgba(248, 249, 250, 0.7);">Failed to load menu. Please refresh the page.</p>';
    }
}

function renderCategoryFilter() {
    const categories = ['all', ...new Set(menuItems.map(item => item.category))];
    const filterContainer = document.getElementById('categoryFilter');

    filterContainer.innerHTML = categories.map(category => `
    <button class="category-btn ${category === 'all' ? 'active' : ''}" data-category="${category}">
      ${category === 'all' ? 'All' : category}
    </button>
  `).join('');

    // Add event listeners
    filterContainer.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterContainer.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterMenu(btn.dataset.category);
        });
    });
}

function filterMenu(category) {
    const filtered = category === 'all'
        ? menuItems
        : menuItems.filter(item => item.category === category);
    renderMenu(filtered);
}

function renderMenu(items = menuItems) {
    const menuGrid = document.getElementById('menuGrid');

    if (items.length === 0) {
        menuGrid.innerHTML = '<p style="text-align: center; color: rgba(248, 249, 250, 0.7);">No items found in this category.</p>';
        return;
    }

    menuGrid.innerHTML = items.map(item => `
    <div class="menu-item" data-id="${item.id}">
      <img src="${item.image_url}" alt="${item.name}" class="menu-item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22220%22%3E%3Crect fill=%22%231e1e28%22 width=%22400%22 height=%22220%22/%3E%3Ctext fill=%22%23667eea%22 font-family=%22Arial%22 font-size=%2218%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
      <div class="menu-item-content">
        <span class="menu-item-category">${item.category}</span>
        <div class="menu-item-header">
          <h3>${item.name}</h3>
          <span class="menu-item-price">$${item.price.toFixed(2)}</span>
        </div>
        <p class="menu-item-description">${item.description || 'Delicious item from our menu'}</p>
        <button class="add-to-cart-btn" onclick="addToCart(${item.id})">
          Add to Cart
        </button>
      </div>
    </div>
  `).join('');
}

// ==================== CART ====================

function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(itemId) {
    const menuItem = menuItems.find(item => item.id === itemId);
    if (!menuItem) return;

    const existingItem = cart.find(item => item.id === itemId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            image_url: menuItem.image_url,
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();

    // Visual feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.style.background = 'linear-gradient(135deg, #00d2d3 0%, #00f2fe 100%)';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 1000);
}

function updateCartQuantity(itemId, change) {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(itemId);
    } else {
        saveCart();
        updateCartUI();
    }
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
    updateCartUI();
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    cartCount.textContent = totalItems;
    cartTotal.textContent = `$${totalAmount.toFixed(2)}`;

    if (cart.length === 0) {
        cartItems.innerHTML = `
      <div class="empty-cart">
        <div class="empty-cart-icon">🛒</div>
        <p>Your cart is empty</p>
      </div>
    `;
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image_url}" alt="${item.name}" class="cart-item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect fill=%22%231e1e28%22 width=%2280%22 height=%2280%22/%3E%3Ctext fill=%22%23667eea%22 font-family=%22Arial%22 font-size=%2212%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          <div class="cart-item-controls">
            <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, -1)">-</button>
            <span class="quantity-display">${item.quantity}</span>
            <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, 1)">+</button>
            <button class="remove-item" onclick="removeFromCart(${item.id})">Remove</button>
          </div>
        </div>
      </div>
    `).join('');
        checkoutBtn.disabled = false;
    }
}

function openCart() {
    document.getElementById('cartSidebar').classList.add('open');
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('open');
}

// ==================== CHECKOUT ====================

function openCheckout() {
    closeCart();
    document.getElementById('orderModal').classList.add('active');
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
    document.getElementById('orderForm').reset();
}

async function handleOrderSubmit(e) {
    e.preventDefault();

    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const notes = document.getElementById('orderNotes').value;

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderData = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        notes: notes || null,
        total_amount: totalAmount,
        items: cart.map(item => ({
            menuItemId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price
        }))
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error('Failed to place order');
        }

        const order = await response.json();
        currentOrder = order;

        // Clear cart
        cart = [];
        saveCart();
        updateCartUI();

        // Close order modal and show confirmation
        closeOrderModal();
        showOrderConfirmation(order);

    } catch (error) {
        console.error('Error placing order:', error);
        alert('Failed to place order. Please try again.');
    }
}

function showOrderConfirmation(order) {
    document.getElementById('orderIdDisplay').textContent = order.id;
    updateOrderStatus(order.status);
    document.getElementById('confirmationModal').classList.add('active');
}

function updateOrderStatus(status) {
    const badge = document.getElementById('statusBadge');
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    badge.className = `status-badge status-${status}`;
}

function closeConfirmationModal() {
    document.getElementById('confirmationModal').classList.remove('active');
    currentOrder = null;
}
