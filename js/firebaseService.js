// js/firebaseService.js

// Forward declare globals defined in this file, used by other scripts
let app = null; // Firebase App instance
let db = null; // Firestore instance
let auth = null; // Auth instance (if used, though not prominent in provided code)
let storage = null; // Storage instance (if used, though not prominent)
let analytics = null; // Analytics instance (if used)
let firebaseInitialized = false; // Flag to check initialization status

// Firebase SDK URLs (use versions compatible with compat libraries)
// These will be dynamically loaded by the loadScript utility
const FIREBASE_SDK_URLS = [
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js', // Included if auth is planned
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage-compat.js', // Included if storage is planned
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics-compat.js' // Included if analytics is planned
];

// Validate Firebase Configuration
function validateFirebaseConfig(config) {
    // Uses debugLog from utils.js (globally available)
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    for (const field of requiredFields) {
        if (!config[field]) {
            throw new Error(`Firebase config is missing required field: ${field}`);
        }
    }
    debugLog("Firebase config validated successfully");
}

// --- Firebase Initialization ---
async function initializeFirebase(maxRetries = 3) {
    // Uses debugLog and loadScript from utils.js (globally available)
    // Uses firebaseConfig from config.js (globally available)

    debugLog("Initializing Firebase...");
    if (firebaseInitialized) {
        debugLog("Firebase already initialized.");
        return true;
    }

     // Check if firebase is already globally available (e.g., if SDKs were loaded manually or in another script tag)
     // This might happen if firebase SDKs were linked directly in index.html <head>
     if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && !app) {
         debugLog("Firebase detected in global scope, attempting to reuse existing instance.");
         try {
            // Try to get services from the existing app instance
            app = window.firebase.apps[0]; // Use the first initialized app
            db = app.firestore();
            // Use try-catch for optional services that might not be included
            try { auth = app.auth(); } catch (e) { debugLog("Auth service not found in existing Firebase app."); }
            try { storage = app.storage(); } catch (e) { debugLog("Storage service not found in existing Firebase app."); }
            try { analytics = app.analytics(); } catch (e) { debugLog("Analytics service not found in existing Firebase app."); }

             // Check if essential services (like db) are available
             if (db) {
                 firebaseInitialized = true; // Mark as initialized since we got the essential service
                 debugLog("Reused existing Firebase app instance and services.");
                 return true;
             } else {
                 debugLog("Existing Firebase app found, but essential services (like Firestore) not available. Proceeding with full initialization.");
                 app = null; // Reset app variable to allow normal initialization flow
             }
         } catch (reuseError) {
             console.warn("Failed to reuse existing Firebase instance services, proceeding with initialization:", reuseError);
             debugLog(`Failed to reuse existing Firebase instance services: ${reuseError.message}. Proceeding with initialization.`);
             app = null; // Reset app variable
         }
     }


    let attempts = 0;
    while (attempts < maxRetries && !firebaseInitialized) {
        try {
            debugLog(`Attempt ${attempts + 1}/${maxRetries} to initialize Firebase...`);
            validateFirebaseConfig(window.firebaseConfig); // Use global config

            // Load SDKs dynamically
            // Note: loadScript is expected to be globally available from utils.js
            await Promise.all(FIREBASE_SDK_URLS.map(url => window.loadScript(url, 1))); // Try each script once per initialization attempt

            // Check if firebase global object is available after loading
            if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
                 throw new Error("Firebase SDK core not loaded correctly or firebase global object not available.");
            }

            // Check if already initialized within this specific attempt (unlikely with proper setup, but defensive)
            if (firebase.apps.length === 0) {
                 app = firebase.initializeApp(window.firebaseConfig); // Use global config
                 debugLog("Firebase app initialized.");
            } else {
                 app = firebase.apps[0];
                 debugLog("Reusing Firebase app instance from current attempt.");
            }

            // Initialize services
            // Ensure 'firebase' global is available from the SDKs loaded by loadScript
            db = firebase.firestore();
            try { auth = firebase.auth(); } catch (e) { debugLog("Auth service failed to initialize:", e.message); }
            try { storage = firebase.storage(); } catch (e) { debugLog("Storage service failed to initialize:", e.message); }
            try { analytics = firebase.analytics(); } catch (e) { debugLog("Analytics service failed to initialize:", e.message); }


            // Test Firestore connection (optional, but good)
            await db.collection('internal_status').doc('init_test').set({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Needs firebase global
                status: 'ok'
            }, { merge: true });

            firebaseInitialized = true;
            debugLog("Firebase fully initialized and connected.");
            return true;
        } catch (error) {
            attempts++;
            console.error(`Firebase initialization attempt ${attempts} failed:`, error);
            debugLog(`Firebase init attempt ${attempts} failed: ${error.message}`);
            // Reset service variables on failure to ensure a clean state for retry
            app = null; db = null; auth = null; storage = null; analytics = null;
            if (attempts >= maxRetries) {
                console.error("Max retries reached. Firebase initialization failed definitively.");
                debugLog("Max retries reached. Firebase initialization failed definitively.");
                // alert("Error connecting to the database. Please restart the app."); // User feedback might be in main.js
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
        }
    }
    return false; // Return false if max retries are exhausted
}

