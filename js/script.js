Console.log('[DEBUG] Script execution started.');

// --- Global Variables ---
let app, db, auth, storage, analytics;
let firebaseInitialized = false;
let telegramUser;
let tonConnectUI = null;
let currentChestIndex = 0; // Keep track of chest slider
let currentUserData = null; // Global cache for user data

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

// Cooldown Constants
const REWARDED_AD_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes in milliseconds (Ad TYPE cooldown)
const QUEST_REPEAT_COOLDOWN_MS = 1 * 60 * 60 * 1000; // 1 hour in milliseconds (Ad QUEST cooldown after claim)

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
    console.log(`[DEBUG] ${timestamp}: ${message}`, data !== null ? data : '');
    const debugConsole = document.getElementById('debugConsole');
    if (debugConsole) {
        const entry = document.createElement('div');
        entry.textContent = `${timestamp}: ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`;
        debugConsole.appendChild(entry);
        // Auto-scroll to bottom
        debugConsole.scrollTop = debugConsole.scrollHeight;
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
                debugLog(`Failed to load script: ${src}. Attempt ${attempts}/${retries}`);
                if (attempts < retries) {
                    console.warn(`Retrying (${attempts}/${retries})...`);
                    setTimeout(tryLoad, delay);
                } else {
                    const errorMsg = `Failed to load script after ${retries} attempts: ${src}`;
                    console.error(errorMsg);
                    debugLog(errorMsg);
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

// Helper to safely convert Firestore Timestamp or Date string/number to Date object
function safeConvertToDate(timestamp) {
    if (!timestamp) return null;
    try {
        if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate(); // Firestore Timestamp
        }
        const date = new Date(timestamp); // Attempt string/number conversion
        if (isNaN(date.getTime())) { // Check if conversion resulted in invalid date
            console.warn(`[DATE WARN] Invalid date format encountered:`, timestamp);
            return null;
        }
        return date;
    } catch (dateError) {
        console.warn(`[DATE ERROR] Error converting value to Date:`, timestamp, dateError);
        return null;
    }
}


// --- Firebase Initialization ---
async function initializeFirebase(maxRetries = 3) {
    debugLog("Initializing Firebase...");
    if (firebaseInitialized) {
        debugLog("Firebase already initialized.");
        return true;
    }

    // Check if Firebase is already loaded in the global scope
    if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
        debugLog("Firebase detected in global scope, reusing existing instance.");
        app = window.firebase.apps[0];
        db = app.firestore();
        auth = app.auth();
        storage = app.storage();
        try {
            analytics = app.analytics();
        } catch (e) {
            console.warn("Analytics setup failed:", e.message);
            debugLog(`Analytics setup failed: ${e.message}`);
        }
        firebaseInitialized = true;
        return true;
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

            // Load Firebase scripts sequentially to avoid race conditions
            for (const url of scriptUrls) {
                await loadScript(url, 3, 1000);
                debugLog(`Loaded script: ${url}`);
            }

            // Verify Firebase is defined
            if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
                throw new Error("Firebase SDK core not loaded correctly.");
            }

            // Initialize Firebase app
            if (firebase.apps.length === 0) {
                app = firebase.initializeApp(firebaseConfig);
                debugLog("Firebase app initialized.");
            } else {
                app = firebase.apps[0];
                debugLog("Reusing existing Firebase app instance.");
            }

            // Initialize Firebase services
            db = firebase.firestore();
            if (typeof db === 'undefined') {
                throw new Error("Firestore initialization failed.");
            }
            auth = firebase.auth();
            if (typeof auth === 'undefined') {
                throw new Error("Auth initialization failed.");
            }
            storage = firebase.storage();
            if (typeof storage === 'undefined') {
                throw new Error("Storage initialization failed.");
            }
            try {
                analytics = firebase.analytics();
                if (typeof analytics === 'undefined') {
                    throw new Error("Analytics initialization failed.");
                }
            } catch (e) {
                console.warn("Analytics setup failed:", e.message);
                debugLog(`Analytics setup failed: ${e.message}`);
            }

            // Test Firestore connectivity
            await db.collection('internal_status').doc('init_test').set({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'ok'
            }, { merge: true });
            debugLog("Firestore connectivity test passed.");

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
                alert("Error connecting to the database. Please restart the app.");
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
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
            return;
        }
    }
    debugLog(`Firebase ready, executing: ${callbackName}`);
    try {
        await callback();
        debugLog(`Successfully executed: ${callbackName}`);
    } catch (error) {
        console.error(`Error during ${callbackName}:`, error);
        debugLog(`Error during ${callbackName}: ${error.message}\n${error.stack}`); // Added stack trace
    }
}

// --- Telegram Web App Setup ---
function initializeTelegram() {
    debugLog("Initializing Telegram Web App...");
    try {
        if (!window.Telegram || !window.Telegram.WebApp) {
            throw new Error("Telegram WebApp script not loaded or available.");
        }
        window.Telegram.WebApp.ready();
        telegramUser = window.Telegram.WebApp.initDataUnsafe?.user;

        if (telegramUser) {
            debugLog("Telegram user data found:", { id: telegramUser.id, username: telegramUser.username });
            const profilePic = document.querySelector('.profile-pic img');
            if (profilePic) {
                try {
                    profilePic.src = telegramUser.photo_url || 'assets/icons/user-avatar.png';
                } catch (imgError) {
                    console.warn("Failed to load Telegram profile picture:", imgError);
                    profilePic.src = 'assets/icons/user-avatar.png';
                }
            }
        } else {
            console.warn("No Telegram user data available. Running in test mode.");
            debugLog("No Telegram user data found. Using test user.");
            telegramUser = {
                id: "test_user_" + Date.now(),
                username: "TestUser",
                first_name: "Test",
                photo_url: "https://via.placeholder.com/40/808080/000000?text=T"
            };
            const profilePic = document.querySelector('.profile-pic img');
            if (profilePic) profilePic.src = telegramUser.photo_url;
        }
        debugLog("Telegram Web App initialized successfully.");
        return true;
    } catch (error) {
        console.error("Telegram Web App initialization failed:", error);
        debugLog(`Telegram Web App initialization failed: ${error.message}`);
        telegramUser = {
            id: "fallback_user_" + Date.now(),
            username: "FallbackUser",
            first_name: "Fallback",
            photo_url: "https://via.placeholder.com/40/FF0000/FFFFFF?text=F"
        };
        const profilePic = document.querySelector('.profile-pic img');
        if (profilePic) profilePic.src = telegramUser.photo_url;
        alert("Could not initialize Telegram features. Using fallback mode.");
        return false;
    }
}

// --- Storage Abstraction (Firestore) ---
const Storage = {
    getItem: async (key) => {
        // debugLog(`Storage: Getting item '${key}' for user ${telegramUser?.id}`); // Reduce noise
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
            const value = doc.exists ? doc.data()?.[key] : null; // Use optional chaining
            // debugLog(`Storage: Got item '${key}', value:`, value); // Reduce noise
            return value;
        } catch (error) {
            console.error(`Storage: Error fetching ${key}:`, error);
            debugLog(`Storage Error: Failed fetching '${key}': ${error.message}`);
            return null;
        }
    },
    setItem: async (key, value) => {
        debugLog(`Storage: Setting item '${key}' for user ${telegramUser?.id}`, value);
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
            debugLog(`Storage: Set item '${key}' successfully.`);
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
    debugLog('[NAV] Setting up navigation...');
    const sections = document.querySelectorAll('.section');
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');
    const bottomNav = document.querySelector('nav.bottom-nav');

    if (!bottomNav || sections.length === 0 || navButtons.length === 0) {
        console.error('[NAV ERROR] Required navigation elements not found!', {
            bottomNavExists: !!bottomNav,
            sectionsFound: sections.length,
            navButtonsFound: navButtons.length
        });
        debugLog('[NAV ERROR] Required navigation elements not found!');
        alert("UI Error: Navigation could not be set up.");
        return;
    }

    debugLog(`[NAV] Found ${sections.length} sections and ${navButtons.length} nav buttons.`);

    bottomNav.style.display = 'flex';
    bottomNav.style.visibility = 'visible';
    bottomNav.style.opacity = '1';

    // Use cloning to ensure listeners are fresh and don't stack up
    navButtons.forEach((button, index) => {
        const sectionId = button.getAttribute('data-section');
        debugLog(`[NAV] Setting up listener for button ${index}: ${sectionId}`);
        if (!sectionId) {
            console.warn(`[NAV WARN] Button ${index} is missing data-section attribute.`);
            debugLog(`[NAV WARN] Button ${index} is missing data-section attribute.`);
            return;
        }

        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', (event) => {
            debugLog(`[NAV] Click detected on button: ${sectionId}`);
            switchSection(sectionId);
        });
        debugLog(`[NAV] Listener attached for button ${index}: ${sectionId}`);

        newButton.style.visibility = 'visible';
        newButton.style.opacity = '1';
        const img = newButton.querySelector('img');
        if (img) img.onerror = () => { console.error(`[NAV ERROR] Image failed to load for button ${sectionId}: ${img.src}`); img.src='assets/icons/placeholder.png'; };
    });

    const defaultSection = 'earn';
    debugLog(`[NAV] Setting default section to: ${defaultSection}`);
    switchSection(defaultSection, true);

    debugLog('[NAV] Navigation setup complete.');
}

async function switchSection(sectionId, isInitialLoad = false) {
    debugLog(`[NAV] Attempting to switch to section: ${sectionId}`);
    const sections = document.querySelectorAll('.section');
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button'); // Select potentially new buttons

    let foundSection = false;
    sections.forEach(section => {
        if (section.id === sectionId) {
            if (!section.classList.contains('active')) {
                section.classList.add('active');
                debugLog(`[NAV] Activated section element: #${section.id}`);
            } else {
                debugLog(`[NAV] Section #${section.id} was already active.`);
            }
            foundSection = true;
        } else {
            if (section.classList.contains('active')) {
                section.classList.remove('active');
                debugLog(`[NAV] Deactivated section element: #${section.id}`);
            }
        }
    });

    if (!foundSection) {
        console.error(`[NAV ERROR] Target section element with id "${sectionId}" not found in DOM.`);
        debugLog(`[NAV ERROR] Target section element with id "${sectionId}" not found.`);
        return; // Exit if the section doesn't exist
    }

    let foundButton = false;
    navButtons.forEach(btn => {
        const btnSectionId = btn.getAttribute('data-section');
        if (btnSectionId === sectionId) {
            if (!btn.classList.contains('active')) {
                btn.classList.add('active');
                debugLog(`[NAV] Activated button: [data-section="${btnSectionId}"]`);
            }
            foundButton = true;
        } else {
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                debugLog(`[NAV] Deactivated button: [data-section="${btnSectionId}"]`);
            }
        }
    });

    if (!foundButton) {
        console.warn(`[NAV WARN] Target button with data-section "${sectionId}" not found.`);
        debugLog(`[NAV WARN] Target button with data-section "${sectionId}" not found.`);
    }

    debugLog(`[NAV] Loading data for section: ${sectionId}`);
    // Use ensureFirebaseReady for all section load functions
    if (sectionId === 'earn') await ensureFirebaseReady(updateEarnSectionUI, 'updateEarnSectionUI');
    else if (sectionId === 'invite') await ensureFirebaseReady(updateInviteSectionUI, 'updateInviteSectionUI');
    else if (sectionId === 'top') await ensureFirebaseReady(updateTopSectionUI, 'updateTopSectionUI');
    else if (sectionId === 'wallet') await ensureFirebaseReady(updateWalletSectionUI, 'updateWalletSectionUI');
    else if (sectionId === 'chest') {
        await ensureFirebaseReady(updateUserStatsUI, 'updateChestUserStats'); // For stats needed by chest UI
        updateChestUI(); // Update chest slider UI specifically after stats are potentially updated
    } else {
        debugLog(`[NAV] No specific data load function for section: ${sectionId}`);
    }
}

