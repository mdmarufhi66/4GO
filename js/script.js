Console.log('[DEBUG] Script execution started.');

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
                if (attempts < retries) {
                    console.warn(`Failed to load script: ${src}. Retrying (${attempts}/${retries})...`);
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
    if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
        debugLog("Firebase detected in global scope, reusing existing instance.");
        app = window.firebase.apps[0];
        db = app.firestore();
        auth = app.auth();
        storage = app.storage();
        try { analytics = app.analytics(); } catch (e) { console.warn("Analytics setup failed:", e.message); }
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

            await Promise.all(scriptUrls.map(url => loadScript(url, 1)));
            if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
                throw new Error("Firebase SDK core not loaded correctly.");
            }

            if (firebase.apps.length === 0) {
                app = firebase.initializeApp(firebaseConfig);
                debugLog("Firebase app initialized.");
            } else {
                app = firebase.apps[0];
                debugLog("Reusing existing Firebase app instance.");
            }

            db = firebase.firestore();
            auth = firebase.auth();
            storage = firebase.storage();
            try { analytics = firebase.analytics(); } catch (e) { console.warn("Analytics setup failed:", e.message); }

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

        button.addEventListener('click', () => {
            debugLog(`[NAV] Click detected on button: ${sectionId}`);
            switchSection(sectionId);
        });

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
        if (sectionId === 'earn') await ensureFirebaseReady(updateEarnSectionUI, 'updateEarnSectionUI');
        else if (sectionId === 'invite') await ensureFirebaseReady(updateInviteSectionUI, 'updateInviteSectionUI');
        else if (sectionId === 'top') await ensureFirebaseReady(updateTopSectionUI, 'updateTopSectionUI');
        else if (sectionId === 'wallet') await ensureFirebaseReady(updateWalletSectionUI, 'updateWalletSectionUI');
        else if (sectionId === 'chest') await ensureFirebaseReady(updateUserStatsUI, 'updateChestUserStats');
        else {
            debugLog(`[NAV] No specific data load function for section: ${sectionId}`);
        }

        if (sectionId === 'chest') {
            updateChestUI();
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
                transactions: []
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
            if (userData.vipLevel === undefined) updates.vipLevel = 0;
            if (userData.adProgress === undefined) updates.adProgress = {};
            if (userData.claimedQuests === undefined) updates.claimedQuests = [];

            await userDocRef.update(updates);

            const rankDoc = await rankingDocRef.get();
            if (!rankDoc.exists) {
                const rankingEntry = {
                    username: telegramUser.username || telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                    foxMedals: userData.foxMedals || 0,
                    photoUrl: telegramUser.photo_url || 'assets/icons/user-avatar.png',
                    userId: userIdStr
                };
                await rankingDocRef.set(rankingEntry);
                debugLog("Created missing ranking entry for existing user.");
            } else {
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
        await updateUserStatsUI();
    } catch (error) {
        console.error("Error initializing/checking user data:", error);
        debugLog(`Error initializing user data for ${userIdStr}: ${error.message}`);
        alert("There was a problem loading your profile.");
    }
}

// Global variable to store fetched user data to reduce reads
let currentUserData = null;

async function fetchAndUpdateUserData() {
    if (!telegramUser || !telegramUser.id || !firebaseInitialized || !db) {
        debugLog("User data fetch skipped: Conditions not met.");
        currentUserData = null;
        return null;
    }
    try {
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            debugLog("User doc not found during fetch.");
            currentUserData = null;
            return null;
        }
        currentUserData = userDoc.data();
        return currentUserData;
    } catch (error) {
        console.error("Error fetching user data:", error);
        debugLog(`Error fetching user data: ${error.message}`);
        currentUserData = null;
        return null;
    }
}

