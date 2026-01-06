// Buyer Dashboard JavaScript

let currentUser = null;
let socket = null;
let marketPrices = {};
let currentChatRoom = null;
let currentPage = 1;
let totalPages = 1;
let currentProducts = [];

// Initialize buyer dashboard
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
    await loadProducts();
    await loadMarketPrices();
    
    // Initialize event listeners
    initEventListeners();
    
    // Show initial section
    initSections();
    
    // Start price ticker animation
    startPriceTicker();
});

// Update user information in UI
function updateUserInfo() {
    if (!currentUser) return;
    
    // Update username displays
    const userNameElements = document.querySelectorAll('#buyerName, #buyerProfileName, #buyerProfileUsername');
    userNameElements.forEach((el, index) => {
        if (el) {
            if (el.id === 'buyerProfileName') {
                el.textContent = currentUser.fullName || currentUser.username;
            } else if (el.id === 'buyerProfileUsername') {
                el.textContent = currentUser.username;
            } else {
                el.textContent = currentUser.fullName || currentUser.username;
            }
        }
    });
    
    // Update profile info
    document.getElementById('buyerProfileMobile').textContent = currentUser.mobile;
    
    if (currentUser.location) {
        const locationStr = [currentUser.location.district, currentUser.location.state]
            .filter(Boolean).join(', ');
        document.getElementById('buyerProfileLocation').textContent = locationStr || 'Not specified';
    }
    
    if (currentUser.createdAt) {
        const memberSince = new Date(currentUser.createdAt).getFullYear();
        document.getElementById('buyerMemberSince').textContent = memberSince;
    }
    
    // Update buyer stats (mock data for now)
    document.getElementById('buyerTotalOrders').textContent = '12';
    document.getElementById('moneySaved').textContent = '₹4,500';
    document.getElementById('farmersConnected').textContent = '8';
    document.getElementById('buyerRating').textContent = '4.5';
}

// Initialize event listeners
function initEventListeners() {
    // Global search
    const globalSearchInput = document.getElementById('globalSearch');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                globalSearch();
            }
        });
    }
    
    // Socket event handlers
    if (socket) {
        socket.on('receive-message', handleIncomingMessage);
        socket.on('chat-history', handleChatHistory);
    }
}

// Load products
async function loadProducts(page = 1) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    showLoader(productsGrid);
    
    try {
        const category = document.getElementById('categoryFilter')?.value || '';
        const location = document.getElementById('locationFilter')?.value || '';
        const minPrice = document.getElementById('minPrice')?.value || '';
        const maxPrice = document.getElementById('maxPrice')?.value || '';
        const search = document.getElementById('globalSearch')?.value || '';
        const sort = document.getElementById('sortFilter')?.value || 'newest';
        
        const response = await apiRequest(`/products/all?page=${page}&limit=12&category=${category}&location=${location}&minPrice=${minPrice}&maxPrice=${maxPrice}&search=${search}&sort=${sort}`);
        
        if (response?.success) {
            currentProducts = response.products;
            totalPages = response.pagination?.pages || 1;
            currentPage = page;
            
            displayProducts(currentProducts);
            updatePagination();
        } else {
            productsGrid.innerHTML = '<div class="no-results">Failed to load products</div>';
        }
    } catch (error) {
        productsGrid.innerHTML = '<div class="no-results">Failed to load products</div>';
    }
}

