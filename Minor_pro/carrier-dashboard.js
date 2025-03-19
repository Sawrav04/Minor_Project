import { auth, db } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let acceptedShipments = [];
let allAvailableShipments = []; // Store all available shipments for filtering

// Check authentication state when page loads
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            // If no user is logged in, redirect to login page
            window.location.href = 'login.html';
            return;
        }

        // Get user data from localStorage
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        
        // If user is not a carrier, redirect to appropriate dashboard
        if (userData.role !== 'carrier') {
            window.location.href = 'shipper-dashboard.html';
            return;
        }

        // User is authenticated and is a carrier, initialize dashboard
        initializeDashboard();
    });

    // Set up event listeners for modal
    setupModalListeners();
});

// Initialize the dashboard
function initializeDashboard() {
    currentUser = auth.currentUser;
    console.log('Initializing dashboard for user:', currentUser.uid);
    
    // Update user info immediately
    updateUserInfo();
    
    // Set up real-time listeners
    setupShipmentListeners();
    
    // Add event listener for filter dropdown
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.addEventListener('change', function() {
            const selectedFilter = filterStatus.value;
            console.log('Filter changed to:', selectedFilter);
            renderAssignedShipments(selectedFilter);
        });
    }
    
    // Show all shipments if we're on the My Shipments tab
    const acceptedShipmentsContainer = document.getElementById('acceptedShipments');
    if (acceptedShipmentsContainer && window.getComputedStyle(acceptedShipmentsContainer).display !== 'none') {
        console.log('Initially on My Shipments tab, showing all shipments');
        renderAssignedShipments('all');
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
    
    // Listen for available shipments (status: pending, not assigned to any carrier)
    try {
        const availableShipmentsQuery = query(
            collection(db, 'shipments'),
            where('status', '==', 'pending')
        );
        
        console.log('Available shipments query created');
        
        onSnapshot(availableShipmentsQuery, (snapshot) => {
            const shipments = [];
            console.log('Received snapshot with', snapshot.size, 'documents');
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log('Shipment data:', doc.id, data);
                
                // Only show shipments that don't have a carrier assigned
                if (!data.carrierId) {
                    shipments.push({
                        id: doc.id,
                        ...data
                    });
                }
            });
            
            console.log('Available shipments loaded:', shipments.length);
            allAvailableShipments = shipments;
            
            // Only render if we're on the Available tab
            const availableContainer = document.getElementById('availableShipments');
            if (availableContainer && window.getComputedStyle(availableContainer).display === 'block') {
                renderAvailableShipments(shipments);
            }
        }, (error) => {
            console.error('Error listening for available shipments:', error);
            showAlert('error', 'Failed to load available shipments: ' + error.message);
            
            // Show error state in container
            const availableShipmentsContainer = document.getElementById('availableShipments');
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
        const assignedShipmentsQuery = query(
            collection(db, 'shipments'),
            where('carrierId', '==', currentUser.uid)
        );
        
        console.log('Assigned shipments query created');
        
        onSnapshot(assignedShipmentsQuery, (snapshot) => {
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
            
            // Always store the shipments but only render if we're on the My Shipments tab
            const acceptedContainer = document.getElementById('acceptedShipments');
            if (acceptedContainer && window.getComputedStyle(acceptedContainer).display === 'block') {
                const filterStatus = document.getElementById('filterStatus');
                const currentFilter = filterStatus ? filterStatus.value : 'all';
                console.log('My Shipments tab is visible, rendering with filter:', currentFilter);
                renderAssignedShipments(currentFilter);
            }
        }, (error) => {
            console.error('Error listening for assigned shipments:', error);
            showAlert('error', 'Failed to load your shipments: ' + error.message);
            
            // Show error state in container
            const acceptedShipmentsContainer = document.getElementById('acceptedShipmentCards');
            if (acceptedShipmentsContainer) {
                acceptedShipmentsContainer.innerHTML = `
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

// Render available shipments
function renderAvailableShipments(shipments) {
    // Store the full list for filtering
    allAvailableShipments = [...shipments];
    
    const availableShipmentsContainer = document.getElementById('availableShipments');
    if (!availableShipmentsContainer) return;
    
    // Apply filter if selected
    const filterStatus = document.getElementById('filterStatus');
    const selectedFilter = filterStatus ? filterStatus.value : 'all';
    
    let filteredShipments = shipments;
    if (selectedFilter !== 'all') {
        filteredShipments = shipments.filter(shipment => shipment.status === selectedFilter);
    }
    
    console.log('Rendering available shipments:', filteredShipments.length);
    
    if (filteredShipments.length === 0) {
        availableShipmentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>No available shipments at the moment</p>
                <span>Check back later for new shipments</span>
            </div>
        `;
        return;
    }
    
    availableShipmentsContainer.innerHTML = filteredShipments.map(shipment => {
        return `
            <div class="shipment-card" data-id="${shipment.id}">
                <div class="shipment-header">
                    <h4>Shipment #${shipment.id.slice(0, 8)}</h4>
                    <span class="status-badge ${shipment.status}">
                        ${shipment.status}
                    </span>
                </div>
                <div class="shipment-body">
                    <div class="shipment-info">
                        <i class="fas fa-user"></i>
                        <span>From: ${shipment.shipperEmail || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Pickup: ${shipment.pickupAddress || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-map-marker"></i>
                        <span>Delivery: ${shipment.dropoffAddress || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-box"></i>
                        <span>Package: ${shipment.packageType || 'N/A'} (${shipment.weight || 'N/A'} kg)</span>
                    </div>
                </div>
                <div class="shipment-actions">
                    <button onclick="viewShipmentDetails('${shipment.id}')" class="btn-secondary">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button onclick="acceptShipment('${shipment.id}')" class="btn-primary">
                        <i class="fas fa-check"></i> Accept Shipment
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Render assigned shipments
function renderAssignedShipments(filter = 'all') {
    console.log('Starting renderAssignedShipments with', acceptedShipments.length, 'shipments and filter:', filter);
    
    const shipmentCardsContainer = document.getElementById('acceptedShipmentCards');
    if (!shipmentCardsContainer) {
        console.error('Shipment cards container not found');
        return;
    }
    
    if (!acceptedShipments || acceptedShipments.length === 0) {
        console.log('No accepted shipments found');
        shipmentCardsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-truck"></i>
                <p>No shipments found</p>
                <span>Accept shipments from the Available tab</span>
            </div>
        `;
        return;
    }
    
    // Apply filter if selected
    let filteredShipments = acceptedShipments;
    if (filter !== 'all') {
        filteredShipments = acceptedShipments.filter(shipment => shipment.status === filter);
        console.log('Filtered shipments:', filteredShipments.length, 'with filter:', filter);
    }
    
    if (filteredShipments.length === 0) {
        shipmentCardsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-truck"></i>
                <p>No ${filter} shipments found</p>
                <span>Try changing the filter</span>
            </div>
        `;
        return;
    }
    
    // Sort shipments by date
    filteredShipments.sort((a, b) => b.createdAt - a.createdAt);
    
    // Render shipment cards
    shipmentCardsContainer.innerHTML = filteredShipments.map(shipment => {
        const createdDate = shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString() : 'N/A';
        
        return `
            <div class="shipment-card">
                <div class="shipment-header">
                    <h4>Shipment #${shipment.id.slice(-6)}</h4>
                    <span class="status-badge ${shipment.status}">${shipment.status}</span>
                </div>
                <div class="shipment-body">
                    <div class="shipment-info">
                        <i class="fas fa-user"></i>
                        <span>From: ${shipment.shipperEmail || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Pickup: ${shipment.pickupAddress || shipment.pickupLocation || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-map-marker"></i>
                        <span>Delivery: ${shipment.dropoffAddress || shipment.deliveryLocation || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-box"></i>
                        <span>Package: ${shipment.packageType || 'N/A'} (${shipment.weight || 'N/A'} kg)</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-user-circle"></i>
                        <span>Receiver: ${shipment.receiverName || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-phone"></i>
                        <span>Contact: ${shipment.receiverContact || 'N/A'}</span>
                    </div>
                    <div class="shipment-info">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Created: ${createdDate}</span>
                    </div>
                    ${shipment.details ? `
                    <div class="shipment-info">
                        <i class="fas fa-info-circle"></i>
                        <span>Details: ${shipment.details}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="shipment-actions">
                    <button onclick="viewShipmentDetails('${shipment.id}')" class="btn-secondary">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${shipment.status === 'pending' ? `
                        <button onclick="updateShipmentStatus('${shipment.id}', 'in-transit')" class="btn-primary">
                            <i class="fas fa-truck"></i> Start Delivery
                        </button>
                    ` : shipment.status === 'in-transit' ? `
                        <button onclick="updateShipmentStatus('${shipment.id}', 'delivered')" class="btn-primary">
                            <i class="fas fa-check"></i> Mark as Delivered
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    console.log('Rendered', filteredShipments.length, 'shipment cards');
}

// Function to switch between views
function switchView(view) {
    console.log('Switching view to:', view);
    
    // Hide all views first
    document.getElementById('availableShipments').style.display = 'none';
    document.getElementById('acceptedShipments').style.display = 'none';
    document.getElementById('profile').style.display = 'none';
    
    // Show the selected view
    switch(view) {
        case 'available':
            document.getElementById('availableShipments').style.display = 'block';
            // Render available shipments if we have them
            if (allAvailableShipments && allAvailableShipments.length > 0) {
                renderAvailableShipments(allAvailableShipments);
            }
            break;
            
        case 'accepted':
            document.getElementById('acceptedShipments').style.display = 'block';
            // Reset filter and render all assigned shipments
            const filterStatus = document.getElementById('filterStatus');
            if (filterStatus) {
                filterStatus.value = 'all';
            }
            console.log('Rendering all assigned shipments');
            // Force render the shipments we have
            if (acceptedShipments && acceptedShipments.length > 0) {
                renderAssignedShipments('all');
            } else {
                console.log('No accepted shipments to display');
                document.getElementById('acceptedShipmentCards').innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-box"></i>
                        <p>You haven't accepted any shipments yet</p>
                    </div>
                `;
            }
            break;
            
        case 'profile':
            document.getElementById('profile').style.display = 'block';
            break;
            
        default:
            console.error('Invalid view:', view);
            return;
    }
    
    // Update active tab styling
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[onclick="switchView('${view}')"]`).classList.add('active');
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
    getShipmentDetails(shipmentId, 'available');
}

// Get shipment details from Firestore
async function getShipmentDetails(shipmentId, type) {
    try {
        console.log('Getting shipment details for ID:', shipmentId);
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            console.error('Shipment not found:', shipmentId);
            throw new Error('Shipment not found');
        }
        
        const shipment = {
            id: shipmentDoc.id,
            ...shipmentDoc.data()
        };
        
        console.log('Retrieved shipment details:', shipment);
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
    const actionButton = document.getElementById('actionButton');
    
    // Format dates
    const createdDate = shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : 'N/A';
    const updatedDate = shipment.updatedAt ? new Date(shipment.updatedAt).toLocaleString() : 'N/A';
    
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
                                    <h5>${update.status}</h5>
                                    <p>${update.message}</p>
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
                <p>No tracking updates available yet.</p>
            </div>
        `;
    }
    
    // Set modal content
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
                        <span class="status-badge ${shipment.status}">${shipment.status}</span>
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
                <div class="detail-row">
                    <div class="detail-label">Type:</div>
                    <div class="detail-value">${shipment.packageType || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Weight:</div>
                    <div class="detail-value">${shipment.weight || 'N/A'} kg</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Dimensions:</div>
                    <div class="detail-value">${shipment.dimensions || 'N/A'}</div>
                </div>
            </div>
            
            <div class="shipment-detail-section">
                <h4>Addresses</h4>
                <div class="detail-row">
                    <div class="detail-label">Pickup:</div>
                    <div class="detail-value">${shipment.pickupAddress || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Delivery:</div>
                    <div class="detail-value">${shipment.dropoffAddress || 'N/A'}</div>
                </div>
            </div>
            
            ${trackingHtml}
        </div>
    `;
    
    // Configure action button based on shipment type and status
    if (type === 'available') {
        actionButton.textContent = 'Accept Shipment';
        actionButton.className = 'btn-primary';
        actionButton.onclick = () => acceptShipment(shipment.id);
        actionButton.style.display = 'block';
    } else if (type === 'accepted') {
        // For accepted shipments, show different buttons based on status
        switch(shipment.status) {
            case 'pending':
                actionButton.textContent = 'Start Delivery';
                actionButton.className = 'btn-primary';
                actionButton.onclick = () => updateShipmentStatus(shipment.id, 'in-transit');
                actionButton.style.display = 'block';
                break;
            case 'in-transit':
                actionButton.textContent = 'Mark as Delivered';
                actionButton.className = 'btn-success';
                actionButton.onclick = () => updateShipmentStatus(shipment.id, 'delivered');
                actionButton.style.display = 'block';
                break;
            case 'delivered':
                actionButton.style.display = 'none';
                break;
            default:
                actionButton.style.display = 'none';
        }
    }
    
    // Show the modal
    modal.style.display = 'block';
}

// Accept a shipment
async function acceptShipment(shipmentId) {
    try {
        console.log('Accepting shipment:', shipmentId);
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            console.error('Shipment not found:', shipmentId);
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        console.log('Shipment data before update:', shipmentData);
        
        // Check if shipment is already assigned
        if (shipmentData.carrierId) {
            console.error('Shipment already assigned:', shipmentId);
            throw new Error('This shipment has already been assigned to another carrier');
        }
        
        // Create tracking update
        const trackingUpdate = {
            status: 'pending',
            timestamp: new Date().toISOString(),
            message: 'Shipment accepted by carrier',
            updatedBy: currentUser.email
        };
        
        // Get existing tracking updates or initialize empty array
        const existingUpdates = shipmentData.trackingUpdates || [];
        
        // Update the shipment
        const updateData = {
            carrierId: currentUser.uid,
            carrierEmail: currentUser.email,
            updatedAt: new Date().toISOString(),
            trackingUpdates: [trackingUpdate, ...existingUpdates]
        };
        
        console.log('Updating shipment with:', updateData);
        await updateDoc(shipmentRef, updateData);
        console.log('Shipment updated successfully');
        
        // Automatically switch to My Shipments tab and render immediately
        switchView('accepted');
        
        showAlert('success', 'Shipment accepted successfully!');
    } catch (error) {
        console.error('Error accepting shipment:', error);
        showAlert('error', 'Failed to accept shipment: ' + error.message);
    }
}

// Update shipment status
async function updateShipmentStatus(shipmentId, newStatus) {
    try {
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        const currentStatus = shipmentData.status;
        
        // Validate status transition
        const validTransitions = {
            'pending': ['in-transit'],
            'in-transit': ['delivered']
        };
        
        if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(newStatus)) {
            throw new Error(`Cannot change status from ${currentStatus} to ${newStatus}`);
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
            updatedBy: currentUser.email
        };
        
        await updateDoc(shipmentRef, {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            trackingUpdates: [newUpdate, ...existingUpdates]
        });
        
        // Close the modal if it's open
        const modal = document.getElementById('shipmentModal');
        if (modal && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
        
        showAlert('success', `Shipment status updated to ${newStatus}!`);
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
    const alert = document.getElementById('alert');
    const alertIcon = alert.querySelector('.alert-icon');
    const alertMessage = alert.querySelector('.alert-message');
    
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
    alert.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        alert.style.display = 'none';
    }, 3000);
}

// Logout function
async function logout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showAlert('error', 'Failed to sign out');
    }
}

// Make functions available globally
window.viewShipmentDetails = viewShipmentDetails;
window.acceptShipment = acceptShipment;
window.updateShipmentStatus = updateShipmentStatus;
window.switchView = switchView;
window.logout = logout;
