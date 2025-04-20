console.log('[DEBUG] Script execution started.');

// --- Global Variables ---
let app, db, auth, storage, analytics;
let firebaseInitialized = false;
let telegramUser;
let tonConnectUI = null;
let currentChestIndex = 0; // Keep track of chest slider
// Removed global quest arrays as fetching is now direct in updateEarnSectionUI
// let dailyQuests = [];
// let basicQuests = [];
let currentUserData = null;

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
        debugLog(`Error during ${callbackName}: ${error.message}`);
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
        debugLog(`Storage: Getting item '${key}' for user ${telegramUser?.id}`);
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

    navButtons.forEach((button, index) => {
        const sectionId = button.getAttribute('data-section');
        debugLog(`[NAV] Setting up listener for button ${index}: ${sectionId}`);
        if (!sectionId) {
            console.warn(`[NAV WARN] Button ${index} is missing data-section attribute.`);
            debugLog(`[NAV WARN] Button ${index} is missing data-section attribute.`);
            return;
        }

        button.addEventListener('click', (event) => {
            debugLog(`[NAV] Click detected on button: ${sectionId}`);
            switchSection(sectionId);
        });
        debugLog(`[NAV] Listener attached for button ${index}: ${sectionId}`);

        button.style.visibility = 'visible';
        button.style.opacity = '1';
        const img = button.querySelector('img');
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
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');

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
        return;
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
    try {
        // Ensure correct data loading function is called for the activated section
        if (sectionId === 'earn') await ensureFirebaseReady(updateEarnSectionUI, 'updateEarnSectionUI');
        else if (sectionId === 'invite') await ensureFirebaseReady(updateInviteSectionUI, 'updateInviteSectionUI');
        else if (sectionId === 'top') await ensureFirebaseReady(updateTopSectionUI, 'updateTopSectionUI');
        else if (sectionId === 'wallet') await ensureFirebaseReady(updateWalletSectionUI, 'updateWalletSectionUI');
        else if (sectionId === 'chest') await ensureFirebaseReady(updateUserStatsUI, 'updateChestUserStats'); // For stats needed by chest UI
        else {
            debugLog(`[NAV] No specific data load function for section: ${sectionId}`);
        }

        // Update Chest UI specifically if navigating to it
        if (sectionId === 'chest') {
            updateChestUI(); // Updates cost/VIP display based on latest stats
        }

    } catch (error) {
        console.error(`[NAV ERROR] Error loading data for section ${sectionId}:`, error);
        debugLog(`[NAV ERROR] Error loading data for section ${sectionId}: ${error.message}`);
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
        return;
    }

    const userIdStr = telegramUser.id.toString();
    const userDocRef = db.collection('userData').doc(userIdStr);
    const rankingDocRef = db.collection('users').doc(userIdStr);

    try {
        const doc = await userDocRef.get();
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
                walletAddress: null,
                transactions: [] // Consider subcollection later
            };
            await userDocRef.set(newUser);

            const rankingEntry = {
                username: telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                foxMedals: 0,
                photoUrl: telegramUser.photo_url || 'assets/icons/user-avatar.png',
                userId: userIdStr
            };
            await rankingDocRef.set(rankingEntry, { merge: true });

            debugLog("New user data initialized in userData and users collections.");
            if (analytics) analytics.logEvent('user_signup', { userId: userIdStr });
        } else {
            debugLog(`User ${userIdStr} found. Updating last login.`);
            const updates = {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            const userData = doc.data();
            // Ensure essential fields exist if user doc was created before fields were added
            if (userData.vipLevel === undefined) updates.vipLevel = 0;
            if (userData.adProgress === undefined) updates.adProgress = {};
            if (userData.claimedQuests === undefined) updates.claimedQuests = [];
            // Add other checks as needed

            await userDocRef.update(updates);

            // Ensure ranking entry exists too
            const rankDoc = await rankingDocRef.get();
            if (!rankDoc.exists) {
                const rankingEntry = {
                    username: telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                    foxMedals: userData.foxMedals || 0, // Sync medals
                    photoUrl: telegramUser.photo_url || 'assets/icons/user-avatar.png',
                    userId: userIdStr
                };
                await rankingDocRef.set(rankingEntry);
                debugLog("Created missing ranking entry for existing user.");
            } else {
                // Optionally update username/photo in ranking if changed in Telegram
                const rankData = rankDoc.data();
                const currentPhoto = telegramUser.photo_url || 'assets/icons/user-avatar.png';
                const currentUsername = telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`;
                if (rankData.photoUrl !== currentPhoto || rankData.username !== currentUsername) {
                    await rankingDocRef.update({
                        photoUrl: currentPhoto,
                        username: currentUsername
                    });
                    debugLog("Updated ranking entry username/photo.");
                }
            }
        }
        // Always fetch fresh data after init/update and store globally
        await fetchAndUpdateUserData();
        await updateUserStatsUI(); // Update UI based on the fetched data

    } catch (error) {
        console.error("Error initializing/checking user data:", error);
        debugLog(`Error initializing user data for ${userIdStr}: ${error.message}`);
        alert("There was a problem loading your profile.");
    }
}

async function fetchAndUpdateUserData() {
    // No console log here to reduce noise, called frequently
    if (!telegramUser || !telegramUser.id || !firebaseInitialized || !db) {
        // debugLog("User data fetch skipped: Conditions not met."); // Enable if needed
        currentUserData = null;
        return null;
    }
    try {
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            debugLog("User doc not found during fetch.");
            currentUserData = null;
            // Optionally re-run initialization logic?
            // await initializeUserData(); // Be careful with potential loops
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
        document.getElementById('gems').textContent = 0;
        document.getElementById('usdt').textContent = '0.0000';
        document.getElementById('ton').textContent = '0.0000';
        // Also update wallet section display if applicable
         try {
             document.getElementById('wallet-usdt').textContent = '0.0000';
             document.getElementById('wallet-ton').textContent = '0.0000';
         } catch (e) { /* ignore if elements not present */ }
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

// --- REMOVED fetchQuests function ---
// The logic is now directly inside updateEarnSectionUI

// --- Earn Section (Quests) ---
// *** THIS IS THE UPDATED FUNCTION USING THE ORIGINAL FETCH LOGIC ***
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
        if (!firebaseInitialized || !db) {
            throw new Error("Firestore not initialized for updating Earn section.");
        }
        debugLog("[QUEST DEBUG] Firestore is initialized.");

        let userData = currentUserData || await fetchAndUpdateUserData();
        if (!userData) {
            throw new Error("User data not available for quest checks.");
        }
        debugLog("[QUEST DEBUG] User data loaded for quest checks.", userData);

        // Ensure sub-objects exist
        userData.adProgress = userData.adProgress || {};
        userData.claimedQuests = userData.claimedQuests || [];
        debugLog("[QUEST DEBUG] Ensured adProgress and claimedQuests exist on userData.");

        // --- Fetch Daily Quests (Original Method) ---
        debugLog("[QUEST DEBUG] Fetching daily quests from quests/daily...");
        const dailyQuestsSnapshot = await db.collection('quests').doc('daily').get({ source: 'server' });
        debugLog("[QUEST DEBUG] Daily quests snapshot received.", dailyQuestsSnapshot.exists);
        const dailyQuestsData = dailyQuestsSnapshot.exists ? dailyQuestsSnapshot.data() : {};
        const fetchedDailyQuests = dailyQuestsData.tasks || []; // Access the 'tasks' array
        debugLog(`[QUEST DEBUG] Found ${fetchedDailyQuests.length} daily quests in tasks array.`, fetchedDailyQuests);

        dailyQuestCountEl.textContent = fetchedDailyQuests.length;
        if (fetchedDailyQuests.length === 0) {
            dailyQuestList.innerHTML = `<li class="no-quests"><p>No daily quests available today.</p></li>`;
            debugLog("[QUEST DEBUG] No daily quests found in tasks array.");
        } else {
            dailyQuestList.innerHTML = ''; // Clear loading message
            fetchedDailyQuests.forEach(quest => {
                // Need to make sure quest objects have an 'id' if it wasn't stored directly in the array items
                // If 'id' isn't part of the object in the 'tasks' array, you might need to adjust how you track claimed quests.
                // Assuming quest objects within the 'tasks' array *do* have an 'id' field:
                 if (!quest.id) {
                    console.warn("[QUEST WARN] Daily quest object missing 'id' field:", quest);
                    debugLog("[QUEST WARN] Daily quest object missing 'id' field.");
                    // Decide how to handle quests without IDs - skip or generate one?
                    // Skipping for now:
                     return;
                 }
                 try {
                     const li = createQuestItem(quest, userData); // Use your existing createQuestItem
                     dailyQuestList.appendChild(li);
                 } catch(renderError) {
                     console.error(`[QUEST ERROR] Failed to render daily quest ${quest.id}:`, renderError);
                     debugLog(`[QUEST ERROR] Failed render daily quest ${quest.id}: ${renderError.message}`);
                 }
            });
            debugLog("[QUEST DEBUG] Daily quests rendered from tasks array.");
        }

        // --- Fetch Basic Quests (Original Method) ---
        debugLog("[QUEST DEBUG] Fetching basic quests from quests/basic...");
        const basicQuestsSnapshot = await db.collection('quests').doc('basic').get({ source: 'server' });
        debugLog("[QUEST DEBUG] Basic quests snapshot received.", basicQuestsSnapshot.exists);
        const basicQuestsData = basicQuestsSnapshot.exists ? basicQuestsSnapshot.data() : {};
        const fetchedBasicQuests = basicQuestsData.tasks || []; // Access the 'tasks' array
        debugLog(`[QUEST DEBUG] Found ${fetchedBasicQuests.length} basic quests in tasks array.`, fetchedBasicQuests);

        // Ensure adProgress structure is initialized for all fetched ad quests if not present
        let adProgressUpdateNeeded = false;
        const adProgressUpdate = {};
        fetchedBasicQuests.forEach(quest => {
            // Check if 'id' exists before using it
            if (quest.type === 'ads' && quest.id && !userData.adProgress[quest.id]) {
                userData.adProgress[quest.id] = { watched: 0, claimed: false, lastClaimed: null };
                adProgressUpdate[`adProgress.${quest.id}`] = userData.adProgress[quest.id];
                adProgressUpdateNeeded = true;
                debugLog(`[QUEST DEBUG] Initializing adProgress for basic quest: ${quest.id}`);
            } else if (quest.type === 'ads' && !quest.id) {
                 console.warn("[QUEST WARN] Basic ad quest object missing 'id' field:", quest);
                 debugLog("[QUEST WARN] Basic ad quest object missing 'id' field.");
            }
        });
        if (adProgressUpdateNeeded) {
            await db.collection('userData').doc(telegramUser.id.toString()).update(adProgressUpdate);
            debugLog("[QUEST DEBUG] Updated user data with initial adProgress structures.");
            userData = currentUserData || await fetchAndUpdateUserData(); // Refresh data
            if (!userData) throw new Error("User data unavailable after adProgress init.");
        }


        basicQuestCountEl.textContent = fetchedBasicQuests.length;
        if (fetchedBasicQuests.length === 0) {
            basicQuestList.innerHTML = `<li class="no-quests"><p>No basic quests available right now.</p></li>`;
             debugLog("[QUEST DEBUG] No basic quests found in tasks array.");
        } else {
            basicQuestList.innerHTML = ''; // Clear loading message
            fetchedBasicQuests.forEach(quest => {
                 // Assuming quest objects within the 'tasks' array *do* have an 'id' field:
                 if (!quest.id) {
                     console.warn("[QUEST WARN] Basic quest object missing 'id' field:", quest);
                     debugLog("[QUEST WARN] Basic quest object missing 'id' field.");
                     return; // Skip rendering
                 }
                  try {
                     const li = createQuestItem(quest, userData); // Use your existing createQuestItem
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
// *** END OF UPDATED FUNCTION ***

function createQuestItem(quest, userData) {
    // --- Check if quest or quest.id is invalid ---
    if (!quest || !quest.id) {
        console.warn("[QUEST WARN] Attempted to create item for invalid quest object:", quest);
        debugLog("[QUEST WARN] Attempted to create item for invalid quest object.");
        // Return an empty document fragment or null to prevent adding anything to the DOM
        return document.createDocumentFragment();
    }
    // --- End Check ---

    debugLog(`Creating quest item: ${quest.id}`);
    const li = document.createElement('li');
    li.className = 'quest-item';
    li.dataset.questId = quest.id;
    li.dataset.questType = quest.type || 'default'; // Use type from quest, default if missing

    // Validate quest data
    const icon = quest.icon || 'assets/icons/quest_placeholder.png';
    const title = quest.title || 'Untitled Quest';
    const reward = Number(quest.reward) || 0; // Ensure reward is a number

    // Sanitize title to prevent HTML injection
    const titleElement = document.createElement('span');
    titleElement.textContent = title;

    const iconImg = document.createElement('img');
    iconImg.src = icon;
    iconImg.alt = title;
    iconImg.onerror = () => {
        debugLog(`Failed to load quest icon for ${quest.id}: ${icon}`);
        iconImg.src = 'assets/icons/quest_placeholder.png';
    };

    const rewardDiv = document.createElement('div');
    rewardDiv.className = 'quest-reward';
    const gemImg = document.createElement('img');
    gemImg.src = 'assets/icons/gem.png';
    gemImg.alt = 'Gem';
    gemImg.onerror = () => {
        debugLog(`Failed to load gem icon for quest ${quest.id}`);
    };
    const rewardSpan = document.createElement('span');
    // Display reward correctly
    rewardSpan.textContent = `+${reward}`;
    rewardDiv.appendChild(gemImg);
    rewardDiv.appendChild(rewardSpan);

    li.appendChild(iconImg);
    li.appendChild(titleElement);


    // --- Ad Quest Specific Logic & Button ---
    const isAdBased = quest.type === 'ads'; // More robust check based on type
    let progressText = '';
    let button;

    if (isAdBased) {
        // Ensure adProgress object and quest-specific entry exist
        const adProgress = userData.adProgress?.[quest.id] || { watched: 0, claimed: false, lastClaimed: null };
        const adsRequired = Math.max(1, Number(quest.adLimit) || 1); // Use adLimit from quest
        const adType = quest.adType || 'rewarded_interstitial'; // Get ad type

        // Create Progress Span
        const progressSpan = document.createElement('span');
        progressSpan.className = 'progress';
        progressSpan.textContent = `${adProgress.watched}/${adsRequired}`;
        // Insert progress before the button in the reward div
        rewardDiv.appendChild(progressSpan);

        // Add dataset attributes for ad logic
        li.dataset.adType = adType;
        li.dataset.adLimit = adsRequired;

        // Determine Button State for Ad Quest
        button = document.createElement('button');
        button.dataset.questReward = reward;

        const isCompleted = adProgress.watched >= adsRequired;
        const isClaimed = adProgress.claimed;
        const currentTime = new Date();
        const lastClaimedTime = adProgress.lastClaimed ? new Date(adProgress.lastClaimed) : null; // Simplified handling
        const cooldownPeriod = 3600 * 1000; // 1 hour
        const timeSinceLastClaim = lastClaimedTime ? currentTime - lastClaimedTime : Infinity;
        const isCooldownOver = timeSinceLastClaim >= cooldownPeriod;

        if (isClaimed && !isCooldownOver) {
             const timeLeftMinutes = Math.ceil((cooldownPeriod - timeSinceLastClaim) / 60000);
             button.className = 'claimed-button'; // Use standard 'claimed' style
             button.textContent = `Wait ${timeLeftMinutes}m`;
             button.disabled = true;
        } else if (isCompleted && !isClaimed) {
            button.className = 'claim-button active';
            button.textContent = 'Claim';
            button.disabled = false;
        } else { // Not completed or cooldown is over (allowing more watches)
            button.className = 'go-button';
            button.textContent = quest.action || 'Watch Ad'; // Use action text or default
            button.disabled = false; // Enable GO button
        }

    } else { // --- Non-Ad Quest Button ---
        button = document.createElement('button');
        button.dataset.questReward = reward;

        const isClaimed = userData.claimedQuests?.includes(quest.id) || false;
        const link = quest.link || '';
        button.dataset.questLink = link; // Add link data for click handler

        if (isClaimed) {
            button.className = 'claimed-button';
            button.textContent = 'Claimed';
            button.disabled = true;
        } else {
            button.className = 'go-button';
            button.textContent = quest.action || 'GO'; // Use action text or default 'GO'
            button.disabled = false;
        }
    }

    // Append the reward div (which now contains progress if applicable)
    li.appendChild(rewardDiv);
    // Append the button (created above based on quest type)
    rewardDiv.appendChild(button); // Add button inside rewardDiv for alignment

    // --- Add Click Listener (Now unified) ---
    // The listener is added outside the if/else to handle both ad and non-ad quests
    button.addEventListener('click', handleQuestButtonClick);
    debugLog(`Quest ${quest.id} button listener attached.`);

    debugLog(`Quest item created: ${quest.id}`);
    return li;
}

// --- Unified Quest Button Click Handler ---
async function handleQuestButtonClick(event) {
    const button = event.target;
    const li = button.closest('.quest-item');
    if (!li || button.disabled) return; // Ignore if no parent item or button disabled

    const questId = li.dataset.questId;
    const questType = li.dataset.questType;
    const reward = parseInt(button.dataset.questReward || '0');
    const link = button.dataset.questLink || ''; // Get link if present
    const adLimit = parseInt(li.dataset.adLimit || '0');
    const adType = li.dataset.adType || ''; // Get adType if present

    debugLog(`[QUEST ACTION] Unified click handler for quest: ${questId}`, { type: questType, reward, link, adLimit, adType });

    if (!firebaseInitialized || !db || !telegramUser || !telegramUser.id) {
        alert("Cannot process quest action: System not ready.");
        debugLog("[QUEST ACTION ERROR] System not ready (Firebase/User).");
        return;
    }

    let userData = currentUserData || await fetchAndUpdateUserData();
    if (!userData) {
        alert("Cannot process quest action: User data unavailable.");
        debugLog("[QUEST ACTION ERROR] User data unavailable.");
        return;
    }
     // Ensure necessary sub-objects exist
     userData.adProgress = userData.adProgress || {};
     userData.claimedQuests = userData.claimedQuests || [];

    // --- Logic based on button class ---
    if (button.classList.contains('claim-button')) {
        // Handle claiming (applies to completed ad quests or potentially other claimable types)
        await claimQuestReward(questId, reward, questType, button, li, userData);
    } else if (button.classList.contains('go-button')) {
        // Handle 'GO' actions
        if (questType === 'ads') {
            // GO action for an ad quest means "Watch Ad"
            await watchAdForQuest(questId, adType, adLimit, button, li, userData);
        } else {
            // GO action for other quests (e.g., link)
            await completeLinkQuest(questId, reward, link, button, li, userData);
        }
    } else if (button.classList.contains('claimed-button')) {
        // Optionally add feedback if needed, but usually do nothing
        debugLog(`[QUEST ACTION] Clicked on already claimed/waiting button for quest: ${questId}`);
    }
}

// --- Specific Action Handlers ---

async function claimQuestReward(questId, reward, questType, button, li, userData) {
    debugLog(`[QUEST ACTION] Attempting to claim reward for quest: ${questId}`);
    button.disabled = true; button.textContent = 'Claiming...';

    const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
    const updates = {
        gems: firebase.firestore.FieldValue.increment(reward)
    };

    try {
        if (questType === 'ads') {
            // Mark ad quest as claimed and set timestamp
            const adProgress = userData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
            if (adProgress.claimed) { // Double check if already claimed
                 debugLog(`[QUEST ACTION WARN] Claim button clicked, but quest ${questId} already marked claimed in data.`);
                 alert("Quest already claimed.");
                 updateQuestItemUI(questId, li); // Update UI just in case
                 return;
            }
            adProgress.claimed = true;
            // Use server timestamp for reliability
            adProgress.lastClaimed = firebase.firestore.FieldValue.serverTimestamp();
            updates[`adProgress.${questId}`] = adProgress;
            debugLog(`[QUEST ACTION] Ad quest ${questId} claim updates prepared.`);
        } else {
            // Mark non-ad, non-repeatable quest as claimed
             // Need quest definition for repeatability check - simplified: assuming claim button only shows for claimable non-ads
             updates.claimedQuests = firebase.firestore.FieldValue.arrayUnion(questId);
             debugLog(`[QUEST ACTION] Default quest ${questId} claim updates prepared.`);
        }

        await userDocRef.update(updates);
        debugLog(`[QUEST ACTION] Firestore updated for ${questId} claim. Awarded ${reward} gems.`);
        if (analytics) analytics.logEvent('quest_claimed', { userId: telegramUser.id, questId, reward, questType });

        alert(`Reward claimed! You earned ${reward} gems.`);
        await fetchAndUpdateUserData(); // Refresh cache
        await updateUserStatsUI();
        updateQuestItemUI(questId, li); // Update the specific item's UI

    } catch (error) {
        console.error(`[QUEST ERROR] Error claiming reward for ${questId}:`, error);
        debugLog(`[QUEST ERROR] Error claiming reward for ${questId}: ${error.message}`);
        alert("Failed to claim reward. Please try again.");
        // Re-enable button on failure ONLY IF it's still a claim button
        if(button.classList.contains('claim-button')) {
            button.disabled = false; button.textContent = 'Claim';
        }
    }
}

async function watchAdForQuest(questId, adType, adLimit, button, li, userData) {
    debugLog(`[QUEST ACTION] Attempting to watch ad (${adType}) for quest: ${questId}`);
    const adProgress = userData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };

    if (adProgress.watched >= adLimit) {
        debugLog(`[QUEST ACTION] Ad limit already reached for ${questId}.`);
        alert("You have already watched the required ads for this quest.");
        updateQuestItemUI(questId, li); // Ensure UI is correct
        return;
    }

    button.disabled = true; button.textContent = 'Loading Ad...';

    try {
        // *** Make sure showAd is defined correctly ***
        await showAd(adType); // Pass the adType retrieved from the quest data
        debugLog(`[QUEST ACTION] Ad shown successfully (or closed) for quest: ${questId}`);

        // Fetch latest user data *before* update to prevent race conditions
        const latestUserData = await fetchAndUpdateUserData();
        if (!latestUserData) throw new Error("User data unavailable after ad watch.");

        const currentAdProgress = latestUserData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
        const newWatchedCount = currentAdProgress.watched + 1;

        // Update Firestore with incremented watch count
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        await userDocRef.update({
            [`adProgress.${questId}.watched`]: newWatchedCount
        });
        debugLog(`[QUEST ACTION] Ad progress updated in Firestore for ${questId}: ${newWatchedCount}/${adLimit}`);

        // Log event
        if (analytics) analytics.logEvent('ads_quest_watch', { userId: telegramUser.id, questId, adType });

        // Update local cache *after* successful Firestore update
        await fetchAndUpdateUserData();

        // Provide user feedback
        if (newWatchedCount >= adLimit) {
            alert(`Ad watched! (${newWatchedCount}/${adLimit}) You can now claim your reward.`);
        } else {
            alert(`Ad watched! Progress: ${newWatchedCount}/${adLimit}`);
        }

        // Update the UI for this specific quest item
        updateQuestItemUI(questId, li);

    } catch (error) {
        console.error(`[QUEST ERROR] Failed to show ad or update progress for ${questId}:`, error);
        debugLog(`[QUEST ERROR] Failed showing ad/updating progress for ${questId}: ${error.message}`);
        alert(`Failed to show ad. Please try again. Error: ${error.message}`);
        // Update UI to reset button state on failure
        updateQuestItemUI(questId, li);
    }
    // No finally block needed as updateQuestItemUI handles button state
}


async function completeLinkQuest(questId, reward, link, button, li, userData) {
    debugLog(`[QUEST ACTION] Completing link quest: ${questId}`);

     if (userData.claimedQuests?.includes(questId)) {
         debugLog(`[QUEST ACTION WARN] Link quest ${questId} already claimed.`);
         // Optionally alert user or just update UI
         updateQuestItemUI(questId, li);
         return;
     }
     if (!link) {
          alert("No link associated with this quest.");
          debugLog(`[QUEST ACTION ERROR] No link found for quest ${questId}.`);
          return;
     }

    button.disabled = true; button.textContent = 'Processing...';

    try {
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        await userDocRef.update({
            gems: firebase.firestore.FieldValue.increment(reward),
            claimedQuests: firebase.firestore.FieldValue.arrayUnion(questId)
        });
        debugLog(`[QUEST ACTION] Link quest ${questId} marked complete. Awarded ${reward} gems.`);

        // Log event
        if (analytics) analytics.logEvent('quest_completed', { userId: telegramUser.id, questId, reward, questType: 'link' });

        // Open the link
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
            window.Telegram.WebApp.openTelegramLink(link);
            debugLog(`[QUEST ACTION] Opened Telegram link: ${link}`);
        } else {
            window.open(link, '_blank');
            debugLog(`[QUEST ACTION WARN] Opened link in new tab (not in Telegram context): ${link}`);
        }

        alert(`Quest completed! You earned ${reward} gems.`);
        await fetchAndUpdateUserData(); // Refresh cache
        await updateUserStatsUI();
        updateQuestItemUI(questId, li); // Update the specific item UI

    } catch (error) {
        console.error(`[QUEST ERROR] Error completing link quest ${questId}:`, error);
        debugLog(`[QUEST ERROR] Error completing link quest ${questId}: ${error.message}`);
        alert("Failed to complete quest. Please try again.");
        // Re-enable button on failure ONLY IF it should still be GO
        if(button.classList.contains('go-button')) {
             button.disabled = false; button.textContent = 'GO'; // Reset text if needed
        }
    }
}

// --- Ad Logic (showAd function) ---
// *** THIS IS THE CORRECTED FUNCTION ***
// It now maps Firestore adType values to the correct Monetag SDK calls.
async function showAd(adType) { // Parameter is the value from Firestore (e.g., 'rewarded_popup')
    debugLog(`[AD] Attempting to show ad. Received adType from quest data: ${adType}`);
    return new Promise((resolve, reject) => {

        // --- REJECT MANUAL 'inApp' TRIGGERS ---
        // Automatic 'inApp' ads should be handled by the SDK's own initialization/timing rules
        if (adType === 'inApp') {
            const errorMsg = "In-App ads are shown automatically or via different SDK settings, not via manual quest trigger.";
            console.warn(`[AD WARN] ${errorMsg}`);
            debugLog(`[AD WARN] ${errorMsg}`);
            // Reject the promise as this type shouldn't be manually triggered this way
            return reject(new Error(errorMsg));
        }
        // --- END REJECTION ---

        const maxWaitTime = 30000; // 30 seconds timeout

        // Check if SDK function exists
        if (typeof window.show_9180370 !== 'function') {
            console.warn("[AD WARN] Monetag SDK function 'show_9180370' not found. Simulating ad success after delay.");
            debugLog("[AD WARN] Monetag SDK function not found. Simulating success.");
            setTimeout(() => {
                debugLog("[AD] Simulated ad finished.");
                resolve(); // Simulate success
            }, 3000);
            return;
        }

        let adPromise = null;
        let adTriggered = false;
        // Assume promise handling needed unless SDK call fails or type is rejected
        let requiresPromiseHandling = true;

        // Cleanup function (remains the same)
        const cleanup = (success, error = null) => {
            clearTimeout(timeoutId);
            if (success) {
                resolve();
            } else {
                reject(error || new Error(`Ad failed or was closed early (${adType || 'unknown type'})`));
            }
        };

        // Timeout Logic (remains the same)
        const timeoutId = setTimeout(() => {
            console.warn(`[AD WARN] Ad timed out after ${maxWaitTime / 1000}s (${adType || 'unknown type'}). Rejecting.`);
            debugLog(`[AD WARN] Ad timed out: ${adType}`);
            cleanup(false, new Error(`Ad timed out or failed to close (${adType || 'unknown type'})`));
        }, maxWaitTime);

        try {
            // --- *** CORRECTED SDK CALL LOGIC *** ---
            debugLog(`[AD] Mapping Firestore adType '${adType}' to Monetag SDK call.`);

            if (adType === 'rewarded_popup') {
                // If Firestore adType is 'rewarded_popup', call the SDK with 'pop' argument
                debugLog("[AD] Calling Monetag SDK with 'pop' argument for rewarded_popup.");
                adPromise = window.show_9180370('pop');
                adTriggered = true;
            } else if (adType === 'rewarded_interstitial') {
                 // If Firestore adType is 'rewarded_interstitial', call the SDK with no arguments
                debugLog("[AD] Calling Monetag SDK with no arguments for rewarded_interstitial.");
                adPromise = window.show_9180370();
                adTriggered = true;
            // } else if (adType === 'inApp') {
                // This case is already handled by the rejection at the start.
                // adTriggered = false; // Ensure flag is false if rejected
                // requiresPromiseHandling = false;
            } else {
                // Default case: If adType is something else or missing, show standard interstitial
                console.warn(`[AD WARN] Unrecognized or missing adType '${adType}'. Defaulting to standard interstitial.`);
                debugLog(`[AD WARN] Defaulting to standard interstitial for adType: ${adType}`);
                adPromise = window.show_9180370(); // Default call
                adTriggered = true;
            }
            // --- *** END CORRECTED SDK CALL LOGIC *** ---

            // --- Handle Promise (remains the same) ---
            if (requiresPromiseHandling && adTriggered && adPromise && typeof adPromise.then === 'function') {
                debugLog(`[AD] SDK returned a Promise for type ${adType}. Waiting for resolution...`);
                adPromise.then(() => {
                    debugLog(`[AD] SDK Promise resolved successfully for type: ${adType}. Ad likely watched/closed.`);
                    cleanup(true); // Resolve the outer promise on success
                }).catch(e => {
                    console.error(`[AD ERROR] SDK Promise rejected for type ${adType}:`, e);
                    debugLog(`[AD ERROR] SDK Promise rejected for ${adType}: ${e?.message || e}`);
                    cleanup(false, new Error(`Ad failed or was closed early (${adType})`)); // Reject the outer promise on failure
                });
            } else if (requiresPromiseHandling && adTriggered) {
                 console.warn(`[AD WARN] SDK call for ${adType} was triggered but did not return a standard promise. Relying on timeout for completion.`);
                 // If Monetag doesn't always return a promise, you might need event listeners or rely solely on the timeout.
                 // However, modern usage typically involves promises. Check their documentation if issues persist.
            } else {
                // This path might be taken if adType was 'inApp' and rejected earlier.
                 debugLog("[AD INFO] Ad was not triggered or handled differently (e.g., rejected 'inApp'). No promise to await.");
                 // If 'inApp' was rejected, the outer promise from showAd should already be rejected by the cleanup in the 'inApp' check.
            }

        } catch (error) {
            // Catch immediate errors from calling show_9180370 itself
            console.error("[AD ERROR] Failed to trigger Monetag ad:", error);
            debugLog(`[AD ERROR] Failed to trigger ad ${adType}: ${error.message}`);
            cleanup(false, error); // Reject the outer promise if the call fails immediately
        }
    });
}
// *** END OF CORRECTED showAd FUNCTION ***


// --- Update Quest Item UI Helper ---
// This function updates a single quest item in the list based on latest user data
// It's called after claiming or watching an ad for a specific quest.
function updateQuestItemUI(questId, listItemElement) {
    debugLog(`[QUEST UI] Updating specific quest item UI for: ${questId}`);
    const userData = currentUserData; // Use cached data
    if (!userData || !listItemElement) {
        debugLog("[QUEST UI] Update skipped: No user data or list item element.");
        return;
    }

    // Find the quest definition (we need it for checks like repeatability, adLimit etc.)
    // This part is tricky without the global arrays. We might need to fetch it again,
    // OR pass the full quest object to this function when initially calling it.
    // *** Assuming the necessary quest data is available via dataset attributes on 'listItemElement' ***
    const questType = listItemElement.dataset.questType;
    const adLimit = parseInt(listItemElement.dataset.adLimit || '0');
    const button = listItemElement.querySelector('.quest-reward button'); // Find the button within the item
    const progressSpan = listItemElement.querySelector('.progress'); // Find progress span if it exists

     if (!button) {
        debugLog("[QUEST UI WARN] Could not find button within quest item:", questId);
        return; // Cannot update if button is missing
     }

    const isAdBased = questType === 'ads';
    const isClaimed = userData.claimedQuests?.includes(questId) || false; // Check non-ad claimed status
    let adProgress = userData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };

    // Update progress text if it's an ad quest and span exists
    if (isAdBased && progressSpan) {
        progressSpan.textContent = `${adProgress.watched}/${adLimit}`;
    }

    // Determine new button state
    const isCompleted = isAdBased ? adProgress.watched >= adLimit : true; // Non-ad quests are 'complete' if not claimed
    const isEffectivelyClaimed = isAdBased ? adProgress.claimed : isClaimed; // Use relevant claimed status

    const currentTime = new Date();
    // Safely attempt to convert Firestore Timestamp or Date string/number to Date object
    let lastClaimedTime = null;
    if (adProgress.lastClaimed) {
        try {
             if (typeof adProgress.lastClaimed.toDate === 'function') {
                 lastClaimedTime = adProgress.lastClaimed.toDate(); // Firestore Timestamp
             } else {
                 lastClaimedTime = new Date(adProgress.lastClaimed); // Attempt string/number conversion
             }
             if (isNaN(lastClaimedTime.getTime())) { // Check if conversion resulted in invalid date
                 lastClaimedTime = null;
                 console.warn(`[QUEST UI WARN] Invalid date format for lastClaimed on quest ${questId}:`, adProgress.lastClaimed);
             }
         } catch (dateError) {
             lastClaimedTime = null;
             console.warn(`[QUEST UI ERROR] Error processing lastClaimed date for quest ${questId}:`, dateError);
         }
     }

    const cooldownPeriod = 3600 * 1000; // 1 hour
    const timeSinceLastClaim = lastClaimedTime ? currentTime.getTime() - lastClaimedTime.getTime() : Infinity;
    const isCooldownOver = timeSinceLastClaim >= cooldownPeriod;

    // Logic based on combined states
    if (isEffectivelyClaimed && (!isAdBased || !isCooldownOver)) { // Claimed (non-ad) OR Claimed Ad still in cooldown
        button.className = 'claimed-button';
        button.textContent = isAdBased ? `Wait ${Math.ceil((cooldownPeriod - timeSinceLastClaim) / 60000)}m` : 'Claimed';
        button.disabled = true;
    } else if (isCompleted && !isEffectivelyClaimed) { // Ready to claim (Ad completed or non-ad not claimed yet but eligible)
        // For non-ad, the 'GO' button might still be shown until clicked, then becomes claimed.
        // Let's refine: If it's *not* ad-based, 'GO' should remain until clicked, then it becomes 'Claimed'.
        // If it *is* ad-based and completed & not claimed, it becomes 'Claim'.
        if (isAdBased) {
            button.className = 'claim-button active';
            button.textContent = 'Claim';
            button.disabled = false;
        } else {
             // Non-ad quests usually transition directly from GO -> Claimed upon successful action
             // If we reach here for a non-ad, it likely means the initial state before interaction.
             button.className = 'go-button';
             button.textContent = listItemElement.querySelector('span')?.textContent || 'GO'; // Try to get original action text
             button.disabled = false;
        }

    } else { // Not completed (Ad) or Cooldown is over for Ad (can watch again) or initial state for non-ad
        button.className = 'go-button';
        // Try to get the quest's original action text, fall back to defaults
        const originalActionText = listItemElement.dataset.originalAction || (isAdBased ? 'Watch Ad' : 'GO');
        button.textContent = originalActionText;
        // Store original action text if not already done
        if (!listItemElement.dataset.originalAction) {
            listItemElement.dataset.originalAction = button.textContent;
        }
        button.disabled = false;
    }

    debugLog(`[QUEST UI] Item UI updated for ${questId}. New button state: ${button.className}, Text: ${button.textContent}`);
}


// --- Wallet Section ---
async function initializeTONConnect() {
    debugLog("Initializing TON Connect...");
    try {
        // Ensure TonConnectUI script is loaded
        if (!window.TonConnectUI) {
            await loadScript('https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js');
            if (!window.TonConnectUI) throw new Error("TonConnectUI script failed to load.");
        } else {
            debugLog("TonConnectUI script already loaded.");
        }

        // Initialize TonConnectUI
        tonConnectUI = new window.TonConnectUI({
            manifestUrl: 'https://fourgo.app/tonconnect-manifest.json', // Make sure this is correct and accessible
            buttonRootId: null // Let the script manage the button interaction
        });
        debugLog("TonConnectUI instance created.");

        // --- Button Handling ---
        const connectButton = document.querySelector('.connect-button');
        if (connectButton) {
            // Remove potential old listeners before adding new one
            connectButton.removeEventListener('click', handleConnectClick);
            connectButton.addEventListener('click', handleConnectClick);
            debugLog("Connect/Disconnect button listener attached.");
        } else {
            console.error("Connect button not found in DOM!");
            debugLog("[WALLET ERROR] Connect button not found.");
        }

        // --- Status Change Listener ---
        tonConnectUI.onStatusChange(async (walletInfo) => {
            debugLog(`[WALLET STATUS CHANGE] Wallet status changed. Connected: ${!!walletInfo}`, walletInfo ? { address: walletInfo.account.address, chain: walletInfo.account.chain } : null);
            await fetchAndUpdateUserData(); // Refresh user data on connect/disconnect
            await updateWalletConnectionStatusUI(); // Update UI based on new status
            if (connectButton) connectButton.disabled = false; // Re-enable button after status change
        }, (error) => {
             console.error("[WALLET STATUS CHANGE ERROR]", error);
             debugLog(`[WALLET STATUS CHANGE ERROR] ${error.message || 'Unknown error'}`);
        });

        debugLog("TON Connect initialized successfully.");
        // Update UI based on initial state after setup
        await updateWalletConnectionStatusUI();

    } catch (error) {
        console.error("TON Connect initialization failed:", error);
        debugLog(`TON Connect initialization failed: ${error.message}`);
        alert("Could not initialize wallet features. Please try again later.");
    }
}

// --- Wallet UI Update (Connection Status Part) ---
async function updateWalletConnectionStatusUI() {
    debugLog("Updating Wallet Connection Status UI...");
    const connectionStatusEl = document.getElementById('connection-status');
    const connectButton = document.querySelector('.connect-button');
    const withdrawButtons = document.querySelectorAll('.withdraw-button'); // Select all withdraw buttons

    if (!connectionStatusEl || !connectButton || !withdrawButtons) {
        console.error("Wallet UI elements missing!");
        debugLog("[WALLET ERROR] Connection status or button elements missing.");
        return;
    }

    const isConnected = tonConnectUI && tonConnectUI.connected;
    debugLog(`Wallet connection status: ${isConnected}`);

    if (isConnected) {
        connectionStatusEl.textContent = 'Connected';
        connectionStatusEl.className = 'wallet-status connected';
        connectButton.textContent = 'DISCONNECT'; // Changed text
        connectButton.classList.add('connected');
        connectButton.disabled = false; // Ensure button is enabled

        // Enable withdraw buttons if connected
        withdrawButtons.forEach(btn => {
            // Optional: Add balance check here if needed before enabling
            // const card = btn.closest('.balance-card');
            // const balance = parseFloat(card?.querySelector('.balance-info span')?.textContent || '0');
            // btn.disabled = balance <= 0;
            btn.disabled = false; // Enable based on connection for now
        });

        // Store wallet address if available
        const walletAddress = tonConnectUI.account?.address;
        if (walletAddress && telegramUser?.id) {
            try {
                 await Storage.setItem('walletAddress', walletAddress); // Use Storage abstraction
                 debugLog(`Wallet connected: Address ${walletAddress} stored for user ${telegramUser.id}.`);
            } catch (storageError) {
                 console.error("Failed to store wallet address:", storageError);
                 debugLog(`[WALLET ERROR] Failed to store wallet address: ${storageError.message}`);
            }

        } else {
            debugLog("Wallet connected, but address not available or user ID missing.");
        }

    } else { // Not connected
        connectionStatusEl.textContent = 'Disconnected';
        connectionStatusEl.className = 'wallet-status disconnected';
        connectButton.textContent = 'CONNECT TON WALLET';
        connectButton.classList.remove('connected');
        connectButton.disabled = false; // Ensure button is enabled

        // Disable withdraw buttons if disconnected
        withdrawButtons.forEach(btn => btn.disabled = true);
        debugLog("Wallet disconnected state UI updated.");
    }
}


// --- Wallet Button Click Handler ---
async function handleConnectClick() {
     debugLog("[WALLET ACTION] Connect/Disconnect button clicked.");
     const connectButton = document.querySelector('.connect-button');
     if (!connectButton || !tonConnectUI) {
         debugLog("[WALLET ACTION ERROR] Button or tonConnectUI not available.");
         return;
     }

     // Temporarily disable button
     connectButton.disabled = true;
     connectButton.textContent = 'Processing...';

     try {
         if (tonConnectUI.connected) {
             debugLog("Disconnecting wallet...");
             await tonConnectUI.disconnect(); // Triggers status change listener
             debugLog("Wallet disconnect initiated.");
             // UI update is handled by onStatusChange
         } else {
             debugLog("Connecting wallet...");
             await tonConnectUI.connectWallet(); // Opens modal, triggers status change listener
             debugLog("Wallet connection process initiated.");
             // UI update is handled by onStatusChange
         }
     } catch (error) {
         console.error(`Wallet connection/disconnection error: ${error.message}`);
         debugLog(`[WALLET ACTION ERROR] ${error.message}`);
         alert(`Wallet action failed: ${error.message}`);
         // Manually update UI on error as status change might not fire
         await updateWalletConnectionStatusUI();
     }
     // Note: Button re-enabling is handled by onStatusChange listener for success cases
     // If an error occurs above before disconnect/connectWallet resolves/rejects,
     // the button might stay disabled. `updateWalletConnectionStatusUI` should re-enable it.
}


// --- Update Full Wallet Section UI ---
async function updateWalletSectionUI() {
    debugLog("Updating Wallet section UI...");
    await updateUserStatsUI(); // Updates balances in the header AND wallet section
    await updateWalletConnectionStatusUI(); // Updates connect button and connection status text
    await updateTransactionHistory(); // Fetches and displays transactions
    setupWithdrawModal(); // Re-attaches listeners for withdraw buttons
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
     transactionListEl.innerHTML = '<li>Loading history...</li>';

     if (!firebaseInitialized || !db || !telegramUser || !telegramUser.id) {
         transactionListEl.innerHTML = '<li>History unavailable.</li>';
         debugLog("[WALLET WARN] History unavailable: System not ready.");
         return;
     }

     try {
         // Reference the subcollection correctly
         const txCollectionRef = db.collection('userData').doc(telegramUser.id.toString()).collection('transactions');
         const snapshot = await txCollectionRef.orderBy('timestamp', 'desc').limit(15).get();

         if (snapshot.empty) {
             transactionListEl.innerHTML = '<li>No transactions yet</li>';
             debugLog("No transaction history found.");
             return;
         }

         debugLog(`Workspaceed ${snapshot.docs.length} transaction history entries.`);
         transactionListEl.innerHTML = snapshot.docs.map(doc => {
             const tx = doc.data();
             let txTime = 'Invalid date';
             // Format timestamp safely
             if (tx.timestamp && typeof tx.timestamp.toDate === 'function') {
                 try { txTime = tx.timestamp.toDate().toLocaleString(); } catch (dateErr) { console.warn("Error formatting date:", dateErr); }
             } else if (tx.timestamp) {
                 // Fallback for different timestamp formats if needed
                 try { txTime = new Date(tx.timestamp).toLocaleString(); } catch (e) { /* ignore */ }
             }

             let detail = '';
             const status = tx.status || 'unknown';
             const statusClass = status.toLowerCase(); // Ensure class is lowercase

             // Determine transaction detail string
             if (tx.type === 'withdrawal' || tx.type === 'Withdrawal') { // Check both cases just in case
                 detail = `Withdraw ${tx.amount?.toFixed(4) || '?'} ${tx.currency || '?'} (Fee: ${tx.fee?.toFixed(4) || '?'})`;
             } else if (tx.type === 'credit_claim') { // Assuming this type might exist from claim logic
                 detail = `Claimed ${tx.usdtAmount?.toFixed(4) || '?'} USDT (${tx.creditsSpent?.toLocaleString() || '?'} C)`;
             } else {
                 // Fallback for other potential transaction types
                 detail = `Type: ${tx.type || 'Unknown'}, Amount: ${tx.amount || '?'} ${tx.currency || '?'}`;
             }

             // Construct list item HTML
             return `<li> ${detail} - <span class="tx-status ${statusClass}">${status}</span> <br> <small>${txTime}</small> </li>`; // Added line break and small tag for time
         }).join('');

     } catch (error) {
         console.error(`Error updating transaction history: ${error.message}`);
         debugLog(`Error updating transaction history: ${error.message}`);
         transactionListEl.innerHTML = `<li>Error loading history.</li>`;
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

    if (!withdrawModal || !confirmButton || !cancelButton || !amountInput || !availableBalanceSpan || !currencySpan || !feeSpan || !feeCurrencySpan) {
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

        // Define fees (Consider fetching these from config/Firestore later)
        const fee = currency === 'USDT' ? 0.10 : 0.01; // Example: 0.1 USDT fee, 0.01 TON fee
        const feeDecimals = currency === 'USDT' ? 2 : 3;
        feeSpan.textContent = fee.toFixed(feeDecimals);

        amountInput.value = '';
        amountInput.step = currency === 'USDT' ? "0.01" : "0.001"; // Adjust step
        amountInput.max = Math.max(0, availableBalance - fee).toFixed(4); // Max withdrawable amount

        withdrawModal.style.display = 'flex';
    };

    // Remove old listeners and add new ones to buttons
    withdrawButtons.forEach(button => {
        const card = button.closest('.balance-card');
        // Clone and replace to remove old listeners reliably
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', (event) => {
            const isUsdt = card?.classList.contains('usdt-card');
            const currency = isUsdt ? 'USDT' : 'TON';
            debugLog(`${currency} Withdraw button clicked.`);
            const userData = currentUserData; // Use cached data
            const balance = isUsdt ? (userData?.usdt || 0) : (userData?.ton || 0);

            if (balance > 0) {
                 showModal(currency, balance);
            } else {
                alert(`Insufficient ${currency} balance.`);
                 debugLog(`Withdraw attempt failed: Insufficient ${currency} balance (${balance}).`);
            }
        });
    });
    debugLog("Withdraw button listeners attached/re-attached.");


    // --- Modal Action Button Listeners ---
    // Clone and replace confirm/cancel buttons to ensure single listener instance
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    const newCancelButton = cancelButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);

    // Cancel Button Listener
    newCancelButton.addEventListener('click', (event) => {
        debugLog("Withdraw Cancel button clicked.");
        withdrawModal.style.display = 'none';
    });
    debugLog("Withdraw Cancel button listener attached.");

    // Confirm Button Listener
    newConfirmButton.addEventListener('click', async (event) => {
        debugLog("Withdraw Confirm button clicked.");
        const amount = parseFloat(amountInput.value);
        const currency = currencySpan.textContent;
        const fee = parseFloat(feeSpan.textContent);
        const available = parseFloat(availableBalanceSpan.textContent);

        const confirmBtn = event.target; // Use event target
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';

        // Validation
        if (isNaN(amount) || amount <= 0) {
            alert("Invalid amount entered.");
            debugLog("[WITHDRAW VALIDATION] Invalid amount.");
            confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm';
            return;
        }
        if (amount + fee > available) {
            alert(`Insufficient balance to cover amount and fee (${fee.toFixed(currency === 'USDT' ? 2 : 3)} ${currency}).`);
            debugLog(`[WITHDRAW VALIDATION] Insufficient balance. Need ${amount + fee}, have ${available}.`);
            confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm';
            return;
        }
        if (!tonConnectUI || !tonConnectUI.connected || !tonConnectUI.account?.address) {
            alert("Wallet not connected. Please connect your wallet first.");
            debugLog("[WITHDRAW VALIDATION] Wallet not connected.");
             withdrawModal.style.display = 'none'; // Close modal if wallet disconnected
            confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm';
            return;
        }

        // --- Proceed with Simulated Withdrawal ---
        const destinationAddress = tonConnectUI.account.address;
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const balanceField = currency.toLowerCase(); // 'usdt' or 'ton'
        const totalDeduction = amount + fee;
        const txId = `sim_tx_${Date.now()}_${currency}`; // Unique simulation ID

        try {
            debugLog(`[WITHDRAW SIMULATION] Initiating: ${amount} ${currency} to ${destinationAddress} (Fee: ${fee} ${currency})`);

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
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            await txCollectionRef.doc(txId).set(transactionData);
            debugLog(`[WITHDRAW SIMULATION] Pending transaction record created: ${txId}`);

            // Deduct Balance from User Data
            await userDocRef.update({
                [balanceField]: firebase.firestore.FieldValue.increment(-totalDeduction)
            });
            debugLog(`[WITHDRAW SIMULATION] User balance deducted: -${totalDeduction} ${currency}`);

            // Simulate Processing Delay & Completion
            setTimeout(async () => {
                try {
                    await txCollectionRef.doc(txId).update({ status: 'completed' });
                    debugLog(`[WITHDRAW SIMULATION] Transaction ${txId} marked as completed.`);
                    await updateTransactionHistory(); // Refresh history UI to show completed
                } catch (simError) {
                    console.error("Error updating simulated transaction status:", simError);
                    debugLog(`[WITHDRAW SIMULATION ERROR] Failed updating tx ${txId} status: ${simError.message}`);
                    try {
                        await txCollectionRef.doc(txId).update({ status: 'failed', failureReason: simError.message });
                    } catch (failErr) {
                        console.error("Failed to mark tx as failed:", failErr);
                    }
                    await updateTransactionHistory(); // Refresh history UI to show failed
                }
            }, 5000); // 5 second delay simulation

            // Log analytics event
            if (analytics) analytics.logEvent('withdrawal_initiated', { userId: telegramUser.id, currency, amount, fee });

            // Close modal and update UI immediately after deduction
            withdrawModal.style.display = 'none';
            await fetchAndUpdateUserData(); // Refresh global cache
            await updateUserStatsUI(); // Update header/wallet balances
            await updateTransactionHistory(); // Show the new pending transaction
            alert(`Withdrawal of ${amount.toFixed(4)} ${currency} initiated (Fee: ${fee.toFixed(currency === 'USDT' ? 2 : 3)} ${currency}). This is a simulation.`);

        } catch (error) {
            console.error(`Withdrawal processing error: ${error.message}`);
            debugLog(`[WITHDRAW ERROR] Processing failed: ${error.message}`);
            alert(`Withdrawal failed: ${error.message}. Please try again.`);
            // Attempt to update history if transaction was partially created? Or handle rollback?
            // For simulation, just alerting failure is often sufficient.
            await updateTransactionHistory(); // Refresh history just in case
        } finally {
             // Ensure button is re-enabled if modal is still somehow open
             if (withdrawModal.style.display !== 'none') {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm';
            }
        }
    });
    debugLog("Withdraw Confirm button listener attached.");
}


// --- Invite Section ---
async function updateInviteSectionUI() {
    debugLog("Updating Invite section UI...");
    const userData = currentUserData || await fetchAndUpdateUserData();
    if (!userData) {
        debugLog("Invite UI update skipped: No user data.");
        // Reset UI elements if needed
        document.getElementById('my-invite').textContent = 'My Invite: 0';
        document.getElementById('total-credit-text').innerHTML = 'Total Credit <span class="warning">!</span> : 0';
        document.getElementById('invite-record-title').textContent = 'Invite Record (0)';
        document.getElementById('claim-record-placeholder').style.display = 'block';
        document.getElementById('invite-record-placeholder').style.display = 'block';
        document.getElementById('claim-record-list').innerHTML = '';
        document.getElementById('invite-record-list').innerHTML = '';
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
    inviteCountEl.textContent = `My Invite: ${userData.referrals || 0}`;
    totalCreditEl.innerHTML = `Total Credit <span class="warning">!</span> : ${(userData.referralCredits || 0).toLocaleString()}`;
    inviteRecordTitleEl.textContent = `Invite Record (${userData.referrals || 0})`;

     // Enable/Disable Claim button based on credits
     if (claimButton) {
        claimButton.disabled = (userData.referralCredits || 0) < 10000;
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
                const timeA = a.claimTime?.toDate ? a.claimTime.toDate().getTime() : (new Date(a.claimTime || 0)).getTime();
                const timeB = b.claimTime?.toDate ? b.claimTime.toDate().getTime() : (new Date(b.claimTime || 0)).getTime();
                return timeB - timeA;
            })
            .forEach(record => {
                const div = document.createElement('div');
                div.className = 'record-item';
                let claimTime = 'Invalid date';
                try {
                     // Check if timestamp is a Firestore Timestamp object
                     if (record.claimTime && typeof record.claimTime.toDate === 'function') {
                        claimTime = record.claimTime.toDate().toLocaleString();
                     } else if (record.claimTime) {
                         // Fallback if it's already a string/number (less likely)
                         claimTime = new Date(record.claimTime).toLocaleString();
                     }
                } catch (e) { console.warn("Error formatting claim date", e); }

                div.innerHTML = `
                    <img src="assets/icons/usdt.png" alt="USDT Claim" style="border-radius: 0;"> <div class="user-info">
                        <span>Claimed ${record.usdtAmount?.toFixed(4) || '?'} USDT</span>
                        <small>${claimTime}</small>
                    </div>
                    <span class="credit" style="background: #00cc00;">-${record.creditsSpent?.toLocaleString() || '?'} C</span>
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
                const timeA = a.joinTime?.toDate ? a.joinTime.toDate().getTime() : (new Date(a.joinTime || 0)).getTime();
                const timeB = b.joinTime?.toDate ? b.joinTime.toDate().getTime() : (new Date(b.joinTime || 0)).getTime();
                return timeB - timeA;
            })
             .forEach(record => {
                const div = document.createElement('div');
                div.className = 'record-item';
                 let joinTime = 'Invalid date';
                 try {
                     if (record.joinTime && typeof record.joinTime.toDate === 'function') {
                        joinTime = record.joinTime.toDate().toLocaleString();
                     } else if (record.joinTime) {
                         joinTime = new Date(record.joinTime).toLocaleString();
                     }
                 } catch (e) { console.warn("Error formatting join date", e); }

                // Use a placeholder/default avatar for invited users for simplicity
                div.innerHTML = `
                    <img src="https://via.placeholder.com/40/808080/FFFFFF?text=${(record.username || 'U')[0].toUpperCase()}" alt="${record.username || 'User'}">
                    <div class="user-info">
                        <span>${record.username || 'Unknown User'}</span>
                        <small>${joinTime}</small>
                    </div>
                    <span class="credit">+${record.creditAwarded || 0}</span>
                `;
                inviteRecordListEl.appendChild(div);
            });
    }

    setupInviteButtons(); // Ensure listeners are attached/updated
    debugLog("Invite section UI updated successfully.");
}

