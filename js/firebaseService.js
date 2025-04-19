// js/firebaseService.js

// Forward declare globals defined in main.js
let app, db, auth, storage, analytics;
let firebaseInitialized = false;

// Firebase SDK URLs (use versions compatible with compat libraries if needed)
const FIREBASE_SDK_URLS = [
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage-compat.js',
    'https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics-compat.js'
];

// Validate Firebase Configuration
function validateFirebaseConfig(config) {
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
    debugLog("Initializing Firebase...");
    if (firebaseInitialized) {
        debugLog("Firebase already initialized.");
        return true;
    }
     // Check if firebase is already globally available (e.g., if SDKs were loaded manually)
     if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && !app) {
         debugLog("Firebase detected in global scope, attempting to reuse existing instance.");
         app = window.firebase.apps[0]; // Use the first initialized app
         try {
            // Try to get services from the existing app instance
            db = app.firestore();
            auth = app.auth();
            storage = app.storage();
            try { analytics = app.analytics(); } catch (e) { console.warn("Analytics setup failed:", e.message); }
             firebaseInitialized = true; // Mark as initialized since we got the services
             debugLog("Reused existing Firebase app instance and services.");
             return true;
         } catch (reuseError) {
             console.warn("Failed to reuse existing Firebase instance services, proceeding with initialization:", reuseError);
             // Reset app variable if reusing failed, to allow normal initialization
             app = null;
         }
     }

    let attempts = 0;
    while (attempts < maxRetries && !firebaseInitialized) {
        try {
            debugLog(`Attempt ${attempts + 1}/${maxRetries} to initialize Firebase...`);
            validateFirebaseConfig(firebaseConfig); // Use config from config.js

            // Load SDKs dynamically
            await Promise.all(FIREBASE_SDK_URLS.map(url => loadScript(url, 1))); // Use utility function

            if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
                 throw new Error("Firebase SDK core not loaded correctly.");
            }

            // Check if already initialized within this attempt
            if (firebase.apps.length === 0) {
                 app = firebase.initializeApp(firebaseConfig);
                 debugLog("Firebase app initialized.");
            } else {
                 app = firebase.apps[0];
                 debugLog("Reusing existing Firebase app instance.");
            }

            // Initialize services
            db = firebase.firestore();
            auth = firebase.auth();
            storage = firebase.storage();
            try { analytics = firebase.analytics(); } catch (e) { console.warn("Analytics setup failed:", e.message); }

            // Test Firestore connection (optional, but good)
            await db.collection('internal_status').doc('init_test').set({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'ok'
            }, { merge: true });

            firebaseInitialized = true;
            debugLog("Firebase fully initialized and connected.");
            return true;
        } catch (error) {
            attempts++;
            console.error(`Firebase initialization attempt ${attempts} failed:`, error);
            debugLog(`Firebase init attempt ${attempts} failed: ${error.message}`);
            if (attempts >= maxRetries) {
                console.error("Max retries reached. Firebase initialization failed definitively.");
                debugLog("Max retries reached. Firebase initialization failed definitively.");
                alert("Error connecting to the database. Please restart the app."); // User feedback
                return false;
            }
            // Clear potentially partially loaded state if needed
            // e.g., app = null; db = null; etc.
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
        }
    }
    return false;
}

// Helper to ensure Firebase is ready before running a callback
async function ensureFirebaseReady(callback, callbackName = 'Unnamed Callback') {
     debugLog(`Ensuring Firebase is ready for: ${callbackName}`);
    if (!firebaseInitialized || !db) {
        debugLog("Firebase not ready, attempting initialization...");
        const success = await initializeFirebase();
        if (!success) {
            console.error("Firebase initialization failed after retries. Cannot proceed.");
            debugLog(`Firebase init failed, cannot execute ${callbackName}`);
            alert("Database connection failed. Please try again later.");
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
         // Optionally show an error to the user
         // alert(`An error occurred while loading data for ${callbackName}.`);
     }
 }

// --- Storage Abstraction (Firestore) ---
const Storage = {
    getItem: async (key) => {
        // Needs global telegramUser from main.js
         debugLog(`Storage: Getting item '${key}' for user ${window.telegramUser?.id}`);
        if (!firebaseInitialized || !db) {
            console.error("Firestore not initialized. Cannot fetch item:", key);
            debugLog(`Storage Error: Firestore not init for getItem '${key}'`);
            return null;
        }
        if (!window.telegramUser || !window.telegramUser.id) {
            console.error("User not identified. Cannot fetch item:", key);
            debugLog(`Storage Error: User not identified for getItem '${key}'`);
            return null;
        }
        try {
            const docRef = db.collection('userData').doc(window.telegramUser.id.toString());
            const doc = await docRef.get();
            const value = doc.exists ? doc.data()[key] : null;
             debugLog(`Storage: Got item '${key}', value:`, value);
             return value;
        } catch (error) {
            console.error(`Storage: Error fetching ${key}:`, error);
            debugLog(`Storage Error: Failed fetching '${key}': ${error.message}`);
            return null;
        }
    },
    setItem: async (key, value) => {
        // Needs global telegramUser from main.js
         debugLog(`Storage: Setting item '${key}' for user ${window.telegramUser?.id}`, value);
        if (!firebaseInitialized || !db) {
            console.error("Firestore not initialized. Cannot set item:", key);
            debugLog(`Storage Error: Firestore not init for setItem '${key}'`);
            return false;
        }
         if (!window.telegramUser || !window.telegramUser.id) {
            console.error("User not identified. Cannot set item:", key);
             debugLog(`Storage Error: User not identified for setItem '${key}'`);
             return false;
         }
        try {
            const docRef = db.collection('userData').doc(window.telegramUser.id.toString());
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