// Display products
function displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search" style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
                <h3>No Products Found</h3>
                <p>Try changing your filters or check back later for new listings.</p>
                <button class="btn btn-outline" onclick="resetFilters()">
                    Reset Filters
                </button>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = products.map(product => `
        <div class="product-card-buyer" onclick="showProductDetails('${product._id}')">
            <div class="product-image-buyer">
                <i class="fas fa-apple-alt" style="font-size: 3rem; color: #7f8c8d;"></i>
            </div>
            <div class="product-content-buyer">
                <div class="product-header-buyer">
                    <h3>${product.productName}</h3>
                    <div class="farmer-info">
                        <i class="fas fa-user"></i>
                        <span>${product.farmerId?.fullName || 'Farmer'}</span>
                        <span class="farmer-rating">★ ${product.farmerId?.rating || 0}</span>
                    </div>
                </div>
                <div class="product-details">
                    <div class="detail-row">
                        <span class="detail-label">Category:</span>
                        <span class="detail-value">${product.category}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Quantity:</span>
                        <span class="detail-value">${product.quantity.value} ${product.quantity.unit}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Location:</span>
                        <span class="detail-value">${product.location?.district || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Quality:</span>
                        <span class="detail-value">${product.qualityGrade.toUpperCase()}</span>
                    </div>
                </div>
                <div class="product-price-buyer">
                    <div class="price-comparison-buyer">
                        <span class="your-price-buyer">₹${product.pricePerUnit}/${product.quantity.unit}</span>
                        <span class="market-price-buyer">Market: ₹${product.marketPrice}/${product.quantity.unit}</span>
                    </div>
                    <div class="savings">
                        ${product.pricePerUnit < product.marketPrice ? 
                            `Save ₹${product.marketPrice - product.pricePerUnit} per unit` : 
                            'Check market price'}
                    </div>
                </div>
                <div class="product-actions-buyer">
                    <button class="btn btn-chat" onclick="event.stopPropagation(); startChatWithFarmer('${product.farmerId?._id}', '${product.farmerId?.fullName}')">
                        <i class="fas fa-comment"></i> Chat
                    </button>
                    <button class="btn btn-buy" onclick="event.stopPropagation(); showOrderModal('${product._id}')">
                        <i class="fas fa-shopping-cart"></i> Buy Now
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update pagination
function updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Prev
        </button>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="changePage(${i})" ${i === currentPage ? 'class="active"' : ''}>
                ${i}
            </button>
        `;
    }
    
    // Next button
    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    loadProducts(page);
}

// Apply filters
const applyFilters = debounce(function() {
    loadProducts(1);
}, 500);

// Reset filters
function resetFilters() {
    document.getElementById('categoryFilter').value = '';
    document.getElementById('locationFilter').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('sortFilter').value = 'newest';
    document.getElementById('globalSearch').value = '';
    
    loadProducts(1);
}

// Global search
function globalSearch() {
    loadProducts(1);
}

// Load market prices
async function loadMarketPrices() {
    try {
        const response = await apiRequest('/market-prices');
        if (response?.success) {
            marketPrices = response.prices || {};
            updatePriceTicker();
        }
    } catch (error) {
        console.error('Failed to load market prices:', error);
    }
}

// Update price ticker
function updatePriceTicker() {
    const priceTicker = document.getElementById('priceTicker');
    if (!priceTicker) return;
    
    const topProducts = Object.entries(marketPrices)
        .slice(0, 8)
        .map(([product, data]) => ({
            product,
            price: data.price,
            trend: data.trend
        }));
    
    priceTicker.innerHTML = topProducts.map(item => `
        <span>${item.product.toUpperCase()}: ₹${item.price}/kg ${item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'}</span>
    `).join('');
}

// Start price ticker animation
function startPriceTicker() {
    const priceTicker = document.getElementById('priceTicker');
    if (!priceTicker) return;
    
    // Clone the content for seamless animation
    priceTicker.innerHTML += priceTicker.innerHTML;
    
    // Calculate animation duration based on content width
    const contentWidth = priceTicker.scrollWidth / 2;
    const duration = contentWidth / 50; // pixels per second
    
    priceTicker.style.animationDuration = `${duration}s`;
}

