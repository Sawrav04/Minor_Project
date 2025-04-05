// Firebase references
let auth, db;
let html5QrScanner = null;
let currentUser = null;
let acceptedShipments = [];
let allAvailableShipments = []; // Store all available shipments for filtering

// Initialize Firebase references when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, initializing Firebase references');
    
    // Show loading indicator
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
    
    // Directly hide loading and show dashboard after a timeout (failsafe)
    setTimeout(() => {
        const loadingElement = document.getElementById('loading');
        if (loadingElement && loadingElement.style.display !== 'none') {
            console.log('Failsafe: Hiding loading overlay after timeout');
            loadingElement.style.display = 'none';
            
            const dashboardContent = document.getElementById('dashboard-content');
            if (dashboardContent) {
                dashboardContent.style.display = 'flex';
                
                // Initialize dashboard with mock data if needed
                initializeDashboardWithoutAuth();
            }
        }
    }, 5000); // 5 second failsafe
    
    // Wait for Firebase to be fully loaded
    setTimeout(() => {
        try {
            // Get Firebase references from the global scope
            if (typeof firebase !== 'undefined') {
                auth = firebase.auth();
                db = firebase.firestore();
                console.log('Firebase references initialized successfully from global scope');
                
                // Check authentication state
                onAuthStateChanged();
            } else {
                // Try to import from the module as fallback
                import('./firebase-config.js')
                    .then(firebaseModule => {
                        console.log('Firebase module imported successfully');
                        auth = firebaseModule.auth;
                        db = firebaseModule.db;
                        
                        // Check authentication state
                        onAuthStateChanged();
                    })
                    .catch(error => {
                        console.error('Error importing Firebase module:', error);
                        showErrorMessage('Failed to initialize Firebase. Please refresh the page.');
                        
                        // Force show dashboard in case of error
                        hideLoadingShowDashboard();
                    });
            }
        } catch (error) {
            console.error('Error initializing Firebase references:', error);
            showErrorMessage('Failed to initialize Firebase. Please refresh the page.');
            
            // Force show dashboard in case of error
            hideLoadingShowDashboard();
        }
    }, 500); // Short delay to ensure Firebase scripts are loaded
});

// Force hide loading and show dashboard
function hideLoadingShowDashboard() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    const dashboardContent = document.getElementById('dashboard-content');
    if (dashboardContent) {
        dashboardContent.style.display = 'flex';
    }
    
    // Initialize dashboard without authentication
    initializeDashboardWithoutAuth();
}

// Initialize dashboard without waiting for authentication (emergency fallback)
function initializeDashboardWithoutAuth() {
    console.log('Initializing dashboard without authentication (fallback mode)');
    
    // Set up navigation buttons
    document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the view name from the onclick attribute
            const onclickAttr = this.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/switchView\('(.+?)'\)/);
                if (match && match[1]) {
                    switchView(match[1]);
                }
            }
        });
    });
    
    // Set up event listeners for modal
    setupModalListeners();
    
    // Set up search functionality
    const searchInput = document.getElementById('searchShipments');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            // Determine which tab is active and filter the appropriate shipments
            const activeTab = document.querySelector('.nav-item.active');
            if (activeTab) {
                const onclickAttr = activeTab.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/switchView\('(.+?)'\)/);
                    if (match && match[1]) {
                        if (match[1] === 'myShipments') {
                            filterAndRenderShipments(acceptedShipments, searchTerm, 'myShipmentsList');
                        } else if (match[1] === 'availableShipments') {
                            filterAndRenderShipments(allAvailableShipments, searchTerm, 'availableShipmentsList');
                        }
                    }
                }
            }
        });
    }
    
    // Start with My Shipments view
    switchView('myShipments');
    
    // Show empty states for shipment lists
    const myShipmentsContainer = document.getElementById('myShipmentsList');
    if (myShipmentsContainer) {
        myShipmentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No shipments found</h3>
                <p>You don't have any shipments assigned to you yet.</p>
            </div>
        `;
    }
    
    const availableShipmentsContainer = document.getElementById('availableShipmentsList');
    if (availableShipmentsContainer) {
        availableShipmentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No available shipments</h3>
                <p>There are no shipments available for you at this time.</p>
            </div>
        `;
    }
}

