// Add this at the very top for immediate feedback
console.log('[DEBUG] script.js execution started.');

// --- Global Variables ---
let app, db, auth, storage, analytics;
let firebaseInitialized = false;
let telegramUser;
let tonConnectUI = null;
let currentChestIndex = 0; // Keep track of chest slider

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUkEmFmJK2vr8k7M6JqYaxlcgBDf7WdJI", // WARNING: Exposing API key is insecure for production
    authDomain: "fourgo-cd98f.firebaseapp.com",
    projectId: "fourgo-cd98f",
    storageBucket: "fourgo-cd98f.firebasestorage.app",
    messagingSenderId: "511215742272",
    appId: "1:511215742272:web:04bd85a284919ae123dea5",
    measurementId: "G-DC7E6ECF2L"
};

 // Chest Data (Consider fetching from Firestore later)
 const chests = [
     { name: "Wood Chest", next: "Bronze", image: "assets/graphics/wood-chest.png", gemCost: 200, vip: 0 },
     { name: "Bronze Chest", next: "Silver", image: "assets/graphics/bronze-chest.png", gemCost: 500, vip: 1 },
     { name: "Silver Chest", next: "Gold", image: "assets/graphics/silver-chest.png", gemCost: 1000, vip: 2 },
     { name: "Gold Chest", next: "Master", image: "assets/graphics/gold-chest.png", gemCost: 2000, vip: 3 },
     { name: "Master Chest", next: "Legendary", image: "assets/graphics/master-chest.png", gemCost: 5000, vip: 4 },
     { name: "Legendary Chest", next: "Mythic", image: "assets/graphics/legendary-chest.png", gemCost: 10000, vip: 5 },
     { name: "Mythic Chest", next: "", image: "assets/graphics/mythic-chest.png", gemCost: 20000, vip: 6 }
 ];


// --- Utility Functions ---

