// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Replace with your actual Firebase configuration
// You can get this from your Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyCUKEtEsj0ZyFhX-UIpum2lwUn9DySDKSo",
    authDomain: "logistic-system-64c05.firebaseapp.com",
    projectId: "logistic-system-64c05",
    storageBucket: "logistic-system-64c05.appspot.com",
    messagingSenderId: "785335550935",
    appId: "1:785335550935:web:c3edacab784f314add8192"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase initialized in firebase-config.js");

export { app, auth, db };