// --- User Data Management ---
async function initializeUserData() {
    debugLog("Initializing user data...");
    if (!telegramUser || !telegramUser.id) {
        console.warn("Cannot initialize user data: No Telegram user available or no ID.");
        debugLog("User init skipped: No Telegram user ID.");
        return;
    }
    if (!firebaseInitialized || !db) {
        console.error("Firestore not initialized. Cannot initialize user data.");
        debugLog("User init skipped: Firestore not initialized.");
        return; // Stop if Firestore isn't ready
    }

    const userIdStr = telegramUser.id.toString();
    const userDocRef = db.collection('userData').doc(userIdStr);
    const rankingDocRef = db.collection('users').doc(userIdStr);

    try {
        const doc = await userDocRef.get();
        const rankDoc = await rankingDocRef.get(); // Check ranking doc too

        if (!doc.exists) {
            debugLog(`User ${userIdStr} not found in userData, creating new record.`);
            const newUser = {
                gems: 0,
                usdt: 0,
                ton: 0,
                referrals: 0,
                referralCredits: 0,
                inviteRecords: [],
                claimHistory: [],
                landPieces: 0,
                foxMedals: 0,
                vipLevel: 0,
                isReferred: false,
                referredBy: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                claimedQuests: [],
                adProgress: {},
                adCooldowns: {}, // Initialize ad cooldowns object
                walletAddress: null,
                transactions: [] // Consider subcollection later if needed
            };
            await userDocRef.set(newUser);

            const rankingEntry = {
                username: telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                foxMedals: 0,
                photoUrl: telegramUser.photo_url || 'assets/icons/user-avatar.png',
                userId: userIdStr
            };
             if (!rankDoc.exists) { // Only create ranking if it doesn't exist
                await rankingDocRef.set(rankingEntry);
                debugLog("New ranking entry created.");
             } else {
                 debugLog("Ranking entry already exists, skipping creation.");
             }

            debugLog("New user data initialized in userData collection.");
            if (analytics) analytics.logEvent('user_signup', { userId: userIdStr });
        } else {
            debugLog(`User ${userIdStr} found. Updating last login and ensuring fields.`);
            const updates = {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            const userData = doc.data();
            // Ensure essential fields exist if user doc was created before fields were added
            if (userData.vipLevel === undefined) updates.vipLevel = 0;
            if (userData.adProgress === undefined) updates.adProgress = {};
            if (userData.adCooldowns === undefined) updates.adCooldowns = {};
            if (userData.claimedQuests === undefined) updates.claimedQuests = [];
            if (userData.inviteRecords === undefined) updates.inviteRecords = [];
            if (userData.claimHistory === undefined) updates.claimHistory = [];
            // Add other checks as needed

            await userDocRef.update(updates);

            // Ensure ranking entry exists too and update if necessary
            const currentPhoto = telegramUser.photo_url || 'assets/icons/user-avatar.png';
            const currentUsername = telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`;
            if (!rankDoc.exists) {
                const rankingEntry = {
                    username: currentUsername,
                    foxMedals: userData.foxMedals || 0, // Sync medals
                    photoUrl: currentPhoto,
                    userId: userIdStr
                };
                await rankingDocRef.set(rankingEntry);
                debugLog("Created missing ranking entry for existing user.");
            } else {
                // Optionally update username/photo in ranking if changed in Telegram
                const rankData = rankDoc.data();
                const rankingUpdates = {};
                if (rankData.photoUrl !== currentPhoto) rankingUpdates.photoUrl = currentPhoto;
                if (rankData.username !== currentUsername) rankingUpdates.username = currentUsername;
                // Ensure medals are synced if somehow diverged (less likely with transactions)
                if (rankData.foxMedals !== (userData.foxMedals || 0)) rankingUpdates.foxMedals = userData.foxMedals || 0;

                if (Object.keys(rankingUpdates).length > 0) {
                     await rankingDocRef.update(rankingUpdates);
                     debugLog("Updated ranking entry username/photo/medals.");
                }
            }
        }
        // Always fetch fresh data after init/update and store globally
        await fetchAndUpdateUserData();
        // No need to call updateUserStatsUI here, fetchAndUpdateUserData handles the cache update,
        // and the navigation logic will call the appropriate UI update function.

    } catch (error) {
        console.error("Error initializing/checking user data:", error);
        debugLog(`Error initializing user data for ${userIdStr}: ${error.message}\n${error.stack}`);
        alert("There was a problem loading your profile.");
    }
}

async function fetchAndUpdateUserData() {
    // No console log here to reduce noise, called frequently
    if (!telegramUser || !telegramUser.id || !firebaseInitialized || !db) {
        // debugLog("User data fetch skipped: Conditions not met."); // Enable if needed
        currentUserData = null; // Invalidate cache if conditions not met
        return null;
    }
    try {
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const userDoc = await userDocRef.get({ source: 'server' }); // Force server fetch for latest state
        if (!userDoc.exists) {
            debugLog("User doc not found during fetch.");
            currentUserData = null; // Invalidate cache
            // Maybe trigger re-initialization? Or assume init failed earlier.
            // For now, just return null. initializeUserData should have created it.
            return null;
        }
        currentUserData = userDoc.data(); // Update global cache
        // debugLog("User data fetched and cached.", currentUserData); // Enable if needed
        return currentUserData;
    } catch (error) {
        console.error("Error fetching user data:", error);
        debugLog(`Error fetching user data: ${error.message}`);
        currentUserData = null; // Reset cache on error
        return null;
    }
}

async function updateUserStatsUI() {
    // No console log here to reduce noise, called frequently
    const data = currentUserData || await fetchAndUpdateUserData(); // Use cache or fetch

    if (!data) {
        debugLog("Stats UI update skipped: No user data available.");
        // Set UI to defaults or loading state
        try { // Wrap DOM access in try-catch
            document.getElementById('gems').textContent = 0;
            document.getElementById('usdt').textContent = '0.0000';
            document.getElementById('ton').textContent = '0.0000';
            const walletUsdtEl = document.getElementById('wallet-usdt');
            const walletTonEl = document.getElementById('wallet-ton');
            if(walletUsdtEl) walletUsdtEl.textContent = '0.0000';
            if(walletTonEl) walletTonEl.textContent = '0.0000';
        } catch (error) {
            console.error("Error setting default stats UI:", error);
            debugLog(`Error setting default stats UI: ${error.message}`);
        }
        return;
    }

    try {
        document.getElementById('gems').textContent = data.gems?.toLocaleString() || 0;
        document.getElementById('usdt').textContent = (data.usdt || 0).toFixed(4);
        document.getElementById('ton').textContent = (data.ton || 0).toFixed(4);

        // Update wallet section balances as well, check if elements exist
        const walletUsdtEl = document.getElementById('wallet-usdt');
        const walletTonEl = document.getElementById('wallet-ton');
        if(walletUsdtEl) walletUsdtEl.textContent = (data.usdt || 0).toFixed(4);
        if(walletTonEl) walletTonEl.textContent = (data.ton || 0).toFixed(4);

        // debugLog("User stats UI updated successfully."); // Enable if needed
    } catch (error) {
        console.error("Error updating user stats UI:", error);
        debugLog(`Error updating stats UI: ${error.message}`);
    }
}


// --- Earn Section (Quests) ---
async function updateEarnSectionUI() {
    debugLog("[QUEST DEBUG] Starting Earn section UI update...");
    const dailyQuestList = document.getElementById('daily-quest-list');
    const basicQuestList = document.getElementById('basic-quest-list');
    const dailyQuestCountEl = document.getElementById('daily-quest-count');
    const basicQuestCountEl = document.getElementById('basic-quest-count');

    if (!dailyQuestList || !basicQuestList || !dailyQuestCountEl || !basicQuestCountEl) {
        console.error("[QUEST ERROR] Required DOM elements for quests not found!");
        debugLog("[QUEST ERROR] Quest list or count elements missing from DOM.");
        return;
    }
    debugLog("[QUEST DEBUG] Quest DOM elements found.");

    // Set initial loading state
    dailyQuestList.innerHTML = `<li class="loading"><p>Loading daily quests...</p></li>`;
    basicQuestList.innerHTML = `<li class="loading"><p>Loading basic quests...</p></li>`;
    dailyQuestCountEl.textContent = '-';
    basicQuestCountEl.textContent = '-';
    debugLog("[QUEST DEBUG] Set initial loading state.");

    try {
        // No need to check firebaseInitialized here, ensureFirebaseReady wrapper handles it.
        debugLog("[QUEST DEBUG] Firebase assumed ready by ensureFirebaseReady.");

        let userData = currentUserData || await fetchAndUpdateUserData(); // Fetch fresh data for quests
        if (!userData) {
            throw new Error("User data not available for quest checks.");
        }
        debugLog("[QUEST DEBUG] User data loaded for quest checks.", userData);

        // Ensure sub-objects exist on fetched data
        userData.adProgress = userData.adProgress || {};
        userData.adCooldowns = userData.adCooldowns || {};
        userData.claimedQuests = userData.claimedQuests || [];
        debugLog("[QUEST DEBUG] Ensured adProgress, adCooldowns, and claimedQuests exist on userData.");

        // --- Fetch Daily Quests ---
        debugLog("[QUEST DEBUG] Fetching daily quests from quests/daily...");
        const dailyQuestsSnapshot = await db.collection('quests').doc('daily').get({ source: 'server' });
        debugLog("[QUEST DEBUG] Daily quests snapshot received.", dailyQuestsSnapshot.exists);
        const dailyQuestsData = dailyQuestsSnapshot.exists ? dailyQuestsSnapshot.data() : {};
        const fetchedDailyQuests = dailyQuestsData.tasks || [];
        debugLog(`[QUEST DEBUG] Found ${fetchedDailyQuests.length} daily quests in tasks array.`, fetchedDailyQuests);

        dailyQuestCountEl.textContent = fetchedDailyQuests.length;
        if (fetchedDailyQuests.length === 0) {
            dailyQuestList.innerHTML = `<li class="no-quests"><p>No daily quests available today.</p></li>`;
            debugLog("[QUEST DEBUG] No daily quests found in tasks array.");
        } else {
            dailyQuestList.innerHTML = ''; // Clear loading message
            fetchedDailyQuests.forEach(quest => {
                 if (!quest.id) {
                    console.warn("[QUEST WARN] Daily quest object missing 'id' field:", quest);
                    debugLog("[QUEST WARN] Daily quest object missing 'id' field.");
                     return; // Skip rendering invalid quest
                 }
                 try {
                     // Pass the most recent userData to the creation function
                     const li = createQuestItem(quest, userData);
                     dailyQuestList.appendChild(li);
                 } catch(renderError) {
                     console.error(`[QUEST ERROR] Failed to render daily quest ${quest.id}:`, renderError);
                     debugLog(`[QUEST ERROR] Failed render daily quest ${quest.id}: ${renderError.message}`);
                 }
            });
            debugLog("[QUEST DEBUG] Daily quests rendered from tasks array.");
        }

        // --- Fetch Basic Quests ---
        debugLog("[QUEST DEBUG] Fetching basic quests from quests/basic...");
        const basicQuestsSnapshot = await db.collection('quests').doc('basic').get({ source: 'server' });
        debugLog("[QUEST DEBUG] Basic quests snapshot received.", basicQuestsSnapshot.exists);
        const basicQuestsData = basicQuestsSnapshot.exists ? basicQuestsSnapshot.data() : {};
        const fetchedBasicQuests = basicQuestsData.tasks || [];
        debugLog(`[QUEST DEBUG] Found ${fetchedBasicQuests.length} basic quests in tasks array.`, fetchedBasicQuests);

        // --- Initialize missing adProgress structures if needed ---
        // This ensures that if new ad quests are added, the user's data structure is updated.
        let adProgressUpdateNeeded = false;
        const adProgressUpdate = {};
        const allFetchedAdQuests = [...fetchedDailyQuests, ...fetchedBasicQuests].filter(q => q.type === 'ads' && q.id);

        allFetchedAdQuests.forEach(quest => {
            if (!userData.adProgress[quest.id]) {
                userData.adProgress[quest.id] = { watched: 0, claimed: false, lastClaimed: null };
                adProgressUpdate[`adProgress.${quest.id}`] = userData.adProgress[quest.id];
                adProgressUpdateNeeded = true;
                debugLog(`[QUEST DEBUG] Initializing adProgress for quest: ${quest.id}`);
            } else if (!quest.id) {
                 console.warn("[QUEST WARN] Ad quest object missing 'id' field during adProgress check:", quest);
                 debugLog("[QUEST WARN] Ad quest object missing 'id' field.");
            }
        });

        if (adProgressUpdateNeeded) {
             debugLog("[QUEST DEBUG] Updating user data with initial adProgress structures...");
             // Use set with merge: true to avoid errors if the document doesn't exist yet (less likely here)
             await db.collection('userData').doc(telegramUser.id.toString()).set({ adProgress: userData.adProgress }, { merge: true });
             debugLog("[QUEST DEBUG] User data updated.");
             // Re-fetch data AFTER the update to ensure subsequent logic uses the correct structure
             userData = await fetchAndUpdateUserData();
             if (!userData) throw new Error("User data unavailable after adProgress init.");
             // Re-ensure structures on the newly fetched data (belt-and-braces)
             userData.adProgress = userData.adProgress || {};
             userData.adCooldowns = userData.adCooldowns || {};
             userData.claimedQuests = userData.claimedQuests || [];
         }
        // --- End adProgress Initialization ---


        basicQuestCountEl.textContent = fetchedBasicQuests.length;
        if (fetchedBasicQuests.length === 0) {
            basicQuestList.innerHTML = `<li class="no-quests"><p>No basic quests available right now.</p></li>`;
             debugLog("[QUEST DEBUG] No basic quests found in tasks array.");
        } else {
            basicQuestList.innerHTML = ''; // Clear loading message
            fetchedBasicQuests.forEach(quest => {
                 if (!quest.id) {
                     console.warn("[QUEST WARN] Basic quest object missing 'id' field:", quest);
                     debugLog("[QUEST WARN] Basic quest object missing 'id' field.");
                     return; // Skip rendering
                 }
                  try {
                      // Pass the most recent userData
                     const li = createQuestItem(quest, userData);
                     basicQuestList.appendChild(li);
                 } catch(renderError) {
                     console.error(`[QUEST ERROR] Failed to render basic quest ${quest.id}:`, renderError);
                      debugLog(`[QUEST ERROR] Failed render basic quest ${quest.id}: ${renderError.message}`);
                 }
            });
             debugLog("[QUEST DEBUG] Basic quests rendered from tasks array.");
        }

         debugLog("[QUEST DEBUG] updateEarnSectionUI completed successfully.");

    } catch (error) {
        console.error("[QUEST ERROR] Failed to update Earn section UI:", error);
        debugLog(`[QUEST ERROR] Failed to update Earn section UI: ${error.message}\n${error.stack}`);
        dailyQuestList.innerHTML = `<li class="error"><p>Failed to load daily quests. Please try again later.</p></li>`;
        basicQuestList.innerHTML = `<li class="error"><p>Failed to load basic quests. Please try again later.</p></li>`;
        dailyQuestCountEl.textContent = 'ERR';
        basicQuestCountEl.textContent = 'ERR';
    }
}

function createQuestItem(quest, userData) {
    // --- Check if quest or quest.id is invalid ---
    if (!quest || !quest.id) {
        console.warn("[QUEST WARN] Attempted to create item for invalid quest object:", quest);
        debugLog("[QUEST WARN] Attempted to create item for invalid quest object.");
        return document.createDocumentFragment(); // Return empty to prevent adding junk to DOM
    }
    // debugLog(`[QUEST UI CREATE] Creating quest item: ${quest.id}`, quest); // More detail

    const li = document.createElement('li');
    li.className = 'quest-item';
    li.dataset.questId = quest.id;
    li.dataset.questType = quest.type || 'default'; // Use type from quest, default if missing

    // Validate quest data
    const icon = quest.icon || 'assets/icons/quest_placeholder.png';
    const title = quest.title || 'Untitled Quest';
    const reward = Number(quest.reward) || 0; // Ensure reward is a number
    const link = quest.link || ''; // For non-ad quests
    const actionText = quest.action || (quest.type === 'ads' ? 'Watch Ad' : 'GO'); // Default action text

    // Store original action text for reset later (used in updateQuestItemUI)
    li.dataset.originalAction = actionText;

    // Sanitize title to prevent HTML injection
    const titleElement = document.createElement('span');
    titleElement.textContent = title;
    titleElement.className = 'quest-title'; // Add class for potential styling

    const iconImg = document.createElement('img');
    iconImg.src = icon;
    iconImg.alt = title;
    iconImg.className = 'quest-icon';
    iconImg.onerror = () => {
        debugLog(`Failed to load quest icon for ${quest.id}: ${icon}`);
        iconImg.src = 'assets/icons/quest_placeholder.png';
    };

    const infoDiv = document.createElement('div'); // Container for title and reward
    infoDiv.className = 'quest-info';

    const rewardDiv = document.createElement('div');
    rewardDiv.className = 'quest-reward';
    const gemImg = document.createElement('img');
    gemImg.src = 'assets/icons/gem.png';
    gemImg.alt = 'Gem';
    gemImg.className = 'reward-icon';
    gemImg.onerror = () => { debugLog(`Failed to load gem icon for quest ${quest.id}`); };
    const rewardSpan = document.createElement('span');
    rewardSpan.className = 'reward-amount';
    rewardSpan.textContent = `+${reward.toLocaleString()}`; // Format reward nicely
    rewardDiv.appendChild(gemImg);
    rewardDiv.appendChild(rewardSpan);

    infoDiv.appendChild(titleElement);
    infoDiv.appendChild(rewardDiv); // Put reward under title

    const buttonContainer = document.createElement('div'); // Separate container for button/progress
    buttonContainer.className = 'quest-action-container';


    // --- Ad Quest Specific Logic & Elements ---
    const isAdBased = quest.type === 'ads';
    let button; // Define button outside the if/else

    if (isAdBased) {
        // Ad Quest specifics
        const adType = quest.adType || 'rewarded_interstitial'; // Get ad type
        const adsRequired = Math.max(1, Number(quest.adLimit) || 1); // Use adLimit from quest

        // Ensure adProgress object and quest-specific entry exist (should be handled by updateEarnSectionUI)
        const adProgress = userData.adProgress?.[quest.id] || { watched: 0, claimed: false, lastClaimed: null };

        // Create Progress Span
        const progressSpan = document.createElement('span');
        progressSpan.className = 'progress'; // Will be updated by updateQuestItemUI
        // Insert progress span into the button container
        buttonContainer.appendChild(progressSpan);

        // Add dataset attributes for ad logic
        li.dataset.adType = adType;
        li.dataset.adLimit = adsRequired;

        button = document.createElement('button');
        button.dataset.questReward = reward; // Store reward for claim logic

        // Initial button state will be set by updateQuestItemUI right after creation
        // Just create the button element here
        buttonContainer.appendChild(button); // Add button to its container

    } else { // --- Non-Ad Quest ---
        button = document.createElement('button');
        button.dataset.questReward = reward;
        button.dataset.questLink = link; // Add link data for click handler

        // Initial button state will be set by updateQuestItemUI
        buttonContainer.appendChild(button); // Add button to its container
    }

    li.appendChild(iconImg);
    li.appendChild(infoDiv);
    li.appendChild(buttonContainer); // Add the action container (progress/button)

    // --- Add Click Listener (Unified) ---
    // Use cloning when adding listener to ensure it's fresh if this function is called multiple times
    const freshButton = button.cloneNode(true); // Clone the created button
    buttonContainer.replaceChild(freshButton, button); // Replace the original button with the clone
    freshButton.addEventListener('click', handleQuestButtonClick);

    // --- Initial UI State Update ---
    // Call updateQuestItemUI immediately after creating the element to set the correct initial state
    updateQuestItemUI(quest.id, li, userData); // Pass userData to avoid re-fetch

    // debugLog(`[QUEST UI CREATE] Quest item created and listener attached: ${quest.id}`); // Reduce noise
    return li;
}

// --- Update Quest Item UI Helper ---
// Now takes optional userData to avoid redundant fetches when called directly after creation
function updateQuestItemUI(questId, listItemElement, currentLocalUserData = null) {
    // debugLog(`[QUEST UI UPDATE] Updating specific quest item UI for: ${questId}`); // Reduce noise
    const userData = currentLocalUserData || currentUserData; // Use provided data or global cache

    if (!userData || !listItemElement) {
        debugLog("[QUEST UI UPDATE] Skipped: No user data or list item element.", { questId, hasUserData: !!userData, hasElement: !!listItemElement });
        return;
    }

    // Retrieve quest details from dataset attributes
    const questType = listItemElement.dataset.questType;
    const adLimit = parseInt(listItemElement.dataset.adLimit || '0');
    const adType = listItemElement.dataset.adType || ''; // Needed for ad type cooldown check
    const originalActionText = listItemElement.dataset.originalAction || (questType === 'ads' ? 'Watch Ad' : 'GO'); // Get stored original text

    const button = listItemElement.querySelector('.quest-action-container button');
    const progressSpan = listItemElement.querySelector('.progress'); // Should be inside action container now

    if (!button) {
        debugLog("[QUEST UI WARN] Could not find button within quest item action container:", questId);
        return; // Cannot update state without a button
    }

    // --- Get Quest State ---
    const isAdBased = questType === 'ads';
    const isNonAdClaimed = !isAdBased && (userData.claimedQuests?.includes(questId) || false);

    let adProgress = { watched: 0, claimed: false, lastClaimed: null }; // Default structure
    if (isAdBased && userData.adProgress && userData.adProgress[questId]) {
        adProgress = userData.adProgress[questId];
    } else if (isAdBased) {
        // If adProgress doesn't exist for this ID yet, treat as initial state
        debugLog(`[QUEST UI UPDATE] No adProgress found for ${questId}, using default state.`);
    }

    // Update progress text if it's an ad quest and span exists
    if (isAdBased && progressSpan) {
        progressSpan.textContent = `${adProgress.watched}/${adLimit}`;
        progressSpan.style.display = 'inline'; // Ensure visible
    } else if (progressSpan) {
        progressSpan.style.display = 'none'; // Hide progress for non-ad quests
    }

    // --- Determine Quest Status ---
    const isQuestCompleted = isAdBased ? adProgress.watched >= adLimit : true; // Non-ad quests are 'complete' if not claimed yet
    const isQuestClaimed = isAdBased ? adProgress.claimed : isNonAdClaimed;

    // --- Check Cooldowns ---

    // 1. Quest Repeat Cooldown (1 hour for Ad Quests after claim)
    let isQuestOnCooldown = false;
    let questCooldownRemainingMinutes = 0;
    if (isAdBased && isQuestClaimed) {
        const questLastClaimedTime = safeConvertToDate(adProgress.lastClaimed)?.getTime() || 0;
        const timeSinceQuestLastClaim = questLastClaimedTime ? Date.now() - questLastClaimedTime : Infinity;
        if (timeSinceQuestLastClaim < QUEST_REPEAT_COOLDOWN_MS) {
            isQuestOnCooldown = true;
            questCooldownRemainingMinutes = Math.ceil((QUEST_REPEAT_COOLDOWN_MS - timeSinceQuestLastClaim) / 60000);
        }
        // If quest cooldown is over (isQuestClaimed is true but timeSince > 1hr),
        // isQuestOnCooldown remains false, allowing the logic below to show the 'GO' button again.
    }

    // 2. Ad Type Cooldown (3 minutes between watching ads of the same type)
    let isAdTypeOnCooldown = false;
    let adTypeCooldownRemainingMinutes = 0;
    if (isAdBased && (adType === 'rewarded_popup' || adType === 'rewarded_interstitial')) {
        // Use optional chaining for safer access
        const adTypeLastWatched = safeConvertToDate(userData.adCooldowns?.[adType])?.getTime() || 0;
        const timeSinceAdTypeLastWatched = adTypeLastWatched ? Date.now() - adTypeLastWatched : Infinity;
        if (timeSinceAdTypeLastWatched < REWARDED_AD_COOLDOWN_MS) {
            isAdTypeOnCooldown = true;
            adTypeCooldownRemainingMinutes = Math.ceil((REWARDED_AD_COOLDOWN_MS - timeSinceAdTypeLastWatched) / 60000);
        }
    }

    // --- Set Button State based on combined logic ---
    button.disabled = false; // Default to enabled, disable below if needed

    if (isQuestOnCooldown) {
        // Ad Quest is claimed AND within its 1-hour cooldown period.
        button.className = 'claimed-button'; // Visually distinct from GO/Claim
        button.textContent = `Wait ${questCooldownRemainingMinutes}m`;
        button.disabled = true;
        // debugLog(`[QUEST UI UPDATE ${questId}] State: Ad Quest ON 1hr Cooldown`);
    } else if (isQuestClaimed && !isAdBased) {
        // Non-ad quest is permanently claimed.
        button.className = 'claimed-button';
        button.textContent = 'Claimed';
        button.disabled = true;
        // debugLog(`[QUEST UI UPDATE ${questId}] State: Non-Ad Claimed`);
    } else if (isQuestCompleted && !isQuestClaimed && isAdBased) {
        // Ad Quest is completed (watched >= limit) AND ready to be claimed (or re-claimed after cooldown).
        button.className = 'claim-button active';
        button.textContent = 'Claim';
        // debugLog(`[QUEST UI UPDATE ${questId}] State: Ad Quest Ready to Claim`);
    } else {
        // Quest is actionable:
        // - Non-ad quest: Ready to 'GO'.
        // - Ad quest: Not completed yet OR 1-hour cooldown is over.
        button.className = 'go-button';
        if (isAdBased && isAdTypeOnCooldown) {
            // Ad quest is ready for action, BUT the 3-minute Ad TYPE cooldown is active.
            button.textContent = `Wait ${adTypeCooldownRemainingMinutes}m`;
            button.disabled = true;
            // debugLog(`[QUEST UI UPDATE ${questId}] State: GO (Ad Type Cooldown Active)`);
        } else {
            // Ad quest is ready AND Ad TYPE cooldown is NOT active, OR it's a Non-ad quest ready for 'GO'.
            button.textContent = originalActionText; // Use the original action text
            button.disabled = false;
            // debugLog(`[QUEST UI UPDATE ${questId}] State: GO (Ready for Action)`);
        }
    }
    // debugLog(`[QUEST UI UPDATE ${questId}] Final State -> Class: ${button.className}, Text: ${button.textContent}, Disabled: ${button.disabled}`);
}

// --- Unified Quest Button Click Handler ---
async function handleQuestButtonClick(event) {
    const button = event.target;
    const li = button.closest('.quest-item'); // Find the parent list item

    // Ensure we have the necessary elements and the button isn't disabled
    if (!li || !button || button.disabled) {
         debugLog("[QUEST ACTION] Click ignored: Missing element or button disabled.", { hasLi: !!li, hasButton: !!button, isDisabled: button?.disabled });
        return;
    }

    const questId = li.dataset.questId;
    const questType = li.dataset.questType;
    const reward = parseInt(button.dataset.questReward || '0');
    const link = button.dataset.questLink || ''; // Get link if present (non-ad)
    const adLimit = parseInt(li.dataset.adLimit || '0'); // Get ad limit if present
    const adType = li.dataset.adType || ''; // Get adType if present

    debugLog(`[QUEST ACTION] Unified click handler for quest: ${questId}`, { type: questType, reward, link, adLimit, adType, buttonClass: button.className });

    if (!firebaseInitialized || !db || !telegramUser || !telegramUser.id) {
        alert("Cannot process quest action: System not ready.");
        debugLog("[QUEST ACTION ERROR] System not ready (Firebase/User).");
        // Re-enable button maybe? Or rely on UI update? Let's just alert.
        return;
    }

    // Get potentially updated user data before proceeding (important for cooldowns/progress)
    let userData = await fetchAndUpdateUserData();
    if (!userData) {
        alert("Cannot process quest action: User data unavailable.");
        debugLog("[QUEST ACTION ERROR] User data unavailable.");
        return; // Stop if user data couldn't be fetched
    }
     // Ensure necessary sub-objects exist on the fetched data
     userData.adProgress = userData.adProgress || {};
     userData.adCooldowns = userData.adCooldowns || {};
     userData.claimedQuests = userData.claimedQuests || [];

    // --- Logic based on button class ---
    if (button.classList.contains('claim-button')) {
        // Handle claiming (applies ONLY to completed ad quests now, as non-ad quests go straight to claimed)
        await claimQuestReward(questId, reward, questType, button, li, userData);
    } else if (button.classList.contains('go-button')) {
        // Handle 'GO' actions
        if (questType === 'ads') {
            // GO action for an ad quest means "Watch Ad" or "Start Watching After Cooldown"
            await watchAdForQuest(questId, adType, adLimit, button, li, userData);
        } else {
            // GO action for other quests (e.g., link)
            await completeLinkQuest(questId, reward, link, button, li, userData);
        }
    } else if (button.classList.contains('claimed-button')) {
        // This class now also covers the "Wait Xm" state for cooldowns.
        // No action needed, but log for clarity.
        debugLog(`[QUEST ACTION] Clicked on claimed/waiting button for quest: ${questId}. Text: ${button.textContent}`);
    } else {
         debugLog(`[QUEST ACTION WARN] Clicked button with unexpected class for quest ${questId}: ${button.className}`);
    }
}

// --- Specific Action Handlers ---

async function claimQuestReward(questId, reward, questType, button, li, userData) {
    // This function should now only be called for ad-based quests when the 'Claim' button is active.
    debugLog(`[QUEST ACTION CLAIM] Attempting to claim reward for quest: ${questId}`);
    button.disabled = true; button.textContent = 'Claiming...';

    const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
    const updates = {
        gems: firebase.firestore.FieldValue.increment(reward)
    };

    try {
        if (questType !== 'ads') {
            // This shouldn't happen based on the button logic, but handle defensively.
            console.warn(`[QUEST ACTION CLAIM WARN] Claim function called for non-ad quest: ${questId}`);
            debugLog(`[QUEST ACTION CLAIM WARN] Claim function called for non-ad quest: ${questId}`);
            // Mark as claimed just in case (though completeLinkQuest should handle it)
            updates.claimedQuests = firebase.firestore.FieldValue.arrayUnion(questId);
        } else {
            // Process claim for Ad Quest
            const adProgress = userData.adProgress?.[questId]; // Get current progress from passed data
            if (!adProgress) throw new Error("Ad progress data missing for claim.");

            // Double check conditions client-side before Firestore update
            const adLimit = parseInt(li.dataset.adLimit || '0');
            if (adProgress.watched < adLimit) {
                 debugLog(`[QUEST ACTION CLAIM WARN] Claim attempted but not enough ads watched for ${questId}. Watched: ${adProgress.watched}, Limit: ${adLimit}`);
                 alert("Quest not yet completed.");
                 await fetchAndUpdateUserData(); // Refresh data
                 updateQuestItemUI(questId, li); // Update UI based on fresh data
                 return; // Stop claim
            }
            if (adProgress.claimed) {
                 // Check if it's claimed but cooldown is over (shouldn't happen if claim button shown, but check)
                 const lastClaimedTime = safeConvertToDate(adProgress.lastClaimed)?.getTime() || 0;
                 if (Date.now() - lastClaimedTime < QUEST_REPEAT_COOLDOWN_MS) {
                    debugLog(`[QUEST ACTION CLAIM WARN] Claim button clicked, but quest ${questId} already marked claimed and on cooldown.`);
                    alert("Quest already claimed and cooling down.");
                    updateQuestItemUI(questId, li); // Update UI to show cooldown
                    return; // Stop claim
                 } else {
                     debugLog(`[QUEST ACTION CLAIM WARN] Claim button clicked for claimed quest ${questId}, but cooldown IS over. Proceeding to re-claim (resets progress).`);
                     // Allow the claim to proceed - it will mark claimed=true again and set a new lastClaimed timestamp.
                     // The watchAd function handles the actual reset of 'watched' count when the GO button is clicked next time.
                 }
            }

            // Prepare updates to mark as claimed and set timestamp for 1-hour cooldown
            updates[`adProgress.${questId}.claimed`] = true;
            updates[`adProgress.${questId}.lastClaimed`] = firebase.firestore.FieldValue.serverTimestamp();
            debugLog(`[QUEST ACTION CLAIM] Ad quest ${questId} claim updates prepared. Claimed: true, Timestamp set.`);
        }

        // --- Perform Firestore Update ---
        await userDocRef.update(updates);
        debugLog(`[QUEST ACTION CLAIM] Firestore updated for ${questId} claim. Awarded ${reward} gems.`);
        if (analytics) analytics.logEvent('quest_claimed', { userId: telegramUser.id, questId, reward, questType });

        alert(`Reward claimed! You earned ${reward} gems. Quest available again in 1 hour.`);

        // --- Update UI ---
        await fetchAndUpdateUserData(); // Refresh cache with new gem count and claim status/timestamp
        await updateUserStatsUI(); // Update global stats display
        updateQuestItemUI(questId, li); // Update the specific item's UI (will now show 1hr cooldown)

    } catch (error) {
        console.error(`[QUEST ERROR] Error claiming reward for ${questId}:`, error);
        debugLog(`[QUEST ERROR] Error claiming reward for ${questId}: ${error.message}`);
        alert("Failed to claim reward. Please try again.");
        // Re-enable button based on updated UI state after fetch
        await fetchAndUpdateUserData(); // Ensure we have latest state
        updateQuestItemUI(questId, li); // Update UI based on potentially failed attempt
    }
}

async function watchAdForQuest(questId, adType, adLimit, button, li, initialUserData) {
    debugLog(`[QUEST ACTION WATCH] Attempting watch ad (${adType}) for quest: ${questId}. Limit: ${adLimit}`);
    button.disabled = true; button.textContent = 'Loading...'; // Initial loading state

    // --- Get Quest Progress & Cooldown Status ---
    const adProgress = initialUserData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
    const isClaimed = adProgress.claimed;
    const lastClaimedTime = safeConvertToDate(adProgress.lastClaimed)?.getTime() || 0;
    const isQuestCooldownOver = isClaimed && (Date.now() - lastClaimedTime >= QUEST_REPEAT_COOLDOWN_MS);
    const needsReset = isQuestCooldownOver; // Quest needs reset if claimed and cooldown is over

    // --- 1. Check 3-Minute Ad TYPE Cooldown ---
    if (adType === 'rewarded_popup' || adType === 'rewarded_interstitial') {
        const adTypeLastWatched = safeConvertToDate(initialUserData.adCooldowns?.[adType])?.getTime() || 0;
        const timeSinceAdTypeLastWatched = adTypeLastWatched ? Date.now() - adTypeLastWatched : Infinity;

        if (timeSinceAdTypeLastWatched < REWARDED_AD_COOLDOWN_MS) {
            const remainingMs = REWARDED_AD_COOLDOWN_MS - timeSinceAdTypeLastWatched;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            alert(`Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before watching another ${adType.replace('_', ' ')} ad.`);
            debugLog(`[AD COOLDOWN] Blocked ${adType} for quest ${questId}. Remaining: ${remainingMinutes} min.`);
            updateQuestItemUI(questId, li); // Update UI to show correct wait time
            return; // Stop execution
        }
         debugLog(`[AD COOLDOWN] Ad type cooldown check passed for ${adType}.`);
    }
    // --- End Ad Type Cooldown Check ---


    // --- 2. Check if Quest is in an invalid state for watching ---
    if (isClaimed && !isQuestCooldownOver) {
         // User somehow clicked GO while quest cooldown timer was active
         debugLog(`[QUEST ACTION WATCH WARN] Attempted watch on quest ${questId} while 1hr quest cooldown is active.`);
         alert("Quest is still cooling down.");
         updateQuestItemUI(questId, li); // Update UI to show correct state
         return;
    }
    if (!isClaimed && adProgress.watched >= adLimit) {
        // User somehow clicked GO when the quest is ready to be claimed
        debugLog(`[QUEST ACTION WATCH WARN] Attempted watch on quest ${questId} that is ready to be claimed.`);
        alert("Quest already completed. Please claim your reward.");
        updateQuestItemUI(questId, li); // Update UI to show claim button
        return;
    }
    // --- End Invalid State Check ---

    // --- Proceed with Ad Display ---
    button.textContent = 'Loading Ad...';
    try {
        await showAd(adType);
        debugLog(`[QUEST ACTION WATCH] Ad shown successfully (or closed) for quest: ${questId}, type: ${adType}`);

        // --- Prepare Firestore updates ---
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const updates = {};
        let newWatchedCount;

        // 1. Determine New Quest Progress State
        if (needsReset) {
            // Resetting the quest after 1hr cooldown and watching the first ad
            newWatchedCount = 1;
            updates[`adProgress.${questId}.watched`] = newWatchedCount;
            updates[`adProgress.${questId}.claimed`] = false; // Mark as not claimed anymore
            // updates[`adProgress.${questId}.lastClaimed`] = null; // Optionally clear lastClaimed, not strictly necessary
            debugLog(`[QUEST ACTION WATCH] Resetting quest ${questId} after cooldown. Watched set to 1.`);
        } else {
            // Incrementing watch count for an ongoing quest
            // Fetch latest user data *only if not resetting* to avoid race conditions on increment
            const latestUserData = await fetchAndUpdateUserData();
            if (!latestUserData) throw new Error("User data unavailable after ad watch for progress update.");
            const currentAdProgress = latestUserData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };

            newWatchedCount = currentAdProgress.watched + 1;
            updates[`adProgress.${questId}.watched`] = newWatchedCount;
            debugLog(`[QUEST ACTION WATCH] Incrementing watch count for ${questId} to ${newWatchedCount}.`);
        }

        // 2. Update Ad Type Cooldown Timestamp
        if (adType === 'rewarded_popup' || adType === 'rewarded_interstitial') {
            updates[`adCooldowns.${adType}`] = firebase.firestore.FieldValue.serverTimestamp();
            debugLog(`[AD COOLDOWN] Preparing to update 3-min cooldown timestamp for ${adType}.`);
        }

        // --- Apply all updates together ---
        await userDocRef.update(updates);
        debugLog(`[QUEST ACTION WATCH] Firestore updated for ${questId}: Progress ${newWatchedCount}/${adLimit}. Cooldown set for ${adType}. Reset applied: ${needsReset}`);

        // --- Log Analytics ---
        if (analytics) analytics.logEvent('ads_quest_watch', { userId: telegramUser.id, questId, adType, reset: needsReset });

        // --- Update Local Cache & UI ---
        await fetchAndUpdateUserData(); // Refresh cache *after* successful Firestore update

        // Provide user feedback
        if (newWatchedCount >= adLimit) {
            alert(`Ad watched! (${newWatchedCount}/${adLimit}) You can now claim your reward.`);
        } else {
            alert(`Ad watched! Progress: ${newWatchedCount}/${adLimit}`);
        }

        // Update the UI for this specific quest item
        updateQuestItemUI(questId, li);

    } catch (error) {
        console.error(`[QUEST ERROR] Failed to show ad or update progress for ${questId} (${adType}):`, error);
        debugLog(`[QUEST ERROR] Failed showing ad/updating progress for ${questId} (${adType}): ${error.message}`);
        // Use a more specific error message if possible
        if (error.message.includes("timed out")) {
             alert("Ad failed to load in time. Please try again.");
        } else if (error.message.includes("closed early")) {
             alert("Ad was closed before completion. Please watch the full ad.");
        } else {
             alert(`Failed to show ad. Please try again. Error: ${error.message}`);
        }
        // Update UI to reset button state based on latest data after failure
        await fetchAndUpdateUserData(); // Ensure we have latest state
        updateQuestItemUI(questId, li); // Update UI based on potentially failed attempt
    }
}


async function completeLinkQuest(questId, reward, link, button, li, userData) {
    // This function remains largely the same, as it handles non-repeatable, non-ad quests.
    debugLog(`[QUEST ACTION LINK] Completing link quest: ${questId}`);

     if (userData.claimedQuests?.includes(questId)) {
         debugLog(`[QUEST ACTION LINK WARN] Link quest ${questId} already claimed.`);
         updateQuestItemUI(questId, li, userData); // Update UI just in case
         return;
     }
     if (!link) {
          alert("No link associated with this quest.");
          debugLog(`[QUEST ACTION LINK ERROR] No link found for quest ${questId}.`);
          // Reset button state as it was likely 'Processing...'
          button.disabled = false; button.textContent = li.dataset.originalAction || 'GO';
          return;
     }

    button.disabled = true; button.textContent = 'Processing...';

    try {
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        // Atomically update gems and add questId to claimedQuests array
        await userDocRef.update({
            gems: firebase.firestore.FieldValue.increment(reward),
            claimedQuests: firebase.firestore.FieldValue.arrayUnion(questId)
        });
        debugLog(`[QUEST ACTION LINK] Link quest ${questId} marked complete. Awarded ${reward} gems.`);

        // Log event
        if (analytics) analytics.logEvent('quest_completed', { userId: telegramUser.id, questId, reward, questType: 'link' });

        // Open the link *after* successfully updating Firestore
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
            window.Telegram.WebApp.openTelegramLink(link);
            debugLog(`[QUEST ACTION LINK] Opened Telegram link: ${link}`);
        } else if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
             window.Telegram.WebApp.openLink(link); // Use openLink as a fallback within Telegram context
             debugLog(`[QUEST ACTION LINK] Opened link via openLink: ${link}`);
        } else {
            window.open(link, '_blank');
            debugLog(`[QUEST ACTION LINK WARN] Opened link in new tab (not in Telegram context): ${link}`);
        }

        alert(`Quest completed! You earned ${reward} gems.`);

        // Update UI
        await fetchAndUpdateUserData(); // Refresh cache
        await updateUserStatsUI(); // Update global stats
        updateQuestItemUI(questId, li); // Update the specific item UI (will show 'Claimed')

    } catch (error) {
        console.error(`[QUEST ERROR] Error completing link quest ${questId}:`, error);
        debugLog(`[QUEST ERROR] Error completing link quest ${questId}: ${error.message}`);
        alert("Failed to complete quest. Please try again.");
        // Re-enable button based on updated UI state after fetch
        await fetchAndUpdateUserData(); // Ensure we have latest state
        updateQuestItemUI(questId, li); // Update UI based on potentially failed attempt
    }
}

// --- Ad Logic (showAd function) ---
// No changes needed here based on the request. It correctly handles adType
// and the cooldowns are managed *before* calling this and *after* its success in watchAdForQuest.
async function showAd(adType) {
    debugLog(`[AD] Attempting to show ad. Received adType from quest data: ${adType}`);
    return new Promise((resolve, reject) => {

        // --- REJECT MANUAL 'inApp' TRIGGERS ---
        if (adType === 'inApp') {
            const errorMsg = "In-App ads are shown automatically or via different SDK settings, not via manual quest trigger.";
            console.warn(`[AD WARN] ${errorMsg}`);
            debugLog(`[AD WARN] ${errorMsg}`);
            // Reject with a specific error type maybe?
            return reject(new Error("Invalid ad type for manual trigger"));
        }
        // --- END REJECTION ---

        const maxWaitTime = 30000; // 30 seconds timeout

        if (typeof window.show_9180370 !== 'function') {
            console.warn("[AD WARN] Monetag SDK function 'show_9180370' not found. Simulating ad success after delay.");
            debugLog("[AD WARN] Monetag SDK function not found. Simulating success.");
            setTimeout(() => {
                debugLog("[AD] Simulated ad finished.");
                resolve(); // Simulate success
            }, 2000); // Shorter delay for simulation
            return;
        }

        let adPromise = null;
        let adTriggered = false;
        let requiresPromiseHandling = true; // Assume we need promise handling unless specified otherwise by SDK docs
        let resolved = false; // Flag to prevent double resolution/rejection

        const cleanup = (success, error = null) => {
             if (resolved) return; // Prevent multiple calls
             resolved = true;
            clearTimeout(timeoutId);
            if (success) {
                 debugLog(`[AD] Cleanup called: Success for adType ${adType}`);
                resolve();
            } else {
                 const baseError = error || new Error(`Ad failed or was closed early (${adType || 'unknown type'})`);
                 debugLog(`[AD] Cleanup called: Failure for adType ${adType}`, baseError.message);
                 // Propagate a more specific error if possible
                 if (error && error.message && error.message.toLowerCase().includes('closed')) {
                     reject(new Error(`Ad was closed early (${adType})`));
                 } else if (error && error.message && error.message.toLowerCase().includes('timeout')) {
                      reject(new Error(`Ad timed out (${adType})`));
                 }
                 else {
                    reject(baseError);
                 }
            }
        };

        const timeoutId = setTimeout(() => {
            console.warn(`[AD WARN] Ad timed out after ${maxWaitTime / 1000}s (${adType || 'unknown type'}). Rejecting.`);
            debugLog(`[AD WARN] Ad timed out: ${adType}`);
            // Pass a specific timeout error
            cleanup(false, new Error(`Ad timed out (${adType || 'unknown type'})`));
        }, maxWaitTime);

        try {
            debugLog(`[AD] Mapping Firestore adType '${adType}' to Monetag SDK call.`);
             // Add specific listener for close events IF the SDK provides one - Monetag docs needed here.
             // Example: window.addEventListener('monetagAdClosed', handleAdClose);
             // function handleAdClose(event) { if (event.detail.id === associatedAdId) cleanup(...) }

            if (adType === 'rewarded_popup') {
                debugLog("[AD] Calling Monetag SDK with 'pop' argument for rewarded_popup.");
                adPromise = window.show_9180370('pop');
                adTriggered = true;
            } else if (adType === 'rewarded_interstitial') {
                debugLog("[AD] Calling Monetag SDK with no arguments for rewarded_interstitial.");
                adPromise = window.show_9180370();
                adTriggered = true;
            } else {
                // Fallback for unrecognized types? Or reject? Let's reject.
                console.error(`[AD ERROR] Unrecognized adType for manual trigger: '${adType}'.`);
                debugLog(`[AD ERROR] Unrecognized adType: ${adType}`);
                cleanup(false, new Error(`Unrecognized ad type: ${adType}`));
                return; // Stop execution for unrecognized types
            }

            // Handle Promise if the SDK returns one
            if (requiresPromiseHandling && adTriggered && adPromise && typeof adPromise.then === 'function') {
                debugLog(`[AD] SDK returned a Promise for type ${adType}. Waiting for resolution...`);
                adPromise.then(() => {
                    debugLog(`[AD] SDK Promise resolved successfully for type: ${adType}. Ad likely watched/closed.`);
                    // Assuming resolve means success (watched fully) based on typical rewarded ad patterns.
                    cleanup(true);
                }).catch(e => {
                    // Treat SDK promise rejection as failure (closed early, failed to load, etc.)
                    console.error(`[AD ERROR] SDK Promise rejected for type ${adType}:`, e);
                    debugLog(`[AD ERROR] SDK Promise rejected for ${adType}: ${e?.message || e}`);
                    cleanup(false, new Error(`Ad failed or was closed early (${adType})`));
                });
            } else if (requiresPromiseHandling && adTriggered) {
                 // SDK call made, but no standard promise returned. Relying on timeout or potential SDK events.
                 // If the SDK doesn't provide events/callbacks, success might only be indicated by timeout NOT firing.
                 // This is risky. Need better SDK integration if this is the case.
                 console.warn(`[AD WARN] SDK call for ${adType} was triggered but did not return a standard promise. Success relies on timeout/events.`);
                 // For now, we assume timeout means failure, and lack of failure before timeout might mean success *if*
                 // the SDK doesn't fire any events. This path should ideally be avoided.
                 // Let's assume for now that if it's not promise based, we can't reliably detect success here, rely on timeout only for failure.
            } else if (adTriggered) {
                 // Ad triggered, but not expecting a promise (e.g., fire-and-forget, relies on events)
                 debugLog(`[AD INFO] Ad triggered for ${adType}, not awaiting promise. Relying on events or timeout.`);
            } else {
                 // Should not happen if adType check passed
                 debugLog("[AD WARN] Ad was not triggered despite recognized type.");
                 cleanup(false, new Error("Ad trigger failed unexpectedly"));
            }

        } catch (error) {
            console.error("[AD ERROR] Failed to trigger Monetag ad:", error);
            debugLog(`[AD ERROR] Failed to trigger ad ${adType}: ${error.message}`);
            cleanup(false, error);
        }
    });
}

// --- Wallet Section ---
async function initializeTONConnect() {
    debugLog("Initializing TON Connect...");
    try {
        // Ensure TonConnectUI script is loaded
        if (!window.TonConnectUI) {
            debugLog("TonConnectUI script not found, attempting to load...");
            await loadScript('https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js');
            if (!window.TonConnectUI) throw new Error("TonConnectUI script failed to load.");
            debugLog("TonConnectUI script loaded successfully.");
        } else {
            debugLog("TonConnectUI script already loaded.");
        }

        // Check if instance already exists to avoid re-initialization issues
        if (!tonConnectUI) {
            tonConnectUI = new window.TonConnectUI({
                manifestUrl: 'https://fourgo.app/tonconnect-manifest.json', // Make sure this is correct and accessible
                buttonRootId: null // We manage button interaction manually
            });
            debugLog("TonConnectUI instance created.");

            // --- Status Change Listener ---
            // Ensure only one listener is attached
            tonConnectUI.onStatusChange(async (walletInfo) => {
                debugLog(`[WALLET STATUS CHANGE] Wallet status changed. Connected: ${!!walletInfo}`, walletInfo ? { address: walletInfo.account.address, chain: walletInfo.account.chain } : null);
                // Refresh user data when connection status changes
                await fetchAndUpdateUserData();
                // Update wallet UI (connection status, address storage)
                await updateWalletConnectionStatusUI();
                // Also update the main Wallet section UI (balances might be affected by logic elsewhere)
                // But only if the wallet section is currently active? Or always? Let's update always for safety.
                await updateWalletSectionUI();

                // Re-enable connect button after status change completes
                const connectButton = document.querySelector('.connect-button');
                if (connectButton) connectButton.disabled = false;

            }, (error) => {
                 console.error("[WALLET STATUS CHANGE ERROR]", error);
                 debugLog(`[WALLET STATUS CHANGE ERROR] ${error.message || 'Unknown error'}`);
                 // Optionally update UI to show error state or re-enable button
                 const connectButton = document.querySelector('.connect-button');
                if (connectButton) connectButton.disabled = false;
            });
            debugLog("TonConnectUI status change listener attached.");

        } else {
             debugLog("TonConnectUI instance already exists, reusing.");
        }


        // --- Button Handling ---
        const connectButton = document.querySelector('.connect-button');
        if (connectButton) {
            // Use cloning to ensure the listener is fresh
            const newConnectButton = connectButton.cloneNode(true);
            connectButton.parentNode.replaceChild(newConnectButton, connectButton);
            newConnectButton.addEventListener('click', handleConnectClick);
            debugLog("Connect/Disconnect button listener attached/re-attached.");
        } else {
            console.error("Connect button not found in DOM!");
            debugLog("[WALLET ERROR] Connect button not found.");
        }

        debugLog("TON Connect initialized successfully.");
        // Update UI based on initial state after setup
        await updateWalletConnectionStatusUI();

    } catch (error) {
        console.error("TON Connect initialization failed:", error);
        debugLog(`TON Connect initialization failed: ${error.message}`);
        alert("Could not initialize wallet features. Please try again later.");
        // Ensure UI reflects failed state
        const connectionStatusEl = document.getElementById('connection-status');
        const connectButton = document.querySelector('.connect-button');
        if (connectionStatusEl) {
            connectionStatusEl.textContent = 'Error';
            connectionStatusEl.className = 'wallet-status disconnected';
        }
        if (connectButton) {
            connectButton.textContent = 'Wallet Error';
            connectButton.disabled = true;
        }
    }
}

// --- Wallet UI Update (Connection Status Part) ---
async function updateWalletConnectionStatusUI() {
    debugLog("Updating Wallet Connection Status UI...");
    const connectionStatusEl = document.getElementById('connection-status');
    const connectButton = document.querySelector('.connect-button'); // Re-select potentially new button
    const withdrawButtons = document.querySelectorAll('.withdraw-button'); // Select all withdraw buttons

    // Check if elements exist before proceeding
    if (!connectionStatusEl || !connectButton || !withdrawButtons) {
        console.error("Wallet UI elements missing (status, connect button, or withdraw buttons)!");
        debugLog("[WALLET ERROR] Connection status or button elements missing.");
        return;
    }

    const isConnected = tonConnectUI && tonConnectUI.connected;
    debugLog(`Wallet connection status check: ${isConnected}`);

    // Update Connect Button State First
    connectButton.disabled = false; // Generally enable after checks
    if (isConnected) {
        connectButton.textContent = 'DISCONNECT';
        connectButton.classList.add('connected');
    } else {
        connectButton.textContent = 'CONNECT TON WALLET';
        connectButton.classList.remove('connected');
    }

    // Update Status Text and Withdraw Button States
    if (isConnected && tonConnectUI.account) { // Ensure account info is available
        const walletAddress = tonConnectUI.account.address;
        const friendlyAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        connectionStatusEl.textContent = `Connected: ${friendlyAddress}`; // Show partial address
        connectionStatusEl.className = 'wallet-status connected';

        // Enable withdraw buttons if connected
        withdrawButtons.forEach(btn => {
            btn.disabled = false;
        });
        debugLog(`Wallet connected UI updated. Address: ${friendlyAddress}`);

        // Store wallet address if available and user identified
        if (walletAddress && telegramUser?.id) {
            try {
                 // Only update if address changed or not set
                 const currentStoredAddress = currentUserData?.walletAddress; // Check cached data first
                 if (currentStoredAddress !== walletAddress) {
                    await Storage.setItem('walletAddress', walletAddress); // Use Storage abstraction
                    debugLog(`Wallet connected: Address ${walletAddress} stored for user ${telegramUser.id}.`);
                    // Refresh local cache after storing
                    await fetchAndUpdateUserData();
                 } else {
                     // debugLog(`Wallet address ${walletAddress} already stored.`); // Reduce noise
                 }
            } catch (storageError) {
                 console.error("Failed to store wallet address:", storageError);
                 debugLog(`[WALLET ERROR] Failed to store wallet address: ${storageError.message}`);
            }
        } else {
            debugLog("Wallet connected, but address not available or user ID missing for storage.");
        }

    } else { // Not connected or account info missing
        connectionStatusEl.textContent = 'Disconnected';
        connectionStatusEl.className = 'wallet-status disconnected';

        // Disable withdraw buttons if disconnected
        withdrawButtons.forEach(btn => btn.disabled = true);
        debugLog("Wallet disconnected state UI updated.");

         // If disconnected, clear stored address? Optional, depends on desired behavior.
         /*
         if (telegramUser?.id && currentUserData?.walletAddress) {
             try {
                 await Storage.setItem('walletAddress', null);
                 debugLog(`Wallet disconnected: Cleared stored address for user ${telegramUser.id}.`);
                 await fetchAndUpdateUserData();
             } catch (storageError) {
                 console.error("Failed to clear wallet address:", storageError);
             }
         }
         */
    }
}


// --- Wallet Button Click Handler ---
async function handleConnectClick() {
     debugLog("[WALLET ACTION] Connect/Disconnect button clicked.");
     const connectButton = document.querySelector('.connect-button'); // Re-select potentially new button

     if (!connectButton) {
          debugLog("[WALLET ACTION ERROR] Connect button not found.");
          return;
     }
     if (!tonConnectUI) {
          debugLog("[WALLET ACTION ERROR] tonConnectUI not initialized.");
          alert("Wallet feature not ready. Please try again.");
          return;
      }

     // Temporarily disable button to prevent double clicks
     connectButton.disabled = true;
     connectButton.textContent = 'Processing...';

     try {
         if (tonConnectUI.connected) {
             debugLog("Disconnecting wallet...");
             await tonConnectUI.disconnect(); // Triggers status change listener which handles UI
             debugLog("Wallet disconnect initiated.");
         } else {
             debugLog("Connecting wallet...");
             // This opens the modal. Connection success/failure is handled by the onStatusChange listener.
             await tonConnectUI.connectWallet();
             debugLog("Wallet connection process initiated (modal shown).");
         }
     } catch (error) {
         console.error(`Wallet connection/disconnection error:`, error);
         debugLog(`[WALLET ACTION ERROR] ${error.message}`);
         alert(`Wallet action failed: ${error.message}`);
         // Manually update UI on error as status change might not fire correctly
         await updateWalletConnectionStatusUI(); // This will re-enable button based on actual state
     }
     // Button re-enabling is primarily handled by onStatusChange listener or the error block above
}


// --- Update Full Wallet Section UI ---
async function updateWalletSectionUI() {
    debugLog("Updating Wallet section UI...");
    // Ensure firebase is ready before proceeding with data-dependent updates
    await ensureFirebaseReady(async () => {
        await updateUserStatsUI(); // Updates balances in the header AND wallet section
        await updateWalletConnectionStatusUI(); // Updates connect button, status text, enables/disables withdraw
        await updateTransactionHistory(); // Fetches and displays transactions
        setupWithdrawModal(); // Re-attaches listeners for withdraw buttons and modal actions
    }, 'updateWalletSectionUI_inner');
    debugLog("Wallet section UI update complete.");
}


// --- Transaction History ---
async function updateTransactionHistory() {
     debugLog("Updating transaction history...");
     const transactionListEl = document.getElementById('transaction-list');
     if (!transactionListEl) {
         debugLog("[WALLET ERROR] Transaction list element not found.");
         return;
     }
     transactionListEl.innerHTML = '<li>Loading history...</li>'; // Loading state

     // No need for firebase init check, ensureFirebaseReady in updateWalletSectionUI covers it.
     if (!telegramUser || !telegramUser.id) {
         transactionListEl.innerHTML = '<li>History unavailable (User ID missing).</li>';
         debugLog("[WALLET WARN] History unavailable: User not identified.");
         return;
     }

     try {
         // Reference the subcollection correctly
         const txCollectionRef = db.collection('userData').doc(telegramUser.id.toString()).collection('transactions');
         // Get recent transactions, ordered by timestamp descending
         const snapshot = await txCollectionRef.orderBy('timestamp', 'desc').limit(20).get(); // Increased limit slightly

         if (snapshot.empty) {
             transactionListEl.innerHTML = '<li>No transactions yet</li>';
             debugLog("No transaction history found.");
             return;
         }

         debugLog(`Workspaceed ${snapshot.docs.length} transaction history entries.`);
         transactionListEl.innerHTML = snapshot.docs.map(doc => {
             const tx = doc.data();
             let txTime = 'Invalid date';
             const timestamp = safeConvertToDate(tx.timestamp);
             if (timestamp) txTime = timestamp.toLocaleString(); // Use local time format

             let detail = '';
             const status = tx.status || 'unknown';
             // Standardize status class names (e.g., pending, completed, failed)
             let statusClass = status.toLowerCase().replace(/\s+/g, '-'); // e.g., "processing simulation" -> "processing-simulation"

             // Determine transaction detail string based on standardized type
             switch (tx.type) {
                case 'Withdrawal':
                    const feeDecimalsW = tx.currency === 'USDT' ? 2 : 3;
                    detail = `Withdraw ${tx.amount?.toFixed(4) || '?'} ${tx.currency || '?'} (Fee: ${tx.fee?.toFixed(feeDecimalsW) || '?'})`;
                    break;
                case 'credit_claim':
                    detail = `Claimed ${tx.usdtAmount?.toFixed(4) || '?'} USDT (${tx.creditsSpent?.toLocaleString() || '?'} C)`;
                    break;
                // Add other transaction types here if needed
                default:
                    detail = `Type: ${tx.type || 'Unknown'}, Amount: ${tx.amount || '?'} ${tx.currency || '?'}`;
                    // Use 'unknown' status class if type is unexpected
                    if (statusClass === 'unknown' || statusClass === '') statusClass = 'unknown-status';
             }

            // Add failure reason if present
            if (status === 'failed' && tx.failureReason) {
                detail += ` <small>(Reason: ${tx.failureReason})</small>`;
            }


             // Construct list item HTML
             // Added specific classes for easier styling
             return `<li class="transaction-item status-${statusClass}">
                        <span class="transaction-detail">${detail}</span>
                        <span class="transaction-status">${status}</span>
                        <small class="transaction-time">${txTime}</small>
                     </li>`;
         }).join('');

     } catch (error) {
         console.error(`Error updating transaction history:`, error);
         debugLog(`Error updating transaction history: ${error.message}`);
         transactionListEl.innerHTML = `<li class="error">Error loading history.</li>`;
     }
 }


// --- Withdraw Modal ---
function setupWithdrawModal() {
    debugLog("Setting up withdraw modal listeners...");
    const withdrawButtons = document.querySelectorAll('.withdraw-button'); // Get all withdraw buttons
    const withdrawModal = document.getElementById('withdraw-modal');
    const confirmButton = document.getElementById('confirm-withdraw');
    const cancelButton = document.getElementById('cancel-withdraw');
    const amountInput = document.getElementById('withdraw-amount');
    const availableBalanceSpan = document.getElementById('available-balance');
    const currencySpan = document.getElementById('currency');
    const feeSpan = document.getElementById('withdraw-fee');
    const feeCurrencySpan = document.getElementById('fee-currency');
    const errorMsgEl = document.getElementById('withdraw-error-msg'); // Element for error messages

    if (!withdrawModal || !confirmButton || !cancelButton || !amountInput || !availableBalanceSpan || !currencySpan || !feeSpan || !feeCurrencySpan || !errorMsgEl) {
        console.error("Withdraw modal elements missing!");
        debugLog("[WALLET ERROR] Withdraw modal elements missing.");
        return;
    }

    // Function to show the modal with correct details
    const showModal = (currency, availableBalance) => {
        debugLog(`Showing withdraw modal for ${currency}. Available: ${availableBalance}`);
        currencySpan.textContent = currency;
        availableBalanceSpan.textContent = availableBalance.toFixed(4);
        feeCurrencySpan.textContent = currency;
        errorMsgEl.textContent = ''; // Clear previous errors
        errorMsgEl.style.display = 'none';

        // Define fees (Consider fetching these from config/Firestore later)
        const fee = currency === 'USDT' ? 0.10 : 0.01; // Example: 0.1 USDT fee, 0.01 TON fee
        const feeDecimals = currency === 'USDT' ? 2 : 3;
        feeSpan.textContent = fee.toFixed(feeDecimals);

        amountInput.value = '';
        amountInput.placeholder = `Min 0.0001`; // Example placeholder
        amountInput.step = currency === 'USDT' ? "0.0001" : "0.0001"; // Adjust step for precision
        const maxWithdraw = Math.max(0, availableBalance - fee);
        amountInput.max = maxWithdraw.toFixed(4); // Max withdrawable amount
        debugLog(`Max withdrawable set to: ${amountInput.max}`);


        // Reset button state
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirm Withdrawal';

        withdrawModal.style.display = 'flex'; // Show the modal using flex
    };

    // Function to hide the modal
    const hideModal = () => {
        withdrawModal.style.display = 'none';
        errorMsgEl.textContent = ''; // Clear errors on close
         errorMsgEl.style.display = 'none';
    };


    // --- Add Listeners using Cloning ---

    // Withdraw Buttons (USDT/TON)
    withdrawButtons.forEach(button => {
        const card = button.closest('.balance-card');
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', async (event) => {
            const isUsdt = card?.classList.contains('usdt-card');
            const currency = isUsdt ? 'USDT' : 'TON';
            debugLog(`${currency} Withdraw button clicked.`);

             // Check connection status before fetching data
             if (!tonConnectUI || !tonConnectUI.connected) {
                alert("Please connect your TON wallet first.");
                debugLog("Withdraw attempt blocked: Wallet not connected.");
                return;
            }

            // Fetch latest data to ensure accurate balance check
            const userData = await fetchAndUpdateUserData();
            if (!userData) {
                alert("Could not retrieve your balance. Please try again.");
                return;
            }

            const balance = isUsdt ? (userData.usdt || 0) : (userData.ton || 0);
            const fee = currency === 'USDT' ? 0.10 : 0.01; // Get fee again for check

            // Check if balance is greater than the fee (minimum required to withdraw anything)
            if (balance > fee) {
                 showModal(currency, balance);
            } else {
                alert(`Insufficient ${currency} balance to cover the withdrawal fee (${fee.toFixed(currency === 'USDT' ? 2 : 3)} ${currency}).`);
                 debugLog(`Withdraw attempt failed: Insufficient ${currency} balance (${balance}) to cover fee (${fee}).`);
            }
        });
    });
    debugLog("Withdraw button listeners attached/re-attached.");


    // Cancel Button Listener
    const newCancelButton = cancelButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    newCancelButton.addEventListener('click', (event) => {
        debugLog("Withdraw Cancel button clicked.");
        hideModal();
    });
    debugLog("Withdraw Cancel button listener attached.");

    // Confirm Button Listener
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    newConfirmButton.addEventListener('click', async (event) => {
        debugLog("Withdraw Confirm button clicked.");
        const amountStr = amountInput.value;
        const currency = currencySpan.textContent;
        const fee = parseFloat(feeSpan.textContent);
        const availableInModal = parseFloat(availableBalanceSpan.textContent); // Balance shown when modal opened

        const confirmBtn = event.target; // Use event target
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';
        errorMsgEl.textContent = ''; // Clear previous errors
        errorMsgEl.style.display = 'none';


        // --- Validation ---
        let amount;
        try {
            amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) {
                 throw new Error("Invalid amount entered. Must be a positive number.");
            }
            // Add minimum withdrawal check if needed (e.g., > 0.01 USDT)
            // if (currency === 'USDT' && amount < 0.01) throw new Error("Minimum withdrawal is 0.01 USDT.");
            // if (currency === 'TON' && amount < 0.01) throw new Error("Minimum withdrawal is 0.01 TON.");

        } catch (validationError) {
             debugLog(`[WITHDRAW VALIDATION] Error: ${validationError.message}`);
             errorMsgEl.textContent = validationError.message;
             errorMsgEl.style.display = 'block';
             confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Withdrawal';
             return;
        }


        // Re-fetch latest data for final balance validation
        const latestUserData = await fetchAndUpdateUserData();
        if (!latestUserData) {
             const msg = "Error verifying your current balance. Please try again.";
             debugLog("[WITHDRAW VALIDATION] Failed to fetch latest user data for final check.");
             errorMsgEl.textContent = msg; errorMsgEl.style.display = 'block';
             confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Withdrawal';
             return;
        }
        const currentActualBalance = currency === 'USDT' ? (latestUserData.usdt || 0) : (latestUserData.ton || 0);

        // Final balance check against actual current balance
        if (amount + fee > currentActualBalance) {
            const msg = `Insufficient balance. You need ${(amount + fee).toFixed(4)} ${currency} (amount + fee), but only have ${currentActualBalance.toFixed(4)} ${currency}.`;
            debugLog(`[WITHDRAW VALIDATION] Insufficient actual balance. ${msg}`);
            errorMsgEl.textContent = msg; errorMsgEl.style.display = 'block';
            // Update modal display if balance changed since opening
            availableBalanceSpan.textContent = currentActualBalance.toFixed(4);
            amountInput.max = Math.max(0, currentActualBalance - fee).toFixed(4);
            confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Withdrawal';
            return;
        }

        // Wallet connection check (redundant if withdraw button worked, but good safety check)
        if (!tonConnectUI || !tonConnectUI.connected || !tonConnectUI.account?.address) {
            const msg = "Wallet not connected. Please connect your wallet first.";
            debugLog("[WITHDRAW VALIDATION] Wallet not connected.");
            errorMsgEl.textContent = msg; errorMsgEl.style.display = 'block';
            // Don't necessarily close modal, let user reconnect? Or close:
            // hideModal();
            confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Withdrawal';
            return;
        }

        // --- Proceed with Simulated Withdrawal Transaction ---
        const destinationAddress = tonConnectUI.account.address;
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const balanceField = currency.toLowerCase(); // 'usdt' or 'ton'
        const totalDeduction = amount + fee;
        const txId = `sim_tx_${Date.now()}_${currency}`; // Unique simulation ID

        try {
            debugLog(`[WITHDRAW SIMULATION] Initiating: ${amount.toFixed(4)} ${currency} to ${destinationAddress} (Fee: ${fee.toFixed(currency === 'USDT' ? 2 : 3)} ${currency})`);

            // --- Use Firestore Transaction for Atomicity ---
            await db.runTransaction(async (transaction) => {
                // Re-read balance *inside* transaction for final check against race conditions
                const userDoc = await transaction.get(userDocRef);
                if (!userDoc.exists) throw new Error("User data not found during transaction.");
                const latestTxUserData = userDoc.data();
                const txBalance = currency === 'USDT' ? (latestTxUserData.usdt || 0) : (latestTxUserData.ton || 0);

                if (amount + fee > txBalance) {
                     throw new Error(`Transaction failed: Insufficient balance detected during final check. Need ${(amount + fee).toFixed(4)}, have ${txBalance.toFixed(4)} ${currency}.`);
                 }

                // Create Transaction Record (Pending) in subcollection
                const txCollectionRef = userDocRef.collection('transactions');
                const transactionData = {
                    txId: txId,
                    userId: telegramUser.id.toString(),
                    type: 'Withdrawal', // Standardized type
                    amount: amount,
                    currency: currency,
                    fee: fee,
                    totalDeducted: totalDeduction,
                    destination: destinationAddress,
                    status: 'processing simulation', // More descriptive pending state
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() // Use server time
                };
                // Use set within transaction for the new subcollection document
                transaction.set(txCollectionRef.doc(txId), transactionData);
                debugLog(`[WITHDRAW SIMULATION] Pending transaction record created: ${txId}`);

                // Deduct Balance from User Data
                transaction.update(userDocRef, {
                    [balanceField]: firebase.firestore.FieldValue.increment(-totalDeduction)
                });
                debugLog(`[WITHDRAW SIMULATION] User balance deduction prepared: -${totalDeduction} ${currency}`);

            }); // --- End of Firestore Transaction ---

            // Transaction successful if no error thrown
            debugLog(`[WITHDRAW SIMULATION] Transaction for ${txId} succeeded (balance deducted, pending record created).`);

            // Log analytics event
            if (analytics) analytics.logEvent('withdrawal_initiated', { userId: telegramUser.id, currency, amount, fee });

            // Close modal and update UI immediately after deduction
            hideModal();
            await fetchAndUpdateUserData(); // Refresh global cache
            await updateUserStatsUI(); // Update header/wallet balances
            await updateTransactionHistory(); // Show the new pending transaction
            alert(`Withdrawal of ${amount.toFixed(4)} ${currency} initiated (Fee: ${fee.toFixed(currency === 'USDT' ? 2 : 3)} ${currency}). This is a simulation and status will update shortly.`);


            // Simulate Processing Delay & Completion/Failure (Outside Transaction)
            setTimeout(async () => {
                 const txDocRef = db.collection('userData').doc(telegramUser.id.toString()).collection('transactions').doc(txId);
                 try {
                     // Simulate success for now
                     await txDocRef.update({ status: 'completed simulation' });
                     debugLog(`[WITHDRAW SIMULATION] Transaction ${txId} marked as completed.`);
                     // Optionally notify user? Maybe not needed if history updates.
                     await updateTransactionHistory(); // Refresh history UI to show completed
                 } catch (simError) {
                     console.error("Error updating simulated transaction status:", simError);
                     debugLog(`[WITHDRAW SIMULATION ERROR] Failed updating tx ${txId} status: ${simError.message}`);
                     try {
                         // Try to mark as failed
                         await txDocRef.update({ status: 'failed simulation', failureReason: simError.message });
                     } catch (failErr) {
                         console.error("Failed to mark simulated tx as failed:", failErr);
                     } finally {
                         await updateTransactionHistory(); // Refresh history UI to show failed status
                     }
                 }
             }, 5000 + Math.random() * 5000); // 5-10 second delay simulation

        } catch (error) {
            // Catch errors from the transaction or Firestore operations
            console.error(`Withdrawal processing error:`, error);
            debugLog(`[WITHDRAW ERROR] Processing failed for ${txId}: ${error.message}`);
            // Show error in the modal
            errorMsgEl.textContent = `Withdrawal failed: ${error.message}`;
            errorMsgEl.style.display = 'block';
            // Don't close modal on failure, allow user to retry or cancel
            confirmBtn.disabled = false; // Re-enable button
            confirmBtn.textContent = 'Confirm Withdrawal';
            // Update history just in case (might show failed if tx record was created but balance update failed)
            await updateTransactionHistory();
        }
        // No finally block needed for button state, handled by success/error paths

    });
    debugLog("Withdraw Confirm button listener attached.");
}


// --- Invite Section ---
async function updateInviteSectionUI() {
    debugLog("Updating Invite section UI...");
    // Ensure Firebase ready wrapper
    await ensureFirebaseReady(async () => {
        const userData = currentUserData || await fetchAndUpdateUserData(); // Fetch fresh data
        if (!userData) {
            debugLog("Invite UI update skipped: No user data.");
            // Reset UI elements to default/empty state
            try {
                document.getElementById('my-invite').textContent = 'My Invite: 0';
                document.getElementById('total-credit-text').innerHTML = 'Total Credit <span class="warning">!</span> : 0';
                document.getElementById('invite-record-title').textContent = 'Invite Record (0)';
                document.getElementById('claim-record-placeholder').style.display = 'block';
                document.getElementById('invite-record-placeholder').style.display = 'block';
                document.getElementById('claim-record-list').innerHTML = '';
                document.getElementById('invite-record-list').innerHTML = '';
                const claimButton = document.querySelector('#invite .claim-button');
                if(claimButton) {
                    claimButton.disabled = true;
                    claimButton.textContent = 'Claim (10k C = 1 USDT)';
                }
            } catch(uiError) {
                console.error("Error resetting Invite UI:", uiError);
            }
            return;
        }

        const inviteCountEl = document.getElementById('my-invite');
        const totalCreditEl = document.getElementById('total-credit-text');
        const claimRecordListEl = document.getElementById('claim-record-list');
        const claimRecordPlaceholderEl = document.getElementById('claim-record-placeholder');
        const inviteRecordListEl = document.getElementById('invite-record-list');
        const inviteRecordPlaceholderEl = document.getElementById('invite-record-placeholder');
        const inviteRecordTitleEl = document.getElementById('invite-record-title');
        const claimButton = document.querySelector('#invite .claim-button'); // Target claim button within invite section

        // Update stats
        const referralCount = userData.referrals || 0;
        const creditCount = userData.referralCredits || 0;
        inviteCountEl.textContent = `My Invite: ${referralCount}`;
        totalCreditEl.innerHTML = `Total Credit <span class="warning">!</span> : ${creditCount.toLocaleString()}`;
        inviteRecordTitleEl.textContent = `Invite Record (${referralCount})`;

         // Enable/Disable Claim button based on credits (e.g., minimum 10000)
         const minimumClaimCredits = 10000;
         if (claimButton) {
            claimButton.disabled = creditCount < minimumClaimCredits;
            claimButton.textContent = 'Claim (10k C = 1 USDT)'; // Reset text, ensure it shows conversion
         }

        // Populate Claim Records
        claimRecordListEl.innerHTML = ''; // Clear previous entries
        const claimHistory = userData.claimHistory || [];
        if (claimHistory.length === 0) {
            claimRecordPlaceholderEl.style.display = 'block';
            claimRecordPlaceholderEl.querySelector('p').textContent = 'No claim records yet';
        } else {
            claimRecordPlaceholderEl.style.display = 'none';
            // Sort by timestamp descending (newest first) before mapping
            claimHistory.sort((a, b) => {
                    const timeA = safeConvertToDate(a.claimTime)?.getTime() || 0;
                    const timeB = safeConvertToDate(b.claimTime)?.getTime() || 0;
                    return timeB - timeA; // Newest first
                })
                .slice(0, 20) // Limit display to recent claims
                .forEach(record => {
                    const div = document.createElement('div');
                    div.className = 'record-item claim-record'; // Add specific class
                    const claimTime = safeConvertToDate(record.claimTime)?.toLocaleString() || 'Invalid date';

                    div.innerHTML = `
                        <img src="assets/icons/usdt.png" alt="USDT Claim" class="record-icon">
                        <div class="user-info">
                            <span>Claimed ${record.usdtAmount?.toFixed(4) || '?'} USDT</span>
                            <small>${claimTime}</small>
                        </div>
                        <span class="credit spent">-${record.creditsSpent?.toLocaleString() || '?'} C</span>
                    `;
                    claimRecordListEl.appendChild(div);
                });
        }

        // Populate Invite Records
        inviteRecordListEl.innerHTML = ''; // Clear previous entries
        const inviteRecords = userData.inviteRecords || [];
         if (inviteRecords.length === 0) {
            inviteRecordPlaceholderEl.style.display = 'block';
            inviteRecordPlaceholderEl.querySelector('p').textContent = 'No invites yet';
        } else {
            inviteRecordPlaceholderEl.style.display = 'none';
             // Sort by join time descending before mapping
              inviteRecords.sort((a, b) => {
                     const timeA = safeConvertToDate(a.joinTime)?.getTime() || 0;
                     const timeB = safeConvertToDate(b.joinTime)?.getTime() || 0;
                    return timeB - timeA; // Newest first
                })
                .slice(0, 20) // Limit display to recent invites
                .forEach(record => {
                    const div = document.createElement('div');
                    div.className = 'record-item invite-record'; // Add specific class
                     const joinTime = safeConvertToDate(record.joinTime)?.toLocaleString() || 'Invalid date';
                     const username = record.username || 'Unknown User';
                     const avatarLetter = username[0].toUpperCase();
                     // Use a simpler hash function or rely on default avatar
                     // const avatarColor = intToHSL(hashCode(record.userId || username)); // Generate color based on ID/name
                     const avatarSrc = record.photoUrl || `https://via.placeholder.com/40/808080/FFFFFF?text=${avatarLetter}`; // Use actual photo if available

                    div.innerHTML = `
                        <img src="${avatarSrc}" alt="${username}" class="record-icon" onerror="this.src='https://via.placeholder.com/40/808080/FFFFFF?text=?'">
                        <div class="user-info">
                            <span>${username}</span>
                            <small>${joinTime}</small>
                        </div>
                        <span class="credit earned">+${record.creditAwarded?.toLocaleString() || 0} C</span>
                    `;
                    inviteRecordListEl.appendChild(div);
                });
        }

        setupInviteButtons(); // Ensure listeners are attached/updated
        debugLog("Invite section UI updated successfully.");
    }, 'updateInviteSectionUI_inner');
}

