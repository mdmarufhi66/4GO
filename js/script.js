console.log('[DEBUG] Script execution started.');

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
const REWARDED_AD_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes in milliseconds

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
            const value = doc.exists ? doc.data()[key] : null;
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
                adCooldowns: {}, // <-- Initialize ad cooldowns object
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
            if (userData.adCooldowns === undefined) updates.adCooldowns = {}; // <-- Ensure adCooldowns exists
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
        const userDoc = await userDocRef.get({ source: 'server' }); // Force server fetch to get latest cooldowns etc.
        if (!userDoc.exists) {
            debugLog("User doc not found during fetch.");
            currentUserData = null;
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
        userData.adCooldowns = userData.adCooldowns || {}; // <-- Ensure adCooldowns exists
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
                     return;
                 }
                 try {
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

        // Ensure adProgress structure is initialized for all fetched ad quests if not present
        let adProgressUpdateNeeded = false;
        const adProgressUpdate = {};
        fetchedBasicQuests.forEach(quest => {
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
            userData = await fetchAndUpdateUserData(); // Refresh data
            if (!userData) throw new Error("User data unavailable after adProgress init.");
        }


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
        // Return an empty document fragment or null to prevent adding anything to the DOM
        return document.createDocumentFragment();
    }
    // --- End Check ---

    // debugLog(`Creating quest item: ${quest.id}`); // Reduce noise
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
    let button;

    if (isAdBased) {
        // Ensure adProgress object and quest-specific entry exist
        const adProgress = userData.adProgress?.[quest.id] || { watched: 0, claimed: false, lastClaimed: null };
        const adsRequired = Math.max(1, Number(quest.adLimit) || 1); // Use adLimit from quest
        const adType = quest.adType || 'rewarded_interstitial'; // Get ad type ('rewarded_popup', 'rewarded_interstitial')

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
        // Quest cooldown (if any, e.g., daily repeatable)
        const questCooldownPeriod = 3600 * 1000; // 1 hour for example quest cooldown
        const questLastClaimedTime = adProgress.lastClaimed ? safeConvertToDate(adProgress.lastClaimed)?.getTime() : 0;
        const timeSinceQuestLastClaim = questLastClaimedTime ? Date.now() - questLastClaimedTime : Infinity;
        const isQuestCooldownOver = timeSinceQuestLastClaim >= questCooldownPeriod;

        // *** Check the AD TYPE cooldown separately ***
        const adTypeLastWatched = userData.adCooldowns?.[adType] ? safeConvertToDate(userData.adCooldowns[adType])?.getTime() : 0;
        const timeSinceAdTypeLastWatched = adTypeLastWatched ? Date.now() - adTypeLastWatched : Infinity;
        const isAdTypeCooldownActive = timeSinceAdTypeLastWatched < REWARDED_AD_COOLDOWN_MS;
        const adTypeCooldownRemainingMinutes = isAdTypeCooldownActive ? Math.ceil((REWARDED_AD_COOLDOWN_MS - timeSinceAdTypeLastWatched) / 60000) : 0;

        // --- Button Logic incorporating both cooldowns ---
        if (isClaimed && !isQuestCooldownOver) { // Quest itself is claimed and on cooldown
            const questCooldownRemainingMinutes = Math.ceil((questCooldownPeriod - timeSinceQuestLastClaim) / 60000);
             button.className = 'claimed-button'; // Use standard 'claimed' style
             button.textContent = `Wait ${questCooldownRemainingMinutes}m`; // Show quest cooldown
             button.disabled = true;
        } else if (isCompleted && !isClaimed) { // Ready to CLAIM quest reward
            button.className = 'claim-button active';
            button.textContent = 'Claim';
            button.disabled = false;
        } else { // Not completed OR quest cooldown is over (ready for more watches/actions)
            button.className = 'go-button';
            if (isAdTypeCooldownActive) { // Check AD TYPE cooldown before allowing "Watch Ad"
                button.textContent = `Wait ${adTypeCooldownRemainingMinutes}m`; // Show ad type cooldown
                button.disabled = true;
            } else { // Ad type cooldown is NOT active
                button.textContent = quest.action || 'Watch Ad'; // Use action text or default
                button.disabled = false; // Enable GO button
            }
        }

    } else { // --- Non-Ad Quest Button ---
        button = document.createElement('button');
        button.dataset.questReward = reward;

        const isClaimed = userData.claimedQuests?.includes(quest.id) || false;
        const link = quest.link || '';
        button.dataset.questLink = link; // Add link data for click handler

        if (isClaimed) {
            // Assuming non-ad quests are not typically repeatable with cooldowns in this logic
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

    // --- Add Click Listener (Unified) ---
    button.addEventListener('click', handleQuestButtonClick);
    // debugLog(`Quest ${quest.id} button listener attached.`); // Reduce noise

    // debugLog(`Quest item created: ${quest.id}`); // Reduce noise
    return li;
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

    // Get potentially updated user data before proceeding
    let userData = await fetchAndUpdateUserData();
    if (!userData) {
        alert("Cannot process quest action: User data unavailable.");
        debugLog("[QUEST ACTION ERROR] User data unavailable.");
        return;
    }
     // Ensure necessary sub-objects exist (redundant if fetchAndUpdateUserData works, but safe)
     userData.adProgress = userData.adProgress || {};
     userData.adCooldowns = userData.adCooldowns || {};
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
        // Re-enable button based on updated UI state after fetch
        await fetchAndUpdateUserData();
        updateQuestItemUI(questId, li);
    }
}

async function watchAdForQuest(questId, adType, adLimit, button, li, initialUserData) {
    debugLog(`[QUEST ACTION] Attempting to watch ad (${adType}) for quest: ${questId}`);

    // --- *** NEW: AD TYPE COOLDOWN CHECK *** ---
    if (adType === 'rewarded_popup' || adType === 'rewarded_interstitial') {
        const lastWatchedTimestamp = initialUserData.adCooldowns?.[adType] ? safeConvertToDate(initialUserData.adCooldowns[adType])?.getTime() : 0;
        const now = Date.now();
        const elapsed = now - lastWatchedTimestamp;

        if (lastWatchedTimestamp > 0 && elapsed < REWARDED_AD_COOLDOWN_MS) {
            const remainingMs = REWARDED_AD_COOLDOWN_MS - elapsed;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            alert(`Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before watching another ${adType.replace('_', ' ')} ad.`);
            debugLog(`[AD COOLDOWN] Blocked ${adType} for quest ${questId}. Remaining: ${remainingMinutes} min.`);
            // No button state change needed here, createQuestItem/updateQuestItemUI handles the "Wait Xm" display
            return; // Stop execution
        }
         debugLog(`[AD COOLDOWN] Cooldown check passed for ${adType}. Last watched: ${lastWatchedTimestamp ? new Date(lastWatchedTimestamp).toLocaleTimeString() : 'Never'}. Elapsed: ${elapsed/1000}s`);
    }
    // --- *** END AD TYPE COOLDOWN CHECK *** ---


    const adProgress = initialUserData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };

    if (adProgress.watched >= adLimit) {
        debugLog(`[QUEST ACTION] Ad limit already reached for ${questId}.`);
        alert("You have already watched the required ads for this quest.");
        updateQuestItemUI(questId, li); // Ensure UI is correct
        return;
    }

    button.disabled = true; button.textContent = 'Loading Ad...';

    try {
        // Show the ad (pass the correct type from Firestore/dataset)
        await showAd(adType);
        debugLog(`[QUEST ACTION] Ad shown successfully (or closed) for quest: ${questId}, type: ${adType}`);

        // Fetch latest user data *before* update to prevent race conditions with cooldowns
        const latestUserData = await fetchAndUpdateUserData();
        if (!latestUserData) throw new Error("User data unavailable after ad watch.");

        const currentAdProgress = latestUserData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
        const newWatchedCount = currentAdProgress.watched + 1;

        // --- Prepare Firestore updates for BOTH quest progress AND ad cooldown ---
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const updates = {};

        // 1. Update Quest Progress
        updates[`adProgress.${questId}.watched`] = newWatchedCount;

        // 2. Update Ad Type Cooldown Timestamp (if applicable)
        if (adType === 'rewarded_popup' || adType === 'rewarded_interstitial') {
            updates[`adCooldowns.${adType}`] = firebase.firestore.FieldValue.serverTimestamp();
             debugLog(`[AD COOLDOWN] Preparing to update cooldown timestamp for ${adType}.`);
        }

        // Apply all updates together
        await userDocRef.update(updates);
        debugLog(`[QUEST ACTION] Firestore updated for ${questId}: Progress ${newWatchedCount}/${adLimit}. Cooldown set for ${adType}.`);

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
        console.error(`[QUEST ERROR] Failed to show ad or update progress for ${questId} (${adType}):`, error);
        debugLog(`[QUEST ERROR] Failed showing ad/updating progress for ${questId} (${adType}): ${error.message}`);
        alert(`Failed to show ad. Please try again. Error: ${error.message}`);
        // Update UI to reset button state based on latest data after failure
        await fetchAndUpdateUserData(); // Ensure we have latest state
        updateQuestItemUI(questId, li);
    }
}


