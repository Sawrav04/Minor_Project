import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Clear any existing auth data
    localStorage.clear();
    
    // Sign out any existing session
    auth.signOut().catch(console.error);

    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const errorMessage = document.getElementById('error-message');
    const authTabs = document.querySelectorAll('.auth-tab');

    // Setup tab switching
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.getAttribute('data-tab');
            loginForm.style.display = tabName === 'login' ? 'block' : 'none';
            signupForm.style.display = tabName === 'signup' ? 'block' : 'none';
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';
        });
    });

    // Handle signup form submission
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value.trim();
        const role = document.getElementById('role').value;
        
        try {
            // Show loading state
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;
            errorMessage.style.display = 'none';

            console.log('Creating user account...'); // Debug log
            
            // Create account in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('User created:', user.uid); // Debug log

            // Create user document in Firestore
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                email: email,
                role: role,
                createdAt: new Date().toISOString()
            });
            console.log('User document created in Firestore'); // Debug log

            // Store user info in localStorage
            const userData = {
                uid: user.uid,
                email: email,
                role: role
            };
            localStorage.setItem('user', JSON.stringify(userData));
            
            // Redirect based on role
            window.location.href = role === 'carrier' ? 'carrier-dashboard.html' : 'shipper-dashboard.html';
            
        } catch (error) {
            console.error('Signup error:', error);
            // Reset button state
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Sign Up';
            submitBtn.disabled = false;
            showError(getErrorMessage(error.code || error.message));
        }
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        
        try {
            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;
            errorMessage.style.display = 'none';

            // Sign in with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('User logged in:', user.uid); // Debug log

            // Get user data from Firestore
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                throw new Error('User data not found');
            }

            const userRole = userDoc.data().role;
            console.log('User role:', userRole); // Debug log
            
            if (!userRole || (userRole !== 'carrier' && userRole !== 'shipper')) {
                throw new Error('Invalid user role');
            }

            const userData = {
                uid: user.uid,
                email: user.email,
                role: userRole
            };

            // Store user info in localStorage
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('User data stored in localStorage'); // Debug log

            // Redirect based on role
            window.location.href = userRole === 'carrier' ? 'carrier-dashboard.html' : 'shipper-dashboard.html';

        } catch (error) {
            console.error('Login error:', error);
            // Reset button state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Log In';
            submitBtn.disabled = false;
            showError(getErrorMessage(error.code || error.message));
        }
    });
});

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Get user-friendly error message
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters';
        case 'User data not found':
            return 'User data not found. Please try signing up again.';
        case 'Invalid user role':
            return 'Invalid user role. Please contact support.';
        default:
            return `An error occurred: ${errorCode}. Please try again.`;
    }
}