// Simple hash function for color generation (Optional, if using generated avatars)
function hashCode(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

// Convert integer hash to HSL color string (pastel range) (Optional)
function intToHSL(h) {
  const hue = Math.abs(h % 360);
  const saturation = 70 + (Math.abs(h) % 10); // Keep saturation relatively high but vary slightly
  const lightness = 75 + (Math.abs(h) % 10); // Keep lightness high for pastel
  return `hsl(${hue},${saturation}%,${lightness}%)`;
}


function generateReferralLink() {
     debugLog("Generating referral link...");
    if (!telegramUser || !telegramUser.id) {
         debugLog("Referral link generation skipped: No user ID.");
         alert("Cannot generate referral link: User not identified.");
         return null; // Return null if no link can be generated
    }
    // !!! IMPORTANT: REPLACE 'YourBotUsername' with your actual Telegram bot's username !!!
    const botUsername = 'FourMetasBot'; // <--- REPLACE THIS
    if (botUsername === 'YourBotUsername') {
        console.warn("CRITICAL: Please replace 'YourBotUsername' in generateReferralLink function!");
        debugLog("[WARN] Bot username not set in generateReferralLink.");
         alert("Referral link configuration error. Please contact support."); // More user friendly
         return null;
    }
    const referralLink = `https://t.me/${botUsername}?start=ref_${telegramUser.id}`;

    // Set the link on the buttons' data attributes if they exist
    // This is useful if the buttons are static HTML, but setupInviteButtons handles the dynamic assignment now.
    // const inviteButton = document.querySelector('.invite-friend');
    // const copyButton = document.querySelector('.copy-link');
    // if (inviteButton) inviteButton.setAttribute('data-link', referralLink);
    // if (copyButton) copyButton.setAttribute('data-link', referralLink);

    debugLog("Referral link generated:", referralLink);
    return referralLink;
}

async function handleReferral() {
    debugLog("Checking for referral parameter...");
    if (!telegramUser || !telegramUser.id) {
        debugLog("Referral check skipped: No Telegram user ID.");
        return;
    }
     // No need to check firebaseInitialized here, ensureFirebaseReady in initializeApp covers it.

    let startParam = null;
    try {
        // Access start_param safely using optional chaining
        startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    } catch (e) {
        console.error("Error accessing Telegram start_param:", e);
        debugLog(`Error accessing start_param: ${e.message}`);
        return; // Exit if accessing start_param fails
    }

    if (startParam && startParam.startsWith('ref_')) {
        const referrerId = startParam.substring(4); // Get the part after 'ref_'
        debugLog(`Referral parameter found: ref_${referrerId}`);

        // Validate referrerId: should be numeric and not empty
        if (!referrerId || !/^\d+$/.test(referrerId)) {
            debugLog(`Invalid referrerId format: ${referrerId}`);
            return; // Ignore invalid IDs
        }

        const currentUserIdStr = telegramUser.id.toString();
        if (referrerId === currentUserIdStr) {
            debugLog("User referred themselves, skipping.");
            return; // Ignore self-referrals
        }

        const currentUserRef = db.collection('userData').doc(currentUserIdStr);
        const referrerRef = db.collection('userData').doc(referrerId);
        const referralCreditAmount = 100; // Consider fetching from config

        try {
            // Use transaction to ensure atomicity
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(currentUserRef);
                // User doc *must* exist for referral processing. InitializeUserData runs first.
                if (!userDoc.exists) {
                     // This indicates a potential timing issue or failure in initializeUserData.
                     console.warn(`User document ${currentUserIdStr} not found during referral transaction. Referral cannot be processed.`);
                     debugLog(`User document ${currentUserIdStr} not found during referral transaction.`);
                     // Throwing an error cancels the transaction.
                     throw new Error(`User data not found for ${currentUserIdStr}.`);
                }
                const userData = userDoc.data();

                // Check if already referred
                if (userData.isReferred) {
                    debugLog(`User ${currentUserIdStr} already referred by ${userData.referredBy || 'unknown'}. Skipping transaction.`);
                    return; // Exit transaction without changes if already referred
                }

                // Check if referrer exists
                const referrerDoc = await transaction.get(referrerRef);
                if (!referrerDoc.exists) {
                     debugLog(`Referrer document ${referrerId} not found. Cannot process referral.`);
                     // Don't throw, just exit silently? Or log failure? Let's exit.
                     return; // Exit transaction silently if referrer doesn't exist
                }

                // --- Process the referral within the transaction ---
                debugLog(`Processing referral via transaction: User ${currentUserIdStr} referred by ${referrerId}`);

                // 1. Update the current user (The one who clicked the link)
                transaction.update(currentUserRef, {
                    isReferred: true,
                    referredBy: referrerId
                });

                // 2. Update the referrer (The one who shared the link)
                const newInviteRecord = {
                    userId: currentUserIdStr,
                    username: telegramUser.username || telegramUser.first_name || `User_${currentUserIdStr.slice(-4)}`,
                    photoUrl: telegramUser.photo_url || null, // Store photo if available
                    joinTime: firebase.firestore.FieldValue.serverTimestamp(), // Use server time
                    creditAwarded: referralCreditAmount,
                };

                // Increment counts and add the record
                transaction.update(referrerRef, {
                    referrals: firebase.firestore.FieldValue.increment(1),
                    referralCredits: firebase.firestore.FieldValue.increment(referralCreditAmount),
                    inviteRecords: firebase.firestore.FieldValue.arrayUnion(newInviteRecord) // Add to the array
                });
            }); // End of transaction

            // Transaction likely succeeded if no error was thrown
            debugLog("Referral transaction completed successfully.");
            if (analytics) analytics.logEvent('referral_success', { userId: currentUserIdStr, referrerId });
            // Refresh user data to reflect 'isReferred' status locally if needed immediately
            // await fetchAndUpdateUserData(); // Optional: Refresh cache, though usually handled by next UI update

        } catch (error) {
            // Transaction failed or error occurred during checks before transaction.get
            console.error("Error processing referral transaction:", error);
            debugLog(`Error processing referral transaction: ${error.message}`);
            // Don't alert user, failure is logged.
        }
    } else {
        debugLog("No referral parameter found or not in 'ref_' format.");
    }
}