// Helper to ensure Firebase is ready before running a callback
// This function is exposed globally for use by other modules
async function ensureFirebaseReady(callback, callbackName = 'Unnamed Callback') {
     // Uses debugLog from utils.js (globally available)
     debugLog(`Ensuring Firebase is ready for: ${callbackName}`);
    if (!firebaseInitialized || !db) {
        debugLog("Firebase not ready, attempting initialization...");
        const success = await initializeFirebase();
        if (!success) {
            console.error(`Firebase initialization failed after retries. Cannot execute ${callbackName}.`);
            debugLog(`Firebase init failed, cannot execute ${callbackName}`);
            // Alert user if needed (might be handled by initializeFirebase or calling function)
            // alert("Database connection failed. Please try again later.");
            return; // Stop execution if Firebase fails
        }
    }
     debugLog(`Firebase ready, executing: ${callbackName}`);
     try {
         await callback();
         debugLog(`Successfully executed: ${callbackName}`);
     } catch (error) {
         console.error(`Error during ${callbackName}:`, error);
         debugLog(`Error during ${callbackName}: ${error.message}`);
         // Optionally show a specific error to the user related to the callback's failure
         // alert(`An error occurred while loading data for ${callbackName}.`);
     }
 }

// --- Storage Abstraction (using Firestore for user-specific data) ---
// This object is exposed globally for use by other modules
const Storage = {
    // Uses debugLog from utils.js (globally available)
    // Uses telegramUser from telegramService.js (globally available)
    // Uses db, firebaseInitialized from this file (implicitly global)

    getItem: async (key) => {
         debugLog(`Storage: Getting item '${key}' for user ${window.telegramUser?.id}`);
        if (!firebaseInitialized || !db) {
            console.error("Storage Error: Firestore not initialized.");
            debugLog(`Storage Error: Firestore not init for getItem '${key}'`);
            // Handle potential uninitialized state gracefully
            await ensureFirebaseReady(() => {}, 'Storage.getItem: Ensure FirebaseReady Check');
            if (!firebaseInitialized || !db) { // Check again after attempt
                console.error("Storage Error: Firestore still not initialized after check.");
                return null;
            }
        }
        if (!window.telegramUser || !window.telegramUser.id) {
            console.error("Storage Error: User not identified.");
             debugLog(`Storage Error: User not identified for getItem '${key}'`);
             return null;
         }
        try {
            const docRef = db.collection('userData').doc(window.telegramUser.id.toString());
            const doc = await docRef.get();
            const value = doc.exists ? doc.data()?.[key] : null; // Use optional chaining
             debugLog(`Storage: Got item '${key}', value:`, value);
             return value;
        } catch (error) {
            console.error(`Storage: Error fetching ${key}:`, error);
            debugLog(`Storage Error: Failed fetching '${key}': ${error.message}`);
            return null;
        }
    },
    setItem: async (key, value) => {
         debugLog(`Storage: Setting item '${key}' for user ${window.telegramUser?.id}`, value);
        if (!firebaseInitialized || !db) {
            console.error("Storage Error: Firestore not initialized.");
            debugLog(`Storage Error: Firestore not init for setItem '${key}'`);
             await ensureFirebaseReady(() => {}, 'Storage.setItem: Ensure FirebaseReady Check');
             if (!firebaseInitialized || !db) { // Check again after attempt
                 console.error("Storage Error: Firestore still not initialized after check.");
                 return false;
             }
        }
         if (!window.telegramUser || !window.telegramUser.id) {
            console.error("Storage Error: User not identified.");
             debugLog(`Storage Error: User not identified for setItem '${key}'`);
             return false;
         }
        try {
            const docRef = db.collection('userData').doc(window.telegramUser.id.toString());
            // Use Set with merge to create the document if it doesn't exist
            await docRef.set({ [key]: value }, { merge: true });
             debugLog(`Storage: Set item '${key}' successfully.`);
            return true;
        } catch (error) {
            console.error(`Storage: Error setting ${key}:`, error);
            debugLog(`Storage Error: Failed setting '${key}': ${error.message}`);
            return false;
        }
    }
};

// Make Firebase variables and utility functions available globally
// This is necessary for other scripts to access Firebase instances and helper functions
window.app = app;
window.db = db; // Firestore instance is most commonly needed
window.auth = auth;
window.storage = storage;
window.analytics = analytics;
window.firebaseInitialized = firebaseInitialized; // Expose the flag
window.initializeFirebase = initializeFirebase; // Expose initialization function
window.ensureFirebaseReady = ensureFirebaseReady; // Expose helper function
window.Storage = Storage; // Expose Storage abstraction

// Note: The 'firebase' global object (the SDK itself) is made available by loading the SDK scripts.
// It is used for things like firebase.firestore.FieldValue.increment
