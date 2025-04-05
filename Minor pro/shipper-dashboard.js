// Import Firebase modules
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, orderBy, onSnapshot, addDoc, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let shipmentsListener = null;
let allShipments = [];

// Initialize Firebase and show dashboard
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Set up auth state listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                document.getElementById('userEmail').textContent = user.email;
                
                // Show dashboard and hide loading
                document.getElementById('loading').style.display = 'none';
                document.getElementById('dashboard-content').style.display = 'flex';
                
                // Load initial data
                await loadShipments();
                
                // Set up search functionality
                const searchInput = document.getElementById('searchShipments');
                if (searchInput) {
                    searchInput.addEventListener('input', handleSearch);
                }
            } else {
                window.location.href = 'login.html';
            }
        });
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        document.getElementById('loading').innerHTML = `
            <div class="error-message">
                <p>Error loading dashboard: ${error.message}</p>
                <button onclick="window.location.href='login.html'">Return to Login</button>
            </div>
        `;
    }
});

// Function to load shipments
async function loadShipments() {
    try {
        if (!currentUser) {
            console.error('No user is logged in');
            showAlert('error', 'Please log in to view shipments');
            return;
        }

        // Show loading state
        const container = document.getElementById('shipmentsList');
        container.innerHTML = `
            <div class="empty-state">
                <div class="loading-spinner"></div>
                <p>Loading shipments...</p>
            </div>
        `;
        
        // Clear existing listener
        if (shipmentsListener) {
            shipmentsListener();
        }

        // Create a query with proper error handling
        try {
            // Simplified query to avoid composite index issues
            // First, get all shipments for this user
            const q = query(
                collection(db, 'shipments'),
                where('shipperId', '==', currentUser.uid)
            );

            shipmentsListener = onSnapshot(q, (querySnapshot) => {
                allShipments = [];
                querySnapshot.forEach((doc) => {
                    const shipmentData = doc.data();
                    // Filter out delivered shipments client-side
                    if (shipmentData.status !== 'delivered') {
                        allShipments.push({ id: doc.id, ...shipmentData });
                    }
                });
                
                // Sort client-side instead of using orderBy
                allShipments.sort((a, b) => {
                    // First sort by status
                    if (a.status < b.status) return -1;
                    if (a.status > b.status) return 1;
                    
                    // Then sort by createdAt if available
                    if (a.createdAt && b.createdAt) {
                        // Handle Firestore timestamps
                        const aTime = a.createdAt.seconds ? a.createdAt.seconds : a.createdAt;
                        const bTime = b.createdAt.seconds ? b.createdAt.seconds : b.createdAt;
                        return bTime - aTime; // descending order
                    }
                    return 0;
                });
                
                renderShipments(allShipments);
                
                // Log success for debugging
                console.log('Successfully loaded', allShipments.length, 'shipments');
            }, (error) => {
                console.error('Error in snapshot listener:', error);
                showAlert('error', 'Failed to load shipments: ' + error.message);
                // Show error state in the container
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading shipments: ${error.message}</p>
                        <button class="btn-primary" onclick="loadShipments()">Retry</button>
                    </div>
                `;
            });
        } catch (firestoreError) {
            console.error('Firestore query error:', firestoreError);
            showAlert('error', 'Database error: ' + firestoreError.message);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error connecting to database: ${firestoreError.message}</p>
                    <button class="btn-primary" onclick="loadShipments()">Retry</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error in loadShipments:', error);
        showAlert('error', 'Failed to load shipments: ' + error.message);
        // Show error state in the container
        const container = document.getElementById('shipmentsList');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading shipments: ${error.message}</p>
                <button class="btn-primary" onclick="loadShipments()">Retry</button>
            </div>
        `;
    }
}

// Function to show alert messages
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
        <button class="close-alert" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.querySelector('.dashboard-main').insertBefore(
        alertDiv,
        document.querySelector('.dashboard-content')
    );
    setTimeout(() => alertDiv.remove(), 5000);
}

// Function to handle logout
async function logout() {
    console.log('Logging out');
    
    // Clean up listeners
    if (shipmentsListener) {
        shipmentsListener();
    }
    
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
}

// Function to switch between tabs
function switchTab(tabName) {
    // Update header title
    const headerTitle = document.querySelector('.header-content h2');
    
    // Update navigation active state
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    const selectedTab = document.querySelector(`.sidebar-nav .nav-item[onclick*="${tabName}"]`);
    if (selectedTab) selectedTab.classList.add('active');

    // Show/hide content based on selected tab
    const shipmentsList = document.getElementById('shipmentsList');
    const createShipmentForm = document.getElementById('createShipmentForm');
    const searchBox = document.querySelector('.search-box');
    const createButton = document.querySelector('.header-actions .btn-primary');

    switch(tabName) {
        case 'createShipment':
            headerTitle.textContent = 'Create New Shipment';
            shipmentsList.style.display = 'none';
            createShipmentForm.style.display = 'block';
            searchBox.style.display = 'none';
            createButton.style.display = 'none';
            
            // Reset form scroll position
            if (createShipmentForm) {
                createShipmentForm.scrollTop = 0;
                
                // Reset form fields if needed
                const form = document.getElementById('newShipmentForm');
                if (form) form.reset();
            }
            break;
        case 'myShipments':
            headerTitle.textContent = 'My Shipments';
            shipmentsList.style.display = 'grid';
            createShipmentForm.style.display = 'none';
            searchBox.style.display = 'block';
            createButton.style.display = 'block';
            
            // Load shipments with a small delay to allow UI to update first
            setTimeout(() => {
                loadShipments();
            }, 100);
            break;
        case 'shipmentHistory':
            headerTitle.textContent = 'Shipment History';
            shipmentsList.style.display = 'grid';
            createShipmentForm.style.display = 'none';
            searchBox.style.display = 'block';
            createButton.style.display = 'none';
            
            // Load history with a small delay to allow UI to update first
            setTimeout(() => {
                loadShipmentHistory();
            }, 100);
            break;
    }
    
    // Scroll main content to top when switching tabs
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
        dashboardContent.scrollTop = 0;
    }
}

// Function to handle shipment creation
async function handleCreateShipment(event) {
    event.preventDefault();
    showLoading();

    try {
        const formData = {
            pickupAddress: document.getElementById('pickupAddress').value,
            dropoffAddress: document.getElementById('dropoffAddress').value,
            receiverName: document.getElementById('receiverName').value,
            receiverContact: document.getElementById('receiverContact').value,
            packageType: document.getElementById('packageType').value,
            weight: parseFloat(document.getElementById('weight').value),
            packageDetails: document.getElementById('packageDetails').value,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            shipperEmail: currentUser.email,
            shipperId: currentUser.uid,
            carrierId: null,
            carrierEmail: null,
            trackingUpdates: [{
                status: 'pending',
                timestamp: new Date().toISOString(),
                message: 'Shipment created and waiting for carrier',
                updatedBy: currentUser.email
            }]
        };

        await addDoc(collection(db, 'shipments'), formData);
        showAlert('success', 'Shipment created successfully!');
        document.getElementById('newShipmentForm').reset();
        switchTab('myShipments');
    } catch (error) {
        console.error('Error creating shipment:', error);
        showAlert('error', 'Failed to create shipment: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Function to load shipment history
async function loadShipmentHistory() {
    try {
        if (!currentUser) {
            console.error('No user is logged in');
            showAlert('error', 'Please log in to view shipment history');
            return;
        }

        // Show loading state
        const container = document.getElementById('shipmentsList');
        container.innerHTML = `
            <div class="empty-state">
                <div class="loading-spinner"></div>
                <p>Loading shipment history...</p>
            </div>
        `;

        try {
            // Simplified query to avoid composite index issues
            const q = query(
                collection(db, 'shipments'),
                where('shipperId', '==', currentUser.uid)
            );

            const querySnapshot = await getDocs(q);
            const shipments = [];
            querySnapshot.forEach((doc) => {
                const shipmentData = doc.data();
                // Filter for delivered shipments client-side
                if (shipmentData.status === 'delivered') {
                    shipments.push({ id: doc.id, ...shipmentData });
                }
            });

            // Sort by createdAt if available
            shipments.sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    // Handle Firestore timestamps
                    const aTime = a.createdAt.seconds ? a.createdAt.seconds : a.createdAt;
                    const bTime = b.createdAt.seconds ? b.createdAt.seconds : b.createdAt;
                    return bTime - aTime; // descending order
                }
                return 0;
            });

            renderShipments(shipments, true);
            console.log('Successfully loaded', shipments.length, 'history items');
        } catch (firestoreError) {
            console.error('Firestore query error:', firestoreError);
            showAlert('error', 'Database error: ' + firestoreError.message);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error connecting to database: ${firestoreError.message}</p>
                    <button class="btn-primary" onclick="loadShipmentHistory()">Retry</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading shipment history:', error);
        showAlert('error', 'Failed to load shipment history: ' + error.message);
        // Show error state in the container
        const container = document.getElementById('shipmentsList');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading shipment history: ${error.message}</p>
                <button class="btn-primary" onclick="loadShipmentHistory()">Retry</button>
            </div>
        `;
    }
}

// Function to render shipments
function renderShipments(shipments, isHistory = false) {
    try {
        const container = document.getElementById('shipmentsList');
        if (!container) {
            console.error('Shipments container not found');
            return;
        }
        
        container.innerHTML = '';

        if (!shipments || shipments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>${isHistory ? 'No completed shipments found' : 'No shipments found'}</p>
                </div>
            `;
            // Update shipment count
            const countElement = document.getElementById('shipmentCount');
            if (countElement) {
                countElement.textContent = '0 shipments';
            }
            return;
        }

        shipments.forEach(shipment => {
            try {
                const card = document.createElement('div');
                card.className = 'shipment-card';
                
                // Format the date if available
                const createdDate = shipment.createdAt ? new Date(shipment.createdAt.seconds * 1000) : new Date();
                const formattedDate = createdDate.toLocaleDateString();
                
                card.innerHTML = `
                    <div class="shipment-header">
                        <h4>Shipment #${shipment.id ? shipment.id.slice(0, 8) : 'Unknown'}</h4>
                        <span class="status-badge ${shipment.status || 'pending'}">${shipment.status || 'pending'}</span>
                    </div>
                    <div class="shipment-body">
                        <div class="shipment-info">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>From: ${shipment.pickupAddress || 'Not specified'}</span>
                        </div>
                        <div class="shipment-info">
                            <i class="fas fa-map-marker"></i>
                            <span>To: ${shipment.dropoffAddress || 'Not specified'}</span>
                        </div>
                        <div class="shipment-info">
                            <i class="fas fa-box"></i>
                            <span>Package: ${shipment.packageType || 'Standard'}</span>
                        </div>
                        <div class="shipment-info">
                            <i class="fas fa-weight-hanging"></i>
                            <span>Weight: ${shipment.weight || '0'} kg</span>
                        </div>
                        <div class="shipment-info">
                            <i class="fas fa-calendar"></i>
                            <span>Date: ${formattedDate}</span>
                        </div>
                    </div>
                    <div class="shipment-actions">
                        <button class="btn-primary" onclick="viewShipmentDetails('${shipment.id}')">
                            View Details
                        </button>
                    </div>
                `;
                container.appendChild(card);
            } catch (cardError) {
                console.error('Error rendering shipment card:', cardError, shipment);
            }
        });

        // Update shipment count
        const countElement = document.getElementById('shipmentCount');
        if (countElement) {
            countElement.textContent = `${shipments.length} shipment${shipments.length !== 1 ? 's' : ''}`;
        }
    } catch (error) {
        console.error('Error in renderShipments:', error);
        showAlert('error', 'Error displaying shipments');
    }
}

// Function to display shipment in modal
function displayShipmentInModal(shipment) {
    const modalBody = document.querySelector('.modal-body');
    const modalActions = document.getElementById('modalActions');
    
    // Format dates
    const createdAt = shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : 'Unknown';
    const updatedAt = shipment.updatedAt ? new Date(shipment.updatedAt).toLocaleString() : 'N/A';
    
    // Get carrier information
    const carrierInfo = shipment.carrierId ? 
        `<div class="detail-section">
            <h4>Carrier Information</h4>
            <p><strong>Email:</strong> ${shipment.carrierEmail || 'Not available'}</p>
            <p><strong>Assigned:</strong> ${shipment.assignedAt ? new Date(shipment.assignedAt).toLocaleString() : 'Unknown'}</p>
        </div>` : 
        `<div class="detail-section">
            <h4>Carrier Information</h4>
            <p>No carrier assigned yet</p>
        </div>`;
    
    // Create HTML for shipment details
    modalBody.innerHTML = `
        <div class="shipment-details">
            <div class="detail-section">
                <h4>Shipment Information</h4>
                <p><strong>ID:</strong> ${shipment.id}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${shipment.status}">${shipment.status}</span></p>
                <p><strong>Created:</strong> ${createdAt}</p>
                <p><strong>Last Updated:</strong> ${updatedAt}</p>
            </div>
            
            ${carrierInfo}
            
            <div class="detail-section">
                <h4>Package Information</h4>
                <p><strong>Type:</strong> ${shipment.packageType || 'Standard'}</p>
                <p><strong>Weight:</strong> ${shipment.weight || 'N/A'} kg</p>
                <p><strong>Details:</strong> ${shipment.packageDetails || 'N/A'}</p>
            </div>
            
            <div class="detail-section">
                <h4>Delivery Information</h4>
                <p><strong>Pickup:</strong> ${shipment.pickupAddress || 'N/A'}</p>
                <p><strong>Delivery:</strong> ${shipment.dropoffAddress || 'N/A'}</p>
                <p><strong>Receiver:</strong> ${shipment.receiverName || 'N/A'}</p>
                <p><strong>Contact:</strong> ${shipment.receiverContact || 'N/A'}</p>
            </div>
        </div>
    `;
    
    // Add action buttons based on shipment status
    let actionButtons = '';
    
    if (shipment.status === 'pending' || shipment.status === 'assigned' || shipment.status === 'in-transit') {
        if (!shipment.cancellationRequested) {
            actionButtons += `
                <button class="btn-danger" onclick="showCancellationModal('${shipment.id}')">
                    <i class="fas fa-ban"></i> Request Cancellation
                </button>
            `;
        } else {
            actionButtons += `
                <button class="btn-secondary" disabled>
                    <i class="fas fa-clock"></i> Cancellation Pending
                </button>
            `;
        }
    }
    
    // Add QR code button for all shipments
    actionButtons += `
        <button class="btn-primary" onclick="showQRCode('${shipment.id}')">
            <i class="fas fa-qrcode"></i> View QR Code
        </button>
    `;
    
    modalActions.innerHTML = actionButtons;
}

// Function to show QR code
function showQRCode(shipmentId) {
    // Clear previous QR code
    const qrCodeContainer = document.getElementById('qrcode');
    qrCodeContainer.innerHTML = '';
    
    // Set shipment ID display
    document.getElementById('shipmentIdDisplay').textContent = `Shipment ID: ${shipmentId}`;
    
    // Generate QR code
    const baseUrl = window.location.origin;
    const shipmentUrl = `${baseUrl}/shipment-details.html?id=${shipmentId}`;
    
    // Use the QRCode library that's included in the HTML
    QRCode.toCanvas(document.createElement('canvas'), shipmentUrl, { width: 200 }, function (error, canvas) {
        if (error) {
            console.error('Error generating QR code:', error);
            qrCodeContainer.innerHTML = '<p class="error-message">Error generating QR code</p>';
        } else {
            qrCodeContainer.appendChild(canvas);
        }
    });
    
    // Show QR code modal
    const modal = document.getElementById('qrCodeModal');
    modal.style.display = 'block';
}

// Function to show cancellation modal
function showCancellationModal(shipmentId) {
    // Store shipment ID for cancellation
    window.currentCancellationShipmentId = shipmentId;
    
    // Clear previous reason
    document.getElementById('cancellationReason').value = '';
    
    // Show cancellation modal
    const modal = document.getElementById('cancellationModal');
    modal.style.display = 'block';
}

// Function to submit cancellation request
async function submitCancellationRequest() {
    const shipmentId = window.currentCancellationShipmentId;
    const reason = document.getElementById('cancellationReason').value.trim();
    
    if (!shipmentId) {
        showAlert('error', 'No shipment selected for cancellation');
        return;
    }
    
    if (!reason) {
        showAlert('error', 'Please provide a reason for cancellation');
        return;
    }
    
    try {
        // Show loading state
        showLoading();
        
        // Update shipment with cancellation request
        const shipmentRef = doc(db, 'shipments', shipmentId);
        await updateDoc(shipmentRef, {
            cancellationRequested: true,
            cancellationReason: reason,
            cancellationRequestedAt: new Date().toISOString(),
            cancellationRequestedBy: currentUser.uid
        });
        
        // Close modal and show success message
        closeCancellationModal();
        hideLoading();
        showAlert('success', 'Cancellation request submitted successfully');
        
        // Send email notification to manager
        // This is a placeholder - in a real application, this would be handled by a backend service
        console.log('Sending cancellation request email to manager');
    } catch (error) {
        hideLoading();
        console.error('Error submitting cancellation request:', error);
        showAlert('error', 'Failed to submit cancellation request: ' + error.message);
    }
}

// Initialize search functionality
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchShipments');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
});