// Debug Logging Helper
function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[DEBUG] ${timestamp}: ${message}`;
    console.log(logMessage, data !== null ? data : ''); // Ensure console.log always happens
    const debugConsole = document.getElementById('debugConsole');
    if (debugConsole) {
        try {
            const entry = document.createElement('div');
            entry.textContent = `${timestamp}: ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`;
            // Limit console entries to prevent memory issues
            while (debugConsole.children.length > 100) {
                debugConsole.removeChild(debugConsole.firstChild);
            }
            debugConsole.appendChild(entry);
            debugConsole.scrollTop = debugConsole.scrollHeight; // Auto-scroll
        } catch (e) {
            console.error("Error writing to internal debug console:", e);
        }
    }
}

// Dynamically load a script and return a Promise
function loadScript(src, retries = 3, delay = 1000) {
     debugLog(`Attempting to load script: ${src}`);
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const tryLoad = () => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                debugLog(`Script loaded successfully: ${src}`);
                resolve();
            };
            script.onerror = () => {
                attempts++;
                if (attempts < retries) {
                    console.warn(`Failed to load script: ${src}. Retrying (${attempts}/${retries})...`);
                    setTimeout(tryLoad, delay);
                } else {
                    const errorMsg = `Failed to load script after ${retries} attempts: ${src}`;
                    console.error(errorMsg);
                    debugLog(errorMsg); // Log to debug console too
                    reject(new Error(errorMsg));
                }
            };
            document.head.appendChild(script);
        };
        tryLoad();
    });
}

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
    console.log("Attempting Firebase Init..."); // Use plain console.log
    debugLog("Initializing Firebase...");
    if (firebaseInitialized) {
        debugLog("Firebase already initialized.");
        return true;
    }
    // Check for existing instance (safer check)
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        debugLog("Firebase detected in global scope, reusing existing instance.");
        app = firebase.app(); // Use firebase.app() to get default app
        try {
            db = firebase.firestore(app);
            auth = firebase.auth(app);
            storage = firebase.storage(app);
            try { analytics = firebase.analytics(app); } catch (e) { console.warn("Analytics setup failed:", e.message); }
            firebaseInitialized = true;
            debugLog("Firebase services attached to existing instance.");
            return true;
        } catch(e) {
             debugLog("Error attaching services to existing Firebase app:", e);
             // Proceed to initialize fresh below
        }
    }


    let attempts = 0;
    const scriptUrls = [
        'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js',
        'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage-compat.js',
        'https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics-compat.js'
    ];

    while (attempts < maxRetries && !firebaseInitialized) {
        try {
            debugLog(`Attempt ${attempts + 1}/${maxRetries} to initialize Firebase...`);
            validateFirebaseConfig(firebaseConfig);

            // Ensure firebase core is loaded first if not already present
            if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
                 await loadScript(scriptUrls[0], 1); // Load app compat first
                 if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
                     throw new Error("Firebase SDK core (app-compat) failed to load.");
                 }
            }

            // Load other components
            await Promise.all(scriptUrls.slice(1).map(url => loadScript(url, 1)));

            // Check if already initialized AGAIN after loading scripts
            if (firebase.apps.length === 0) {
                 app = firebase.initializeApp(firebaseConfig);
                 debugLog("Firebase app initialized.");
            } else {
                 app = firebase.app(); // Get default app
                 debugLog("Reusing existing Firebase app instance after script loads.");
            }

            // Initialize services
            db = firebase.firestore();
            auth = firebase.auth();
            storage = firebase.storage();
            try { analytics = firebase.analytics(); } catch (e) { console.warn("Analytics setup failed:", e.message); }

            // Test Firestore connection (optional, can be removed if causing issues)
            // await db.collection('internal_status').doc('init_test').set({
            //     timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            //     status: 'ok'
            // }, { merge: true });

            firebaseInitialized = true;
            console.log("Firebase Initialized Successfully."); // Use plain console.log
            debugLog("Firebase fully initialized and connected.");
            return true;
        } catch (error) {
            attempts++;
            console.error(`Firebase initialization attempt ${attempts} failed:`, error);
            debugLog(`Firebase init attempt ${attempts} failed: ${error.message}`);
            if (attempts >= maxRetries) {
                console.error("Max retries reached. Firebase initialization failed definitively.");
                debugLog("Max retries reached. Firebase initialization failed definitively.");
                // Removed alert to avoid blocking, rely on console/debug log
                // alert("Error connecting to the database. Please restart the app.");
                return false;
            }
            // Don't wait excessively long during debugging
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s before retry
        }
    }
    return false;
}

// Helper to ensure Firebase is ready before running a callback
async function ensureFirebaseReady(callback, callbackName = 'Unnamed Callback') {
     console.log(`Ensuring Firebase Ready for: ${callbackName}`); // Use plain console.log
     debugLog(`Ensuring Firebase is ready for: ${callbackName}`);
    if (!firebaseInitialized || !db) {
        debugLog("Firebase not ready, attempting initialization...");
        const success = await initializeFirebase();
        if (!success) {
            console.error(`Firebase initialization failed. Cannot proceed with ${callbackName}.`);
            debugLog(`Firebase init failed, cannot execute ${callbackName}`);
            // alert("Database connection failed. Please try again later."); // Avoid blocking
            return; // Stop execution if Firebase fails
        }
    }
     debugLog(`Firebase ready, executing: ${callbackName}`);
     try {
         await callback(); // Await the callback itself
         debugLog(`Successfully executed: ${callbackName}`);
     } catch (error) {
         console.error(`Error during ${callbackName}:`, error);
         debugLog(`Error during ${callbackName}: ${error.message}\n${error.stack || ''}`);
         // Optionally show an error to the user
         // alert(`An error occurred while loading data for ${callbackName}.`);
     }
 }


// --- Telegram Web App Setup ---
function initializeTelegram() {
    console.log("Initializing Telegram..."); // Use plain console.log
     debugLog("Initializing Telegram Web App...");
    try {
        if (!window.Telegram || !window.Telegram.WebApp) {
            throw new Error("Telegram WebApp script not loaded or available.");
        }
        window.Telegram.WebApp.ready();
        // Ensure initDataUnsafe is accessed safely
        const initData = window.Telegram.WebApp.initDataUnsafe || {};
        telegramUser = initData.user;

        if (telegramUser && telegramUser.id) { // Check for ID as well
            debugLog("Telegram user data found:", { id: telegramUser.id, username: telegramUser.username });
            const profilePic = document.querySelector('.profile-pic img');
            if (profilePic) {
                profilePic.onerror = () => { profilePic.src = 'assets/icons/user-avatar.png'; }; // Add onerror handler
                profilePic.src = telegramUser.photo_url || 'assets/icons/user-avatar.png';
            }
        } else {
            console.warn("No Telegram user data available or missing ID. Running in test mode.");
            debugLog("No Telegram user data found or missing ID. Using test user.");
            // Define a fallback test user
            telegramUser = {
                id: "test_user_" + Date.now(), // Unique test ID
                username: "TestUser",
                first_name: "Test",
                photo_url: "assets/icons/user-avatar.png" // Use local placeholder
            };
            const profilePic = document.querySelector('.profile-pic img');
             if (profilePic) {
                 profilePic.onerror = () => { profilePic.src = 'assets/icons/user-avatar.png'; };
                 profilePic.src = telegramUser.photo_url;
             }
        }
        debugLog("Telegram Web App initialized successfully.");
        return true;
    } catch (error) {
        console.error("Telegram Web App initialization failed:", error);
        debugLog(`Telegram Web App initialization failed: ${error.message}`);
         // Define a fallback test user if Telegram fails catastrophically
         telegramUser = {
             id: "fallback_user_" + Date.now(),
             username: "FallbackUser",
             first_name: "Fallback",
             photo_url: "assets/icons/user-avatar.png" // Use local placeholder
         };
         const profilePic = document.querySelector('.profile-pic img');
         if (profilePic) {
            profilePic.onerror = () => { profilePic.src = 'assets/icons/user-avatar.png'; };
            profilePic.src = telegramUser.photo_url;
         }
         // alert("Could not initialize Telegram features. Using fallback mode."); // Avoid blocking
        return false;
    }
}

// --- Storage Abstraction (Firestore) ---
const Storage = {
    getItem: async (key) => {
         // debugLog(`Storage: Getting item '${key}' for user ${telegramUser?.id}`); // Can be noisy
        if (!firebaseInitialized || !db) {
            console.error("Firestore not initialized. Cannot fetch item:", key);
            debugLog(`Storage Error: Firestore not init for getItem '${key}'`);
            return null;
        }
        if (!telegramUser || !telegramUser.id) {
            console.error("User not identified. Cannot fetch item:", key);
            debugLog(`Storage Error: User not identified for getItem '${key}'`);
            return null;
        }
        try {
            const docRef = db.collection('userData').doc(telegramUser.id.toString());
            const doc = await docRef.get();
            const value = doc.exists ? doc.data()[key] : undefined; // Return undefined if not found
             // debugLog(`Storage: Got item '${key}', value:`, value); // Can be noisy
             return value;
        } catch (error) {
            console.error(`Storage: Error fetching ${key}:`, error);
            debugLog(`Storage Error: Failed fetching '${key}': ${error.message}`);
            return null; // Indicate error
        }
    },
    setItem: async (key, value) => {
         // debugLog(`Storage: Setting item '${key}' for user ${telegramUser?.id}`, value); // Can be noisy
        if (!firebaseInitialized || !db) {
            console.error("Firestore not initialized. Cannot set item:", key);
            debugLog(`Storage Error: Firestore not init for setItem '${key}'`);
            return false;
        }
         if (!telegramUser || !telegramUser.id) {
            console.error("User not identified. Cannot set item:", key);
             debugLog(`Storage Error: User not identified for setItem '${key}'`);
             return false;
         }
        try {
            const docRef = db.collection('userData').doc(telegramUser.id.toString());
            await docRef.set({ [key]: value }, { merge: true });
             // debugLog(`Storage: Set item '${key}' successfully.`); // Can be noisy
            return true;
        } catch (error) {
            console.error(`Storage: Error setting ${key}:`, error);
            debugLog(`Storage Error: Failed setting '${key}': ${error.message}`);
            return false;
        }
    }
};

// --- Navigation Logic ---
function setupNavigation() {
    console.log("Setting up Navigation..."); // Use plain console.log
    debugLog('[NAV] Setting up navigation...');
    const sections = document.querySelectorAll('.section');
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');
    const bottomNav = document.querySelector('nav.bottom-nav');

    if (!bottomNav || sections.length === 0 || navButtons.length === 0) {
        console.error('[NAV ERROR] Required navigation elements not found!');
        debugLog('[NAV ERROR] Required navigation elements not found!');
        return;
    }

     debugLog(`[NAV] Found ${sections.length} sections and ${navButtons.length} nav buttons.`);
     console.log(`[NAV] Found ${sections.length} sections and ${navButtons.length} nav buttons.`); // Plain log

    navButtons.forEach((button, index) => {
        const sectionId = button.getAttribute('data-section');
         // debugLog(`[NAV] Setting up listener for button ${index}: ${sectionId}`); // Can be noisy
         if (!sectionId) {
             console.warn(`[NAV WARN] Button ${index} is missing data-section attribute.`);
             return;
         }

        button.addEventListener('click', () => {
            console.log(`Navigating to: ${sectionId}`); // Plain log
            debugLog(`[NAV] Click detected on button: ${sectionId}`);
            switchSection(sectionId); // Switch section on click
        });
    });

    // Set default section
    const defaultSection = 'earn';
    console.log(`Setting default section: ${defaultSection}`); // Plain log
    debugLog(`[NAV] Setting default section to: ${defaultSection}`);
    switchSection(defaultSection, true); // Pass true for initial load

    console.log("Navigation Setup Complete."); // Plain log
    debugLog('[NAV] Navigation setup complete.');
}

async function switchSection(sectionId, isInitialLoad = false) {
    console.log(`Switching to section: ${sectionId}`); // Plain log
     debugLog(`[NAV] Attempting to switch to section: ${sectionId}`);
    const sections = document.querySelectorAll('.section');
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');

    let foundSection = false;
    sections.forEach(section => {
        if (section.id === sectionId) {
            if (!section.classList.contains('active')) {
                 section.classList.add('active');
                 console.log(`Added 'active' to section: ${section.id}`); // Plain log
                 debugLog(`[NAV] Activated section element: #${section.id}`);
             }
             foundSection = true;
        } else {
            if (section.classList.contains('active')) {
                section.classList.remove('active');
                 console.log(`Removed 'active' from section: ${section.id}`); // Plain log
                 debugLog(`[NAV] Deactivated section element: #${section.id}`);
             }
        }
    });

    if (!foundSection) {
         console.error(`[NAV ERROR] Target section element with id "${sectionId}" not found.`);
         return;
    }

    navButtons.forEach(btn => {
         const btnSectionId = btn.getAttribute('data-section');
         if (btnSectionId === sectionId) {
             if (!btn.classList.contains('active')) {
                 btn.classList.add('active');
                 // debugLog(`[NAV] Activated button: [data-section="${btnSectionId}"]`); // Noisy
             }
         } else {
             if (btn.classList.contains('active')) {
                 btn.classList.remove('active');
                 // debugLog(`[NAV] Deactivated button: [data-section="${btnSectionId}"]`); // Noisy
             }
         }
     });

    // Load data for the activated section
     debugLog(`[NAV] Loading data for section: ${sectionId}`);
     try {
         // Use ensureFirebaseReady for data loading
         if (sectionId === 'earn') await ensureFirebaseReady(updateEarnSectionUI, 'updateEarnSectionUI');
         else if (sectionId === 'invite') await ensureFirebaseReady(updateInviteSectionUI, 'updateInviteSectionUI');
         else if (sectionId === 'top') await ensureFirebaseReady(updateTopSectionUI, 'updateTopSectionUI');
         else if (sectionId === 'wallet') await ensureFirebaseReady(updateWalletSectionUI, 'updateWalletSectionUI');
         else if (sectionId === 'chest') {
             await ensureFirebaseReady(updateUserStatsUI, 'updateChestUserStats');
             updateChestUI(); // Explicitly update chest UI after stats
         }
         // Add other section updates here if needed
         else {
            // debugLog(`[NAV] No specific data load function for section: ${sectionId}`); // Noisy
         }

     } catch (error) {
         console.error(`[NAV ERROR] Error loading data for section ${sectionId}:`, error);
         debugLog(`[NAV ERROR] Error loading data for section ${sectionId}: ${error.message}`);
     }
     console.log(`Finished switching to section: ${sectionId}`); // Plain log
 }