async function completeLinkQuest(questId, reward, link, button, li, userData) {
    debugLog(`[QUEST ACTION] Completing link quest: ${questId}`);

     if (userData.claimedQuests?.includes(questId)) {
         debugLog(`[QUEST ACTION WARN] Link quest ${questId} already claimed.`);
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
        // Re-enable button based on updated UI state after fetch
        await fetchAndUpdateUserData();
        updateQuestItemUI(questId, li);
    }
}

// --- Ad Logic (showAd function) ---
// No changes needed here; it correctly takes adType and calls the SDK.
// The cooldown logic happens *before* calling this and *after* its success.
async function showAd(adType) { // Parameter is the value from Firestore (e.g., 'rewarded_popup')
    debugLog(`[AD] Attempting to show ad. Received adType from quest data: ${adType}`);
    return new Promise((resolve, reject) => {

        // --- REJECT MANUAL 'inApp' TRIGGERS ---
        if (adType === 'inApp') {
            const errorMsg = "In-App ads are shown automatically or via different SDK settings, not via manual quest trigger.";
            console.warn(`[AD WARN] ${errorMsg}`);
            debugLog(`[AD WARN] ${errorMsg}`);
            return reject(new Error(errorMsg));
        }
        // --- END REJECTION ---

        const maxWaitTime = 30000; // 30 seconds timeout

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
        let requiresPromiseHandling = true;

        const cleanup = (success, error = null) => {
            clearTimeout(timeoutId);
            if (success) {
                 debugLog(`[AD] Cleanup called: Success for adType ${adType}`);
                resolve();
            } else {
                 debugLog(`[AD] Cleanup called: Failure for adType ${adType}`, error);
                reject(error || new Error(`Ad failed or was closed early (${adType || 'unknown type'})`));
            }
        };

        const timeoutId = setTimeout(() => {
            console.warn(`[AD WARN] Ad timed out after ${maxWaitTime / 1000}s (${adType || 'unknown type'}). Rejecting.`);
            debugLog(`[AD WARN] Ad timed out: ${adType}`);
            cleanup(false, new Error(`Ad timed out or failed to close (${adType || 'unknown type'})`));
        }, maxWaitTime);

        try {
            debugLog(`[AD] Mapping Firestore adType '${adType}' to Monetag SDK call.`);

            if (adType === 'rewarded_popup') {
                debugLog("[AD] Calling Monetag SDK with 'pop' argument for rewarded_popup.");
                adPromise = window.show_9180370('pop');
                adTriggered = true;
            } else if (adType === 'rewarded_interstitial') {
                debugLog("[AD] Calling Monetag SDK with no arguments for rewarded_interstitial.");
                adPromise = window.show_9180370();
                adTriggered = true;
            } else {
                console.warn(`[AD WARN] Unrecognized or missing adType '${adType}'. Defaulting to standard interstitial.`);
                debugLog(`[AD WARN] Defaulting to standard interstitial for adType: ${adType}`);
                adPromise = window.show_9180370(); // Default call
                adTriggered = true;
            }

            if (requiresPromiseHandling && adTriggered && adPromise && typeof adPromise.then === 'function') {
                debugLog(`[AD] SDK returned a Promise for type ${adType}. Waiting for resolution...`);
                adPromise.then(() => {
                    debugLog(`[AD] SDK Promise resolved successfully for type: ${adType}. Ad likely watched/closed.`);
                    cleanup(true);
                }).catch(e => {
                    console.error(`[AD ERROR] SDK Promise rejected for type ${adType}:`, e);
                    debugLog(`[AD ERROR] SDK Promise rejected for ${adType}: ${e?.message || e}`);
                    // Don't treat rejection as outright failure necessarily, Monetag might reject on close?
                    // Let's assume rejection means it wasn't fully watched or failed.
                    cleanup(false, new Error(`Ad failed or was closed early (${adType})`));
                });
            } else if (requiresPromiseHandling && adTriggered) {
                 console.warn(`[AD WARN] SDK call for ${adType} was triggered but did not return a standard promise. Relying on timeout for completion.`);
                 // If relying on timeout, cleanup(true) will never be called unless we add other event listeners.
                 // For now, this path likely leads to timeout unless the SDK implicitly resolves something.
            } else {
                 debugLog("[AD INFO] Ad was not triggered or handled differently. No promise to await.");
            }

        } catch (error) {
            console.error("[AD ERROR] Failed to trigger Monetag ad:", error);
            debugLog(`[AD ERROR] Failed to trigger ad ${adType}: ${error.message}`);
            cleanup(false, error);
        }
    });
}