function generateReferralLink() {
     debugLog("Generating referral link...");
    if (!telegramUser || !telegramUser.id) {
         debugLog("Referral link generation skipped: No user ID.");
         return null; // Return null if no link can be generated
    }
    // !!! IMPORTANT: REPLACE 'YourBotUsername' with your actual Telegram bot's username !!!
    const botUsername = 'FourMetasBot'; // <--- REPLACE THIS
    if (botUsername === 'YourBotUsername') {
        console.warn("Please replace 'YourBotUsername' in generateReferralLink function!");
        debugLog("[WARN] Bot username not set in generateReferralLink.");
    }
    const referralLink = `https://t.me/${botUsername}?start=ref_${telegramUser.id}`;

    // Set the link on the buttons' data attributes if they exist
    const inviteButton = document.querySelector('.invite-friend');
    const copyButton = document.querySelector('.copy-link');

    if (inviteButton) inviteButton.setAttribute('data-link', referralLink);
    if (copyButton) copyButton.setAttribute('data-link', referralLink);

    debugLog("Referral link generated and set on buttons:", referralLink);
    return referralLink;
}

async function handleReferral() {
    debugLog("Checking for referral parameter...");
    if (!telegramUser || !telegramUser.id) {
        debugLog("Referral check skipped: No Telegram user ID.");
        return;
    }
    if (!firebaseInitialized || !db) {
        debugLog("Referral check skipped: Firestore not initialized.");
        return;
    }

    let startParam = null;
    try {
        // Access start_param safely
        startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    } catch (e) {
        console.error("Error accessing Telegram start_param:", e);
        debugLog(`Error accessing start_param: ${e.message}`);
        return;
    }

    if (startParam && startParam.startsWith('ref_')) {
        const referrerId = startParam.split('_')[1];
        debugLog(`Referral parameter found: ref_${referrerId}`);

        // Validate referrerId
        if (!referrerId || !/^\d+$/.test(referrerId)) { // Check if it's a string of digits
            debugLog(`Invalid referrerId format: ${referrerId}`);
            return;
        }

        const currentUserIdStr = telegramUser.id.toString();
        if (referrerId === currentUserIdStr) {
            debugLog("User referred themselves, skipping.");
            return; // Don't process self-referral
        }

        const currentUserRef = db.collection('userData').doc(currentUserIdStr);
        const referrerRef = db.collection('userData').doc(referrerId);

        try {
            // Check if the current user has already been referred
            const userDoc = await currentUserRef.get();
            // Ensure doc exists before checking data - might be a new user
            if (!userDoc.exists) {
                 debugLog("User document doesn't exist yet for referral check (might be created in initializeUserData).");
                 // If initialization hasn't run yet, the 'isReferred' check will happen there if needed.
                 // Or, we could potentially wait/retry, but simpler to let init handle it.
                 // For now, we just log and exit. If init runs later, it won't find the start_param.
                 // A more robust solution might involve passing the referrerId to init.
                 return;
            }
            const userData = userDoc.data();

            if (userData.isReferred) {
                debugLog(`User ${currentUserIdStr} has already been referred by ${userData.referredBy}. Skipping.`);
                return;
            }

            // Check if the referrer exists
            const referrerDoc = await referrerRef.get();
            if (!referrerDoc.exists) {
                 debugLog(`Referrer document ${referrerId} not found. Cannot process referral.`);
                 // Maybe store the invalid attempt? For now, just skip.
                 return;
            }

            // --- Process the referral ---
            debugLog(`Processing referral: User ${currentUserIdStr} referred by ${referrerId}`);

            // 1. Update the current user
            await currentUserRef.update({
                isReferred: true,
                referredBy: referrerId
            });
            debugLog(`User ${currentUserIdStr} marked as referred by ${referrerId}.`);

            // 2. Update the referrer
            const referralCreditAmount = 100; // Example: Credits per referral
            const referralGemAmount = 0;   // Example: Gems per referral (optional)

            // Create a record for the referrer's list
            const newInviteRecord = {
                userId: currentUserIdStr,
                username: telegramUser.username || telegramUser.first_name || `User_${currentUserIdStr.slice(-4)}`,
                joinTime: firebase.firestore.FieldValue.serverTimestamp(), // Use server time
                creditAwarded: referralCreditAmount,
                // photoUrl: telegramUser.photo_url || null // Optionally store photo
            };

            await referrerRef.update({
                referrals: firebase.firestore.FieldValue.increment(1),
                referralCredits: firebase.firestore.FieldValue.increment(referralCreditAmount),
                // Add gems increment if awarding gems:
                // gems: firebase.firestore.FieldValue.increment(referralGemAmount),
                inviteRecords: firebase.firestore.FieldValue.arrayUnion(newInviteRecord) // Add to the array
            });
            debugLog(`Updated referrer ${referrerId} data: +1 referral, +${referralCreditAmount} credits.`);

            // Log analytics event
            if (analytics) analytics.logEvent('referral_success', { userId: currentUserIdStr, referrerId });

            debugLog("Referral handled successfully.");
            // Optionally, refresh user data immediately if needed elsewhere right after referral
            // await fetchAndUpdateUserData();

        } catch (error) {
            console.error("Error processing referral:", error);
            debugLog(`Error processing referral: ${error.message}`);
            // Don't alert the user, as this runs silently on load
        }
    } else {
        debugLog("No referral parameter found or not in 'ref_' format.");
    }
}


