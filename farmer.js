// Farmer Dashboard JavaScript

let currentUser = null;
let socket = null;
let marketPrices = {};
let currentChatRoom = null;

// Initialize farmer dashboard
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const auth = checkAuth();
    if (!auth) return;
    
    currentUser = auth.user;
    
    // Update UI with user info
    updateUserInfo();
    
    // Initialize socket for real-time chat
    socket = initSocket();
    
    // Load initial data
    await loadDashboardData();
    await loadMarketPrices();
    
    // Initialize event listeners
    initEventListeners();
    
    // Show initial section
    initSections();
    
    // Check for unread messages
    checkUnreadMessages();
});

// Update user information in UI
function updateUserInfo() {
    if (!currentUser) return;
    
    // Update username displays
    const userNameElements = document.querySelectorAll('#userName, #farmerName');
    userNameElements.forEach(el => {
        if (el) el.textContent = currentUser.fullName || currentUser.username;
    });
    
    // Update profile info if on profile section
    updateProfileInfo();
}

// Initialize event listeners
function initEventListeners() {
    // Product form submission
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleAddProduct);
    }
    
    // Product name input for market price lookup
    const productNameInput = document.getElementById('productName');
    if (productNameInput) {
        productNameInput.addEventListener('input', debounce(async function() {
            await updateMarketPriceForProduct(this.value);
        }, 500));
    }
    
    // Price input for comparison
    const priceInput = document.getElementById('pricePerUnit');
    if (priceInput) {
        priceInput.addEventListener('input', updatePriceComparison);
    }
    
    // Socket event handlers
    if (socket) {
        socket.on('receive-message', handleIncomingMessage);
        socket.on('chat-history', handleChatHistory);
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load farmer's products
        const productsResponse = await apiRequest('/products/my-products');
        if (productsResponse?.success) {
            updateProductsDashboard(productsResponse.products);
        }
        
        // Load farmer's orders
        const ordersResponse = await apiRequest('/orders/farmer-orders');
        if (ordersResponse?.success) {
            updateOrdersDashboard(ordersResponse.orders);
        }
        
        // Load recent orders for dashboard
        updateRecentOrders();
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Load market prices
async function loadMarketPrices() {
    try {
        const response = await apiRequest('/market-prices');
        if (response?.success) {
            marketPrices = response.prices || {};
            updateMarketPricesDisplay();
        }
    } catch (error) {
        console.error('Failed to load market prices:', error);
    }
}

// Update products on dashboard
function updateProductsDashboard(products) {
    if (!products) return;
    
    const activeProducts = products.filter(p => p.isAvailable).length;
    document.getElementById('activeProducts').textContent = activeProducts;
    document.getElementById('productsChange').textContent = `${products.length} total listed`;
    
    // Update products grid if on products section
    if (document.getElementById('productsGrid')) {
        displayProducts(products);
    }
}

// Update orders on dashboard
function updateOrdersDashboard(orders) {
    if (!orders) return;
    
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const totalEarnings = deliveredOrders.reduce((sum, order) => sum + order.farmerAmount, 0);
    
    document.getElementById('pendingOrders').textContent = pendingOrders;
    document.getElementById('totalEarnings').textContent = formatCurrency(totalEarnings);
    document.getElementById('ordersChange').textContent = `${orders.length} total orders`;
    
    // Update total products stat
    document.getElementById('totalProductsStat').textContent = 
        document.getElementById('activeProducts').textContent;
    document.getElementById('totalOrdersStat').textContent = orders.length;
    
    const successRate = orders.length > 0 ? 
        Math.round((deliveredOrders.length / orders.length) * 100) : 0;
    document.getElementById('successRate').textContent = `${successRate}%`;
}

// Update recent orders display
function updateRecentOrders() {
    const recentOrdersContainer = document.getElementById('recentOrders');
    if (!recentOrdersContainer) return;
    
    // This would be populated from actual API call
    const mockOrders = [
        { id: 'ORD001', product: 'Tomato', quantity: '100 kg', amount: '₹3,000', status: 'pending' },
        { id: 'ORD002', product: 'Potato', quantity: '200 kg', amount: '₹3,600', status: 'confirmed' },
        { id: 'ORD003', product: 'Onion', quantity: '150 kg', amount: '₹4,200', status: 'delivered' }
    ];
    
    recentOrdersContainer.innerHTML = mockOrders.map(order => `
        <div class="order-item">
            <div class="order-info">
                <h4>${order.product}</h4>
                <p>${order.quantity} • ${order.amount}</p>
            </div>
            <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
        </div>
    `).join('');
}

// Update market prices display
function updateMarketPricesDisplay() {
    const marketPricesContainer = document.getElementById('marketPrices');
    const marketTipsContainer = document.getElementById('marketTips');
    
    if (!marketPricesContainer && !marketTipsContainer) return;
    
    // Get top 5 products
    const topProducts = Object.entries(marketPrices)
        .slice(0, 5)
        .map(([product, data]) => ({
            product,
            price: data.price,
            trend: data.trend,
            change: data.change
        }));
    
    if (marketPricesContainer) {
        marketPricesContainer.innerHTML = topProducts.map(item => `
            <div class="price-item">
                <span>${item.product.toUpperCase()}</span>
                <div>
                    <span class="price">₹${item.price}/kg</span>
                    <span class="price-change ${item.trend}">
                        ${item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'} ${item.change}%
                    </span>
                </div>
            </div>
        `).join('');
    }
    
    if (marketTipsContainer) {
        const tips = [
            'Tomato prices are rising due to high demand',
            'Consider holding potato stock for better prices next week',
            'Onion market is stable - good time to sell',
            'Mango season starting - prices expected to drop'
        ];
        
        marketTipsContainer.innerHTML = `
            <ul>
                ${tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        `;
    }
}

// Update market price for specific product
async function updateMarketPriceForProduct(productName) {
    if (!productName.trim()) return;
    
    try {
        const response = await apiRequest(`/market-prices?product=${productName.toLowerCase()}`);
        if (response?.success) {
            const marketPrice = response.price || 25;
            document.getElementById('marketPriceValue').textContent = `₹${marketPrice}`;
            document.getElementById('marketAverageDisplay').textContent = `₹${marketPrice}/unit`;
            
            // Update price comparison
            const yourPrice = parseFloat(document.getElementById('pricePerUnit').value) || 0;
            updatePriceDisplay(yourPrice, marketPrice);
        }
    } catch (error) {
        console.error('Failed to fetch market price:', error);
    }
}

// Update price comparison display
function updatePriceComparison() {
    const yourPrice = parseFloat(document.getElementById('pricePerUnit').value) || 0;
    const marketPrice = parseFloat(document.getElementById('marketPriceValue').textContent.replace('₹', '')) || 0;
    
    updatePriceDisplay(yourPrice, marketPrice);
}

function updatePriceDisplay(yourPrice, marketPrice) {
    document.getElementById('yourPriceDisplay').textContent = `₹${yourPrice}/unit`;
    
    if (marketPrice > 0) {
        const difference = ((yourPrice - marketPrice) / marketPrice * 100);
        const adviceElement = document.getElementById('priceAdvice');
        
        if (yourPrice === 0) {
            adviceElement.textContent = 'Enter your price';
            adviceElement.className = 'advice-neutral';
        } else if (difference > 20) {
            adviceElement.textContent = 'Price too high';
            adviceElement.className = 'advice-warning';
        } else if (difference > 10) {
            adviceElement.textContent = 'Above market';
            adviceElement.className = 'advice-warning';
        } else if (difference < -10) {
            adviceElement.textContent = 'Good deal!';
            adviceElement.className = 'advice-good';
        } else if (difference < -20) {
            adviceElement.textContent = 'Great price!';
            adviceElement.className = 'advice-good';
        } else {
            adviceElement.textContent = 'Market price';
            adviceElement.className = 'advice-neutral';
        }
    }
}

// Handle add product
async function handleAddProduct(event) {
    event.preventDefault();
    
    const productName = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const quantityValue = parseFloat(document.getElementById('quantityValue').value);
    const quantityUnit = document.getElementById('quantityUnit').value;
    const pricePerUnit = parseFloat(document.getElementById('pricePerUnit').value);
    const qualityGrade = document.getElementById('qualityGrade').value;
    const description = document.getElementById('productDescription').value.trim();
    const harvestDate = document.getElementById('harvestDate').value;
    const tags = document.getElementById('productTags').value.trim();
    
    // Validation
    if (!productName || !category || !quantityValue || !pricePerUnit) {
        showNotification('Please fill all required fields', 'warning');
        return;
    }
    
    if (quantityValue <= 0) {
        showNotification('Quantity must be greater than 0', 'warning');
        return;
    }
    
    if (pricePerUnit <= 0) {
        showNotification('Price must be greater than 0', 'warning');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding Product...';
    
    try {
        const response = await apiRequest('/products/add', {
            method: 'POST',
            body: {
                productName,
                category,
                description,
                quantity: {
                    value: quantityValue,
                    unit: quantityUnit
                },
                pricePerUnit,
                qualityGrade,
                harvestDate: harvestDate || new Date().toISOString().split('T')[0],
                tags: tags ? tags.split(',').map(t => t.trim()) : []
            }
        });
        
        if (response?.success) {
            showNotification('Product added successfully!', 'success');
            
            // Reset form
            event.target.reset();
            document.getElementById('marketPriceValue').textContent = '₹0';
            document.getElementById('priceAdvice').textContent = 'Enter product name';
            document.getElementById('priceAdvice').className = 'advice-neutral';
            
            // Reload products
            await loadDashboardData();
            
            // Switch to products section
            showSection('products');
        } else {
            showNotification(response?.message || 'Failed to add product', 'error');
        }
    } catch (error) {
        showNotification('Failed to add product. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Display products in grid
function displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-apple-alt" style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
                <h3>No Products Yet</h3>
                <p>Start by adding your first product!</p>
                <button class="btn btn-primary" onclick="showSection('addProduct')">
                    <i class="fas fa-plus"></i> Add First Product
                </button>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = products.map(product => `
        <div class="product-card">
            <div class="product-image">
                <i class="fas fa-apple-alt" style="font-size: 3rem; color: #7f8c8d;"></i>
            </div>
            <div class="product-content">
                <div class="product-header">
                    <h3>${product.productName}</h3>
                    <span class="product-category">${product.category}</span>
                </div>
                <div class="product-meta">
                    <span>${product.quantity.value} ${product.quantity.unit}</span>
                    <span>Harvest: ${formatDate(product.harvestDate)}</span>
                </div>
                <div class="product-price">
                    <div class="price-row">
                        <span class="market-price">Market: ₹${product.marketPrice}/${product.quantity.unit}</span>
                        <span class="your-price">₹${product.pricePerUnit}/${product.quantity.unit}</span>
                    </div>
                    <div class="price-row">
                        <span>${product.qualityGrade.toUpperCase()}</span>
                        <span class="${product.pricePerUnit < product.marketPrice ? 'savings' : ''}">
                            ${product.pricePerUnit < product.marketPrice ? 'Good Deal' : 'Check Price'}
                        </span>
                    </div>
                </div>
                <div class="product-status ${product.isAvailable ? 'status-available' : 'status-sold'}">
                    ${product.isAvailable ? 'Available' : 'Sold Out'}
                </div>
                <div class="product-actions">
                    <button class="edit" onclick="editProduct('${product._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete" onclick="deleteProduct('${product._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter products
function filterProducts() {
    const filter = document.getElementById('productFilter').value;
    const search = document.getElementById('productSearch').value.toLowerCase();
    
    // This would filter the products array in a real implementation
    console.log('Filtering products:', { filter, search });
    // In production, you would filter the products array and re-render
}

// Search products
const searchProducts = debounce(function() {
    filterProducts();
}, 300);

// Edit product
async function editProduct(productId) {
    try {
        const response = await apiRequest(`/products/${productId}`);
        if (response?.success) {
            const product = response.product;
            
            // Populate form
            document.getElementById('productName').value = product.productName;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('quantityValue').value = product.quantity.value;
            document.getElementById('quantityUnit').value = product.quantity.unit;
            document.getElementById('pricePerUnit').value = product.pricePerUnit;
            document.getElementById('qualityGrade').value = product.qualityGrade;
            document.getElementById('productDescription').value = product.description || '';
            document.getElementById('harvestDate').value = product.harvestDate.split('T')[0];
            document.getElementById('productTags').value = product.tags?.join(', ') || '';
            
            // Update market price display
            document.getElementById('marketPriceValue').textContent = `₹${product.marketPrice}`;
            updatePriceDisplay(product.pricePerUnit, product.marketPrice);
            
            // Change form to edit mode
            const form = document.getElementById('productForm');
            form.dataset.editId = productId;
            form.onsubmit = handleEditProduct;
            
            // Update submit button text
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Product';
            
            // Switch to add product section
            showSection('addProduct');
        }
    } catch (error) {
        showNotification('Failed to load product details', 'error');
    }
}

// Handle edit product
async function handleEditProduct(event) {
    event.preventDefault();
    
    const productId = event.target.dataset.editId;
    const productName = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const quantityValue = parseFloat(document.getElementById('quantityValue').value);
    const quantityUnit = document.getElementById('quantityUnit').value;
    const pricePerUnit = parseFloat(document.getElementById('pricePerUnit').value);
    const qualityGrade = document.getElementById('qualityGrade').value;
    const description = document.getElementById('productDescription').value.trim();
    const harvestDate = document.getElementById('harvestDate').value;
    const tags = document.getElementById('productTags').value.trim();
    
    // Validation
    if (!productName || !category || !quantityValue || !pricePerUnit) {
        showNotification('Please fill all required fields', 'warning');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';
    
    try {
        const response = await apiRequest(`/products/${productId}`, {
            method: 'PUT',
            body: {
                productName,
                category,
                description,
                quantity: {
                    value: quantityValue,
                    unit: quantityUnit
                },
                pricePerUnit,
                qualityGrade,
                harvestDate: harvestDate || new Date().toISOString().split('T')[0],
                tags: tags ? tags.split(',').map(t => t.trim()) : []
            }
        });
        
        if (response?.success) {
            showNotification('Product updated successfully!', 'success');
            
            // Reset form and switch back to normal mode
            event.target.reset();
            delete event.target.dataset.editId;
            event.target.onsubmit = handleAddProduct;
            
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Add Product';
            
            // Reload products
            await loadDashboardData();
            
            // Switch to products section
            showSection('products');
        } else {
            showNotification(response?.message || 'Failed to update product', 'error');
        }
    } catch (error) {
        showNotification('Failed to update product. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        const response = await apiRequest(`/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (response?.success) {
            showNotification('Product deleted successfully', 'success');
            await loadDashboardData();
        } else {
            showNotification(response?.message || 'Failed to delete product', 'error');
        }
    } catch (error) {
        showNotification('Failed to delete product', 'error');
    }
}

// Update profile info
function updateProfileInfo() {
    if (!currentUser) return;
    
    document.getElementById('profileName').textContent = currentUser.fullName || currentUser.username;
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileMobile').textContent = currentUser.mobile;
    document.getElementById('profileRating').textContent = `${currentUser.rating || 0}/5.0`;
    
    if (currentUser.location) {
        const locationStr = [currentUser.location.district, currentUser.location.state]
            .filter(Boolean).join(', ');
        document.getElementById('profileLocation').textContent = locationStr || 'Not specified';
    }
    
    if (currentUser.createdAt) {
        const memberSince = new Date(currentUser.createdAt).getFullYear();
        document.getElementById('memberSince').textContent = memberSince;
    }
}

// Edit profile
function editProfile() {
    showNotification('Edit profile feature coming soon!', 'info');
}

// Change password
function changePassword() {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        showNotification('Password change feature coming soon!', 'info');
    } else if (newPassword) {
        showNotification('Password must be at least 6 characters', 'warning');
    }
}

// Update location
function updateLocation() {
    const location = prompt('Enter your location (District, State):');
    if (location) {
        showNotification('Location update feature coming soon!', 'info');
    }
}

// Verify account
function verifyAccount() {
    showNotification('Account verification feature coming soon!', 'info');
}

// Delete account
function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        showNotification('Account deletion feature coming soon!', 'info');
    }
}

// Chat functions
function checkUnreadMessages() {
    // Check for unread messages
    // This would make an API call in production
    const unreadCount = 0; // Mock value
    if (unreadCount > 0) {
        const messagesLink = document.querySelector('a[onclick*="messages"]');
        if (messagesLink) {
            messagesLink.innerHTML += ` <span class="badge">${unreadCount}</span>`;
        }
    }
}

function startNewChat() {
    showNotification('New chat feature coming soon!', 'info');
}

function handleIncomingMessage(data) {
    // Handle incoming message
    if (currentChatRoom === data.roomId) {
        // Add message to current chat
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${data.sender === currentUser.id ? 'sent' : 'received'}`;
            messageDiv.innerHTML = `
                <p>${data.message}</p>
                <div class="message-time">${timeAgo(data.timestamp)}</div>
            `;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    } else {
        // Show notification for new message in other chat
        showNotification(`New message from ${data.senderName}`, 'info');
    }
}

function handleChatHistory(history) {
    // Display chat history
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = history.map(msg => `
            <div class="message ${msg.sender === currentUser.id ? 'sent' : 'received'}">
                <p>${msg.message}</p>
                <div class="message-time">${timeAgo(msg.timestamp)}</div>
            </div>
        `).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentChatRoom) return;
    
    if (socket) {
        socket.emit('send-message', {
            roomId: currentChatRoom,
            message: message,
            sender: currentUser.id,
            senderName: currentUser.fullName || currentUser.username
        });
        
        // Clear input
        messageInput.value = '';
    }
}

// Global handlers for socket events
window.handleIncomingMessage = handleIncomingMessage;
window.handleChatHistory = handleChatHistory;