function setupInviteButtons() {
    const inviteButton = document.querySelector('.invite-friend');
    const copyLinkButton = document.querySelector('.copy-link');
    const claimButton = document.querySelector('#invite .claim-button'); // More specific selector

    // Use cloning to ensure old listeners are removed and new ones attached
    if (inviteButton) {
        const newInviteButton = inviteButton.cloneNode(true);
        inviteButton.parentNode.replaceChild(newInviteButton, inviteButton);
        newInviteButton.addEventListener('click', handleInviteFriendClick);
        // debugLog("Invite Friend button listener attached."); // Reduce noise
    } else { debugLog("[INVITE WARN] Invite Friend button not found."); }

    if (copyLinkButton) {
         const newCopyLinkButton = copyLinkButton.cloneNode(true);
         copyLinkButton.parentNode.replaceChild(newCopyLinkButton, copyLinkButton);
         newCopyLinkButton.addEventListener('click', handleCopyLinkClick);
         // debugLog("Copy Link button listener attached."); // Reduce noise
    } else { debugLog("[INVITE WARN] Copy Link button not found."); }

    if (claimButton) {
         const newClaimButton = claimButton.cloneNode(true);
         claimButton.parentNode.replaceChild(newClaimButton, claimButton);
         newClaimButton.addEventListener('click', handleClaimCreditsClick);
         // debugLog("Claim Credits button listener attached."); // Reduce noise
    } else { debugLog("[INVITE WARN] Claim Credits button not found."); }
}