async function updateUserStatsUI() {
    const data = currentUserData || await fetchAndUpdateUserData();

    if (!data) {
        debugLog("Stats UI update skipped: No user data available.");
        document.getElementById('gems').textContent = 0;
        document.getElementById('usdt').textContent = '0.0000';
        document.getElementById('ton').textContent = '0.0000';
        return;
    }

    document.getElementById('gems').textContent = data.gems || 0;
    document.getElementById('usdt').textContent = (data.usdt || 0).toFixed(4);
    document.getElementById('ton').textContent = (data.ton || 0).toFixed(4);
}

// --- Earn Section (Quests) ---
async function updateEarnSectionUI() {
    debugLog("Updating Earn section UI...");
    let userData = currentUserData || await fetchAndUpdateUserData();
    if (!userData) {
        debugLog("Earn section UI update skipped: No user data.");
        return;
    }

    const dailyQuestList = document.getElementById('daily-quest-list');
    const basicQuestList = document.getElementById('basic-quest-list');
    const dailyQuestCount = document.getElementById('daily-quest-count');
    const basicQuestCount = document.getElementById('basic-quest-count');

    try {
        const questsSnapshot = await db.collection('quests').get();
        if (questsSnapshot.empty) {
            debugLog("No quests found in Firestore.");
            dailyQuestList.innerHTML = '<li class="no-quests"><p>No quests available.</p></li>';
            basicQuestList.innerHTML = '<li class="no-quests"><p>No quests available.</p></li>';
            dailyQuestCount.textContent = '0';
            basicQuestCount.textContent = '0';
            return;
        }

        const dailyQuests = [];
        const basicQuests = [];
        questsSnapshot.forEach(doc => {
            const quest = { id: doc.id, ...doc.data() };
            if (quest.type === 'daily') dailyQuests.push(quest);
            else if (quest.type === 'basic') basicQuests.push(quest);
        });

        dailyQuestCount.textContent = dailyQuests.length;
        basicQuestCount.textContent = basicQuests.length;

        // Initialize adProgress if not exists
        if (!userData.adProgress) {
            userData.adProgress = {};
            await db.collection('userData').doc(telegramUser.id.toString()).update({ adProgress: {} });
        }

        dailyQuestList.innerHTML = '';
        if (dailyQuests.length === 0) {
            dailyQuestList.innerHTML = '<li class="no-quests"><p>No daily quests available.</p></li>';
        } else {
            dailyQuests.forEach(quest => {
                const li = createQuestItem(quest, userData);
                dailyQuestList.appendChild(li);
            });
        }

        basicQuestList.innerHTML = '';
        if (basicQuests.length === 0) {
            basicQuestList.innerHTML = '<li class="no-quests"><p>No basic quests available.</p></li>';
        } else {
            basicQuests.forEach(quest => {
                const li = createQuestItem(quest, userData);
                basicQuestList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error fetching quests:", error);
        debugLog(`Error fetching quests: ${error.message}`);
        dailyQuestList.innerHTML = '<li class="error"><p>Error loading quests. Please try again.</p></li>';
        basicQuestList.innerHTML = '<li class="error"><p>Error loading quests. Please try again.</p></li>';
        dailyQuestCount.textContent = '0';
        basicQuestCount.textContent = '0';
    }
}

function createQuestItem(quest, userData) {
    const li = document.createElement('li');
    li.className = 'quest-item';
    li.innerHTML = `
        <img src="${quest.icon || 'assets/icons/quest_placeholder.png'}" alt="${quest.title}">
        <span>${quest.title}</span>
        <div class="quest-reward">
            <img src="assets/icons/gem.png" alt="Gem">
            <span>${quest.reward}</span>
        </div>
    `;

    const isRepeatable = quest.repeatable !== false;
    const isAdBased = quest.action === 'watch_ad';
    const isClaimed = userData.claimedQuests?.includes(quest.id);
    let adProgress = userData.adProgress[quest.id] || { watched: 0, claimed: false, lastClaimed: null };
    const adsRequired = quest.adsRequired || 1;

    if (isAdBased && !adProgress.lastClaimed) {
        adProgress.lastClaimed = null;
    }

    const canClaimToday = isRepeatable || !isClaimed;
    const isDaily = quest.type === 'daily';
    let canClaim = false;

    if (isAdBased) {
        const progress = adProgress.watched || 0;
        li.innerHTML += `<span class="progress">${progress}/${adsRequired}</span>`;
        canClaim = progress >= adsRequired && !adProgress.claimed && canClaimToday;
    } else {
        canClaim = canClaimToday;
    }

    const button = document.createElement('button');
    if (!canClaimToday || (isAdBased && adProgress.claimed)) {
        button.className = 'claimed-button';
        button.textContent = 'Claimed';
        button.disabled = true;
    } else if (canClaim) {
        button.className = 'claim-button active';
        button.textContent = 'Claim';
    } else {
        button.className = 'go-button';
        button.textContent = isAdBased ? 'Watch Ad' : 'Go';
    }

    button.addEventListener('click', async () => {
        if (button.classList.contains('claimed-button')) return;

        if (isAdBased && !canClaim) {
            await handleAdQuest(quest, adProgress, button, li);
        } else if (canClaim) {
            await claimQuest(quest, button, li);
        } else {
            debugLog(`Quest action triggered: ${quest.action}`);
            if (quest.link) {
                window.open(quest.link, '_blank');
            }
        }
    });

    li.appendChild(button);
    return li;
}

async function handleAdQuest(quest, adProgress, button, li) {
    debugLog(`Handling ad quest: ${quest.id}`);
    button.disabled = true;
    try {
        const success = await showAd(quest.id);
        if (success) {
            adProgress.watched = (adProgress.watched || 0) + 1;
            const adsRequired = quest.adsRequired || 1;
            adProgress.claimed = adProgress.watched >= adsRequired;

            await db.collection('userData').doc(telegramUser.id.toString()).update({
                [`adProgress.${quest.id}`]: adProgress
            });

            await fetchAndUpdateUserData();
            updateQuestItemUI(quest, li, button);
        } else {
            debugLog(`Ad watch failed or was not completed for quest: ${quest.id}`);
            alert("Ad was not completed. Please try again.");
        }
    } catch (error) {
        console.error("Error handling ad quest:", error);
        debugLog(`Error handling ad quest ${quest.id}: ${error.message}`);
        alert("Error playing ad. Please try again.");
    } finally {
        button.disabled = false;
    }
}

async function showAd(questId) {
    debugLog(`Attempting to show ad for quest: ${questId}`);
    if (!window.Monetag || !window.Monetag.show) {
        console.error("Monetag SDK not loaded or unavailable.");
        debugLog("Monetag SDK not loaded or unavailable.");
        return false;
    }

    const adType = 'rewarded_interstitial'; // Default ad type
    return new Promise((resolve) => {
        let adCompleted = false;
        const timeout = setTimeout(() => {
            if (!adCompleted) {
                debugLog(`Ad timeout after 30s for quest: ${questId}`);
                resolve(false);
            }
        }, 30000);

        try {
            window.Monetag.show(adType, {
                onReady: () => {
                    debugLog(`Ad ready to display: ${adType} for quest: ${questId}`);
                },
                onImpression: () => {
                    debugLog(`Ad impression recorded for quest: ${questId}`);
                },
                onComplete: () => {
                    clearTimeout(timeout);
                    adCompleted = true;
                    debugLog(`Ad completed successfully for quest: ${questId}`);
                    resolve(true);
                },
                onError: (error) => {
                    clearTimeout(timeout);
                    console.error(`Ad error for quest ${questId}:`, error);
                    debugLog(`Ad error for quest ${questId}: ${error.message || error}`);
                    resolve(false);
                }
            });
        } catch (error) {
            clearTimeout(timeout);
            console.error(`Error triggering ad for quest ${questId}:`, error);
            debugLog(`Error triggering ad for quest ${questId}: ${error.message}`);
            resolve(false);
        }
    });
}

async function claimQuest(quest, button, li) {
    debugLog(`Claiming quest: ${quest.id}`);
    if (!telegramUser || !telegramUser.id || !firebaseInitialized || !db) {
        debugLog("Quest claim skipped: Conditions not met.");
        alert("Cannot claim quest at this time.");
        return;
    }

    button.disabled = true;
    try {
        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            debugLog("User not found during quest claim.");
            alert("User data not found.");
            return;
        }

        let userData = userDoc.data();
        const isRepeatable = quest.repeatable !== false;
        const isAdBased = quest.action === 'watch_ad';
        let adProgress = userData.adProgress?.[quest.id] || { watched: 0, claimed: false, lastClaimed: null };

        if (!isRepeatable && userData.claimedQuests?.includes(quest.id)) {
            debugLog(`Quest ${quest.id} already claimed and not repeatable.`);
            alert("This quest has already been claimed.");
            return;
        }

        if (isAdBased && (!adProgress || adProgress.watched < (quest.adsRequired || 1))) {
            debugLog(`Quest ${quest.id} cannot be claimed: Insufficient ad progress.`);
            alert("You haven't watched enough ads to claim this quest.");
            return;
        }

        const updates = {
            gems: firebase.firestore.FieldValue.increment(quest.reward)
        };

        if (!isRepeatable) {
            updates.claimedQuests = firebase.firestore.FieldValue.arrayUnion(quest.id);
        }

        if (isAdBased) {
            adProgress.claimed = true;
            adProgress.lastClaimed = firebase.firestore.FieldValue.serverTimestamp();
            updates[`adProgress.${quest.id}`] = adProgress;
        }

        await userDocRef.update(updates);
        debugLog(`Quest ${quest.id} claimed successfully. Reward: ${quest.reward} gems`);

        await fetchAndUpdateUserData();
        updateUserStatsUI();
        updateQuestItemUI(quest, li, button);

        if (analytics) analytics.logEvent('quest_completed', {
            questId: quest.id,
            questType: quest.type,
            reward: quest.reward
        });
    } catch (error) {
        console.error("Error claiming quest:", error);
        debugLog(`Error claiming quest ${quest.id}: ${error.message}`);
        alert("Error claiming quest. Please try again.");
    } finally {
        button.disabled = false;
    }
}

function updateQuestItemUI(quest, li, button) {
    const userData = currentUserData;
    if (!userData) return;

    const isRepeatable = quest.repeatable !== false;
    const isAdBased = quest.action === 'watch_ad';
    const isClaimed = userData.claimedQuests?.includes(quest.id);
    let adProgress = userData.adProgress?.[quest.id] || { watched: 0, claimed: false, lastClaimed: null };
    const adsRequired = quest.adsRequired || 1;

    const canClaimToday = isRepeatable || !isClaimed;
    let canClaim = false;

    if (isAdBased) {
        const progressSpan = li.querySelector('.progress');
        if (progressSpan) {
            progressSpan.textContent = `${adProgress.watched}/${adsRequired}`;
        }
        canClaim = adProgress.watched >= adsRequired && !adProgress.claimed && canClaimToday;
    } else {
        canClaim = canClaimToday;
    }

    if (!canClaimToday || (isAdBased && adProgress.claimed)) {
        button.className = 'claimed-button';
        button.textContent = 'Claimed';
        button.disabled = true;
    } else if (canClaim) {
        button.className = 'claim-button active';
        button.textContent = 'Claim';
        button.disabled = false;
    } else {
        button.className = 'go-button';
        button.textContent = isAdBased ? 'Watch Ad' : 'Go';
        button.disabled = false;
    }
}

// --- Wallet Section ---
async function initializeTONConnect() {
    debugLog("Initializing TON Connect...");
    try {
        await loadScript('https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js');
        if (!window.TONConnectUI) {
            throw new Error("TONConnectUI not loaded.");
        }

        tonConnectUI = new window.TONConnectUI({
            manifestUrl: 'https://fourgo.app/tonconnect-manifest.json',
            buttonRootId: 'ton-connect-button'
        });

        const connectButton = document.querySelector('.connect-button');
        if (connectButton) {
            connectButton.addEventListener('click', async () => {
                try {
                    await tonConnectUI.connectWallet();
                    debugLog("Wallet connection initiated.");
                } catch (error) {
                    console.error("Error connecting wallet:", error);
                    debugLog(`Error connecting wallet: ${error.message}`);
                    alert("Failed to connect wallet.");
                }
            });
        }

        tonConnectUI.onStatusChange(wallet => {
            updateWalletSectionUI();
            debugLog("Wallet status changed:", wallet);
        });

        debugLog("TON Connect initialized successfully.");
    } catch (error) {
        console.error("TON Connect initialization failed:", error);
        debugLog(`TON Connect initialization failed: ${error.message}`);
        alert("Could not initialize wallet features.");
    }
}

async function updateWalletSectionUI() {
    debugLog("Updating Wallet section UI...");
    const userData = currentUserData || await fetchAndUpdateUserData();
    if (!userData) {
        debugLog("Wallet UI update skipped: No user data.");
        return;
    }

    const walletStatus = document.getElementById('connection-status');
    const connectButton = document.querySelector('.connect-button');
    const usdtBalance = document.getElementById('wallet-usdt');
    const tonBalance = document.getElementById('wallet-ton');
    const transactionList = document.getElementById('transaction-list');
    const usdtWithdrawButton = document.querySelector('.usdt-card .withdraw-button');
    const tonWithdrawButton = document.querySelector('.ton-card .withdraw-button');

    if (!tonConnectUI) {
        walletStatus.textContent = 'Disconnected';
        connectButton.textContent = 'CONNECT TON WALLET';
        connectButton.classList.remove('connected');
        usdtWithdrawButton.disabled = true;
        tonWithdrawButton.disabled = true;
        return;
    }

    const walletInfo = tonConnectUI.wallet;
    if (walletInfo) {
        walletStatus.textContent = 'Connected';
        walletStatus.classList.remove('disconnected');
        walletStatus.classList.add('connected');
        connectButton.textContent = 'DISCONNECT WALLET';
        connectButton.classList.add('connected');
        usdtWithdrawButton.disabled = userData.usdt <= 0;
        tonWithdrawButton.disabled = userData.ton <= 0;

        await db.collection('userData').doc(telegramUser.id.toString()).update({
            walletAddress: walletInfo.account.address
        });
    } else {
        walletStatus.textContent = 'Disconnected';
        walletStatus.classList.remove('connected');
        walletStatus.classList.add('disconnected');
        connectButton.textContent = 'CONNECT TON WALLET';
        connectButton.classList.remove('connected');
        usdtWithdrawButton.disabled = true;
        tonWithdrawButton.disabled = true;
    }

    usdtBalance.textContent = (userData.usdt || 0).toFixed(4);
    tonBalance.textContent = (userData.ton || 0).toFixed(4);

    try {
        const transactionsSnapshot = await db.collection('userData')
            .doc(telegramUser.id.toString())
            .collection('transactions')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        transactionList.innerHTML = '';
        if (transactionsSnapshot.empty) {
            transactionList.innerHTML = '<li>No transactions yet</li>';
        } else {
            transactionsSnapshot.forEach(doc => {
                const tx = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${tx.type} ${tx.amount} ${tx.currency}</span>
                    <span class="tx-status ${tx.status}">${tx.status}</span>
                `;
                transactionList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
        debugLog(`Error fetching transactions: ${error.message}`);
        transactionList.innerHTML = '<li>Error loading transactions</li>';
    }

    setupWithdrawModal();
}

function setupWithdrawModal() {
    const usdtWithdrawButton = document.querySelector('.usdt-card .withdraw-button');
    const tonWithdrawButton = document.querySelector('.ton-card .withdraw-button');
    const withdrawModal = document.getElementById('withdraw-modal');
    const confirmButton = document.getElementById('confirm-withdraw');
    const cancelButton = document.getElementById('cancel-withdraw');
    const amountInput = document.getElementById('withdraw-amount');
    const availableBalanceSpan = document.getElementById('available-balance');
    const currencySpan = document.getElementById('currency');
    const feeSpan = document.getElementById('withdraw-fee');
    const feeCurrencySpan = document.getElementById('fee-currency');

    const showModal = (currency, availableBalance) => {
        withdrawModal.style.display = 'flex';
        availableBalanceSpan.textContent = availableBalance.toFixed(4);
        currencySpan.textContent = currency;
        feeCurrencySpan.textContent = currency;
        const fee = currency === 'USDT' ? 0.1 : 0.01;
        feeSpan.textContent = fee.toFixed(4);
        amountInput.value = '';
        amountInput.max = availableBalance;
    };

    usdtWithdrawButton.addEventListener('click', () => {
        const userData = currentUserData;
        if (userData && userData.usdt > 0) {
            showModal('USDT', userData.usdt);
        }
    });

    tonWithdrawButton.addEventListener('click', () => {
        const userData = currentUserData;
        if (userData && userData.ton > 0) {
            showModal('TON', userData.ton);
        }
    });

    cancelButton.addEventListener('click', () => {
        withdrawModal.style.display = 'none';
    });

    confirmButton.addEventListener('click', async () => {
        const amount = parseFloat(amountInput.value);
        const currency = currencySpan.textContent;
        const fee = parseFloat(feeSpan.textContent);
        const available = parseFloat(availableBalanceSpan.textContent);

        if (!amount || amount <= 0 || amount > available) {
            alert("Invalid amount.");
            return;
        }

        try {
            const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
            await userDocRef.update({
                [currency.toLowerCase()]: firebase.firestore.FieldValue.increment(-amount),
                transactions: firebase.firestore.FieldValue.arrayUnion({
                    type: 'Withdrawal',
                    amount: amount,
                    currency: currency,
                    status: 'pending',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                })
            });

            await fetchAndUpdateUserData();
            updateWalletSectionUI();
            withdrawModal.style.display = 'none';
            alert(`Withdrawal of ${amount} ${currency} initiated.`);
        } catch (error) {
            console.error("Error processing withdrawal:", error);
            debugLog(`Error processing withdrawal: ${error.message}`);
            alert("Error processing withdrawal.");
        }
    });
}

// --- Invite Section ---
async function updateInviteSectionUI() {
    debugLog("Updating Invite section UI...");
    const userData = currentUserData || await fetchAndUpdateUserData();
    if (!userData) {
        debugLog("Invite UI update skipped: No user data.");
        return;
    }

    const inviteCount = document.getElementById('my-invite');
    const totalCredit = document.getElementById('total-credit-text');
    const claimRecordList = document.getElementById('claim-record-list');
    const claimRecordPlaceholder = document.getElementById('claim-record-placeholder');
    const inviteRecordList = document.getElementById('invite-record-list');
    const inviteRecordPlaceholder = document.getElementById('invite-record-placeholder');
    const inviteRecordTitle = document.getElementById('invite-record-title');

    inviteCount.textContent = `My Invite: ${userData.referrals || 0}`;
    totalCredit.innerHTML = `Total Credit <span class="warning">!</span> : ${userData.referralCredits || 0}`;

    claimRecordList.innerHTML = '';
    if (!userData.claimHistory || userData.claimHistory.length === 0) {
        claimRecordPlaceholder.style.display = 'block';
    } else {
        claimRecordPlaceholder.style.display = 'none';
        userData.claimHistory.forEach(record => {
            const div = document.createElement('div');
            div.className = 'record-item';
            div.innerHTML = `
                <img src="${record.photoUrl || 'assets/icons/user-avatar.png'}" alt="User">
                <div class="user-info">
                    <span>${record.username || 'Unknown'}</span>
                    <small>${new Date(record.timestamp?.toDate()).toLocaleString()}</small>
                </div>
                <span class="credit">${record.credit}</span>
            `;
            claimRecordList.appendChild(div);
        });
    }

    inviteRecordList.innerHTML = '';
    if (!userData.inviteRecords || userData.inviteRecords.length === 0) {
        inviteRecordPlaceholder.style.display = 'block';
        inviteRecordTitle.textContent = 'Invite Record (0)';
    } else {
        inviteRecordPlaceholder.style.display = 'none';
        inviteRecordTitle.textContent = `Invite Record (${userData.inviteRecords.length})`;
        userData.inviteRecords.forEach(record => {
            const div = document.createElement('div');
            div.className = 'record-item';
            div.innerHTML = `
                <img src="${record.photoUrl || 'assets/icons/user-avatar.png'}" alt="User">
                <div class="user-info">
                    <span>${record.username || 'Unknown'}</span>
                    <small>${new Date(record.joinTime?.toDate()).toLocaleString()}</small>
                </div>
                <span class="credit">${record.credit}</span>
            `;
            inviteRecordList.appendChild(div);
        });
    }

    setupInviteButtons();
}

function setupInviteButtons() {
    const inviteButton = document.querySelector('.invite-friend');
    const copyLinkButton = document.querySelector('.copy-link');
    const claimButton = document.querySelector('.claim-button');

    inviteButton.addEventListener('click', () => {
        const inviteLink = `https://t.me/FourMetasBot?start=${telegramUser.id}`;
        window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}`);
    });

    copyLinkButton.addEventListener('click', () => {
        const inviteLink = `https://t.me/FourMetasBot?start=${telegramUser.id}`;
        navigator.clipboard.writeText(inviteLink).then(() => {
            alert("Invite link copied to clipboard!");
        }).catch(err => {
            console.error("Failed to copy link:", err);
            alert("Failed to copy link.");
        });
    });

    claimButton.addEventListener('click', async () => {
        const userData = currentUserData || await fetchAndUpdateUserData();
        if (!userData || userData.referralCredits < 10000) {
            alert("Not enough credits to claim (minimum 10,000 credits).");
            return;
        }

        try {
            const usdtToAdd = userData.referralCredits / 10000;
            const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
            await userDocRef.update({
                referralCredits: 0,
                usdt: firebase.firestore.FieldValue.increment(usdtToAdd),
                claimHistory: firebase.firestore.FieldValue.arrayUnion({
                    username: telegramUser.username || telegramUser.first_name,
                    photoUrl: telegramUser.photo_url || 'assets/icons/user-avatar.png',
                    credit: userData.referralCredits,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                })
            });

            await fetchAndUpdateUserData();
            updateInviteSectionUI();
            updateUserStatsUI();
            alert(`Successfully claimed ${usdtToAdd} USDT!`);
        } catch (error) {
            console.error("Error claiming credits:", error);
            debugLog(`Error claiming credits: ${error.message}`);
            alert("Error claiming credits.");
        }
    });
}

// --- Chest Section ---
function updateChestUI() {
    debugLog("Updating Chest section UI...");
    const chestContainer = document.getElementById('chestContainer');
    const chestCost = document.getElementById('chest-cost-amount');
    const vipRequirement = document.getElementById('chestVipRequirement');
    const openButton = document.querySelector('.open-chest-button');

    const chest = chests[currentChestIndex];
    chestContainer.innerHTML = `
        <div class="chest-item">
            <div class="chest-title">
                <h2>${chest.name}</h2>
                <span>Next: ${chest.next || 'None'}</span>
            </div>
            <div class="chest-image">
                <img src="${chest.image}" alt="${chest.name}">
            </div>
        </div>
    `;
    chestCost.textContent = chest.gemCost;

    const userData = currentUserData;
    if (userData && userData.vipLevel < chest.vip) {
        vipRequirement.textContent = `NEED VIP ${chest.vip}`;
        vipRequirement.style.display = 'block';
        openButton.disabled = true;
    } else {
        vipRequirement.style.display = 'none';
        openButton.disabled = userData && userData.gems < chest.gemCost;
    }
}

function prevChest() {
    if (currentChestIndex > 0) {
        currentChestIndex--;
        updateChestUI();
    }
}

function nextChest() {
    if (currentChestIndex < chests.length - 1) {
        currentChestIndex++;
        updateChestUI();
    }
}

async function openChest() {
    debugLog("Opening chest...");
    const chest = chests[currentChestIndex];
    const userData = currentUserData || await fetchAndUpdateUserData();
    if (!userData) {
        alert("User data not available.");
        return;
    }

    if (userData.gems < chest.gemCost) {
        alert("Not enough gems to open this chest.");
        return;
    }

    if (userData.vipLevel < chest.vip) {
        alert(`VIP level ${chest.vip} required to open this chest.`);
        return;
    }

    try {
        const rewards = [
            { type: 'usdt', amount: Math.random() * 0.5 },
            { type: 'land_piece', amount: 1 },
            { type: 'fox_medal', amount: 1 }
        ];
        const reward = rewards[Math.floor(Math.random() * rewards.length)];

        const userDocRef = db.collection('userData').doc(telegramUser.id.toString());
        const rankingDocRef = db.collection('users').doc(telegramUser.id.toString());
        const updates = {
            gems: firebase.firestore.FieldValue.increment(-chest.gemCost)
        };

        if (reward.type === 'usdt') {
            updates.usdt = firebase.firestore.FieldValue.increment(reward.amount);
        } else if (reward.type === 'land_piece') {
            updates.landPieces = firebase.firestore.FieldValue.increment(reward.amount);
        } else if (reward.type === 'fox_medal') {
            updates.foxMedals = firebase.firestore.FieldValue.increment(reward.amount);
            await rankingDocRef.update({
                foxMedals: firebase.firestore.FieldValue.increment(reward.amount)
            });
        }

        await userDocRef.update(updates);
        await fetchAndUpdateUserData();
        updateUserStatsUI();
        updateChestUI();
        alert(`You opened a ${chest.name} and received ${reward.amount} ${reward.type.replace('_', ' ')}!`);
    } catch (error) {
        console.error("Error opening chest:", error);
        debugLog(`Error opening chest: ${error.message}`);
        alert("Error opening chest.");
    }
}

// --- Top Section (Rankings) ---
async function updateTopSectionUI() {
    debugLog("Updating Top section UI...");
    const rankingList = document.getElementById('ranking-list');

    try {
        const snapshot = await db.collection('users')
            .orderBy('foxMedals', 'desc')
            .limit(30)
            .get();

        rankingList.innerHTML = '';
        if (snapshot.empty) {
            rankingList.innerHTML = '<li class="no-rankings"><p>No rankings available.</p></li>';
            return;
        }

        snapshot.forEach(doc => {
            const user = doc.data();
            const li = document.createElement('li');
            li.className = 'ranking-item';
            li.innerHTML = `
                <img src="${user.photoUrl}" alt="${user.username}">
                <span>${user.username}</span>
                <div class="medal-count">
                    <img src="assets/icons/fox-medal.png" alt="Fox Medal">
                    <span>${user.foxMedals || 0}</span>
                </div>
            `;
            rankingList.appendChild(li);
        });
    } catch (error) {
        console.error("Error fetching rankings:", error);
        debugLog(`Error fetching rankings: ${error.message}`);
        rankingList.innerHTML = '<li class="no-rankings"><p>Error loading rankings.</p></li>';
    }
}

// --- Initialize App ---
async function initializeApp() {
    debugLog("Starting app initialization...");
    const telegramSuccess = initializeTelegram();
    if (!telegramSuccess) {
        debugLog("Proceeding with fallback Telegram user.");
    }

    await ensureFirebaseReady(async () => {
        await initializeUserData();
        setupNavigation();
        await initializeTONConnect();
        await updateEarnSectionUI();
        await updateWalletSectionUI();
        await updateInviteSectionUI();
        updateChestUI();
        await updateTopSectionUI();

        if (analytics) analytics.logEvent('app_initialized', {
            userId: telegramUser?.id?.toString() || 'unknown'
        });
    }, 'initializeApp');
}

document.addEventListener('DOMContentLoaded', initializeApp);