// Show error message when Firebase fails to initialize
function showErrorMessage(message) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button onclick="window.location.reload()">Refresh Page</button>
                <button onclick="hideLoadingShowDashboard()">Continue Anyway</button>
            </div>
        `;
    }
    
    // Also show alert if available
    if (typeof showAlert === 'function') {
        showAlert('error', message);
    }
}

// Switch between different views in the dashboard
function switchView(viewName) {
    console.log('Switching to view:', viewName);
    
    // Hide all tab content first
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to the selected nav item
    const selectedNavItem = document.querySelector(`.nav-item[onclick*="${viewName}"]`);
    if (selectedNavItem) {
        selectedNavItem.classList.add('active');
    }
    
    // Show the selected tab content
    const selectedTab = document.getElementById(`${viewName}Tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
        console.log(`Showing tab: ${viewName}Tab`);
    } else {
        console.error(`Tab content not found for: ${viewName}Tab`);
    }
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        switch(viewName) {
            case 'myShipments':
                pageTitle.textContent = 'My Shipments';
                break;
            case 'availableShipments':
                pageTitle.textContent = 'Available Shipments';
                break;
            case 'scanQR':
                pageTitle.textContent = 'Scan QR Code';
                break;
            case 'shipmentHistory':
                pageTitle.textContent = 'Shipment History';
                break;
            default:
                pageTitle.textContent = 'Carrier Dashboard';
        }
    }
    
    // Update shipment count if needed
    updateShipmentCount(selectedNavItem);
    
    // Special handling for different tabs
    if (viewName === 'myShipments' && typeof renderAssignedShipments === 'function') {
        renderAssignedShipments(acceptedShipments);
    } else if (viewName === 'availableShipments' && typeof renderAvailableShipments === 'function') {
        renderAvailableShipments(allAvailableShipments);
    } else if (viewName === 'scanQR') {
        // Reset QR scanner if needed
        if (html5QrScanner) {
            try {
                html5QrScanner.clear();
            } catch (error) {
                console.error('Error clearing QR scanner:', error);
            }
        }
    }
}

// Make switchView function globally accessible
window.switchView = switchView;
window.hideLoadingShowDashboard = hideLoadingShowDashboard;

// Update shipment count in the header
function updateShipmentCount(activeTab) {
    const shipmentCount = document.getElementById('shipmentCount');
    if (!shipmentCount) return;
    
    if (!activeTab) {
        shipmentCount.textContent = '';
        return;
    }
    
    const onclickAttr = activeTab.getAttribute('onclick');
    if (!onclickAttr) return;
    
    if (onclickAttr.includes('myShipments')) {
        shipmentCount.textContent = `${acceptedShipments.length} shipment${acceptedShipments.length !== 1 ? 's' : ''} assigned to you`;
    } else if (onclickAttr.includes('availableShipments')) {
        shipmentCount.textContent = `${allAvailableShipments.length} shipment${allAvailableShipments.length !== 1 ? 's' : ''} available`;
    } else {
        shipmentCount.textContent = '';
    }
}

// Firebase auth state change handler
function onAuthStateChanged() {
    console.log('Setting up auth state change listener');
    
    if (!auth) {
        console.error('Auth reference is not available');
        showErrorMessage('Authentication service is not available. Please refresh the page.');
        hideLoadingShowDashboard(); // Show dashboard anyway
        return;
    }
    
    // Set a timeout to ensure we don't wait forever for auth state to change
    const authTimeout = setTimeout(() => {
        console.warn('Auth state change listener timed out');
        hideLoadingShowDashboard();
    }, 3000);
    
    auth.onAuthStateChanged((user) => {
        clearTimeout(authTimeout); // Clear the timeout since we got a response
        
        if (!user) {
            // If no user is logged in, redirect to login page
            console.log('No user logged in, redirecting to login page');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('User authenticated:', user.uid);
        currentUser = user;
        
        // Check if user is a carrier
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.role !== 'carrier') {
            console.log('User is not a carrier, redirecting to login page');
            window.location.href = 'login.html';
            return;
        }
        
        // Initialize the dashboard once authenticated
        initializeDashboard();
        
        // Update user info in sidebar
        updateUserInfo();
        
        // Set up real-time listeners for shipments
        setupShipmentListeners();
        
        // Hide loading overlay
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        // Show dashboard content
        const dashboardContent = document.getElementById('dashboard-content');
        if (dashboardContent) {
            dashboardContent.style.display = 'flex';
        }
    });
}