// Show product details
async function showProductDetails(productId) {
    try {
        const response = await apiRequest(`/products/${productId}`);
        if (response?.success) {
            const product = response.product;
            const modalBody = document.getElementById('productModalBody');
            
            modalBody.innerHTML = `
                <div class="product-modal-header">
                    <div class="product-modal-image">
                        <i class="fas fa-apple-alt" style="font-size: 4rem; color: #7f8c8d;"></i>
                    </div>
                    <div class="product-modal-info">
                        <div class="product-modal-title">
                            <h2>${product.productName}</h2>
                            <span class="product-category">${product.category.toUpperCase()}</span>
                        </div>
                        
                        <div class="farmer-modal-info">
                            <div class="farmer-avatar">
                                ${product.farmerId?.fullName?.charAt(0) || 'F'}
                            </div>
                            <div class="farmer-details">
                                <h4>${product.farmerId?.fullName || 'Farmer'}</h4>
                                <p class="farmer-location">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${product.location?.district || 'Location not specified'}
                                    ${product.farmerId?.rating ? ` • ★ ${product.farmerId.rating}` : ''}
                                </p>
                            </div>
                        </div>
                        
                        <div class="product-modal-details">
                            <div class="modal-detail-item">
                                <label>Quantity Available</label>
                                <p>${product.quantity.value} ${product.quantity.unit}</p>
                            </div>
                            <div class="modal-detail-item">
                                <label>Price Per Unit</label>
                                <p>₹${product.pricePerUnit}/${product.quantity.unit}</p>
                            </div>
                            <div class="modal-detail-item">
                                <label>Market Price</label>
                                <p>₹${product.marketPrice}/${product.quantity.unit}</p>
                            </div>
                            <div class="modal-detail-item">
                                <label>Quality Grade</label>
                                <p>${product.qualityGrade.toUpperCase()}</p>
                            </div>
                            <div class="modal-detail-item">
                                <label>Harvest Date</label>
                                <p>${formatDate(product.harvestDate)}</p>
                            </div>
                            <div class="modal-detail-item">
                                <label>Views</label>
                                <p>${product.views}</p>
                            </div>
                        </div>
                        
                        ${product.description ? `
                            <div class="product-description">
                                <h4>Description</h4>
                                <p>${product.description}</p>
                            </div>
                        ` : ''}
                        
                        ${product.tags?.length > 0 ? `
                            <div class="product-tags">
                                <h4>Tags</h4>
                                <div class="tags">
                                    ${product.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="startChatWithFarmer('${product.farmerId?._id}', '${product.farmerId?.fullName}')">
                        <i class="fas fa-comment"></i> Chat with Farmer
                    </button>
                    <button class="btn btn-primary" onclick="showOrderModal('${product._id}')">
                        <i class="fas fa-shopping-cart"></i> Buy Now
                    </button>
                </div>
            `;
            
            openModal('productModal');
        }
    } catch (error) {
        showNotification('Failed to load product details', 'error');
    }
}

// Show order modal
async function showOrderModal(productId) {
    try {
        const response = await apiRequest(`/products/${productId}`);
        if (response?.success) {
            const product = response.product;
            const modalBody = document.getElementById('orderModalBody');
            
            modalBody.innerHTML = `
                <h2>Place Order</h2>
                <div class="order-summary">
                    <div class="order-item">
                        <h4>${product.productName}</h4>
                        <p>Farmer: ${product.farmerId?.fullName || 'N/A'}</p>
                        <p>Available: ${product.quantity.value} ${product.quantity.unit}</p>
                        <p>Price: ₹${product.pricePerUnit}/${product.quantity.unit}</p>
                    </div>
                </div>
                
                <form id="orderForm" onsubmit="placeOrder(event, '${product._id}')">
                    <div class="form-group">
                        <label for="orderQuantity">Quantity (${product.quantity.unit}) *</label>
                        <div class="quantity-selector">
                            <div class="quantity-input-group">
                                <button type="button" class="quantity-btn" onclick="updateQuantity(-1)">-</button>
                                <input type="number" id="orderQuantity" name="quantity" 
                                       min="1" max="${product.quantity.value}" 
                                       value="1" required 
                                       onchange="calculateOrderTotal(${product.pricePerUnit})">
                                <button type="button" class="quantity-btn" onclick="updateQuantity(1)">+</button>
                            </div>
                            <span class="available-quantity">Max: ${product.quantity.value} ${product.quantity.unit}</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="deliveryAddress">Delivery Address *</label>
                        <textarea id="deliveryAddress" name="deliveryAddress" rows="3" required 
                                  placeholder="Enter complete delivery address including pincode"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="orderNotes">Notes (Optional)</label>
                        <textarea id="orderNotes" name="notes" rows="2" 
                                  placeholder="Any special instructions..."></textarea>
                    </div>
                    
                    <div class="price-breakdown" id="priceBreakdown">
                        <!-- Price breakdown will be calculated here -->
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="closeOrderModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Place Order</button>
                    </div>
                </form>
            `;
            
            // Calculate initial total
            calculateOrderTotal(product.pricePerUnit);
            
            openModal('orderModal');
        }
    } catch (error) {
        showNotification('Failed to load order details', 'error');
    }
}

// Update quantity
function updateQuantity(change) {
    const quantityInput = document.getElementById('orderQuantity');
    if (!quantityInput) return;
    
    let newQuantity = parseInt(quantityInput.value) + change;
    const max = parseInt(quantityInput.max);
    
    if (newQuantity < 1) newQuantity = 1;
    if (newQuantity > max) newQuantity = max;
    
    quantityInput.value = newQuantity;
    
    // Trigger change event to recalculate total
    quantityInput.dispatchEvent(new Event('change'));
}

// Calculate order total
function calculateOrderTotal(unitPrice) {
    const quantityInput = document.getElementById('orderQuantity');
    if (!quantityInput) return;
    
    const quantity = parseInt(quantityInput.value) || 1;
    const totalAmount = quantity * unitPrice;
    const commission = totalAmount * 0.03; // 3% commission
    const farmerAmount = totalAmount - commission;
    
    const priceBreakdown = document.getElementById('priceBreakdown');
    if (priceBreakdown) {
        priceBreakdown.innerHTML = `
            <div class="price-item">
                <h4>Product Total</h4>
                <p>₹${totalAmount}</p>
            </div>
            <div class="price-item">
                <h4>Platform Fee (3%)</h4>
                <p>₹${commission.toFixed(2)}</p>
            </div>
            <div class="price-item total">
                <h4>Amount to Pay</h4>
                <p>₹${totalAmount}</p>
            </div>
            <div class="price-note">
                <small>₹${farmerAmount.toFixed(2)} will be paid to the farmer after delivery</small>
            </div>
        `;
    }
}

// Place order
async function placeOrder(event, productId) {
    event.preventDefault();
    
    const quantity = parseInt(document.getElementById('orderQuantity').value);
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
    const notes = document.getElementById('orderNotes').value.trim();
    
    if (!deliveryAddress) {
        showNotification('Please enter delivery address', 'warning');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing Order...';
    
    try {
        const response = await apiRequest('/orders/create', {
            method: 'POST',
            body: {
                productId,
                quantity,
                deliveryAddress,
                notes
            }
        });
        
        if (response?.success) {
            showNotification('Order placed successfully!', 'success');
            closeOrderModal();
            
            // Reload products to update availability
            await loadProducts(currentPage);
            
            // Switch to orders section
            showSection('myOrders');
            loadMyOrders();
        } else {
            showNotification(response?.message || 'Failed to place order', 'error');
        }
    } catch (error) {
        showNotification('Failed to place order. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Load my orders
async function loadMyOrders() {
    const ordersContainer = document.getElementById('myOrdersContainer');
    if (!ordersContainer) return;
    
    showLoader(ordersContainer);
    
    try {
        const response = await apiRequest('/orders/buyer-orders');
        if (response?.success) {
            displayMyOrders(response.orders);
        } else {
            ordersContainer.innerHTML = '<div class="no-results">Failed to load orders</div>';
        }
    } catch (error) {
        ordersContainer.innerHTML = '<div class="no-results">Failed to load orders</div>';
    }
}

// Display my orders
function displayMyOrders(orders) {
    const ordersContainer = document.getElementById('myOrdersContainer');
    if (!ordersContainer) return;
    
    if (!orders || orders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
                <h3>No Orders Yet</h3>
                <p>Start shopping to see your orders here!</p>
                <button class="btn btn-primary" onclick="showSection('browse')">
                    Browse Products
                </button>
            </div>
        `;
        return;
    }
    
    ordersContainer.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <h4 class="order-id">Order #${order.orderId}</h4>
                    <p class="order-date">${formatDateTime(order.createdAt)}</p>
                </div>
                <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
            </div>
            
            <div class="order-details">
                <div class="detail-item">
                    <label>Product</label>
                    <p>${order.productId?.productName || 'N/A'}</p>
                </div>
                <div class="detail-item">
                    <label>Quantity</label>
                    <p>${order.quantity} ${order.productId?.quantity?.unit || 'units'}</p>
                </div>
                <div class="detail-item">
                    <label>Total Amount</label>
                    <p>₹${order.totalAmount}</p>
                </div>
                <div class="detail-item">
                    <label>Farmer</label>
                    <p>${order.farmerId?.fullName || 'N/A'}</p>
                </div>
            </div>
            
            <div class="order-actions">
                ${order.status === 'pending' ? `
                    <button class="btn btn-small" onclick="cancelOrder('${order._id}')">Cancel Order</button>
                ` : ''}
                ${order.status === 'shipped' ? `
                    <button class="btn btn-small btn-primary" onclick="markDelivered('${order._id}')">Mark Delivered</button>
                ` : ''}
                <button class="btn btn-small btn-outline" onclick="chatWithFarmer('${order.farmerId?._id}', '${order.farmerId?.fullName}')">
                    Message Farmer
                </button>
                ${order.status === 'delivered' ? `
                    <button class="btn btn-small" onclick="rateOrder('${order._id}')">Rate Order</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Filter my orders
function filterMyOrders() {
    const filter = document.getElementById('myOrderFilter').value;
    // This would filter the orders array in a real implementation
    console.log('Filtering orders:', filter);
}

// Cancel order
async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
        const response = await apiRequest(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: { status: 'cancelled' }
        });
        
        if (response?.success) {
            showNotification('Order cancelled successfully', 'success');
            loadMyOrders();
        } else {
            showNotification(response?.message || 'Failed to cancel order', 'error');
        }
    } catch (error) {
        showNotification('Failed to cancel order', 'error');
    }
}

// Mark order as delivered
async function markDelivered(orderId) {
    try {
        const response = await apiRequest(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: { status: 'delivered' }
        });
        
        if (response?.success) {
            showNotification('Order marked as delivered', 'success');
            loadMyOrders();
        }
    } catch (error) {
        showNotification('Failed to update order status', 'error');
    }
}

// Rate order
function rateOrder(orderId) {
    const rating = prompt('Rate this order (1-5 stars):');
    if (rating && rating >= 1 && rating <= 5) {
        showNotification('Rating submitted successfully!', 'success');
        // In production, make API call to submit rating
    }
}

// Start chat with farmer
function startChatWithFarmer(farmerId, farmerName) {
    if (!farmerId) {
        showNotification('Cannot start chat at this time', 'warning');
        return;
    }
    
    // Switch to messages section
    showSection('messages');
    
    // In production, this would initialize a chat room
    currentChatRoom = `chat_${currentUser.id}_${farmerId}`;
    
    // Update chat header
    const chatHeader = document.getElementById('chatHeader');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    
    if (chatHeader && chatInput && chatMessages) {
        chatHeader.innerHTML = `
            <div class="chat-header-info">
                <div class="farmer-avatar">${farmerName?.charAt(0) || 'F'}</div>
                <div>
                    <h4 class="chat-header-name">${farmerName || 'Farmer'}</h4>
                    <p class="chat-status">Online</p>
                </div>
            </div>
        `;
        
        chatInput.style.display = 'flex';
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <p>You started a conversation with ${farmerName || 'the farmer'}</p>
                <small>${new Date().toLocaleTimeString()}</small>
            </div>
        `;
        
        // Join chat room via socket
        if (socket) {
            socket.emit('join-room', currentChatRoom);
            socket.emit('get-chat-history', currentChatRoom);
        }
    }
}

// Chat with farmer from orders
function chatWithFarmer(farmerId, farmerName) {
    startChatWithFarmer(farmerId, farmerName);
}

// Handle incoming message (shared with farmer.js)
function handleIncomingMessage(data) {
    if (currentChatRoom === data.roomId) {
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
    }
}

// Handle chat history (shared with farmer.js)
function handleChatHistory(history) {
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

// Send message
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

// Edit profile
function editProfile() {
    showNotification('Edit profile feature coming soon!', 'info');
}

// Edit address
function editAddress() {
    const address = prompt('Enter your shipping address:');
    if (address) {
        const addressCard = document.getElementById('addressCard');
        if (addressCard) {
            addressCard.innerHTML = `
                <p>${address}</p>
                <button class="btn btn-small" onclick="editAddress()">Edit Address</button>
            `;
        }
        showNotification('Address updated successfully!', 'success');
    }
}

// Global handlers for socket events
window.handleIncomingMessage = handleIncomingMessage;
window.handleChatHistory = handleChatHistory;