// --- Update Quest Item UI Helper ---
// This function updates a single quest item in the list based on latest user data
// It's called after claiming or watching an ad for a specific quest, or during initial render setup.
function updateQuestItemUI(questId, listItemElement) {
    // debugLog(`[QUEST UI] Updating specific quest item UI for: ${questId}`); // Reduce noise
    const userData = currentUserData; // Use cached data
    if (!userData || !listItemElement) {
        // debugLog("[QUEST UI] Update skipped: No user data or list item element."); // Reduce noise
        return;
    }

    // Retrieve quest details from dataset attributes
    const questType = listItemElement.dataset.questType;
    const adLimit = parseInt(listItemElement.dataset.adLimit || '0');
    const adType = listItemElement.dataset.adType || ''; // Needed for ad cooldown check
    const button = listItemElement.querySelector('.quest-reward button');
    const progressSpan = listItemElement.querySelector('.progress');

     if (!button) {
        debugLog("[QUEST UI WARN] Could not find button within quest item:", questId);
        return;
     }

    const isAdBased = questType === 'ads';
    const isNonAdClaimed = !isAdBased && (userData.claimedQuests?.includes(questId) || false);
    let adProgress = userData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };

    // Update progress text if it's an ad quest and span exists
    if (isAdBased && progressSpan) {
        progressSpan.textContent = `${adProgress.watched}/${adLimit}`;
    }

    // Determine quest state
    const isQuestCompleted = isAdBased ? adProgress.watched >= adLimit : true; // Non-ad quests are 'complete' if not claimed
    const isQuestClaimed = isAdBased ? adProgress.claimed : isNonAdClaimed;

    // Check Quest Cooldown (e.g., for daily repeatables)
    const questCooldownPeriod = 3600 * 1000; // Example: 1 hour cooldown for the quest itself if repeatable
    const questLastClaimedTime = isAdBased ? safeConvertToDate(adProgress.lastClaimed)?.getTime() : 0; // Only check for ad quests for now
    const timeSinceQuestLastClaim = questLastClaimedTime ? Date.now() - questLastClaimedTime : Infinity;
    const isQuestOnCooldown = isQuestClaimed && timeSinceQuestLastClaim < questCooldownPeriod;
    const questCooldownRemainingMinutes = isQuestOnCooldown ? Math.ceil((questCooldownPeriod - timeSinceQuestLastClaim) / 60000) : 0;

    // Check AD TYPE Cooldown (only relevant for 'GO' button state)
    let isAdTypeOnCooldown = false;
    let adTypeCooldownRemainingMinutes = 0;
    if (isAdBased && (adType === 'rewarded_popup' || adType === 'rewarded_interstitial')) {
        const adTypeLastWatched = userData.adCooldowns?.[adType] ? safeConvertToDate(userData.adCooldowns[adType])?.getTime() : 0;
        const timeSinceAdTypeLastWatched = adTypeLastWatched ? Date.now() - adTypeLastWatched : Infinity;
        isAdTypeOnCooldown = timeSinceAdTypeLastWatched < REWARDED_AD_COOLDOWN_MS;
        if (isAdTypeOnCooldown) {
             adTypeCooldownRemainingMinutes = Math.ceil((REWARDED_AD_COOLDOWN_MS - timeSinceAdTypeLastWatched) / 60000);
        }
    }

    // --- Set Button State based on combined logic ---
    button.disabled = false; // Default to enabled, disable below if needed

    if (isQuestOnCooldown) { // Quest itself is claimed and on its own cooldown (e.g., daily)
        button.className = 'claimed-button';
        button.textContent = `Wait ${questCooldownRemainingMinutes}m`;
        button.disabled = true;
    } else if (isQuestClaimed && !isQuestOnCooldown && !isAdBased) { // Non-ad quest permanently claimed
        button.className = 'claimed-button';
        button.textContent = 'Claimed';
        button.disabled = true;
    } else if (isQuestCompleted && !isQuestClaimed) { // Ready to CLAIM the reward
        button.className = 'claim-button active';
        button.textContent = 'Claim';
    } else { // Quest is not complete OR quest cooldown is over (ready for action)
        button.className = 'go-button';
        if (isAdBased && isAdTypeOnCooldown) { // Check AD TYPE cooldown before allowing watch action
            button.textContent = `Wait ${adTypeCooldownRemainingMinutes}m`;
            button.disabled = true;
        } else { // Ad type cooldown not active OR it's a non-ad quest ready for 'GO'
             // Try to get the quest's original action text, fall back to defaults
            const originalActionText = listItemElement.dataset.originalAction || (isAdBased ? 'Watch Ad' : 'GO');
            button.textContent = originalActionText;
            // Store original action text if not already done
            if (!listItemElement.dataset.originalAction) {
                listItemElement.dataset.originalAction = button.textContent;
            }
        }
    }

    // debugLog(`[QUEST UI] Item UI updated for ${questId}. New button state: ${button.className}, Text: ${button.textContent}, Disabled: ${button.disabled}`); // Reduce noise
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
            btn.disabled = false; // Enable based on connection for now
        });

        // Store wallet address if available
        const walletAddress = tonConnectUI.account?.address;
        if (walletAddress && telegramUser?.id) {
            try {
                 // Only update if address changed or not set
                 const currentStoredAddress = await Storage.getItem('walletAddress');
                 if (currentStoredAddress !== walletAddress) {
                    await Storage.setItem('walletAddress', walletAddress); // Use Storage abstraction
                    debugLog(`Wallet connected: Address ${walletAddress} stored for user ${telegramUser.id}.`);
                 } else {
                     debugLog(`Wallet address ${walletAddress} already stored.`);
                 }
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
     // Button re-enabling is handled by onStatusChange listener or the error block above
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
             const timestamp = safeConvertToDate(tx.timestamp);
             if (timestamp) txTime = timestamp.toLocaleString();

             let detail = '';
             const status = tx.status || 'unknown';
             const statusClass = status.toLowerCase(); // Ensure class is lowercase

             // Determine transaction detail string
             if (tx.type === 'Withdrawal') { // Check standardized type
                 detail = `Withdraw ${tx.amount?.toFixed(4) || '?'} ${tx.currency || '?'} (Fee: ${tx.fee?.toFixed(currency === 'USDT' ? 2:3) || '?'})`; // Format fee correctly
             } else if (tx.type === 'credit_claim') {
                 detail = `Claimed ${tx.usdtAmount?.toFixed(4) || '?'} USDT (${tx.creditsSpent?.toLocaleString() || '?'} C)`;
             } else {
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

        // Reset button state
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirm';

        withdrawModal.style.display = 'flex';
    };

    // Remove old listeners and add new ones to buttons
    withdrawButtons.forEach(button => {
        const card = button.closest('.balance-card');
        // Clone and replace to remove old listeners reliably
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', async (event) => { // Make async for data fetch
            const isUsdt = card?.classList.contains('usdt-card');
            const currency = isUsdt ? 'USDT' : 'TON';
            debugLog(`${currency} Withdraw button clicked.`);

            // Fetch latest data to ensure accurate balance check
            const userData = await fetchAndUpdateUserData();
            if (!userData) {
                alert("Could not retrieve your balance. Please try again.");
                return;
            }

            const balance = isUsdt ? (userData.usdt || 0) : (userData.ton || 0);

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
        const available = parseFloat(availableBalanceSpan.textContent); // Balance shown in modal

        const confirmBtn = event.target; // Use event target
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';

        // Re-fetch latest data for validation before proceeding
        const latestUserData = await fetchAndUpdateUserData();
        if (!latestUserData) {
             alert("Error verifying balance. Please try again.");
             debugLog("[WITHDRAW VALIDATION] Failed to fetch latest user data for final check.");
             confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm';
             return;
        }
        const currentActualBalance = currency === 'USDT' ? (latestUserData.usdt || 0) : (latestUserData.ton || 0);

        // Validation
        if (isNaN(amount) || amount <= 0) {
            alert("Invalid amount entered.");
            debugLog("[WITHDRAW VALIDATION] Invalid amount.");
            confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm';
            return;
        }
        if (amount + fee > currentActualBalance) { // Use latest actual balance for final check
            alert(`Insufficient balance to cover amount and fee (${fee.toFixed(currency === 'USDT' ? 2 : 3)} ${currency}). Your current balance is ${currentActualBalance.toFixed(4)} ${currency}.`);
            debugLog(`[WITHDRAW VALIDATION] Insufficient actual balance. Need ${amount + fee}, have ${currentActualBalance}.`);
            // Update modal display if balance changed since opening
            availableBalanceSpan.textContent = currentActualBalance.toFixed(4);
            amountInput.max = Math.max(0, currentActualBalance - fee).toFixed(4);
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
                        // Try to mark as failed even if first update failed
                        await txCollectionRef.doc(txId).update({ status: 'failed', failureReason: simError.message });
                    } catch (failErr) {
                        console.error("Failed to mark tx as failed:", failErr);
                    } finally {
                        await updateTransactionHistory(); // Refresh history UI to show failed status
                    }
                }
            }, 5000); // 5 second delay simulation

            // Log analytics event
            if (analytics) analytics.logEvent('withdrawal_initiated', { userId: telegramUser.id, currency, amount, fee });

            // Close modal and update UI immediately after deduction
            withdrawModal.style.display = 'none';
            await fetchAndUpdateUserData(); // Refresh global cache
            await updateUserStatsUI(); // Update header/wallet balances
            await updateTransactionHistory(); // Show the new pending transaction
            alert(`Withdrawal of ${amount.toFixed(4)} ${currency} initiated (Fee: ${fee.toFixed(currency === 'USDT' ? 2 : 3)} ${currency}). This is a simulation and may take a moment to complete.`);

        } catch (error) {
            console.error(`Withdrawal processing error: ${error.message}`);
            debugLog(`[WITHDRAW ERROR] Processing failed: ${error.message}`);
            alert(`Withdrawal failed: ${error.message}. Please try again.`);
            // Update history just in case (might show failed if tx record was created)
            await updateTransactionHistory();
        } finally {
             // Re-enable button if modal didn't close for some reason
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
        const claimButton = document.querySelector('#invite .claim-button');
        if(claimButton) claimButton.disabled = true;
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
        claimButton.textContent = 'Claim'; // Reset text
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
                return timeB - timeA;
            })
            .forEach(record => {
                const div = document.createElement('div');
                div.className = 'record-item';
                const claimTime = safeConvertToDate(record.claimTime)?.toLocaleString() || 'Invalid date';

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
                 const timeA = safeConvertToDate(a.joinTime)?.getTime() || 0;
                 const timeB = safeConvertToDate(b.joinTime)?.getTime() || 0;
                return timeB - timeA;
            })
             .forEach(record => {
                const div = document.createElement('div');
                div.className = 'record-item';
                 const joinTime = safeConvertToDate(record.joinTime)?.toLocaleString() || 'Invalid date';
                 const avatarLetter = (record.username || 'U')[0].toUpperCase();
                 const avatarColor = intToHSL(hashCode(record.userId || record.username || 'Default')); // Generate color based on ID/name

                div.innerHTML = `
                    <img src="https://via.placeholder.com/40/${avatarColor.substring(1)}/FFFFFF?text=${avatarLetter}" alt="${record.username || 'User'}">
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

// Simple hash function for color generation
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

// Convert integer hash to HSL color string (pastel range)
function intToHSL(h) {
  const hue = h % 360;
  const saturation = 70 + (h % 10); // Keep saturation relatively high but vary slightly
  const lightness = 75 + (h % 10); // Keep lightness high for pastel
  return `hsl(${hue},${saturation}%,${lightness}%)`;
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
        startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    } catch (e) {
        console.error("Error accessing Telegram start_param:", e);
        debugLog(`Error accessing start_param: ${e.message}`);
        return;
    }

    if (startParam && startParam.startsWith('ref_')) {
        const referrerId = startParam.split('_')[1];
        debugLog(`Referral parameter found: ref_${referrerId}`);

        if (!referrerId || !/^\d+$/.test(referrerId)) {
            debugLog(`Invalid referrerId format: ${referrerId}`);
            return;
        }

        const currentUserIdStr = telegramUser.id.toString();
        if (referrerId === currentUserIdStr) {
            debugLog("User referred themselves, skipping.");
            return;
        }

        const currentUserRef = db.collection('userData').doc(currentUserIdStr);
        const referrerRef = db.collection('userData').doc(referrerId);

        try {
            // Use transaction to ensure atomicity
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(currentUserRef);
                 // It's possible the user doc doesn't exist yet if init hasn't finished.
                 // If so, the referral can't be processed yet. Let initializeUserData handle creation.
                 // A more robust system might queue the referral, but this is simpler for now.
                if (!userDoc.exists) {
                     debugLog(`User document ${currentUserIdStr} not found during referral transaction. Deferring.`);
                     // Throwing an error here would cancel the transaction attempt.
                     // Returning without throwing allows init to potentially handle later.
                     // However, the start_param might be lost by then.
                     // Safest might be to just log and let it fail silently if init hasn't run.
                     return;
                }
                const userData = userDoc.data();

                if (userData.isReferred) {
                    debugLog(`User ${currentUserIdStr} already referred by ${userData.referredBy}. Skipping transaction.`);
                    return; // Exit transaction without changes
                }

                const referrerDoc = await transaction.get(referrerRef);
                if (!referrerDoc.exists) {
                     debugLog(`Referrer document ${referrerId} not found. Cannot process referral.`);
                     // Throw an error to cancel the transaction? Or just log?
                     // Let's just log and exit the transaction silently.
                     return;
                }

                // --- Process the referral within the transaction ---
                debugLog(`Processing referral via transaction: User ${currentUserIdStr} referred by ${referrerId}`);

                // 1. Update the current user
                transaction.update(currentUserRef, {
                    isReferred: true,
                    referredBy: referrerId
                });

                // 2. Update the referrer
                const referralCreditAmount = 100;
                const newInviteRecord = {
                    userId: currentUserIdStr,
                    username: telegramUser.username || telegramUser.first_name || `User_${currentUserIdStr.slice(-4)}`,
                    joinTime: firebase.firestore.FieldValue.serverTimestamp(), // Use server time
                    creditAwarded: referralCreditAmount,
                };

                transaction.update(referrerRef, {
                    referrals: firebase.firestore.FieldValue.increment(1),
                    referralCredits: firebase.firestore.FieldValue.increment(referralCreditAmount),
                    inviteRecords: firebase.firestore.FieldValue.arrayUnion(newInviteRecord)
                });
            }); // End of transaction

            // Transaction likely succeeded if no error was thrown
            debugLog("Referral transaction completed successfully.");
            if (analytics) analytics.logEvent('referral_success', { userId: currentUserIdStr, referrerId });
            // Optionally refresh data if needed immediately, but UI updates usually handle it.
            // await fetchAndUpdateUserData();

        } catch (error) {
            // Transaction failed or error occurred during checks before transaction.get
            console.error("Error processing referral transaction:", error);
            debugLog(`Error processing referral transaction: ${error.message}`);
            // Don't alert user
        }
    } else {
        debugLog("No referral parameter found or not in 'ref_' format.");
    }
}


function setupInviteButtons() {
    const inviteButton = document.querySelector('.invite-friend');
    const copyLinkButton = document.querySelector('.copy-link');
    const claimButton = document.querySelector('#invite .claim-button'); // More specific selector

    // Use cloning to ensure old listeners are removed
    if (inviteButton) {
        const newInviteButton = inviteButton.cloneNode(true);
        inviteButton.parentNode.replaceChild(newInviteButton, inviteButton);
        newInviteButton.addEventListener('click', handleInviteFriendClick);
        debugLog("Invite Friend button listener attached.");
    } else { debugLog("[INVITE WARN] Invite Friend button not found."); }

    if (copyLinkButton) {
         const newCopyLinkButton = copyLinkButton.cloneNode(true);
         copyLinkButton.parentNode.replaceChild(newCopyLinkButton, copyLinkButton);
         newCopyLinkButton.addEventListener('click', handleCopyLinkClick);
         debugLog("Copy Link button listener attached.");
    } else { debugLog("[INVITE WARN] Copy Link button not found."); }

    if (claimButton) {
         const newClaimButton = claimButton.cloneNode(true);
         claimButton.parentNode.replaceChild(newClaimButton, claimButton);
         newClaimButton.addEventListener('click', handleClaimCreditsClick);
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
         const text = encodeURIComponent("Join me on 4Metas and earn rewards!"); // Example text
         window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`);
    } else {
        alert("Please copy the link manually to share."); // Fallback
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
            // Optional: Visual feedback like changing button text temporarily
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => { button.textContent = originalText; }, 2000);
        }).catch(err => {
            console.error("Failed to copy link:", err);
            alert("Failed to copy link. Please copy it manually.");
            debugLog("[INVITE ERROR] Failed to copy link using navigator.clipboard:", err);
        });
    } else {
        alert("Clipboard access not available. Please copy the link manually.");
        debugLog("[INVITE WARN] navigator.clipboard API not available.");
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
    const txCollectionRef = userDocRef.collection('transactions'); // For transaction history

    try {
        let usdtToClaim = 0;
        let creditsToSpend = 0;

        // Use a transaction for atomicity
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists) {
                throw new Error("User data not found for claim.");
            }

            const data = userDoc.data();
            const currentCredits = data.referralCredits || 0;
            const conversionRate = 10000;
            const minimumClaim = 10000;

            debugLog(`[CREDIT CLAIM] Transaction Check: Current credits: ${currentCredits}`);

            if (currentCredits < minimumClaim) {
                throw new Error(`Insufficient credits. Minimum ${minimumClaim.toLocaleString()} required.`);
            }

            usdtToClaim = Math.floor(currentCredits / conversionRate);
            creditsToSpend = usdtToClaim * conversionRate;

            if (usdtToClaim <= 0) {
                 throw new Error("Calculated claim amount is zero or less.");
            }

            debugLog(`[CREDIT CLAIM] Transaction Proceed: Claiming ${usdtToClaim} USDT for ${creditsToSpend} credits.`);
            claimButton.textContent = 'Claiming...'; // UI feedback

            const claimRecord = {
                claimTime: firebase.firestore.FieldValue.serverTimestamp(),
                usdtAmount: usdtToClaim,
                creditsSpent: creditsToSpend,
                rate: conversionRate
            };
            const transactionRecord = { // Record for transaction history
                txId: `claim_${Date.now()}`,
                userId: telegramUser.id.toString(),
                type: 'credit_claim',
                usdtAmount: usdtToClaim,
                creditsSpent: creditsToSpend,
                status: 'completed', // Claim is instant
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Perform updates within the transaction
            transaction.update(userDocRef, {
                usdt: firebase.firestore.FieldValue.increment(usdtToClaim),
                referralCredits: firebase.firestore.FieldValue.increment(-creditsToSpend),
                claimHistory: firebase.firestore.FieldValue.arrayUnion(claimRecord)
            });
            // Add transaction history record (use set in transaction)
            transaction.set(txCollectionRef.doc(transactionRecord.txId), transactionRecord);

        }); // End of transaction

        // Transaction successful
        debugLog(`[CREDIT CLAIM] Transaction successful. Claimed ${usdtToClaim} USDT for ${creditsToSpend} credits.`);
        alert(`Successfully claimed ${usdtToClaim.toFixed(4)} USDT for ${creditsToSpend.toLocaleString()} credits!`);
        if (analytics) analytics.logEvent('credit_claim', { userId: telegramUser.id, usdt: usdtToClaim, credits: creditsToSpend });

        // Update UI *after* successful transaction
        await fetchAndUpdateUserData(); // Refresh cache
        await updateUserStatsUI();
        await updateInviteSectionUI(); // Re-renders lists and updates button state
        await updateTransactionHistory(); // Show the new claim in history

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
        return;
     }

    // Update Slider Content position
    chestContainer.style.transform = `translateX(-${currentChestIndex * 100}%)`;


    // --- Update Cost/VIP/Button State for the *currently selected* chest ---
     const userData = currentUserData; // Use cached user data
     const userVipLevel = userData?.vipLevel || 0;
     const userGems = userData?.gems || 0;

     // debugLog(`[CHEST CHECK] User VIP: ${userVipLevel}, User Gems: ${userGems.toLocaleString()}, Chest: ${chest.name} (Needs VIP ${chest.vip}, Cost ${chest.gemCost.toLocaleString()})`); // Reduce noise

     vipRequirementDisplay.style.display = 'none';
     chestCostDisplay.style.display = 'none';
     openButton.disabled = false; // Enable button by default
     chestCostDisplay.style.color = ''; // Reset cost color
     openButton.textContent = 'Open Chest'; // Reset button text

    // Check VIP Level
     if (chest.vip > userVipLevel) {
         vipRequirementDisplay.textContent = `NEED VIP ${chest.vip}`;
         vipRequirementDisplay.style.display = 'block';
         openButton.disabled = true;
         openButton.textContent = `VIP ${chest.vip} Required`;
         // debugLog(`[CHEST] VIP ${chest.vip} required, user has ${userVipLevel}. Button disabled.`); // Reduce noise
     } else {
         // VIP level met, show cost and check gems
         vipRequirementDisplay.style.display = 'none';
         chestCostAmount.textContent = chest.gemCost.toLocaleString();
         chestCostDisplay.style.display = 'flex';

         // Check Gems
         if (userGems < chest.gemCost) {
             openButton.disabled = true;
             chestCostDisplay.style.color = '#ffcc00'; // Make cost yellow if not enough
             // debugLog(`[CHEST] Insufficient gems. Need ${chest.gemCost.toLocaleString()}, user has ${userGems.toLocaleString()}. Button disabled.`); // Reduce noise
         } else {
             // Meets VIP and Gem requirements
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

     // Add event listeners using cloning to remove old ones
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

     updateChestUI(); // Initial UI update for the first chest
}


function prevChest() {
    // debugLog("Prev Chest button clicked."); // Reduce noise
    if (currentChestIndex > 0) {
        currentChestIndex--;
        updateChestUI();
    }
}

function nextChest() {
    // debugLog("Next Chest button clicked."); // Reduce noise
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

     if (!telegramUser || !telegramUser.id) { alert("User not identified."); updateChestUI(); return; } // Update UI restores button
     if (!firebaseInitialized || !db) { alert("Database not ready."); updateChestUI(); return; }

     const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
     const rankingDocRef = db.collection('users').doc(telegramUser.id.toString());

     try {
          // Fetch latest data using a transaction for atomic check-and-update
          let rewards = {}; // Scope for alert
          await db.runTransaction(async (transaction) => {
             const userDoc = await transaction.get(userDocRef);
             if (!userDoc.exists) throw new Error("User data not found to open chest.");
             const userData = userDoc.data();

             const currentGems = userData.gems || 0;
             const userVipLevel = userData.vipLevel || 0;

             debugLog(`[CHEST ACTION CHECK] Transaction: Need VIP ${chest.vip} (Have ${userVipLevel}), Need Gems ${chest.gemCost.toLocaleString()} (Have ${currentGems.toLocaleString()})`);

             if (chest.vip > userVipLevel) throw new Error(`VIP Level ${chest.vip} required.`);
             if (currentGems < chest.gemCost) throw new Error(`Insufficient gems. Need ${chest.gemCost.toLocaleString()}, have ${currentGems.toLocaleString()}.`);

             // Calculate Rewards (inside transaction to ensure consistency if needed, though random is usually ok outside)
             rewards = {
                 usdt: parseFloat((Math.random() * (chest.gemCost / 4000) + (chest.gemCost / 10000)).toFixed(4)),
                 landPiece: Math.random() < (0.05 + currentChestIndex * 0.02) ? 1 : 0,
                 foxMedal: Math.floor(Math.random() * (currentChestIndex + 1) * 1.5) + 1
             };
             debugLog("[CHEST ACTION] Calculated rewards:", rewards);

             // Prepare updates for user data
             const updates = {
                 gems: firebase.firestore.FieldValue.increment(-chest.gemCost),
                 usdt: firebase.firestore.FieldValue.increment(rewards.usdt),
                 landPieces: firebase.firestore.FieldValue.increment(rewards.landPiece),
                 foxMedals: firebase.firestore.FieldValue.increment(rewards.foxMedal)
             };
             transaction.update(userDocRef, updates);

             // Update ranking document if medals were awarded
             if (rewards.foxMedal > 0) {
                 // Use set with merge to handle potential non-existence safely within transaction
                 transaction.set(rankingDocRef, {
                     foxMedals: firebase.firestore.FieldValue.increment(rewards.foxMedal),
                     // Ensure username/photo are present/updated in ranking if needed
                     username: userData.username || telegramUser.username || telegramUser.first_name || `User_${telegramUser.id.toString().slice(-4)}`,
                     photoUrl: userData.photoUrl || telegramUser.photo_url || 'assets/icons/user-avatar.png'
                 }, { merge: true });
             }
         }); // End transaction

         // Transaction successful
         debugLog(`[CHEST ACTION] Transaction successful. Deducted ${chest.gemCost.toLocaleString()} gems. Added rewards.`);
         if (analytics) analytics.logEvent('chest_opened', { userId: telegramUser.id, chestName: chest.name, cost: chest.gemCost, rewards });

         // Show Rewards
         let rewardString = `Opened ${chest.name}! Rewards:\n`;
         if (rewards.usdt > 0) rewardString += `- ${rewards.usdt.toFixed(4)} USDT\n`;
         if (rewards.landPiece > 0) rewardString += `- ${rewards.landPiece} Land Piece\n`;
         if (rewards.foxMedal > 0) rewardString += `- ${rewards.foxMedal} Fox Medal\n`;
         if (rewards.usdt <= 0 && rewards.landPiece <= 0 && rewards.foxMedal <= 0) {
            rewardString += "- Nothing this time!";
         }
         alert(rewardString);

         // Update UI after successful transaction
         await fetchAndUpdateUserData();
         await updateUserStatsUI();
         updateChestUI(); // Re-check requirements/costs & update button

     } catch (error) {
         console.error("Error opening chest:", error);
         debugLog(`[CHEST ERROR] ${error.message}`);
         alert(`Failed to open chest: ${error.message}`);
         // Ensure UI reflects actual state after failure
         await fetchAndUpdateUserData(); // Get potentially unchanged state
         updateChestUI(); // Reset button based on actual data
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
         const rankingsSnapshot = await db.collection('users') // Use 'users' collection for ranking
             .orderBy('foxMedals', 'desc')
             .limit(30)
             .get({ source: 'server' }); // Get fresh data

         const rankings = [];
         rankingsSnapshot.forEach(doc => {
             const data = doc.data();
             rankings.push({
                 id: doc.id,
                 username: data.username || 'Anonymous',
                 foxMedals: data.foxMedals || 0,
                 photoUrl: data.photoUrl || 'assets/icons/user-avatar.png'
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
    }

    // 2. Initialize Firebase (essential)
    const firebaseSuccess = await initializeFirebase();
    if (!firebaseSuccess) {
        debugLog("App Init Failed: Firebase could not be initialized.");
        alert("Critical Error: Cannot connect to the database. Please try restarting the app.");
        return;
    }

    // 3. Initialize User Data (creates record if needed, fetches into currentUserData)
    await ensureFirebaseReady(initializeUserData, 'initializeUserData');

    // 4. Handle Incoming Referrals (checks start_param AFTER user data might exist)
    await ensureFirebaseReady(handleReferral, 'handleReferral');

    // 5. Generate User's Referral Link (doesn't need await/Firebase)
    generateReferralLink();

    // 6. Initialize TON Connect
    await initializeTONConnect(); // Await completion

    // 7. Render Dynamic Components (Chests)
    renderChests(); // Doesn't need await/Firebase

    // 8. Setup Main Navigation (attaches listeners, sets default view)
    // This implicitly triggers the data load for the default section ('earn')
    setupNavigation();

    // 9. Automatic Ad Initialization (In-App Interstitial)
    try {
        if (typeof window.show_9180370 === 'function') {
            // *** UPDATED In-App Settings ***
            const autoInAppSettings = {
                frequency: 2,      // Max 2 ads per session
                capping: 0.0667,   // Session duration = 0.0667 hours (~4 minutes)
                interval: 30,      // Minimum 30 seconds between ads
                timeout: 5,        // 5-second delay before the *first* ad in a session might show
                everyPage: false   // Keep false unless needed on every navigation
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

    // 10. Final UI Updates (ensure stats are up-to-date after all init steps)
    await ensureFirebaseReady(updateUserStatsUI, 'finalUserStatsUpdate');
    // Wallet UI might also need a final refresh if state changed during init
    await ensureFirebaseReady(updateWalletSectionUI, 'finalWalletUpdate');


    debugLog("--- App Initialization Sequence Finished ---");
    if (analytics) analytics.logEvent('app_initialized', { userId: telegramUser?.id?.toString() || 'unknown' });
}


// --- DOMContentLoaded Listener ---
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    debugLog("DOM already loaded, initializing app shortly.");
    setTimeout(initializeApp, 0);
} else {
    debugLog("Waiting for DOMContentLoaded to initialize app.");
    document.addEventListener('DOMContentLoaded', () => {
        debugLog("DOMContentLoaded fired, initializing app.");
        initializeApp();
    });
}