// Function to handle search
let searchTimeout = null;

function handleSearch(event) {
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Set a timeout to prevent searching on every keystroke
    searchTimeout = setTimeout(() => {
        const searchTerm = event.target.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            // If search is empty, show all shipments
            renderShipments(allShipments);
            return;
        }
        
        // Filter shipments based on search term
        const filteredShipments = allShipments.filter(shipment => {
            return (
                (shipment.id && shipment.id.toLowerCase().includes(searchTerm)) ||
                (shipment.pickupAddress && shipment.pickupAddress.toLowerCase().includes(searchTerm)) ||
                (shipment.dropoffAddress && shipment.dropoffAddress.toLowerCase().includes(searchTerm)) ||
                (shipment.receiverName && shipment.receiverName.toLowerCase().includes(searchTerm)) ||
                (shipment.status && shipment.status.toLowerCase().includes(searchTerm)) ||
                (shipment.packageDetails && shipment.packageDetails.toLowerCase().includes(searchTerm))
            );
        });
        
        // Render filtered shipments
        renderShipments(filteredShipments);
    }, 300); // 300ms delay
}

// Function to view shipment details
async function viewShipmentDetails(shipmentId) {
    try {
        // Show loading in modal
        const modalContent = document.querySelector('#shipmentModal .modal-body');
        if (modalContent) {
            modalContent.innerHTML = '<div class="loading-message">Loading shipment details...</div>';
        }
        
        // Show modal
        const modal = document.getElementById('shipmentModal');
        if (modal) {
            modal.style.display = 'flex';
        }
        
        // Find shipment in cached data first for instant display
        let shipment = allShipments.find(s => s.id === shipmentId);
        
        if (shipment) {
            displayShipmentInModal(shipment);
        } else {
            // If not in cache, fetch from Firestore
            const shipmentDoc = await getDoc(doc(db, 'shipments', shipmentId));
            
            if (shipmentDoc.exists()) {
                shipment = { id: shipmentDoc.id, ...shipmentDoc.data() };
                displayShipmentInModal(shipment);
            } else {
                if (modalContent) {
                    modalContent.innerHTML = '<div class="error-message">Shipment not found</div>';
                }
            }
        }
    } catch (error) {
        console.error('Error viewing shipment details:', error);
        const modalContent = document.querySelector('#shipmentModal .modal-body');
        if (modalContent) {
            modalContent.innerHTML = `<div class="error-message">Error loading shipment: ${error.message}</div>`;
        }
    }
}

// Function to close modal
function closeModal() {
    const modal = document.getElementById('shipmentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    const modal = document.getElementById('shipmentModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Function to cancel shipment
async function cancelShipment(shipmentId) {
    try {
        await updateDoc(doc(db, 'shipments', shipmentId), {
            status: 'cancelled',
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error cancelling shipment:", error);
        alert('Error cancelling shipment. Please try again.');
    }
}

// Function to show loading state
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'flex';
}

// Function to hide loading state
function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
}

// Make functions available to HTML
window.switchTab = switchTab;
window.handleCreateShipment = handleCreateShipment;
window.viewShipmentDetails = viewShipmentDetails;
window.showQRCode = showQRCode;
window.showCancellationModal = showCancellationModal;
window.submitCancellationRequest = submitCancellationRequest;
window.logout = logout;