// --- User Data Management --- (initializeUserData, fetchAndUpdateUserData, updateUserStatsUI)
// --- Earn Section (Quests) --- (updateEarnSectionUI, click listener)
// --- Ad Logic --- (showAd)
// --- Referral System --- (generateReferralLink, handleReferral)
// --- Invite Section UI & Logic --- (updateInviteSectionUI, claim button, invite buttons)
// --- Top Section (Ranking) --- (updateTopSectionUI)
// --- Wallet Section UI & TON Connect --- (updateWalletSectionUI, updateWalletConnectionStatusUI, getWalletElements, initializeTonConnect, handleConnectClick, initWalletSystem, showWithdrawModal, confirmWithdraw, updateTransactionHistory)
// --- Chest Section Logic --- (renderChests, updateChestUI, nextChest, prevChest, openChest)
// --- [ ALL THE FUNCTION DEFINITIONS FROM THE PREVIOUS SCRIPT.JS GO HERE ] ---
// --- [ I have omitted them for brevity, but they MUST be included ] ---
// --- [ Ensure all functions like initializeUserData, updateEarnSectionUI, etc., are present ] ---


// --- App Initialization ---
async function initApp() {
    console.log("initApp: START"); // Plain log
    debugLog("--- App Initialization Sequence Start ---");

     // 1. Initialize Telegram Interface
     console.log("initApp: Initializing Telegram...");
    initializeTelegram();
     console.log("initApp: Telegram Initialized.");

     // 2. Initialize Firebase
     console.log("initApp: Initializing Firebase...");
    const firebaseSuccess = await initializeFirebase();
     console.log("initApp: Firebase Initialized =", firebaseSuccess);
    if (!firebaseSuccess) {
        debugLog("App Init Failed: Firebase could not be initialized.");
        console.error("App Init Failed: Firebase could not be initialized.");
        return; // Stop if Firebase fails
    }

    // 3. Initialize User Data (includes fetching initial data into currentUserData)
     console.log("initApp: Initializing User Data...");
     await ensureFirebaseReady(initializeUserData, 'initializeUserData');
     console.log("initApp: User Data Initialized.");

    // 4. Handle Incoming Referrals (Must run after user init)
     console.log("initApp: Handling Referrals...");
     await ensureFirebaseReady(handleReferral, 'handleReferral');
     console.log("initApp: Referrals Handled.");

     // 5. Generate User's Referral Link
     console.log("initApp: Generating Referral Link...");
    generateReferralLink();
     console.log("initApp: Referral Link Generated.");

     // 6. Initialize TON Connect
     console.log("initApp: Initializing TON Connect...");
    tonConnectUI = await initializeTonConnect();
     console.log("initApp: TON Connect Initialized.");

     // 7. Setup Wallet System Listeners & UI (Depends on tonConnectUI)
     console.log("initApp: Initializing Wallet System...");
     await initWalletSystem();
     console.log("initApp: Wallet System Initialized.");

    // 8. Render Dynamic Components (Chests)
     console.log("initApp: Rendering Chests...");
    renderChests();
     console.log("initApp: Chests Rendered.");

    // 9. Setup Main Navigation (This will call switchSection for 'earn')
     console.log("initApp: Setting up Navigation...");
    setupNavigation();
     console.log("initApp: Navigation Setup Complete.");

    // 10. Initial Data Load for Default Section (is handled by setupNavigation/switchSection)

    // 11. Initialize Automatic Ads
     console.log("initApp: Initializing Automatic Ads...");
    try {
        if (typeof window.show_9180370 === 'function') {
            const autoInAppSettings = { frequency: 2, capping: 0.016, interval: 30, timeout: 5, everyPage: false };
            debugLog('[AD INIT] Initializing automatic In-App ads with settings:', JSON.stringify(autoInAppSettings));
            window.show_9180370({ type: 'inApp', inAppSettings: autoInAppSettings });
        } else {
            debugLog('[AD INIT] Monetag SDK function not found, cannot initialize automatic ads.');
        }
    } catch (initAdError) {
        console.error('[AD INIT] Error initializing automatic In-App ads:', initAdError);
        debugLog(`[AD INIT] Error initializing automatic ads: ${initAdError.message}`);
    }
     console.log("initApp: Automatic Ads Initialized.");

    console.log("initApp: FINISHED"); // Plain log
    debugLog("--- App Initialization Sequence Finished ---");
 }

// --- DOMContentLoaded ---
// Ensure this is the final part of the script
if (document.readyState === 'loading') {
    // Loading hasn't finished yet
    console.log("DOM not ready, adding listener...");
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded event fired."); // Plain log
        debugLog("DOMContentLoaded event fired. Starting App Initialization.");
        initApp(); // Start the main application logic
    });
} else {
    // DOMContentLoaded has already fired
    console.log("DOM already ready, starting App Initialization directly.");
    debugLog("DOM already ready. Starting App Initialization.");
    initApp();
}

// Make sure ALL function definitions (like initializeUserData, updateEarnSectionUI, etc.)
// that were present in the original <script> block are included above the initApp() function call.
// I have omitted them above just for brevity in this example response.