function setupInviteButtons() {
    const inviteButton = document.querySelector('.invite-friend');
    const copyLinkButton = document.querySelector('.copy-link');
    const claimButton = document.querySelector('.invite-section .claim-button'); // More specific selector

    if (inviteButton) {
        // Remove old listener before adding new one
        inviteButton.removeEventListener('click', handleInviteFriendClick);
        inviteButton.addEventListener('click', handleInviteFriendClick);
        debugLog("Invite Friend button listener attached.");
    } else { debugLog("[INVITE WARN] Invite Friend button not found."); }

    if (copyLinkButton) {
        copyLinkButton.removeEventListener('click', handleCopyLinkClick);
        copyLinkButton.addEventListener('click', handleCopyLinkClick);
         debugLog("Copy Link button listener attached.");
    } else { debugLog("[INVITE WARN] Copy Link button not found."); }

    if (claimButton) {
        claimButton.removeEventListener('click', handleClaimCreditsClick);
        claimButton.addEventListener('click', handleClaimCreditsClick);
         debugLog("Claim Credits button listener attached.");
    } else { debugLog("[INVITE WARN] Claim Credits button not found."); }
}

// --- Invite Button Click Handlers ---
function handleInviteFriendClick(event) {
    debugLog("Invite Friend button clicked.");
    const link = generateReferralLink(); // Generate link dynamically
    if (!link) {
        alert("Could not generate referral link.");
        return;
    }
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
         // Use Telegram's share URL format for better integration
         const text = encodeURIComponent("Join me on 4Metas!"); // Optional text
         window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`);
    } else {
        alert("Please copy the link manually."); // Fallback if not in Telegram context
        debugLog("[INVITE WARN] Cannot open Telegram share link outside Telegram context.");
    }
}

function handleCopyLinkClick(event) {
    debugLog("Copy Link button clicked.");
    const link = generateReferralLink(); // Generate link dynamically
     if (!link) {
        alert("Could not generate referral link.");
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            alert("Invite link copied to clipboard!");
            debugLog("Referral link copied successfully.");
        }).catch(err => {
            console.error("Failed to copy link:", err);
            alert("Failed to copy link. Please copy it manually.");
            debugLog("[INVITE ERROR] Failed to copy link using navigator.clipboard:", err);
        });
    } else {
        // Fallback for browsers without clipboard API support (less common now)
        alert("Clipboard access not available. Please copy the link manually.");
        debugLog("[INVITE WARN] navigator.clipboard API not available.");
        // Consider showing the link in a prompt or text area for manual copying as a better fallback.
    }
}

async function handleClaimCreditsClick(event) {
    debugLog("Claim Credits button clicked.");
    const claimButton = event.target;
    claimButton.disabled = true;
    claimButton.textContent = 'Checking...';

    if (!telegramUser || !telegramUser.id || !firebaseInitialized || !db) {
        alert("Cannot claim credits: System not ready.");
        claimButton.disabled = false; claimButton.textContent = 'Claim';
        return;
    }

    const userDocRef = db.collection('userData').doc(telegramUser.id.toString());

    try {
        // Use a transaction for atomicity: read credits, check, then update
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists) {
                throw new Error("User data not found for claim.");
            }

            const data = userDoc.data();
            const currentCredits = data.referralCredits || 0;
            const conversionRate = 10000; // 10,000 credits = 1 USDT
            const minimumClaim = 10000; // Minimum credits needed to claim

            debugLog(`[CREDIT CLAIM] Transaction Check: Current credits: ${currentCredits}`);

            if (currentCredits < minimumClaim) {
                throw new Error(`Insufficient credits. Minimum ${minimumClaim.toLocaleString()} required.`);
            }

            // Calculate exact USDT and credits to use
            // Floor USDT to avoid fractional amounts if conversion isn't exact
            const usdtToClaim = Math.floor(currentCredits / conversionRate);
            const creditsToSpend = usdtToClaim * conversionRate; // Credits actually being spent

            if (usdtToClaim <= 0) {
                 throw new Error("Calculated claim amount is zero or less."); // Should not happen if min check passed
            }

            debugLog(`[CREDIT CLAIM] Transaction Proceed: Claiming ${usdtToClaim} USDT for ${creditsToSpend} credits.`);
            // Update button text visually, although transaction might still fail
            // This might be slightly misleading if it fails, but gives immediate feedback
            claimButton.textContent = 'Claiming...';

            const claimRecord = {
                claimTime: firebase.firestore.FieldValue.serverTimestamp(), // Use server time
                usdtAmount: usdtToClaim,
                creditsSpent: creditsToSpend,
                rate: conversionRate
                // Optionally add username/photoUrl here if needed in history items
            };

            // Perform the update within the transaction
            transaction.update(userDocRef, {
                usdt: firebase.firestore.FieldValue.increment(usdtToClaim),
                referralCredits: firebase.firestore.FieldValue.increment(-creditsToSpend),
                claimHistory: firebase.firestore.FieldValue.arrayUnion(claimRecord)
            });
            // Transaction commits automatically if no error is thrown here
        });

        // Transaction successful
        debugLog(`[CREDIT CLAIM] Transaction successful.`);
         // Find claimed amount again if needed for alert (might be slightly complex post-transaction)
         // Simple alert for now:
         alert(`Successfully claimed USDT for credits!`);
        if (analytics) analytics.logEvent('credit_claim', { userId: telegramUser.id /*, usdt: usdtToClaim, credits: creditsToSpend */ }); // Add amounts if easily accessible

        // Update UI *after* successful transaction
        await fetchAndUpdateUserData(); // Refresh cache
        await updateUserStatsUI();
        await updateInviteSectionUI(); // This will re-render lists and update button state

    } catch (error) {
        console.error("[CREDIT CLAIM ERROR]", error);
        debugLog(`[CREDIT CLAIM ERROR] ${error.message}`);
        alert(`Failed to claim credits: ${error.message}`);
        // Update UI to reflect potential unchanged state after error
         await updateInviteSectionUI(); // Re-renders button based on actual credit amount
    }
    // No finally block needed for button state, updateInviteSectionUI handles it based on refreshed data
}


// --- Chest Section ---
function updateChestUI() {
    debugLog("Updating Chest section UI...");
    const chestContainer = document.getElementById('chestContainer');
    const chestCostDisplay = document.getElementById('chestCost'); // Main cost display below slider
    const chestCostAmount = document.getElementById('chest-cost-amount');
    const vipRequirementDisplay = document.getElementById('chestVipRequirement');
    const openButton = document.querySelector('.open-chest-button');
    const leftArrow = document.querySelector('.nav-arrow.left');
    const rightArrow = document.querySelector('.nav-arrow.right');

     if (!chestContainer || !chestCostDisplay || !chestCostAmount || !vipRequirementDisplay || !openButton || !leftArrow || !rightArrow) {
        console.error("Chest UI elements missing!");
        debugLog("[CHEST ERROR] Required chest UI elements not found.");
        return;
     }

    const chest = chests[currentChestIndex];
     if (!chest) {
        console.error(`[CHEST ERROR] Invalid chest index: ${currentChestIndex}`);
        debugLog(`[CHEST ERROR] Invalid chest index: ${currentChestIndex}`);
        // Optionally reset index or display error in UI
        return;
     }

    // Update Slider Content (if not already rendered or needs dynamic update)
    // Assuming renderChests() was called once initially.
    // We just need to ensure the correct one is visually centered.
    chestContainer.style.transform = `translateX(-${currentChestIndex * 100}%)`;


    // --- Update Cost/VIP/Button State for the *currently selected* chest ---
     const userData = currentUserData; // Use cached user data
     const userVipLevel = userData?.vipLevel || 0;
     const userGems = userData?.gems || 0;

     debugLog(`[CHEST CHECK] User VIP: ${userVipLevel}, User Gems: ${userGems.toLocaleString()}, Chest: ${chest.name} (Needs VIP ${chest.vip}, Cost ${chest.gemCost.toLocaleString()})`);

     // Hide requirement/cost initially
     vipRequirementDisplay.style.display = 'none';
     chestCostDisplay.style.display = 'none'; // Hide the whole cost div initially
     openButton.disabled = false; // Enable button by default, disable based on checks

    // Check VIP Level
     if (chest.vip > userVipLevel) {
         vipRequirementDisplay.textContent = `NEED VIP ${chest.vip}`;
         vipRequirementDisplay.style.display = 'block'; // Show VIP requirement
         openButton.disabled = true;
         openButton.textContent = `VIP ${chest.vip} Required`;
         debugLog(`[CHEST] VIP ${chest.vip} required, user has ${userVipLevel}. Button disabled.`);
     } else {
         // VIP level met, show cost and check gems
         vipRequirementDisplay.style.display = 'none'; // Hide VIP req
         chestCostAmount.textContent = chest.gemCost.toLocaleString(); // Set cost amount
         chestCostDisplay.style.display = 'flex'; // Show the cost display div
         openButton.textContent = 'Open Chest';

         // Check Gems
         if (userGems < chest.gemCost) {
             openButton.disabled = true;
             // Optionally add a visual indicator for insufficient gems
             // e.g., change button style or show a small message next to cost
             debugLog(`[CHEST] Insufficient gems. Need ${chest.gemCost.toLocaleString()}, user has ${userGems.toLocaleString()}. Button disabled.`);
              chestCostDisplay.style.color = '#ffcc00'; // Example: Make cost yellow if not enough
         } else {
             // Meets VIP and Gem requirements
              chestCostDisplay.style.color = ''; // Reset color
             debugLog(`[CHEST] User meets VIP and Gem requirements. Button enabled.`);
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
    container.innerHTML = chests.map((chest, index) => `
        <div class="chest-item" data-index="${index}">
            <div class="chest-title">
                <h2>${chest.name}</h2>
                <span>${chest.next ? `Next: ${chest.next}` : 'Max Level'}</span>
            </div>
            <div class="chest-image">
                <img src="${chest.image}" alt="${chest.name}" onerror="this.src='assets/icons/chest_placeholder.png'">
            </div>
            </div>
    `).join('');
     debugLog(`[CHEST] Rendered ${chests.length} chests into slider.`);

     // Add event listeners to arrows and button AFTER rendering
     const leftArrow = document.querySelector('.nav-arrow.left');
     const rightArrow = document.querySelector('.nav-arrow.right');
     const openButton = document.querySelector('.open-chest-button');

     if (leftArrow) {
         leftArrow.removeEventListener('click', prevChest); // Remove old listener first
         leftArrow.addEventListener('click', prevChest);
     } else { debugLog("[CHEST WARN] Left arrow not found."); }
     if (rightArrow) {
         rightArrow.removeEventListener('click', nextChest);
         rightArrow.addEventListener('click', nextChest);
     } else { debugLog("[CHEST WARN] Right arrow not found."); }
     if (openButton) {
         openButton.removeEventListener('click', openChest);
         openButton.addEventListener('click', openChest);
     } else { debugLog("[CHEST WARN] Open Chest button not found."); }

     updateChestUI(); // Initial UI update for the first chest
}


function prevChest() {
    debugLog("Prev Chest button clicked.");
    if (currentChestIndex > 0) {
        currentChestIndex--;
        updateChestUI();
    }
}

function nextChest() {
    debugLog("Next Chest button clicked.");
    if (currentChestIndex < chests.length - 1) {
        currentChestIndex++;
        updateChestUI();
    }
}

async function openChest() {
     const chest = chests[currentChestIndex];
      if (!chest) {
          console.error("[CHEST ACTION ERROR] Cannot open chest, invalid index:", currentChestIndex);
          debugLog(`[CHEST ACTION ERROR] Cannot open chest, invalid index: ${currentChestIndex}`);
          alert("Error: Could not determine which chest to open.");
          return;
      }
     debugLog(`[CHEST ACTION] Attempting to open chest: ${chest.name}`);
     const openButton = document.querySelector('.open-chest-button');
     openButton.disabled = true; openButton.textContent = 'Opening...';

     if (!telegramUser || !telegramUser.id) { alert("User not identified."); openButton.disabled = false; updateChestUI(); return; }
     if (!firebaseInitialized || !db) { alert("Database not ready."); openButton.disabled = false; updateChestUI(); return; }

     const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
     const rankingDocRef = db.collection('users').doc(telegramUser.id.toString());

     try {
          // Fetch latest data for check (important!) using the global cache pattern
          const userData = await fetchAndUpdateUserData();
          if (!userData) throw new Error("User data not found to open chest.");

         const currentGems = userData.gems || 0;
         const userVipLevel = userData.vipLevel || 0;

         debugLog(`[CHEST ACTION CHECK] Checking requirements: Need VIP ${chest.vip} (Have ${userVipLevel}), Need Gems ${chest.gemCost.toLocaleString()} (Have ${currentGems.toLocaleString()})`);

         if (chest.vip > userVipLevel) throw new Error(`VIP Level ${chest.vip} required.`);
         if (currentGems < chest.gemCost) throw new Error(`Insufficient gems. Need ${chest.gemCost.toLocaleString()}, have ${currentGems.toLocaleString()}.`);

         // Simulate Reward Calculation (Example Logic - adjust as needed)
         const rewards = {
             usdt: parseFloat((Math.random() * (chest.gemCost / 4000) + (chest.gemCost / 10000)).toFixed(4)), // Scale USDT reward with cost
             landPiece: Math.random() < (0.05 + currentChestIndex * 0.02) ? 1 : 0, // Increase land piece chance with chest level (max ~17% for mythic)
             foxMedal: Math.floor(Math.random() * (currentChestIndex + 1) * 1.5) + 1 // More medals for higher chests
         };
         debugLog("[CHEST ACTION] Calculated rewards:", rewards);

         // Update Firestore atomically using transaction if possible, or batched write
         const batch = db.batch(); // Use a batch for multiple updates

         // Update user data
         const updates = {
             gems: firebase.firestore.FieldValue.increment(-chest.gemCost),
             usdt: firebase.firestore.FieldValue.increment(rewards.usdt),
             landPieces: firebase.firestore.FieldValue.increment(rewards.landPiece),
             foxMedals: firebase.firestore.FieldValue.increment(rewards.foxMedal)
         };
         batch.update(userDocRef, updates);

         // Update ranking document if medals were awarded
         if (rewards.foxMedal > 0) {
              // Use set with merge to ensure document exists or is updated safely
               batch.set(rankingDocRef, {
                   foxMedals: firebase.firestore.FieldValue.increment(rewards.foxMedal)
               }, { merge: true });
         }

         await batch.commit(); // Commit all updates together
         debugLog(`[CHEST ACTION] Firestore updated via batch. Deducted ${chest.gemCost.toLocaleString()} gems. Added rewards.`);

         // Log analytics event
         if (analytics) analytics.logEvent('chest_opened', { userId: telegramUser.id, chestName: chest.name, cost: chest.gemCost, rewards });

         // Show Rewards
         let rewardString = `Opened ${chest.name}! Rewards:\n`;
         if (rewards.usdt > 0) rewardString += `- ${rewards.usdt.toFixed(4)} USDT\n`;
         if (rewards.landPiece > 0) rewardString += `- ${rewards.landPiece} Land Piece\n`;
         if (rewards.foxMedal > 0) rewardString += `- ${rewards.foxMedal} Fox Medal\n`;
         if (rewards.usdt <= 0 && rewards.landPiece <= 0 && rewards.foxMedal <= 0) {
            rewardString += "- Nothing this time!"; // Handle case where all rewards are 0
         }
         alert(rewardString);

         // Update UI
         await fetchAndUpdateUserData(); // Refresh cache with new balances *after* update
         await updateUserStatsUI(); // Update header stats
         updateChestUI(); // Re-check requirements/costs for the current chest & update button state

     } catch (error) {
         console.error("Error opening chest:", error);
         debugLog(`[CHEST ERROR] ${error.message}`);
         alert(`Failed to open chest: ${error.message}`);
         // Ensure button is re-enabled and UI reflects potential unchanged state
         openButton.disabled = false;
         updateChestUI(); // Crucial to reset button state based on actual data
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

     if (!firebaseInitialized || !db) {
         rankingList.innerHTML = `<li class="error"><p>Failed to load rankings: Database not ready.</p></li>`;
         debugLog("[RANKING ERROR] Firestore not initialized.");
         return;
     }

     try {
         const rankingsSnapshot = await db.collection('users') // Assuming 'users' collection holds ranking data
             .orderBy('foxMedals', 'desc')
             .limit(30) // Limit to top 30
             .get();

         const rankings = [];
         rankingsSnapshot.forEach(doc => {
             const data = doc.data();
             // Basic validation/defaults
             rankings.push({
                 id: doc.id,
                 username: data.username || 'Anonymous',
                 foxMedals: data.foxMedals || 0,
                 photoUrl: data.photoUrl || 'assets/icons/user-avatar.png' // Default avatar
             });
         });
         debugLog(`Workspaceed ${rankings.length} ranking entries.`);

         if (rankings.length === 0) {
             rankingList.innerHTML = `<li class="no-rankings"><p>The ranking is empty right now.</p></li>`;
         } else {
             rankingList.innerHTML = rankings.map((user, index) => `
                 <li class="ranking-item">
                     <span class="rank-number" style="margin-right: 10px; font-weight: bold; width: 25px; text-align: right;">${index + 1}.</span>
                     <img src="${user.photoUrl}" alt="${user.username}" onerror="this.src='assets/icons/user-avatar.png'">
                     <span class="rank-username" style="flex-grow: 1; margin-left: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.username}</span>
                     <div class="medal-count">
                         <span>${user.foxMedals.toLocaleString()}</span>
                         <img src="assets/icons/fox-medal.png" alt="Fox Medal">
                     </div>
                 </li>
             `).join('');
         }
         debugLog("Top section UI updated successfully.");
     } catch (error) {
         console.error("Error updating top section UI:", error);
         debugLog(`Error updating ranking UI: ${error.message}`);
         rankingList.innerHTML = `<li class="error"><p>Failed to load rankings. Please try again.</p></li>`;
     }
 }


// --- Initialize App ---
async function initializeApp() {
    debugLog("--- App Initialization Sequence Start ---");

    // 1. Initialize Telegram Interface
    const telegramSuccess = initializeTelegram();
    if (!telegramSuccess) {
        debugLog("Proceeding with fallback Telegram user.");
        // Decide if app should stop or continue in fallback mode
    }

    // 2. Initialize Firebase (essential)
    const firebaseSuccess = await initializeFirebase();
    if (!firebaseSuccess) {
        debugLog("App Init Failed: Firebase could not be initialized.");
        alert("Critical Error: Cannot connect to the database. Please try restarting the app.");
        return; // Stop initialization if Firebase fails
    }

    // 3. Initialize User Data (includes fetching initial data into currentUserData)
    // Use ensureFirebaseReady wrapper for safety, although firebaseSuccess check is done above
    await ensureFirebaseReady(initializeUserData, 'initializeUserData');

    // 4. Handle Incoming Referrals (check after user data might exist)
    await ensureFirebaseReady(handleReferral, 'handleReferral');

    // 5. Generate User's Referral Link
    generateReferralLink(); // Doesn't need await or Firebase

    // 6. Initialize TON Connect
    // Doesn't strictly need ensureFirebaseReady, but await its completion
    await initializeTONConnect();

    // 7. Render Dynamic Components (Chests - depends on chest data array)
    renderChests(); // Doesn't need await or Firebase

    // 8. Setup Main Navigation (attaches listeners, sets default view)
    setupNavigation(); // Doesn't need await or Firebase

    // 9. Initial Data Load for Default Section
    // This is now handled implicitly by setupNavigation -> switchSection(defaultSection)
    // which calls ensureFirebaseReady(updateEarnSectionUI, ...)
    debugLog("Initial data load for default section triggered via navigation setup.");

    // 10. Automatic Ad Initialization (optional, depends on SDK)
    try {
        if (typeof window.show_9180370 === 'function') {
            // Define the settings for automatic display - ADJUST THESE AS NEEDED
            const autoInAppSettings = {
                frequency: 2,      // Max 2 ads per session defined by capping
                capping: 0.016,    // Session duration = 0.016 hours (~1 minute)
                interval: 30,     // Minimum 30 seconds between ads
                timeout: 5,       // 5-second delay before the *first* ad in a session might show
                everyPage: false   // Set to true if ads should potentially show on every section switch
            };
            debugLog('[AD INIT] Initializing automatic In-App ads with settings:', JSON.stringify(autoInAppSettings));
            window.show_9180370({ type: 'inApp', inAppSettings: autoInAppSettings });
        } else {
            debugLog('[AD INIT WARN] Monetag SDK function not found, cannot initialize automatic ads.');
        }
    } catch (initAdError) {
        console.error('[AD INIT ERROR] Error initializing automatic In-App ads:', initAdError);
        debugLog(`[AD INIT ERROR] Error initializing automatic ads: ${initAdError.message}`);
    }

    // 11. Final UI Updates (optional, ensure everything reflects initial state)
    await ensureFirebaseReady(updateUserStatsUI, 'finalUserStatsUpdate');
    // Other section updates might be needed if they weren't the default section
    // e.g., await ensureFirebaseReady(updateWalletSectionUI, 'finalWalletUpdate');


    debugLog("--- App Initialization Sequence Finished ---");
    if (analytics) analytics.logEvent('app_initialized', { userId: telegramUser?.id?.toString() || 'unknown' });
}


// --- DOMContentLoaded Listener ---
// Ensures DOM is fully loaded before initializing the app logic
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // DOM is already loaded or nearly loaded, initialize shortly after current script execution finishes
    debugLog("DOM already loaded, initializing app shortly.");
    // Use setTimeout to ensure it runs after the current call stack clears, allowing rendering engine potentially catch up
    setTimeout(initializeApp, 0);
} else {
    // DOM not ready yet, wait for the event
    debugLog("Waiting for DOMContentLoaded to initialize app.");
    document.addEventListener('DOMContentLoaded', () => {
        debugLog("DOMContentLoaded fired, initializing app.");
        initializeApp();
    });
}