// Initialize the dashboard
function initializeDashboard() {
    console.log('Initializing dashboard for user:', currentUser.uid);
    
    // Update user info immediately
    updateUserInfo();
    
    // Set up navigation buttons
    document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the view name from the onclick attribute
            const onclickAttr = this.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/switchView\('(.+?)'\)/);
                if (match && match[1]) {
                    switchView(match[1]);
                }
            }
        });
    });
    
    // Set up event listeners for modal
    setupModalListeners();
    
    // Set up search functionality
    const searchInput = document.getElementById('searchShipments');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            // Determine which tab is active and filter the appropriate shipments
            const activeTab = document.querySelector('.nav-item.active');
            if (activeTab) {
                const onclickAttr = activeTab.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/switchView\('(.+?)'\)/);
                    if (match && match[1]) {
                        if (match[1] === 'myShipments') {
                            filterAndRenderShipments(acceptedShipments, searchTerm, 'myShipmentsList');
                        } else if (match[1] === 'availableShipments') {
                            filterAndRenderShipments(allAvailableShipments, searchTerm, 'availableShipmentsList');
                        }
                    }
                }
            }
        });
    }
    
    // Initialize QR scanner
    const qrScanner = document.getElementById('qrScanner');
    if (qrScanner) {
        try {
            html5QrScanner = new Html5Qrcode('qrScanner');
            
            // Set up QR scanner buttons
            const startScanButton = document.getElementById('startScanButton');
            const stopScanButton = document.getElementById('stopScanButton');
            
            if (startScanButton) {
                startScanButton.addEventListener('click', function() {
                    startQRScanner();
                    startScanButton.style.display = 'none';
                    if (stopScanButton) stopScanButton.style.display = 'inline-block';
                });
            }
            
            if (stopScanButton) {
                stopScanButton.addEventListener('click', function() {
                    stopQRScanner();
                    stopScanButton.style.display = 'none';
                    if (startScanButton) startScanButton.style.display = 'inline-block';
                });
            }
        } catch (error) {
            console.error('Error initializing QR scanner:', error);
            const scannerContainer = document.getElementById('scanQRTab');
            if (scannerContainer) {
                scannerContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>QR Scanner Error</h3>
                        <p>Failed to initialize QR scanner: ${error.message}</p>
                        <p>Please make sure your device has camera access and try again.</p>
                    </div>
                `;
            }
        }
    }
    
    // Start with My Shipments view
    switchView('myShipments');
}

// Filter and render shipments based on search term
function filterAndRenderShipments(shipments, searchTerm, containerId) {
    if (!searchTerm) {
        // If no search term, render all shipments
        if (containerId === 'myShipmentsList') {
            renderAssignedShipments(shipments);
        } else {
            renderAvailableShipments(shipments);
        }
        return;
    }
    
    // Filter shipments based on search term
    const filteredShipments = shipments.filter(shipment => {
        // Search in multiple fields
        return (
            (shipment.id && shipment.id.toLowerCase().includes(searchTerm)) ||
            (shipment.origin && shipment.origin.toLowerCase().includes(searchTerm)) ||
            (shipment.destination && shipment.destination.toLowerCase().includes(searchTerm)) ||
            (shipment.status && shipment.status.toLowerCase().includes(searchTerm)) ||
            (shipment.description && shipment.description.toLowerCase().includes(searchTerm))
        );
    });
    
    // Render filtered shipments
    if (containerId === 'myShipmentsList') {
        renderAssignedShipments(filteredShipments);
    } else {
        renderAvailableShipments(filteredShipments);
    }
}

// Update user info in sidebar
function updateUserInfo() {
    if (!currentUser) return;
    
    const userEmail = currentUser.email;
    const userName = userEmail.split('@')[0]
        .split('.')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    // Update user email in sidebar
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = userEmail;
    }
}

// Set up real-time listeners for shipments
function setupShipmentListeners() {
    console.log('Setting up shipment listeners for user:', currentUser.uid);
    console.log('Firebase db reference:', db);
    
    if (!db) {
        console.error('Firestore database reference is not initialized');
        showAlert('error', 'Database connection error. Please refresh the page.');
        return;
    }
    
    // Listen for available shipments (status: pending, not assigned to any carrier)
    try {
        console.log('Creating query for available shipments with status: pending');
        const availableShipmentsQuery = db.collection('shipments').where('status', '==', 'pending');
        
        console.log('Available shipments query created:', availableShipmentsQuery);
        
        // Unsubscribe from previous listener if exists
        if (window.availableShipmentsUnsubscribe) {
            window.availableShipmentsUnsubscribe();
        }
        
        // Set up new listener
        window.availableShipmentsUnsubscribe = availableShipmentsQuery.onSnapshot((snapshot) => {
            const shipments = [];
            console.log('Received snapshot with', snapshot.size, 'documents');
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log('Shipment data:', doc.id, data);
                
                // Only show shipments that don't have a carrier assigned
                if (!data.carrierId) {
                    console.log('Adding shipment to available list:', doc.id);
                    shipments.push({
                        id: doc.id,
                        ...data
                    });
                } else {
                    console.log('Skipping shipment (has carrier assigned):', doc.id);
                }
            });
            
            console.log('Available shipments loaded:', shipments.length);
            
            // Always update the global variable
            allAvailableShipments = [...shipments];
            
            // Check if we're on the available tab
            const availableTab = document.querySelector('.nav-item[onclick*="availableShipments"]');
            const isAvailableTabActive = availableTab && availableTab.classList.contains('active');
            console.log('Is available tab active:', isAvailableTabActive);
            
            // Render the shipments if we're on the available tab
            if (isAvailableTabActive) {
                renderAvailableShipments(shipments);
            }
            
            // Update shipment count if needed
            updateShipmentCount(document.querySelector('.nav-item.active'));
            
        }, (error) => {
            console.error('Error listening for available shipments:', error);
            showAlert('error', 'Failed to load available shipments: ' + error.message);
            
            // Show error state in container
            const availableShipmentsContainer = document.getElementById('availableShipmentsList');
            if (availableShipmentsContainer) {
                availableShipmentsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading shipments: ${error.message}</p>
                        <button class="btn-primary" onclick="setupShipmentListeners()">Retry</button>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error('Error setting up available shipments listener:', error);
        showAlert('error', 'Failed to set up shipments listener: ' + error.message);
    }
    
    // Listen for shipments assigned to this carrier
    try {
        const assignedShipmentsQuery = db.collection('shipments').where('carrierId', '==', currentUser.uid);
        
        console.log('Assigned shipments query created');
        
        assignedShipmentsQuery.onSnapshot((snapshot) => {
            acceptedShipments = [];
            console.log('Received assigned snapshot with', snapshot.size, 'documents');
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log('Assigned shipment data:', doc.id, data);
                
                acceptedShipments.push({
                    id: doc.id,
                    ...data
                });
            });
            
            console.log('Assigned shipments loaded:', acceptedShipments.length);
            
            // If we're on the my shipments tab, render immediately
            const myShipmentsTab = document.querySelector('.nav-item[onclick*="myShipments"]');
            if (myShipmentsTab && myShipmentsTab.classList.contains('active')) {
                renderAssignedShipments(acceptedShipments);
            }
            
            // Update shipment count if needed
            updateShipmentCount(document.querySelector('.nav-item.active'));
            
        }, (error) => {
            console.error('Error listening for assigned shipments:', error);
            showAlert('error', 'Failed to load your shipments: ' + error.message);
            
            // Show error state in container
            const myShipmentsContainer = document.getElementById('myShipmentsList');
            if (myShipmentsContainer) {
                myShipmentsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading your shipments: ${error.message}</p>
                        <button class="btn-primary" onclick="setupShipmentListeners()">Retry</button>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error('Error setting up assigned shipments listener:', error);
        showAlert('error', 'Failed to set up assigned shipments listener: ' + error.message);
    }
}

// Set up event listeners for modal
function setupModalListeners() {
    // Close modal when clicking the close button or outside the modal
    const modal = document.getElementById('shipmentModal');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    });
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Set up event listeners for all action buttons
function setupActionButtonListeners() {
    // Get all action buttons
    const actionButtons = document.querySelectorAll('.shipment-actions button');
    
    // Add event listeners to each button
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Get the shipment ID from the parent element
            const shipmentId = this.parentElement.parentElement.getAttribute('data-id');
            
            // Get the action type from the button text
            const actionType = this.textContent.trim();
            
            // Perform the action
            switch(actionType) {
                case 'View Details':
                    viewShipmentDetails(shipmentId);
                    break;
                case 'Accept Shipment':
                    acceptShipment(shipmentId);
                    break;
                case 'Start Delivery':
                    updateShipmentStatus(shipmentId, 'in-transit');
                    break;
                case 'Mark as Delivered':
                    updateShipmentStatus(shipmentId, 'delivered');
                    break;
                default:
                    console.error('Unknown action type:', actionType);
            }
        });
    });
}

// Render available shipments
function renderAvailableShipments(shipments) {
    console.log('Rendering available shipments:', shipments.length);
    
    const availableShipmentsContainer = document.getElementById('availableShipmentsList');
    if (!availableShipmentsContainer) {
        console.error('Available shipments container not found');
        return;
    }
    
    // Clear previous content
    availableShipmentsContainer.innerHTML = '';
    
    // Update shipment count
    const shipmentCount = document.getElementById('shipmentCount');
    if (shipmentCount) {
        shipmentCount.textContent = `${shipments.length} shipment${shipments.length !== 1 ? 's' : ''} available`;
    }
    
    // Check if there are any shipments
    if (shipments.length === 0) {
        availableShipmentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No available shipments</h3>
                <p>There are no shipments available for you at this time.</p>
            </div>
        `;
        return;
    }
    
    // Render each shipment
    shipments.forEach(shipment => {
        const card = document.createElement('div');
        card.className = 'shipment-card';
        card.setAttribute('data-id', shipment.id);
        
        // Format dates if available
        const pickupDate = shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : 'Not specified';
        
        // Set priority badge
        const priorityBadge = shipment.priority === 'high' 
            ? '<span class="badge badge-priority">Express</span>' 
            : '';
        
        card.innerHTML = `
            <div class="shipment-header">
                <h3>Shipment #${shipment.id.substring(0, 8)}</h3>
                <div class="badges">
                    ${priorityBadge}
                    <span class="badge badge-status badge-pending">${getStatusIcon('pending')} Pending</span>
                </div>
            </div>
            <div class="shipment-details">
                <div class="detail-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <div class="detail-content">
                        <div class="detail-label">Route</div>
                        <div class="detail-value">${shipment.origin || 'N/A'} → ${shipment.destination || 'N/A'}</div>
                    </div>
                </div>
                <div class="detail-item">
                    <i class="fas fa-calendar"></i>
                    <div class="detail-content">
                        <div class="detail-label">Pickup Date</div>
                        <div class="detail-value">${pickupDate}</div>
                    </div>
                </div>
                ${shipment.weight ? `
                <div class="detail-item">
                    <i class="fas fa-weight"></i>
                    <div class="detail-content">
                        <div class="detail-label">Weight</div>
                        <div class="detail-value">${shipment.weight} kg</div>
                    </div>
                </div>` : ''}
            </div>
            <div class="shipment-footer">
                <button class="btn-secondary" onclick="viewShipmentDetails('${shipment.id}')">
                    <i class="fas fa-info-circle"></i>
                    View Details
                </button>
                <button class="btn-primary" onclick="acceptShipment('${shipment.id}')">
                    <i class="fas fa-check"></i>
                    Accept
                </button>
            </div>
        `;
        
        availableShipmentsContainer.appendChild(card);
    });
}

// Render assigned shipments
function renderAssignedShipments(shipments) {
    console.log('Rendering assigned shipments:', shipments.length);
    
    const myShipmentsContainer = document.getElementById('myShipmentsList');
    if (!myShipmentsContainer) {
        console.error('My shipments container not found');
        return;
    }
    
    // Clear previous content
    myShipmentsContainer.innerHTML = '';
    
    // Update shipment count
    const shipmentCount = document.getElementById('shipmentCount');
    if (shipmentCount) {
        shipmentCount.textContent = `${shipments.length} shipment${shipments.length !== 1 ? 's' : ''} assigned to you`;
    }
    
    // Check if there are any shipments
    if (shipments.length === 0) {
        myShipmentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-truck-loading"></i>
                <h3>No assigned shipments</h3>
                <p>You haven't accepted any shipments yet.</p>
                <button class="btn-primary" onclick="switchView('availableShipments')">Find Shipments</button>
            </div>
        `;
        return;
    }
    
    // Group shipments by status
    const groupedShipments = {
        'pending': [],
        'in-transit': [],
        'delivered': [],
        'cancelled': []
    };
    
    shipments.forEach(shipment => {
        const status = shipment.status || 'pending';
        if (!groupedShipments[status]) {
            groupedShipments[status] = [];
        }
        groupedShipments[status].push(shipment);
    });
    
    // Create status sections
    const statusOrder = ['in-transit', 'pending', 'delivered', 'cancelled'];
    
    statusOrder.forEach(status => {
        if (!groupedShipments[status] || groupedShipments[status].length === 0) return;
        
        const statusSection = document.createElement('div');
        statusSection.className = 'status-section';
        
        // Get status display name and icon
        let statusName = '';
        let statusIcon = '';
        
        switch(status) {
            case 'pending':
                statusName = 'Accepted Shipments';
                statusIcon = 'fa-check-circle';
                break;
            case 'in-transit':
                statusName = 'In Transit';
                statusIcon = 'fa-truck';
                break;
            case 'delivered':
                statusName = 'Delivered';
                statusIcon = 'fa-check-double';
                break;
            case 'cancelled':
                statusName = 'Cancelled';
                statusIcon = 'fa-times-circle';
                break;
        }
        
        statusSection.innerHTML = `
            <div class="status-header">
                <i class="fas ${statusIcon}"></i>
                <h3>${statusName}</h3>
                <span class="count">${groupedShipments[status] ? groupedShipments[status].length : 0}</span>
            </div>
            <div class="shipments-container" id="${status}-shipments"></div>
        `;
        
        myShipmentsContainer.appendChild(statusSection);
        
        // Get the container for this status
        const statusContainer = document.getElementById(`${status}-shipments`);
        if (!statusContainer || !groupedShipments[status]) return;
        
        // Render shipments for this status
        groupedShipments[status].forEach(shipment => {
            const card = document.createElement('div');
            card.className = 'shipment-card';
            card.setAttribute('data-id', shipment.id);
            
            // Format dates if available
            const pickupDate = shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : 'Not specified';
            
            // Set priority badge
            const priorityBadge = shipment.priority === 'high' 
                ? '<span class="badge badge-priority">Express</span>' 
                : '';
            
            // Set action button based on status
            let actionButton = '';
            
            if (status === 'pending') {
                actionButton = `
                    <button class="btn-primary" onclick="updateShipmentStatus('${shipment.id}', 'in-transit')">
                        <i class="fas fa-truck"></i>
                        Start Delivery
                    </button>
                `;
            } else if (status === 'in-transit') {
                actionButton = `
                    <button class="btn-success" onclick="updateShipmentStatus('${shipment.id}', 'delivered')">
                        <i class="fas fa-check-double"></i>
                        Mark Delivered
                    </button>
                `;
            }
            
            card.innerHTML = `
                <div class="shipment-header">
                    <h3>Shipment #${shipment.id.substring(0, 8)}</h3>
                    <div class="badges">
                        ${priorityBadge}
                        <span class="badge badge-status badge-${status}">${getStatusIcon(status)} ${status.replace('-', ' ')}</span>
                    </div>
                </div>
                <div class="shipment-details">
                    <div class="detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <div class="detail-content">
                            <div class="detail-label">Route</div>
                            <div class="detail-value">${shipment.origin || 'N/A'} → ${shipment.destination || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <div class="detail-content">
                            <div class="detail-label">Pickup Date</div>
                            <div class="detail-value">${pickupDate}</div>
                        </div>
                    </div>
                    ${shipment.weight ? `
                    <div class="detail-item">
                        <i class="fas fa-weight"></i>
                        <div class="detail-content">
                            <div class="detail-label">Weight</div>
                            <div class="detail-value">${shipment.weight} kg</div>
                        </div>
                    </div>` : ''}
                </div>
                <div class="shipment-footer">
                    <button class="btn-secondary" onclick="viewShipmentDetails('${shipment.id}')">
                        <i class="fas fa-info-circle"></i>
                        Details
                    </button>
                    ${actionButton}
                </div>
            `;
            
            statusContainer.appendChild(card);
        });
    });
}

// View shipment details
function viewShipmentDetails(shipmentId) {
    console.log('Viewing shipment details for ID:', shipmentId);
    
    // Find the shipment in our arrays
    let shipment = null;
    
    // Check in available shipments
    shipment = allAvailableShipments.find(s => s.id === shipmentId);
    if (shipment) {
        console.log('Found in available shipments');
        displayShipmentDetails(shipment, 'available');
        return;
    }
    
    // Check in accepted shipments
    shipment = acceptedShipments.find(s => s.id === shipmentId);
    if (shipment) {
        console.log('Found in accepted shipments');
        displayShipmentDetails(shipment, 'accepted');
        return;
    }
    
    // If we get here, the shipment wasn't found in memory, try to fetch it
    console.log('Shipment not found in memory, fetching from Firestore');
    getShipmentDetails(shipmentId);
}

// Get shipment details from Firestore
async function getShipmentDetails(shipmentId) {
    try {
        console.log('Getting shipment details for ID:', shipmentId);
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        const shipmentDoc = await shipmentRef.get();
        
        // Fix: Check document existence properly
        if (!shipmentDoc.exists) {
            console.error('Shipment not found:', shipmentId);
            showAlert('error', 'Shipment not found');
            return;
        }
        
        const shipment = {
            id: shipmentDoc.id,
            ...shipmentDoc.data()
        };
        
        console.log('Retrieved shipment details:', shipment);
        
        // Determine if this is an available or accepted shipment
        const type = shipment.carrierId === currentUser.uid ? 'accepted' : 'available';
        displayShipmentDetails(shipment, type);
    } catch (error) {
        console.error('Error getting shipment details:', error);
        showAlert('error', 'Failed to load shipment details: ' + error.message);
    }
}

// Display shipment details in modal
function displayShipmentDetails(shipment, type) {
    const modal = document.getElementById('shipmentModal');
    const modalBody = modal.querySelector('.modal-body');
    const modalActions = document.getElementById('modalActions');
    
    if (!modal || !modalBody) {
        console.error('Modal elements not found');
        return;
    }
    
    // Format dates
    const createdDate = shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : 'N/A';
    const updatedDate = shipment.updatedAt ? new Date(shipment.updatedAt).toLocaleString() : 'N/A';
    const pickupDate = shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : 'N/A';
    
    // Create tracking timeline HTML
    let trackingHtml = '';
    if (shipment.trackingUpdates && shipment.trackingUpdates.length > 0) {
        trackingHtml = `
            <div class="tracking-timeline">
                <h4>Tracking Updates</h4>
                <div class="timeline">
                    ${shipment.trackingUpdates.map(update => {
                        const updateDate = new Date(update.timestamp).toLocaleString();
                        return `
                            <div class="timeline-item">
                                <div class="timeline-icon ${update.status}">
                                    ${getStatusIcon(update.status)}
                                </div>
                                <div class="timeline-content">
                                    <h5>${update.status.replace('-', ' ')}</h5>
                                    <p>${update.message || ''}</p>
                                    <span class="timeline-date">${updateDate}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        trackingHtml = `
            <div class="tracking-timeline">
                <h4>Tracking Updates</h4>
                <p class="no-data-message">No tracking updates available yet.</p>
            </div>
        `;
    }
    
    // Set modal content - only include fields that are likely to be in the backend
    modalBody.innerHTML = `
        <div class="shipment-details-container">
            <div class="shipment-detail-section">
                <h4>Shipment Information</h4>
                <div class="detail-row">
                    <div class="detail-label">ID:</div>
                    <div class="detail-value">${shipment.id}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Status:</div>
                    <div class="detail-value">
                        <span class="status-badge ${shipment.status || 'pending'}">${getStatusIcon(shipment.status || 'pending')} ${(shipment.status || 'pending').replace('-', ' ')}</span>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Created:</div>
                    <div class="detail-value">${createdDate}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${updatedDate}</div>
                </div>
            </div>
            
            <div class="shipment-detail-section">
                <h4>Package Details</h4>
                ${shipment.packageType ? `
                <div class="detail-row">
                    <div class="detail-label">Type:</div>
                    <div class="detail-value">${shipment.packageType}</div>
                </div>` : ''}
                ${shipment.weight ? `
                <div class="detail-row">
                    <div class="detail-label">Weight:</div>
                    <div class="detail-value">${shipment.weight} kg</div>
                </div>` : ''}
                ${shipment.description ? `
                <div class="detail-row">
                    <div class="detail-label">Description:</div>
                    <div class="detail-value">${shipment.description}</div>
                </div>` : ''}
                ${!shipment.packageType && !shipment.weight && !shipment.description ? `
                <p class="no-data-message">No package details available</p>` : ''}
            </div>
            
            <div class="shipment-detail-section">
                <h4>Route Information</h4>
                <div class="detail-row">
                    <div class="detail-label">Origin:</div>
                    <div class="detail-value">${shipment.origin || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Destination:</div>
                    <div class="detail-value">${shipment.destination || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Pickup Date:</div>
                    <div class="detail-value">${pickupDate}</div>
                </div>
            </div>
            
            ${trackingHtml}
        </div>
    `;
    
    // Configure action buttons based on shipment type and status
    if (modalActions) {
        modalActions.innerHTML = '';
        
        if (type === 'available') {
            // For available shipments, show accept button
            const acceptButton = document.createElement('button');
            acceptButton.className = 'btn-primary';
            acceptButton.innerHTML = '<i class="fas fa-check"></i> Accept Shipment';
            acceptButton.onclick = () => {
                acceptShipment(shipment.id);
                modal.style.display = 'none';
            };
            modalActions.appendChild(acceptButton);
        } else if (type === 'accepted') {
            // For accepted shipments, show different buttons based on status
            const status = shipment.status || 'pending';
            
            if (status === 'pending') {
                const startButton = document.createElement('button');
                startButton.className = 'btn-primary';
                startButton.innerHTML = '<i class="fas fa-truck"></i> Start Delivery';
                startButton.onclick = () => {
                    updateShipmentStatus(shipment.id, 'in-transit');
                    modal.style.display = 'none';
                };
                modalActions.appendChild(startButton);
            } else if (status === 'in-transit') {
                const deliverButton = document.createElement('button');
                deliverButton.className = 'btn-success';
                deliverButton.innerHTML = '<i class="fas fa-check-double"></i> Mark as Delivered';
                deliverButton.onclick = () => {
                    updateShipmentStatus(shipment.id, 'delivered');
                    modal.style.display = 'none';
                };
                modalActions.appendChild(deliverButton);
            }
        }
    }
    
    // Show the modal
    modal.style.display = 'block';
}

// Accept a shipment
async function acceptShipment(shipmentId) {
    try {
        console.log('Accepting shipment:', shipmentId);
        
        // Show loading indicator
        showAlert('info', 'Processing your request...');
        
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        const shipmentDoc = await shipmentRef.get();
        
        // Fix: Check document existence properly
        if (!shipmentDoc.exists) {
            console.error('Shipment not found:', shipmentId);
            showAlert('error', 'Shipment not found');
            return;
        }
        
        const shipmentData = shipmentDoc.data();
        console.log('Shipment data before update:', shipmentData);
        
        // Check if shipment is already assigned
        if (shipmentData.carrierId) {
            console.error('Shipment already assigned:', shipmentId);
            showAlert('error', 'This shipment has already been assigned to another carrier');
            return;
        }
        
        // Create tracking update
        const trackingUpdate = {
            status: 'pending',
            timestamp: new Date().toISOString(),
            message: 'Shipment accepted by carrier',
            updatedBy: currentUser ? currentUser.email : 'Unknown user'
        };
        
        // Get existing tracking updates or initialize empty array
        const existingUpdates = shipmentData.trackingUpdates || [];
        
        // Update the shipment
        const updateData = {
            carrierId: currentUser ? currentUser.uid : null,
            carrierEmail: currentUser ? currentUser.email : null,
            status: 'pending',
            updatedAt: new Date().toISOString(),
            trackingUpdates: [trackingUpdate, ...existingUpdates]
        };
        
        console.log('Updating shipment with:', updateData);
        try {
            await shipmentRef.update(updateData);
            console.log('Shipment updated successfully');
            
            // Close modal if open
            const modal = document.getElementById('shipmentModal');
            if (modal) {
                modal.style.display = 'none';
            }
            
            // Switch to My Shipments tab
            switchView('myShipments');
            
            showAlert('success', 'Shipment accepted successfully!');
        } catch (updateError) {
            console.error('Error updating document:', updateError);
            showAlert('error', 'Failed to update shipment: ' + updateError.message);
        }
    } catch (error) {
        console.error('Error accepting shipment:', error);
        showAlert('error', 'Failed to accept shipment: ' + error.message);
    }
}

// Update shipment status
async function updateShipmentStatus(shipmentId, newStatus) {
    try {
        console.log(`Updating shipment ${shipmentId} to status: ${newStatus}`);
        
        // Show loading indicator
        showAlert('info', 'Updating shipment status...');
        
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        const shipmentDoc = await shipmentRef.get();
        
        // Fix: Check document existence properly
        if (!shipmentDoc.exists) {
            console.error('Shipment not found:', shipmentId);
            showAlert('error', 'Shipment not found');
            return;
        }
        
        const shipmentData = shipmentDoc.data();
        const currentStatus = shipmentData.status || 'pending';
        
        // Validate status transition
        const validTransitions = {
            'pending': ['in-transit', 'cancelled'],
            'in-transit': ['delivered', 'cancelled'],
            'delivered': [],
            'cancelled': []
        };
        
        if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(newStatus)) {
            console.error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
            showAlert('error', `Cannot change status from ${currentStatus} to ${newStatus}`);
            return;
        }
        
        // Create status update message
        let statusMessage = '';
        switch(newStatus) {
            case 'in-transit':
                statusMessage = 'Shipment is in transit';
                break;
            case 'delivered':
                statusMessage = 'Shipment has been delivered';
                break;
            case 'cancelled':
                statusMessage = 'Shipment has been cancelled';
                break;
            default:
                statusMessage = `Status updated to: ${newStatus}`;
        }
        
        // Get existing tracking updates or initialize empty array
        const existingUpdates = shipmentData.trackingUpdates || [];
        
        // Add new update to the beginning of the array
        const newUpdate = {
            status: newStatus,
            timestamp: new Date().toISOString(),
            message: statusMessage,
            updatedBy: currentUser ? currentUser.email : 'Unknown user'
        };
        
        try {
            await shipmentRef.update({
                status: newStatus,
                updatedAt: new Date().toISOString(),
                trackingUpdates: [newUpdate, ...existingUpdates]
            });
            
            console.log('Shipment status updated successfully');
            
            // Close the modal if it's open
            const modal = document.getElementById('shipmentModal');
            if (modal && modal.style.display === 'block') {
                modal.style.display = 'none';
            }
            
            showAlert('success', `Shipment status updated to ${newStatus}!`);
            
            // Refresh the current view
            const activeTab = document.querySelector('.nav-item.active');
            if (activeTab) {
                const onclickAttr = activeTab.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/switchView\('(.+?)'\)/);
                    if (match && match[1]) {
                        switchView(match[1]);
                    }
                }
            }
        } catch (updateError) {
            console.error('Error updating document:', updateError);
            showAlert('error', 'Failed to update shipment status: ' + updateError.message);
        }
    } catch (error) {
        console.error('Error updating shipment status:', error);
        showAlert('error', 'Failed to update shipment status: ' + error.message);
    }
}

// Get status icon based on status
function getStatusIcon(status) {
    switch(status) {
        case 'pending':
            return '<i class="fas fa-clock"></i>';
        case 'in-transit':
            return '<i class="fas fa-truck"></i>';
        case 'delivered':
            return '<i class="fas fa-check-circle"></i>';
        case 'cancelled':
            return '<i class="fas fa-times-circle"></i>';
        default:
            return '<i class="fas fa-circle"></i>';
    }
}

// Show alert message
function showAlert(type, message) {
    console.log(`Alert [${type}]: ${message}`);
    
    // Create alert element if it doesn't exist
    let alert = document.getElementById('alert');
    if (!alert) {
        alert = document.createElement('div');
        alert.id = 'alert';
        alert.className = 'alert';
        
        // Create alert content
        alert.innerHTML = `
            <i class="alert-icon"></i>
            <span class="alert-message"></span>
            <button class="alert-close">&times;</button>
        `;
        
        // Add alert to the body
        document.body.appendChild(alert);
        
        // Add event listener to close button
        const closeButton = alert.querySelector('.alert-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                alert.style.display = 'none';
            });
        }
    }
    
    const alertIcon = alert.querySelector('.alert-icon');
    const alertMessage = alert.querySelector('.alert-message');
    
    if (!alertIcon || !alertMessage) return;
    
    // Set alert type
    alert.className = `alert ${type}`;
    
    // Set icon based on type
    switch(type) {
        case 'success':
            alertIcon.className = 'alert-icon fas fa-check-circle';
            break;
        case 'error':
            alertIcon.className = 'alert-icon fas fa-exclamation-circle';
            break;
        case 'warning':
            alertIcon.className = 'alert-icon fas fa-exclamation-triangle';
            break;
        case 'info':
            alertIcon.className = 'alert-icon fas fa-info-circle';
            break;
    }
    
    // Set message
    alertMessage.textContent = message;
    
    // Show alert
    alert.style.display = 'flex';
    
    // Hide after 3 seconds for success and info alerts
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            alert.style.display = 'none';
        }, 3000);
    }
}

// Make functions available globally
window.viewShipmentDetails = viewShipmentDetails;
window.acceptShipment = acceptShipment;
window.updateShipmentStatus = updateShipmentStatus;
window.switchView = switchView;
window.getStatusIcon = getStatusIcon;
window.showAlert = showAlert;
