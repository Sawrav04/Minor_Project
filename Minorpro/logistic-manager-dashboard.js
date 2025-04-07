// Import Firebase modules
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, query, where, orderBy, onSnapshot, 
    addDoc, getDocs, updateDoc, doc, getDoc, 
    Timestamp, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global variables
let currentUser = null;
let carrierApprovalsListener = null;
let carrierListListener = null;
let shipmentAssignmentListener = null;
let cancellationRequestsListener = null;
let allShipmentsListener = null;
let currentShipmentId = null;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Set up auth state listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Get user data from localStorage
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                
                // Check if user is a manager
                if (userData.role !== 'manager') {
                    window.location.href = 'login.html';
                    return;
                }
                
                currentUser = user;
                document.getElementById('userEmail').textContent = user.email;
                
                // Show dashboard and hide loading
                document.getElementById('loading').style.display = 'none';
                document.getElementById('dashboard-content').style.display = 'flex';
                
                // Load initial data for the active tab
                loadTabData('carrierApprovals');
                
                // Set up search functionality
                const searchInput = document.getElementById('searchItems');
                if (searchInput) {
                    searchInput.addEventListener('input', handleSearch);
                }
                
                // Set up filter functionality
                const filterStatus = document.getElementById('filterStatus');
                if (filterStatus) {
                    filterStatus.addEventListener('change', handleFilter);
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

// Function to load data for the selected tab
function loadTabData(tabName) {
    // Clear existing listeners
    clearAllListeners();
    
    // Update the view title
    document.getElementById('viewTitle').textContent = getTabTitle(tabName);
    
    // Hide all tab content
    document.querySelectorAll('.data-grid').forEach(element => {
        element.style.display = 'none';
    });
    
    // Show selected tab content
    document.getElementById(tabName).style.display = 'block';
    
    // Load data based on tab
    switch(tabName) {
        case 'carrierApprovals':
            loadCarrierApprovals();
            break;
        case 'carrierList':
            loadCarrierList();
            break;
        case 'shipmentAssignment':
            loadShipmentAssignment();
            break;
        case 'cancellationRequests':
            loadCancellationRequests();
            break;
        case 'allShipments':
            loadAllShipments();
            break;
    }
}

// Function to get tab title
function getTabTitle(tabName) {
    switch(tabName) {
        case 'carrierApprovals':
            return 'Carrier Approvals';
        case 'carrierList':
            return 'Carrier List';
        case 'shipmentAssignment':
            return 'Shipment Assignment';
        case 'cancellationRequests':
            return 'Cancellation Requests';
        case 'allShipments':
            return 'All Shipments';
        default:
            return 'Dashboard';
    }
}

// Function to clear all listeners
function clearAllListeners() {
    if (carrierApprovalsListener) carrierApprovalsListener();
    if (carrierListListener) carrierListListener();
    if (shipmentAssignmentListener) shipmentAssignmentListener();
    if (cancellationRequestsListener) cancellationRequestsListener();
    if (allShipmentsListener) allShipmentsListener();
}

// Function to load carrier approvals
function loadCarrierApprovals() {
    const container = document.getElementById('carrierApprovalsTable');
    container.innerHTML = '<tr><td colspan="4" class="loading-cell"><div class="loading-spinner"></div><p>Loading carrier approvals...</p></td></tr>';
    
    // Debug message
    console.log('Loading carrier approvals...');
    
    try {
        // Query for carriers with pending status
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'carrier')
        );
        
        carrierApprovalsListener = onSnapshot(q, (querySnapshot) => {
            const carriers = [];
            querySnapshot.forEach((doc) => {
                carriers.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('Found carriers:', carriers);
            
            renderCarrierApprovals(carriers);
            updateItemCount(carriers.length, 'carrier approvals');
        }, (error) => {
            console.error('Error in carrier approvals listener:', error);
            showError('Failed to load carrier approvals: ' + error.message);
            container.innerHTML = `
                <tr>
                    <td colspan="4" class="error-cell">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading carrier approvals: ${error.message}</p>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error setting up carrier approvals listener:', error);
        showError('Failed to set up carrier approvals listener: ' + error.message);
    }
}

// Function to render carrier approvals
function renderCarrierApprovals(carriers) {
    const container = document.getElementById('carrierApprovalsTable');
    const searchTerm = document.getElementById('searchItems').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    
    // Apply filters
    if (filterStatus !== 'all') {
        carriers = carriers.filter(carrier => 
            carrier.status === filterStatus || 
            (!carrier.status && filterStatus === 'pending')
        );
    }
    
    if (searchTerm) {
        carriers = carriers.filter(carrier => 
            carrier.email.toLowerCase().includes(searchTerm)
        );
    }
    
    if (carriers.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="empty-cell">No carriers match your filters</td></tr>';
        return;
    }
    
    let html = '';
    carriers.forEach(carrier => {
        const createdAt = carrier.createdAt ? new Date(carrier.createdAt).toLocaleString() : 'Unknown';
        const statusClass = getStatusClass(carrier.status || 'pending');
        const status = carrier.status || 'pending';
        
        html += `
            <tr>
                <td>${carrier.email}</td>
                <td>${createdAt}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td class="actions-cell">
                    ${status === 'pending' ? `
                        <button class="btn-action btn-accept" onclick="approveCarrierImpl('${carrier.id}')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn-action btn-reject" onclick="rejectCarrierImpl('${carrier.id}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : `
                        <button class="btn-sm btn-primary" onclick="viewCarrierDetails('${carrier.id}')">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    `}
                </td>
            </tr>
        `;
    });
    
    container.innerHTML = html;
    
    // Log for debugging
    console.log('Rendered carriers:', carriers);
    console.log('Carriers with pending status:', carriers.filter(c => (c.status || 'pending') === 'pending').length);
}

// Function to get status class for styling
function getStatusClass(status) {
    switch(status) {
        case 'pending':
            return 'status-pending';
        case 'approved':
            return 'status-approved';
        case 'rejected':
            return 'status-rejected';
        case 'in-transit':
            return 'status-in-transit';
        case 'delivered':
            return 'status-delivered';
        case 'cancelled':
            return 'status-cancelled';
        default:
            return 'status-default';
    }
}

// Function to approve a carrier
async function approveCarrier(carrierId) {
    try {
        // Show loading indicator
        const approveButton = document.querySelector(`button[onclick="approveCarrierImpl('${carrierId}')"]`);
        if (approveButton) {
            approveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Accepting...';
            approveButton.disabled = true;
        }
        
        const carrierRef = doc(db, 'users', carrierId);
        const carrierDoc = await getDoc(carrierRef);
        
        if (!carrierDoc.exists()) {
            showError('Carrier not found');
            return;
        }
        
        const carrierData = carrierDoc.data();
        
        await updateDoc(carrierRef, {
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.uid
        });
        
        showSuccess(`Carrier ${carrierData.email} accepted successfully`);
        
        // Send email notification (to be implemented)
        sendEmailNotification({
            to: carrierData.email,
            subject: 'Your Carrier Account has been Approved',
            body: 'Congratulations! Your carrier account has been approved. You can now log in and start accepting shipments.'
        });
        
        // Switch to carrier list tab to show the newly approved carrier
        setTimeout(() => {
            switchTab('carrierList');
        }, 1500);
    } catch (error) {
        console.error('Error approving carrier:', error);
        showError('Failed to approve carrier: ' + error.message);
        
        // Reset button state
        const approveButton = document.querySelector(`button[onclick="approveCarrierImpl('${carrierId}')"]`);
        if (approveButton) {
            approveButton.innerHTML = '<i class="fas fa-check"></i> Accept';
            approveButton.disabled = false;
        }
    }
}

// Function to reject a carrier
async function rejectCarrier(carrierId) {
    try {
        // Show loading indicator
        const rejectButton = document.querySelector(`button[onclick="rejectCarrierImpl('${carrierId}')"]`);
        if (rejectButton) {
            rejectButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting...';
            rejectButton.disabled = true;
        }
        
        const carrierRef = doc(db, 'users', carrierId);
        const carrierDoc = await getDoc(carrierRef);
        
        if (!carrierDoc.exists()) {
            showError('Carrier not found');
            return;
        }
        
        const carrierData = carrierDoc.data();
        
        await updateDoc(carrierRef, {
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUser.uid
        });
        
        showSuccess(`Carrier ${carrierData.email} rejected successfully`);
        
        // Send email notification (to be implemented)
        sendEmailNotification({
            to: carrierData.email,
            subject: 'Your Carrier Account Application Status',
            body: 'We regret to inform you that your carrier account application has been rejected. Please contact support for more information.'
        });
    } catch (error) {
        console.error('Error rejecting carrier:', error);
        showError('Failed to reject carrier: ' + error.message);
        
        // Reset button state
        const rejectButton = document.querySelector(`button[onclick="rejectCarrierImpl('${carrierId}')"]`);
        if (rejectButton) {
            rejectButton.innerHTML = '<i class="fas fa-times"></i> Reject';
            rejectButton.disabled = false;
        }
    }
}

// Function to get carrier email
async function getCarrierEmail(carrierId) {
    try {
        const carrierRef = doc(db, 'users', carrierId);
        const carrierDoc = await getDoc(carrierRef);
        
        if (carrierDoc.exists()) {
            return carrierDoc.data().email;
        }
        
        return '';
    } catch (error) {
        console.error('Error getting carrier email:', error);
        return '';
    }
}

// Function to update item count
function updateItemCount(count, itemType) {
    const itemCountElement = document.getElementById('itemCount');
    if (itemCountElement) {
        itemCountElement.textContent = `${count} ${itemType}`;
    }
}

// Function to show success message
function showSuccess(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        ${message}
        <button class="close-alert" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.querySelector('.dashboard-main').insertBefore(
        alertDiv,
        document.querySelector('.dashboard-content')
    );
    setTimeout(() => alertDiv.remove(), 5000);
}

// Function to show error message
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-error';
    alertDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        ${message}
        <button class="close-alert" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.querySelector('.dashboard-main').insertBefore(
        alertDiv,
        document.querySelector('.dashboard-content')
    );
    setTimeout(() => alertDiv.remove(), 5000);
}

// Function to handle search
function handleSearch(event) {
    const searchTerm = event.target.value.trim().toLowerCase();
    const activeTab = document.querySelector('.nav-item.active').getAttribute('onclick').match(/switchTab\('(.+?)'\)/)[1];
    
    // Reload the active tab data with the search filter
    loadTabData(activeTab);
}

// Function to handle filter
function handleFilter(event) {
    const activeTab = document.querySelector('.nav-item.active').getAttribute('onclick').match(/switchTab\('(.+?)'\)/)[1];
    
    // Reload the active tab data with the filter
    loadTabData(activeTab);
}

// Function to logout
async function logout() {
    try {
        // Clear all listeners
        clearAllListeners();
        
        // Sign out
        await auth.signOut();
        
        // Redirect to login page
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showError('Failed to sign out: ' + error.message);
    }
}

// Function to close modal
function closeModal() {
    const modal = document.getElementById('shipmentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to close assign modal
function closeAssignModal() {
    const modal = document.getElementById('assignCarrierModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Function to send email notification (placeholder)
function sendEmailNotification(options) {
    console.log('Sending email notification:', options);
    // In a real application, this would send an API request to a backend service
    // that handles email sending
}

// Make functions available to HTML
window.approveCarrierImpl = approveCarrier;
window.rejectCarrierImpl = rejectCarrier;
window.switchTab = switchTab;
window.viewCarrierDetails = viewCarrierDetails;
window.viewShipmentDetails = viewShipmentDetails;
window.assignShipmentToCarrier = assignShipmentToCarrier;
window.approveCancellation = approveCancellation;
window.rejectCancellation = rejectCancellation;
window.showAssignCarrierModal = showAssignCarrierModal;
window.assignCarrier = assignCarrier;
window.logout = logout;
window.closeModal = closeModal;
window.closeAssignModal = closeAssignModal;

// Function to switch between tabs
function switchTab(tabName) {
    // Update navigation active state
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    const selectedTab = document.querySelector(`.sidebar-nav .nav-item[onclick*="${tabName}"]`);
    if (selectedTab) selectedTab.classList.add('active');
    
    // Load data for the selected tab
    loadTabData(tabName);
}

// Function to view carrier details
function viewCarrierDetails(carrierId) {
    getCarrierWithShipments(carrierId).then(data => {
        const { carrier, shipments } = data;
        
        // Create modal content
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalActions = document.getElementById('modalActions');
        
        modalTitle.textContent = 'Carrier Details';
        
        const carrierName = carrier.email.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        let shipmentsHtml = '';
        if (shipments.length > 0) {
            shipmentsHtml = `
                <div class="detail-section">
                    <h4>Current Shipments (${shipments.length})</h4>
                    <div class="shipment-list">
                        ${shipments.map(shipment => `
                            <div class="shipment-item">
                                <div class="shipment-header">
                                    <span class="shipment-id">${shipment.id.substring(0, 8)}...</span>
                                    <span class="status-badge ${getStatusClass(shipment.status)}">${shipment.status}</span>
                                </div>
                                <div class="shipment-details">
                                    <p><strong>From:</strong> ${shipment.pickupAddress}</p>
                                    <p><strong>To:</strong> ${shipment.dropoffAddress}</p>
                                    <p><strong>Package:</strong> ${shipment.packageType}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            shipmentsHtml = `
                <div class="detail-section">
                    <h4>Current Shipments</h4>
                    <p>No active shipments for this carrier</p>
                </div>
            `;
        }
        
        modalBody.innerHTML = `
            <div class="carrier-details">
                <div class="detail-section">
                    <h4>Carrier Information</h4>
                    <p><strong>Name:</strong> ${carrierName}</p>
                    <p><strong>Email:</strong> ${carrier.email}</p>
                    <p><strong>Status:</strong> <span class="status-badge ${getStatusClass(carrier.status)}">${carrier.status}</span></p>
                    <p><strong>Joined:</strong> ${new Date(carrier.createdAt).toLocaleString()}</p>
                    <p><strong>Approved:</strong> ${carrier.approvedAt ? new Date(carrier.approvedAt).toLocaleString() : 'N/A'}</p>
                </div>
                ${shipmentsHtml}
            </div>
        `;
        
        modalActions.innerHTML = '';
        
        // Show the modal
        const modal = document.getElementById('shipmentModal');
        modal.style.display = 'block';
    }).catch(error => {
        console.error('Error getting carrier details:', error);
        showError('Failed to load carrier details: ' + error.message);
    });
}

// Function to get carrier with shipments
async function getCarrierWithShipments(carrierId) {
    try {
        // Get carrier data
        const carrierRef = doc(db, 'users', carrierId);
        const carrierDoc = await getDoc(carrierRef);
        
        if (!carrierDoc.exists()) {
            throw new Error('Carrier not found');
        }
        
        const carrier = {
            id: carrierDoc.id,
            ...carrierDoc.data()
        };
        
        // Get carrier's shipments
        const shipmentQuery = query(
            collection(db, 'shipments'),
            where('carrierId', '==', carrierId),
            where('status', 'in', ['pending', 'in-transit'])
        );
        
        const shipmentSnapshot = await getDocs(shipmentQuery);
        const shipments = [];
        
        shipmentSnapshot.forEach(doc => {
            shipments.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return { carrier, shipments };
    } catch (error) {
        console.error('Error getting carrier with shipments:', error);
        throw error;
    }
}

// Function to load carrier list
function loadCarrierList() {
    const container = document.getElementById('carrierListTable');
    container.innerHTML = '<tr><td colspan="5" class="loading-cell"><div class="loading-spinner"></div><p>Loading carriers...</p></td></tr>';
    
    try {
        // Query for approved carriers
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'carrier'),
            where('status', '==', 'approved')
        );
        
        carrierListListener = onSnapshot(q, async (querySnapshot) => {
            const carriers = [];
            
            // Get all carriers
            for (const docSnapshot of querySnapshot.docs) {
                const carrierData = docSnapshot.data();
                
                // Get current shipments count for this carrier
                const shipmentCount = await getCarrierShipmentCount(docSnapshot.id);
                
                // Get approval date
                const approvedAt = carrierData.approvedAt ? new Date(carrierData.approvedAt).toLocaleString() : 'Unknown';
                
                carriers.push({ 
                    id: docSnapshot.id, 
                    ...carrierData,
                    shipmentCount,
                    approvedAt
                });
            }
            
            renderCarrierList(carriers);
            updateItemCount(carriers.length, 'approved carriers');
        }, (error) => {
            console.error('Error in carrier list listener:', error);
            showError('Failed to load carrier list: ' + error.message);
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="error-cell">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading carriers: ${error.message}</p>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error setting up carrier list listener:', error);
        showError('Failed to set up carrier list listener: ' + error.message);
    }
}

// Function to get carrier shipment count
async function getCarrierShipmentCount(carrierId) {
    try {
        const shipmentQuery = query(
            collection(db, 'shipments'),
            where('carrierId', '==', carrierId),
            where('status', 'in', ['pending', 'in-transit'])
        );
        
        const querySnapshot = await getDocs(shipmentQuery);
        return querySnapshot.size;
    } catch (error) {
        console.error('Error getting carrier shipment count:', error);
        return 0;
    }
}

// Function to render carrier list
function renderCarrierList(carriers) {
    const container = document.getElementById('carrierListTable');
    
    if (carriers.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="empty-cell">No approved carriers found</td></tr>';
        return;
    }
    
    // Sort carriers by approval date (newest first)
    carriers.sort((a, b) => {
        const aDate = a.approvedAt ? new Date(a.approvedAt) : new Date(0);
        const bDate = b.approvedAt ? new Date(b.approvedAt) : new Date(0);
        return bDate - aDate;
    });
    
    // Apply search if needed
    const searchTerm = document.getElementById('searchItems').value.trim().toLowerCase();
    if (searchTerm) {
        carriers = carriers.filter(carrier => 
            carrier.email.toLowerCase().includes(searchTerm)
        );
    }
    
    if (carriers.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="empty-cell">No carriers match your search</td></tr>';
        return;
    }
    
    let html = '';
    carriers.forEach(carrier => {
        const carrierName = carrier.email.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        html += `
            <tr>
                <td>${carrierName}</td>
                <td>${carrier.email}</td>
                <td>${carrier.shipmentCount || 0}</td>
                <td><span class="status-badge status-approved">Active</span></td>
                <td class="actions-cell">
                    <button class="btn-sm btn-primary" onclick="viewCarrierDetails('${carrier.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </td>
            </tr>
        `;
    });
    
    container.innerHTML = html;
}

// Function to assign carrier
function assignCarrier() {
    const carrierId = document.getElementById('carrierSelect').value;
    
    if (!carrierId) {
        showError('Please select a carrier');
        return;
    }
    
    if (!currentShipmentId) {
        showError('No shipment selected');
        return;
    }
    
    assignShipmentToCarrier(currentShipmentId, carrierId)
        .then(() => {
            closeAssignModal();
            showSuccess('Shipment assigned successfully');
        })
        .catch(error => {
            console.error('Error assigning shipment:', error);
            showError('Failed to assign shipment: ' + error.message);
        });
}

// Function to assign shipment to carrier
async function assignShipmentToCarrier(shipmentId, carrierId) {
    try {
        // Get carrier data
        const carrierRef = doc(db, 'users', carrierId);
        const carrierDoc = await getDoc(carrierRef);
        
        if (!carrierDoc.exists()) {
            throw new Error('Carrier not found');
        }
        
        const carrierData = carrierDoc.data();
        
        // Get shipment data
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        
        // Update shipment with carrier info
        await updateDoc(shipmentRef, {
            carrierId: carrierId,
            carrierEmail: carrierData.email,
            assignedAt: new Date().toISOString(),
            assignedBy: currentUser.uid,
            status: 'assigned'
        });
        
        // Send email notifications
        await sendEmailNotification({
            to: carrierData.email,
            subject: 'New Shipment Assigned',
            body: `You have been assigned a new shipment (ID: ${shipmentId}). Please check your dashboard for details.`
        });
        
        await sendEmailNotification({
            to: shipmentData.shipperEmail,
            subject: 'Carrier Assigned to Your Shipment',
            body: `A carrier has been assigned to your shipment (ID: ${shipmentId}). Carrier: ${carrierData.email}`
        });
        
        return true;
    } catch (error) {
        console.error('Error assigning shipment to carrier:', error);
        throw error;
    }
}

// Function to load shipment assignment
function loadShipmentAssignment() {
    const container = document.getElementById('shipmentAssignmentTable');
    container.innerHTML = '<tr><td colspan="6" class="loading-cell"><div class="loading-spinner"></div><p>Loading shipments...</p></td></tr>';
    
    try {
        // Query for pending shipments without a carrier
        const q = query(
            collection(db, 'shipments'),
            where('status', '==', 'pending')
        );
        
        shipmentAssignmentListener = onSnapshot(q, (querySnapshot) => {
            const shipments = [];
            querySnapshot.forEach((doc) => {
                shipments.push({ id: doc.id, ...doc.data() });
            });
            
            renderShipmentAssignment(shipments);
            updateItemCount(shipments.length, 'pending shipments');
        }, (error) => {
            console.error('Error in shipment assignment listener:', error);
            showError('Failed to load pending shipments: ' + error.message);
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="error-cell">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading shipments: ${error.message}</p>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error setting up shipment assignment listener:', error);
        showError('Failed to set up shipment assignment listener: ' + error.message);
    }
}

// Function to render shipment assignment
function renderShipmentAssignment(shipments) {
    const container = document.getElementById('shipmentAssignmentTable');
    
    if (shipments.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="empty-cell">No pending shipments found</td></tr>';
        return;
    }
    
    // Sort shipments by creation date (newest first)
    shipments.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return bDate - aDate;
    });
    
    // Apply search if needed
    const searchTerm = document.getElementById('searchItems').value.trim().toLowerCase();
    if (searchTerm) {
        shipments = shipments.filter(shipment => 
            (shipment.id && shipment.id.toLowerCase().includes(searchTerm)) ||
            (shipment.shipperEmail && shipment.shipperEmail.toLowerCase().includes(searchTerm)) ||
            (shipment.pickupAddress && shipment.pickupAddress.toLowerCase().includes(searchTerm)) ||
            (shipment.dropoffAddress && shipment.dropoffAddress.toLowerCase().includes(searchTerm))
        );
    }
    
    if (shipments.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="empty-cell">No shipments match your search</td></tr>';
        return;
    }
    
    let html = '';
    shipments.forEach(shipment => {
        const shipperEmail = shipment.shipperEmail || 'Unknown';
        const shipperName = shipperEmail.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        html += `
            <tr>
                <td>${shipment.id.substring(0, 8)}...</td>
                <td>${shipperName}</td>
                <td>${shipment.packageType || 'Standard'}</td>
                <td>${shipment.pickupAddress || 'N/A'}</td>
                <td>${shipment.dropoffAddress || 'N/A'}</td>
                <td class="actions-cell">
                    <button class="btn-sm btn-primary" onclick="viewShipmentDetails('${shipment.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-sm btn-success" onclick="showAssignCarrierModal('${shipment.id}')">
                        <i class="fas fa-user-plus"></i> Assign
                    </button>
                </td>
            </tr>
        `;
    });
    
    container.innerHTML = html;
}

// Function to show assign carrier modal
function showAssignCarrierModal(shipmentId) {
    currentShipmentId = shipmentId;
    
    // Load available carriers
    loadAvailableCarriers().then(carriers => {
        const carrierSelect = document.getElementById('carrierSelect');
        
        // Clear existing options
        carrierSelect.innerHTML = '<option value="">Select a carrier</option>';
        
        // Add carriers to select
        carriers.forEach(carrier => {
            const carrierName = carrier.email.split('@')[0]
                .split('.')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            
            const option = document.createElement('option');
            option.value = carrier.id;
            option.textContent = `${carrierName} (${carrier.email}) - ${carrier.shipmentCount || 0} active shipments`;
            carrierSelect.appendChild(option);
        });
        
        // Show the modal
        const modal = document.getElementById('assignCarrierModal');
        modal.style.display = 'block';
    }).catch(error => {
        console.error('Error loading available carriers:', error);
        showError('Failed to load available carriers: ' + error.message);
    });
}

// Function to load available carriers
async function loadAvailableCarriers() {
    try {
        // Query for approved carriers
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'carrier'),
            where('status', '==', 'approved')
        );
        
        const querySnapshot = await getDocs(q);
        const carriers = [];
        
        // Get all carriers with their shipment counts
        for (const docSnapshot of querySnapshot.docs) {
            const carrierData = docSnapshot.data();
            
            // Get current shipments count for this carrier
            const shipmentCount = await getCarrierShipmentCount(docSnapshot.id);
            
            carriers.push({ 
                id: docSnapshot.id, 
                ...carrierData,
                shipmentCount
            });
        }
        
        // Sort carriers by shipment count (lowest first)
        carriers.sort((a, b) => (a.shipmentCount || 0) - (b.shipmentCount || 0));
        
        return carriers;
    } catch (error) {
        console.error('Error loading available carriers:', error);
        throw error;
    }
}

// Function to view shipment details
function viewShipmentDetails(shipmentId) {
    getShipmentDetails(shipmentId).then(shipment => {
        // Create modal content
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalActions = document.getElementById('modalActions');
        
        modalTitle.textContent = 'Shipment Details';
        
        const shipperName = shipment.shipperEmail ? shipment.shipperEmail.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') : 'Unknown';
        
        const createdAt = shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : 'Unknown';
        
        modalBody.innerHTML = `
            <div class="shipment-details">
                <div class="detail-section">
                    <h4>Shipment Information</h4>
                    <p><strong>ID:</strong> ${shipment.id}</p>
                    <p><strong>Status:</strong> <span class="status-badge ${getStatusClass(shipment.status)}">${shipment.status}</span></p>
                    <p><strong>Created:</strong> ${createdAt}</p>
                </div>
                
                <div class="detail-section">
                    <h4>Shipper Information</h4>
                    <p><strong>Name:</strong> ${shipperName}</p>
                    <p><strong>Email:</strong> ${shipment.shipperEmail || 'N/A'}</p>
                </div>
                
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
        if (shipment.status === 'pending' && !shipment.carrierId) {
            modalActions.innerHTML = `
                <button class="btn-primary" onclick="showAssignCarrierModal('${shipment.id}')">
                    <i class="fas fa-user-plus"></i> Assign Carrier
                </button>
            `;
        } else {
            modalActions.innerHTML = '';
        }
        
        // Show the modal
        const modal = document.getElementById('shipmentModal');
        modal.style.display = 'block';
    }).catch(error => {
        console.error('Error getting shipment details:', error);
        showError('Failed to load shipment details: ' + error.message);
    });
}

// Function to get shipment details
async function getShipmentDetails(shipmentId) {
    try {
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        return {
            id: shipmentDoc.id,
            ...shipmentDoc.data()
        };
    } catch (error) {
        console.error('Error getting shipment details:', error);
        throw error;
    }
}

// Function to load cancellation requests
function loadCancellationRequests() {
    const container = document.getElementById('cancellationRequestsTable');
    container.innerHTML = '<tr><td colspan="6" class="loading-cell"><div class="loading-spinner"></div><p>Loading cancellation requests...</p></td></tr>';
    
    try {
        // Query for shipments with cancellation requests
        const q = query(
            collection(db, 'shipments'),
            where('cancellationRequested', '==', true)
        );
        
        cancellationRequestsListener = onSnapshot(q, (querySnapshot) => {
            const requests = [];
            querySnapshot.forEach((doc) => {
                requests.push({ id: doc.id, ...doc.data() });
            });
            
            renderCancellationRequests(requests);
            updateItemCount(requests.length, 'cancellation requests');
        }, (error) => {
            console.error('Error in cancellation requests listener:', error);
            showError('Failed to load cancellation requests: ' + error.message);
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="error-cell">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading cancellation requests: ${error.message}</p>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error setting up cancellation requests listener:', error);
        showError('Failed to set up cancellation requests listener: ' + error.message);
    }
}

// Function to render cancellation requests
function renderCancellationRequests(requests) {
    const container = document.getElementById('cancellationRequestsTable');
    
    if (requests.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="empty-cell">No cancellation requests found</td></tr>';
        return;
    }
    
    // Sort requests by request date (newest first)
    requests.sort((a, b) => {
        const aDate = a.cancellationRequestedAt ? new Date(a.cancellationRequestedAt) : new Date(0);
        const bDate = b.cancellationRequestedAt ? new Date(b.cancellationRequestedAt) : new Date(0);
        return bDate - aDate;
    });
    
    // Apply search if needed
    const searchTerm = document.getElementById('searchItems').value.trim().toLowerCase();
    if (searchTerm) {
        requests = requests.filter(request => 
            (request.id && request.id.toLowerCase().includes(searchTerm)) ||
            (request.shipperEmail && request.shipperEmail.toLowerCase().includes(searchTerm)) ||
            (request.carrierEmail && request.carrierEmail.toLowerCase().includes(searchTerm)) ||
            (request.cancellationReason && request.cancellationReason.toLowerCase().includes(searchTerm))
        );
    }
    
    if (requests.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="empty-cell">No requests match your search</td></tr>';
        return;
    }
    
    let html = '';
    requests.forEach(request => {
        const shipperEmail = request.shipperEmail || 'Unknown';
        const shipperName = shipperEmail.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        const carrierEmail = request.carrierEmail || 'Not assigned';
        const carrierName = carrierEmail === 'Not assigned' ? 'Not assigned' : carrierEmail.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        const requestDate = request.cancellationRequestedAt ? new Date(request.cancellationRequestedAt).toLocaleString() : 'Unknown';
        
        html += `
            <tr>
                <td>${request.id.substring(0, 8)}...</td>
                <td>${shipperName}</td>
                <td>${carrierName}</td>
                <td>${request.cancellationReason || 'No reason provided'}</td>
                <td>${requestDate}</td>
                <td class="actions-cell">
                    <button class="btn-sm btn-primary" onclick="viewShipmentDetails('${request.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-sm btn-success" onclick="approveCancellation('${request.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-sm btn-danger" onclick="rejectCancellation('${request.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            </tr>
        `;
    });
    
    container.innerHTML = html;
}

// Function to approve cancellation
async function approveCancellation(shipmentId) {
    try {
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        
        // Update shipment status
        await updateDoc(shipmentRef, {
            status: 'cancelled',
            cancellationApproved: true,
            cancellationApprovedAt: new Date().toISOString(),
            cancellationApprovedBy: currentUser.uid
        });
        
        showSuccess('Cancellation approved');
        
        // Send email notifications
        if (shipmentData.shipperEmail) {
            await sendEmailNotification({
                to: shipmentData.shipperEmail,
                subject: 'Shipment Cancellation Approved',
                body: `Your cancellation request for shipment (ID: ${shipmentId}) has been approved.`
            });
        }
        
        if (shipmentData.carrierEmail) {
            await sendEmailNotification({
                to: shipmentData.carrierEmail,
                subject: 'Shipment Cancelled',
                body: `A shipment assigned to you (ID: ${shipmentId}) has been cancelled.`
            });
        }
    } catch (error) {
        console.error('Error approving cancellation:', error);
        showError('Failed to approve cancellation: ' + error.message);
    }
}

// Function to reject cancellation
async function rejectCancellation(shipmentId) {
    try {
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        
        // Update shipment to remove cancellation request
        await updateDoc(shipmentRef, {
            cancellationRequested: false,
            cancellationRejectedAt: new Date().toISOString(),
            cancellationRejectedBy: currentUser.uid
        });
        
        showSuccess('Cancellation rejected');
        
        // Send email notification to shipper
        if (shipmentData.shipperEmail) {
            await sendEmailNotification({
                to: shipmentData.shipperEmail,
                subject: 'Shipment Cancellation Rejected',
                body: `Your cancellation request for shipment (ID: ${shipmentId}) has been rejected. The shipment will continue as planned.`
            });
        }
    } catch (error) {
        console.error('Error rejecting cancellation:', error);
        showError('Failed to reject cancellation: ' + error.message);
    }
}

// Function to load all shipments
function loadAllShipments() {
    const container = document.getElementById('allShipmentsTable');
    container.innerHTML = '<tr><td colspan="6" class="loading-cell"><div class="loading-spinner"></div><p>Loading shipments...</p></td></tr>';
    
    try {
        // Query for all shipments
        const q = query(
            collection(db, 'shipments')
        );
        
        allShipmentsListener = onSnapshot(q, (querySnapshot) => {
            const shipments = [];
            querySnapshot.forEach((doc) => {
                shipments.push({ id: doc.id, ...doc.data() });
            });
            
            renderAllShipments(shipments);
            updateItemCount(shipments.length, 'shipments');
        }, (error) => {
            console.error('Error in all shipments listener:', error);
            showError('Failed to load shipments: ' + error.message);
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="error-cell">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading shipments: ${error.message}</p>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error setting up all shipments listener:', error);
        showError('Failed to set up shipments listener: ' + error.message);
    }
}

// Function to render all shipments
function renderAllShipments(shipments) {
    const container = document.getElementById('allShipmentsTable');
    
    if (shipments.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="empty-cell">No shipments found</td></tr>';
        return;
    }
    
    // Sort shipments by creation date (newest first)
    shipments.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return bDate - aDate;
    });
    
    // Apply filter if needed
    const filterStatus = document.getElementById('filterStatus').value;
    if (filterStatus !== 'all') {
        shipments = shipments.filter(shipment => shipment.status === filterStatus);
    }
    
    // Apply search if needed
    const searchTerm = document.getElementById('searchItems').value.trim().toLowerCase();
    if (searchTerm) {
        shipments = shipments.filter(shipment => 
            (shipment.id && shipment.id.toLowerCase().includes(searchTerm)) ||
            (shipment.shipperEmail && shipment.shipperEmail.toLowerCase().includes(searchTerm)) ||
            (shipment.carrierEmail && shipment.carrierEmail.toLowerCase().includes(searchTerm)) ||
            (shipment.status && shipment.status.toLowerCase().includes(searchTerm))
        );
    }
    
    if (shipments.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="empty-cell">No shipments match your filters</td></tr>';
        return;
    }
    
    let html = '';
    shipments.forEach(shipment => {
        const shipperEmail = shipment.shipperEmail || 'Unknown';
        const shipperName = shipperEmail.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        const carrierEmail = shipment.carrierEmail || 'Not assigned';
        const carrierName = carrierEmail === 'Not assigned' ? 'Not assigned' : carrierEmail.split('@')[0]
            .split('.')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        html += `
            <tr>
                <td>${shipment.id.substring(0, 8)}...</td>
                <td>${shipperName}</td>
                <td>${carrierName}</td>
                <td>${shipment.packageType || 'Standard'}</td>
                <td><span class="status-badge ${getStatusClass(shipment.status)}">${shipment.status}</span></td>
                <td class="actions-cell">
                    <button class="btn-sm btn-primary" onclick="viewShipmentDetails('${shipment.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${shipment.status === 'pending' && !shipment.carrierId ? `
                        <button class="btn-sm btn-success" onclick="showAssignCarrierModal('${shipment.id}')">
                            <i class="fas fa-user-plus"></i> Assign
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    });
    
    container.innerHTML = html;
}

// Make additional functions available to HTML
window.approveCancellation = approveCancellation;
window.rejectCancellation = rejectCancellation;
window.showAssignCarrierModal = showAssignCarrierModal;