// --- Invite Button Click Handlers ---
function handleInviteFriendClick(event) {
    debugLog("Invite Friend button clicked.");
    const link = generateReferralLink(); // Generate link dynamically each time
    if (!link) {
        // generateReferralLink already alerts if it fails
        return;
    }
    // Use Telegram's share functionality
    if (window.Telegram?.WebApp?.openTelegramLink) {
         const text = encodeURIComponent("Join me on 4Metas and earn rewards!"); // Customize share text
         const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`;
         window.Telegram.WebApp.openTelegramLink(shareUrl);
         debugLog("Opened Telegram share link.");
    } else {
        alert("Sharing not available. Please copy the link manually."); // Fallback
        debugLog("[INVITE WARN] Cannot open Telegram share link (Not in Telegram context or SDK unavailable).");
    }
}

function handleCopyLinkClick(event) {
    debugLog("Copy Link button clicked.");
    const button = event.target; // Get the button that was clicked
    const link = generateReferralLink(); // Generate link dynamically
     if (!link) {
        // generateReferralLink already alerts if it fails
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            debugLog("Referral link copied successfully.");
            // Visual feedback
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.disabled = true; // Briefly disable
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
             }, 2000);
            // Optionally show a more persistent success message in the UI instead of alert
             // alert("Invite link copied to clipboard!");
        }).catch(err => {
            console.error("Failed to copy link using clipboard API:", err);
            alert("Failed to copy link automatically. Please try copying it manually.");
            debugLog("[INVITE ERROR] Failed to copy link using navigator.clipboard:", err);
        });
    } else {
        // Fallback for browsers without clipboard API or in insecure contexts
        alert("Clipboard access not available. Please copy the link manually.");
        debugLog("[INVITE WARN] navigator.clipboard API not available.");
        // You could potentially display the link in a text area for manual copying here.
    }
}

async function handleClaimCreditsClick(event) {
    debugLog("Claim Credits button clicked.");
    const claimButton = event.target;
    claimButton.disabled = true;
    claimButton.textContent = 'Checking...';

    // Ensure Firebase is ready
    if (!firebaseInitialized || !db || !telegramUser || !telegramUser.id) {
        alert("Cannot claim credits: System not ready.");
        // Attempt to re-enable based on current state (which might be disabled anyway)
        await updateInviteSectionUI(); // Refresh button state based on actual credits
        return;
    }

    const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
    const txCollectionRef = userDocRef.collection('transactions'); // For transaction history

    try {
        let usdtToClaim = 0;
        let creditsToSpend = 0;
        const conversionRate = 10000; // Fetch from config ideally
        const minimumClaim = 10000;   // Fetch from config ideally

        // Use a transaction for atomicity (check credits, update balances, add history)
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists) {
                throw new Error("User data not found for claim.");
            }

            const data = userDoc.data();
            const currentCredits = data.referralCredits || 0;

            debugLog(`[CREDIT CLAIM] Transaction Check: Current credits: ${currentCredits}, Min required: ${minimumClaim}`);

            if (currentCredits < minimumClaim) {
                throw new Error(`Insufficient credits. Minimum ${minimumClaim.toLocaleString()} required, you have ${currentCredits.toLocaleString()}.`);
            }

            // Calculate claim amount based on whole multiples of the conversion rate
            usdtToClaim = Math.floor(currentCredits / conversionRate); // Integer division
            creditsToSpend = usdtToClaim * conversionRate; // Credits actually spent

            if (usdtToClaim <= 0 || creditsToSpend <= 0) {
                 // This shouldn't happen if currentCredits >= minimumClaim and minimumClaim >= conversionRate
                 console.error("[CREDIT CLAIM ERROR] Calculated claim amount is zero or less despite sufficient credits.", { currentCredits, usdtToClaim, creditsToSpend });
                 throw new Error("Calculation error during claim. Please try again.");
            }

            debugLog(`[CREDIT CLAIM] Transaction Proceed: Claiming ${usdtToClaim} USDT for ${creditsToSpend} credits.`);
            claimButton.textContent = 'Claiming...'; // UI feedback during transaction

            // Prepare records for updates
            const claimRecord = { // For claimHistory array
                claimTime: firebase.firestore.FieldValue.serverTimestamp(),
                usdtAmount: usdtToClaim,
                creditsSpent: creditsToSpend,
                rate: conversionRate
            };
            const transactionRecord = { // For transactions subcollection
                txId: `claim_${Date.now()}_${usdtToClaim}`, // More unique ID
                userId: telegramUser.id.toString(),
                type: 'credit_claim', // Standardized type
                usdtAmount: usdtToClaim,
                creditsSpent: creditsToSpend,
                status: 'completed', // Claim is instant
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Perform updates within the transaction
            transaction.update(userDocRef, {
                usdt: firebase.firestore.FieldValue.increment(usdtToClaim),
                referralCredits: firebase.firestore.FieldValue.increment(-creditsToSpend),
                claimHistory: firebase.firestore.FieldValue.arrayUnion(claimRecord) // Add to claim history
            });
            // Add transaction history record using set in transaction
            transaction.set(txCollectionRef.doc(transactionRecord.txId), transactionRecord);

        }); // End of transaction

        // Transaction successful
        debugLog(`[CREDIT CLAIM] Transaction successful. Claimed ${usdtToClaim} USDT for ${creditsToSpend.toLocaleString()} credits.`);
        alert(`Successfully claimed ${usdtToClaim.toFixed(4)} USDT for ${creditsToSpend.toLocaleString()} credits!`);
        if (analytics) analytics.logEvent('credit_claim', { userId: telegramUser.id, usdt: usdtToClaim, credits: creditsToSpend });

        // Update UI *after* successful transaction
        await fetchAndUpdateUserData(); // Refresh cache
        await updateUserStatsUI();      // Update balances display
        await updateInviteSectionUI();  // Re-renders lists and updates button state based on new credit amount
        await updateTransactionHistory(); // Show the new claim in wallet history

    } catch (error) {
        console.error("[CREDIT CLAIM ERROR]", error);
        debugLog(`[CREDIT CLAIM ERROR] ${error.message}`);
        alert(`Failed to claim credits: ${error.message}`);
        // Update UI to reflect potential unchanged state after error
        await updateInviteSectionUI(); // Re-renders button based on actual credit amount
    }
    // No finally needed, updateInviteSectionUI handles button state based on refreshed data
}


// --- Chest Section ---
function updateChestUI() {
    // debugLog("Updating Chest section UI..."); // Reduce noise
    const chestContainer = document.getElementById('chestContainer');
    const chestCostDisplay = document.getElementById('chestCost');
    const chestCostAmount = document.getElementById('chest-cost-amount');
    const vipRequirementDisplay = document.getElementById('chestVipRequirement');
    const openButton = document.querySelector('.open-chest-button'); // Re-select potentially new button
    const leftArrow = document.querySelector('.nav-arrow.left');
    const rightArrow = document.querySelector('.nav-arrow.right');

     if (!chestContainer || !chestCostDisplay || !chestCostAmount || !vipRequirementDisplay || !openButton || !leftArrow || !rightArrow) {
        console.error("Chest UI elements missing!");
        debugLog("[CHEST ERROR] Required chest UI elements not found.");
        return; // Stop if elements are missing
     }

    // Validate currentChestIndex
     if (currentChestIndex < 0 || currentChestIndex >= chests.length) {
         console.error(`[CHEST ERROR] Invalid chest index: ${currentChestIndex}. Resetting to 0.`);
         debugLog(`[CHEST ERROR] Invalid chest index: ${currentChestIndex}. Resetting to 0.`);
         currentChestIndex = 0;
     }

    const chest = chests[currentChestIndex];
     if (!chest) {
         console.error(`[CHEST ERROR] Chest data not found for index: ${currentChestIndex}`);
         debugLog(`[CHEST ERROR] Chest data not found for index: ${currentChestIndex}`);
         // Maybe hide the chest section or show an error? For now, just disable button.
         openButton.disabled = true;
         openButton.textContent = 'Error';
         return;
     }

    // Update Slider Content position
    chestContainer.style.transform = `translateX(-${currentChestIndex * 100}%)`;


    // --- Update Cost/VIP/Button State for the *currently selected* chest ---
     // Use cached user data - ensure it's fetched before calling this or rely on ensureFirebaseReady
     const userData = currentUserData;
     // Provide defaults if userData is somehow null/undefined after checks
     const userVipLevel = userData?.vipLevel || 0;
     const userGems = userData?.gems || 0;

     // debugLog(`[CHEST CHECK] User VIP: ${userVipLevel}, User Gems: ${userGems.toLocaleString()}, Chest: ${chest.name} (Needs VIP ${chest.vip}, Cost ${chest.gemCost.toLocaleString()})`); // Reduce noise

     // Reset elements before applying conditions
     vipRequirementDisplay.textContent = '';
     vipRequirementDisplay.style.display = 'none';
     chestCostDisplay.style.display = 'flex'; // Show cost by default unless VIP fails
     chestCostAmount.textContent = chest.gemCost.toLocaleString();
     chestCostDisplay.style.color = ''; // Reset cost color
     openButton.disabled = false; // Enable button by default
     openButton.textContent = 'Open Chest'; // Reset button text

    // Check VIP Level
     if (chest.vip > userVipLevel) {
         vipRequirementDisplay.textContent = `NEED VIP ${chest.vip}`;
         vipRequirementDisplay.style.display = 'block';
         chestCostDisplay.style.display = 'none'; // Hide cost if VIP failed
         openButton.disabled = true;
         openButton.textContent = `VIP ${chest.vip} Required`;
         // debugLog(`[CHEST] VIP ${chest.vip} required, user has ${userVipLevel}. Button disabled.`); // Reduce noise
     } else {
         // VIP level met, check Gems
         if (userGems < chest.gemCost) {
             openButton.disabled = true;
             chestCostDisplay.style.color = '#ffcc00'; // Make cost yellow/warning if not enough gems
             // debugLog(`[CHEST] Insufficient gems. Need ${chest.gemCost.toLocaleString()}, user has ${userGems.toLocaleString()}. Button disabled.`); // Reduce noise
         } else {
             // Meets VIP and Gem requirements - button remains enabled, text 'Open Chest'
             // debugLog(`[CHEST] User meets VIP and Gem requirements. Button enabled.`); // Reduce noise
         }
     }

    // Update Navigation Arrows Visibility
    leftArrow.style.display = currentChestIndex === 0 ? 'none' : 'block';
    rightArrow.style.display = currentChestIndex === chests.length - 1 ? 'none' : 'block';
}

function renderChests() {
    debugLog("[CHEST] Rendering chests...");
    const container = document.getElementById('chestContainer');
    if (!container) {
         console.error("[CHEST ERROR] Chest container element not found.");
         debugLog("[CHEST ERROR] Chest container element not found.");
         return;
     }
     // Generate HTML for all chests
    container.innerHTML = chests.map((chest, index) => `
        <div class="chest-item" data-index="${index}">
            <div class="chest-title">
                <h2>${chest.name}</h2>
                <span>${chest.next ? `Next: ${chest.next}` : 'Max Level'}</span>
            </div>
            <div class="chest-image">
                <img src="${chest.image}" alt="${chest.name}" loading="lazy" onerror="this.src='assets/icons/chest_placeholder.png'">
            </div>
        </div>
    `).join('');
     debugLog(`[CHEST] Rendered ${chests.length} chests into slider.`);

     // Add event listeners using cloning to remove old ones safely
     const leftArrow = document.querySelector('.nav-arrow.left');
     const rightArrow = document.querySelector('.nav-arrow.right');
     const openButton = document.querySelector('.open-chest-button');

     if (leftArrow) {
        const newLeft = leftArrow.cloneNode(true);
        leftArrow.parentNode.replaceChild(newLeft, leftArrow);
        newLeft.addEventListener('click', prevChest);
     } else { debugLog("[CHEST WARN] Left arrow not found."); }

     if (rightArrow) {
        const newRight = rightArrow.cloneNode(true);
        rightArrow.parentNode.replaceChild(newRight, rightArrow);
        newRight.addEventListener('click', nextChest);
     } else { debugLog("[CHEST WARN] Right arrow not found."); }

     if (openButton) {
         const newOpen = openButton.cloneNode(true);
         openButton.parentNode.replaceChild(newOpen, openButton);
         newOpen.addEventListener('click', openChest);
     } else { debugLog("[CHEST WARN] Open Chest button not found."); }

     updateChestUI(); // Initial UI update for the first chest based on current data
}


function prevChest() {
    // debugLog("Prev Chest button clicked."); // Reduce noise
    if (currentChestIndex > 0) {
        currentChestIndex--;
        updateChestUI(); // Update display for the new current chest
    }
}

function nextChest() {
    // debugLog("Next Chest button clicked."); // Reduce noise
    if (currentChestIndex < chests.length - 1) {
        currentChestIndex++;
        updateChestUI(); // Update display for the new current chest
    }
}

async function openChest() {
      // Validate index again before proceeding
      if (currentChestIndex < 0 || currentChestIndex >= chests.length) {
          console.error("[CHEST ACTION ERROR] Invalid chest index on open:", currentChestIndex);
          debugLog(`[CHEST ACTION ERROR] Invalid chest index on open: ${currentChestIndex}`);
          alert("Error: Cannot open chest due to internal error.");
          return;
      }
     const chest = chests[currentChestIndex];
      if (!chest) { // Should be caught by index check, but belt-and-braces
          console.error("[CHEST ACTION ERROR] Cannot open chest, invalid chest data for index:", currentChestIndex);
          debugLog(`[CHEST ACTION ERROR] Cannot open chest, invalid data index: ${currentChestIndex}`);
          alert("Error: Could not determine which chest to open.");
          return;
      }

     debugLog(`[CHEST ACTION] Attempting to open chest: ${chest.name} (Index: ${currentChestIndex})`);
     const openButton = document.querySelector('.open-chest-button'); // Re-select button
     if (!openButton) {
         debugLog("[CHEST ACTION ERROR] Open button not found.");
         alert("Error opening chest: UI element missing.");
         return;
     }
     openButton.disabled = true; openButton.textContent = 'Opening...';

     // Ensure Firebase is ready and user identified
     if (!firebaseInitialized || !db || !telegramUser || !telegramUser.id) {
         alert("Cannot open chest: System not ready.");
         debugLog("[CHEST ACTION ERROR] System not ready (Firebase/User).");
         updateChestUI(); // Update UI to restore button based on current (likely insufficient) state
         return;
     }

     const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
     const rankingDocRef = db.collection('users').doc(telegramUser.id.toString());

     try {
          let rewards = {}; // Scope for alert message
          // Use Firestore Transaction for atomic check-and-update
          await db.runTransaction(async (transaction) => {
             const userDoc = await transaction.get(userDocRef);
             if (!userDoc.exists) throw new Error("User data not found to open chest.");
             const userData = userDoc.data();

             const currentGems = userData.gems || 0;
             const userVipLevel = userData.vipLevel || 0;
             const currentFoxMedals = userData.foxMedals || 0; // Get current medals for ranking update

             debugLog(`[CHEST ACTION CHECK] Transaction: Need VIP ${chest.vip} (Have ${userVipLevel}), Need Gems ${chest.gemCost.toLocaleString()} (Have ${currentGems.toLocaleString()})`);

             // Perform checks within the transaction
             if (chest.vip > userVipLevel) throw new Error(`VIP Level ${chest.vip} required.`);
             if (currentGems < chest.gemCost) throw new Error(`Insufficient gems. Need ${chest.gemCost.toLocaleString()}, have ${currentGems.toLocaleString()}.`);

             // Calculate Rewards (Can be done inside transaction)
             // More sophisticated reward logic could be used here
             rewards = {
                 usdt: parseFloat((Math.random() * (chest.gemCost / 4000) + (chest.gemCost / 10000)).toFixed(4)), // Example scaling
                 landPiece: Math.random() < (0.05 + currentChestIndex * 0.02) ? 1 : 0, // Increasing chance for land
                 foxMedal: Math.floor(Math.random() * (currentChestIndex + 1) * 1.5) + 1 // More medals for better chests
             };
              // Ensure rewards are non-negative
              rewards.usdt = Math.max(0, rewards.usdt);
              rewards.landPiece = Math.max(0, rewards.landPiece);
              rewards.foxMedal = Math.max(0, rewards.foxMedal);

             debugLog("[CHEST ACTION] Calculated rewards:", rewards);
             const newTotalFoxMedals = currentFoxMedals + rewards.foxMedal;

             // Prepare updates for user data
             const updates = {
                 gems: firebase.firestore.FieldValue.increment(-chest.gemCost),
                 usdt: firebase.firestore.FieldValue.increment(rewards.usdt),
                 landPieces: firebase.firestore.FieldValue.increment(rewards.landPiece),
                 foxMedals: firebase.firestore.FieldValue.increment(rewards.foxMedal) // Increment medals
             };
             transaction.update(userDocRef, updates);

             // Update ranking document atomically if medals were awarded
             if (rewards.foxMedal > 0) {
                 // Use set with merge to handle potential non-existence and update relevant fields
                 transaction.set(rankingDocRef, {
                     foxMedals: newTotalFoxMedals, // Set the new total medals
                     // Ensure username/photo are present/updated in ranking doc
                     username: userData.username || telegramUser.username || telegramUser.first_name || `User_${telegramUser.id.toString().slice(-4)}`,
                     photoUrl: userData.photoUrl || telegramUser.photo_url || 'assets/icons/user-avatar.png',
                     userId: telegramUser.id.toString() // Ensure userId is present
                 }, { merge: true }); // Use merge to avoid overwriting other fields if they exist
                 debugLog(`[CHEST ACTION] Ranking doc update prepared. New total medals: ${newTotalFoxMedals}`);
             }
         }); // End transaction

         // Transaction successful
         debugLog(`[CHEST ACTION] Transaction successful. Deducted ${chest.gemCost.toLocaleString()} gems. Added rewards.`);
         if (analytics) analytics.logEvent('chest_opened', { userId: telegramUser.id, chestName: chest.name, cost: chest.gemCost, rewards });

         // Show Rewards in a user-friendly way
         let rewardString = `Opened ${chest.name}! Rewards:\n`;
         let hasRewards = false;
         if (rewards.usdt > 0) { rewardString += `\n- ${rewards.usdt.toFixed(4)} USDT`; hasRewards = true; }
         if (rewards.landPiece > 0) { rewardString += `\n- ${rewards.landPiece} Land Piece`; hasRewards = true; }
         if (rewards.foxMedal > 0) { rewardString += `\n- ${rewards.foxMedal} Fox Medal`; hasRewards = true; }
         if (!hasRewards) {
            rewardString += "\n- Nothing this time!";
         }
         alert(rewardString); // Consider using a custom modal for better presentation

         // Update UI after successful transaction
         await fetchAndUpdateUserData(); // Refresh cache with new balances/items
         await updateUserStatsUI();      // Update header stats
         updateChestUI();                // Re-check requirements/costs & update button state for the current chest

     } catch (error) {
         console.error("Error opening chest:", error);
         debugLog(`[CHEST ERROR] ${error.message}`);
         alert(`Failed to open chest: ${error.message}`);
         // Ensure UI reflects actual state after failure
         await fetchAndUpdateUserData(); // Get potentially unchanged state
         updateChestUI(); // Reset button based on actual data (likely disabled again)
     }
 }


// --- Top Section (Rankings) ---
async function updateTopSectionUI() {
    debugLog("Updating Top section UI...");
    const rankingList = document.getElementById('ranking-list');
     if (!rankingList) {
        console.error("[RANKING ERROR] Ranking list element not found.");
        debugLog("[RANKING ERROR] Ranking list element not found.");
        return;
     }
     rankingList.innerHTML = `<li class="loading"><p>Loading rankings...</p></li>`;

     // Ensure Firebase is ready
     await ensureFirebaseReady(async () => {
         try {
             const rankingsSnapshot = await db.collection('users') // Use 'users' collection for ranking
                 .orderBy('foxMedals', 'desc') // Order by medals descending
                 .limit(30) // Limit to top 30
                 .get({ source: 'server' }); // Get fresh data from server

             const rankings = [];
             rankingsSnapshot.forEach(doc => {
                 const data = doc.data();
                 // Ensure essential data exists, provide defaults if missing
                 rankings.push({
                     id: doc.id, // User's Telegram ID (string)
                     username: data.username || `User_${doc.id.slice(-4)}` || 'Anonymous',
                     foxMedals: data.foxMedals || 0,
                     photoUrl: data.photoUrl || 'assets/icons/user-avatar.png' // Use default avatar if missing
                 });
             });
             debugLog(`Workspaceed ${rankings.length} ranking entries.`);

             if (rankings.length === 0) {
                 rankingList.innerHTML = `<li class="no-rankings"><p>The ranking is empty right now.</p></li>`;
             } else {
                 // Generate HTML for ranking list
                 rankingList.innerHTML = rankings.map((user, index) => {
                     const rank = index + 1;
                     const isCurrentUser = user.id === telegramUser?.id?.toString(); // Check if this entry is the current user
                     const itemClass = isCurrentUser ? 'ranking-item current-user' : 'ranking-item'; // Add class for highlighting

                     return `
                     <li class="${itemClass}">
                         <span class="rank-number">${rank}.</span>
                         <img src="${user.photoUrl}" alt="${user.username}" class="rank-avatar" loading="lazy" onerror="this.src='assets/icons/user-avatar.png'">
                         <span class="rank-username">${user.username}</span>
                         <div class="medal-count">
                             <span>${user.foxMedals.toLocaleString()}</span>
                             <img src="assets/icons/fox-medal.png" alt="Fox Medal" class="medal-icon">
                         </div>
                     </li>
                     `;
                 }).join('');
             }
             debugLog("Top section UI updated successfully.");
         } catch (error) {
             console.error("Error updating top section UI:", error);
             debugLog(`Error updating ranking UI: ${error.message}`);
             rankingList.innerHTML = `<li class="error"><p>Failed to load rankings. Please try again later.</p></li>`;
         }
     }, 'updateTopSectionUI_inner');
 }


// --- Initialize App ---
async function initializeApp() {
    debugLog("--- App Initialization Sequence Start ---");
    const loadingOverlay = document.getElementById('loadingOverlay'); // Get loading overlay
    if(loadingOverlay) loadingOverlay.style.display = 'flex'; // Show loading overlay

    try {
        // 1. Initialize Telegram Interface
        const telegramSuccess = initializeTelegram();
        if (!telegramSuccess) {
            debugLog("Proceeding with fallback Telegram user.");
            // Potentially show a warning to the user if Telegram features are critical
        }

        // 2. Initialize Firebase (essential)
        const firebaseSuccess = await initializeFirebase();
        if (!firebaseSuccess) {
            debugLog("App Init Failed: Firebase could not be initialized.");
            alert("Critical Error: Cannot connect to the database. Please try restarting the app.");
            if(loadingOverlay) loadingOverlay.textContent = 'Connection Error. Please Restart.'; // Update overlay text
            return; // Stop initialization
        }

        // 3. Initialize User Data (creates record if needed, fetches into currentUserData)
        // ensureFirebaseReady is implicitly handled by sequence, but explicit call is fine
        await ensureFirebaseReady(initializeUserData, 'initializeUserData');

        // 4. Handle Incoming Referrals (AFTER user data might exist)
        await ensureFirebaseReady(handleReferral, 'handleReferral');

        // 5. Generate User's Referral Link (doesn't need await/Firebase, but needs user ID)
        generateReferralLink(); // Should be called after telegramUser is set

        // 6. Initialize TON Connect (Allow user interaction while this loads)
        // Run concurrently? Or await? Await ensures wallet state is known before potentially showing wallet section.
        await initializeTONConnect();

        // 7. Render Dynamic Components (Chests)
        renderChests(); // Doesn't need await/Firebase

        // 8. Setup Main Navigation (attaches listeners, sets default view)
        // This implicitly triggers the data load for the default section (e.g., 'earn') via switchSection
        setupNavigation();

        // 9. Automatic Ad Initialization (In-App Interstitial)
        // Run this after main UI is likely set up
        try {
            if (typeof window.show_9180370 === 'function') {
                // Configure Monetag In-App Ads
                const autoInAppSettings = {
                    frequency: 2,      // Max 2 ads per session
                    capping: 0.0667,   // Session duration = ~4 minutes (0.0667 * 60)
                    interval: 30,      // Minimum 30 seconds between ads
                    timeout: 5,        // 5-second delay before the *first* ad might show
                    everyPage: false   // Keep false unless ads needed on every navigation
                };
                debugLog('[AD INIT] Initializing automatic In-App ads with settings:', JSON.stringify(autoInAppSettings));
                // Call Monetag SDK to setup automatic ads
                window.show_9180370({ type: 'inApp', inAppSettings: autoInAppSettings });
            } else {
                debugLog('[AD INIT WARN] Monetag SDK function not found, cannot initialize automatic ads.');
            }
        } catch (initAdError) {
            console.error('[AD INIT ERROR] Error initializing automatic In-App ads:', initAdError);
            debugLog(`[AD INIT ERROR] Error initializing automatic ads: ${initAdError.message}`);
        }

        // 10. Final UI Updates (ensure stats are up-to-date after all init steps)
        // These might already be covered by navigation switching, but explicit calls ensure consistency.
        await ensureFirebaseReady(updateUserStatsUI, 'finalUserStatsUpdate');
        // Update Wallet section explicitly if needed, as TON connect might change state
        // await ensureFirebaseReady(updateWalletSectionUI, 'finalWalletUpdate'); // Already called by TON status change listener

        debugLog("--- App Initialization Sequence Finished ---");
        if (analytics) analytics.logEvent('app_initialized', { userId: telegramUser?.id?.toString() || 'unknown' });

    } catch (error) {
         console.error("CRITICAL ERROR during app initialization:", error);
         debugLog(`CRITICAL INIT ERROR: ${error.message}\n${error.stack}`);
         alert("An error occurred during app startup. Please restart the app.");
         if(loadingOverlay) loadingOverlay.textContent = 'Initialization Error. Please Restart.'; // Update overlay text
         // Don't hide overlay on critical failure
         return;
    } finally {
        // Hide loading overlay once initialization is complete (or failed critically before return)
        if(loadingOverlay) loadingOverlay.style.display = 'none';
    }
}


// --- DOMContentLoaded Listener ---
// Ensures the script runs after the HTML is parsed
function runOnLoaded() {
     debugLog("DOM loaded state reached, initializing app.");
     initializeApp();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // If DOM is already loaded, run init slightly delayed to allow browser rendering cycle
    debugLog("DOM already loaded, initializing app shortly.");
    setTimeout(runOnLoaded, 0);
} else {
    // Otherwise, wait for the DOMContentLoaded event
    debugLog("Waiting for DOMContentLoaded to initialize app.");
    document.addEventListener('DOMContentLoaded', runOnLoaded);
}
