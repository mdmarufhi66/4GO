// js/main.js

// --- Global Variables ---
// Firebase variables (initialized in firebaseService.js)
let app = null, db = null, auth = null, storage = null, analytics = null;
let firebaseInitialized = false;
// Telegram user info (initialized in telegramService.js)
let telegramUser = null;
// TON Connect UI instance (initialized in walletService.js)
let tonConnectUI = null;
// User data cache (initialized/updated in uiUpdater.js)
let currentUserData = null;
// Chest state (initialized/updated in chest.js) - Keep it here or in chest.js? Decision: Keep in chest.js for now.
// let currentChestIndex = 0;


// --- Main Initialization Function ---
async function initApp() {
    debugLog("--- App Initialization Sequence Start ---");

    // 1. Initialize Telegram Interface & Get User
    initializeTelegram(); // From telegramService.js
    // Update profile pic based on telegramUser (can be done here or in updateUserStatsUI)
    updateUserStatsUI(); // Initial update with default/test user potentially

    // 2. Initialize Firebase
    const firebaseSuccess = await initializeFirebase(); // From firebaseService.js
    if (!firebaseSuccess) {
        debugLog("App Init Failed: Firebase could not be initialized.");
        alert("Critical Error: Could not connect to backend services. Please try restarting.");
        return; // Stop initialization
    }

    // 3. Initialize User Data in Firestore (Create if new, update login)
    // ensureFirebaseReady calls initializeUserData from uiUpdater.js
    await ensureFirebaseReady(initializeUserData, 'initializeUserData');
    // At this point, currentUserData should be populated by the fetch in initializeUserData

    // 4. Update Stats Bar with actual user data
    await updateUserStatsUI(); // From uiUpdater.js

    // 5. Handle Incoming Referrals (Check start_param)
    await ensureFirebaseReady(handleReferral, 'handleReferral'); // From invite.js

    // 6. Initialize TON Connect & Wallet System
    // ensureFirebaseReady not strictly needed here as initWalletSystem handles TON Connect init internally
    await initWalletSystem(); // From walletService.js (initializes TON Connect)

    // 7. Initialize Invite Section Listeners (Claim, Invite, Copy buttons)
    initInviteSectionListeners(); // From invite.js

    // 8. Render Dynamic Components (Chests)
    // Ensure user data (VIP, gems) is available before rendering chests that depend on it
    await ensureFirebaseReady(async () => {
        if (!window.currentUserData) await fetchAndUpdateUserData(); // Make sure data is loaded
        renderChests(); // From chest.js (sets up listeners internally now)
    }, 'renderChests');

    // 9. Setup Main Navigation (Sets default section and loads its data)
    setupNavigation(); // From navigation.js

    // 10. Initialize Automatic Ads
    initializeAutomaticAds(); // From adService.js

    // 11. Setup Global Event Listeners (delegation)
    setupGlobalEventListeners();

    debugLog("--- App Initialization Sequence Finished ---");
}

// --- Global Event Listeners ---
function setupGlobalEventListeners() {
    // Main click listener using event delegation
    document.body.addEventListener('click', (event) => {
        // Quest Button Clicks
        const questButton = event.target.closest('.quest-item .quest-reward button');
        if (questButton && !questButton.disabled) {
            handleQuestClick(questButton); // From earn.js
            return; // Prevent other handlers if this matched
        }

        // Debug Toggle Button
        const toggleButton = event.target.closest('#toggleDebugButton');
        if (toggleButton) {
            const consoleDiv = document.getElementById('debugConsole');
            if (consoleDiv) {
                consoleDiv.style.display = consoleDiv.style.display === 'none' ? 'block' : 'none';
            }
            return;
        }

        // Wallet Warning Button Click (Example)
        const warningButton = event.target.closest('.balance-card .warning-button');
        if (warningButton) {
             const card = warningButton.closest('.balance-card');
             const currency = card.classList.contains('usdt-card') ? 'USDT' : 'TON';
             alert(`Information about ${currency} balance or withdrawal process.`); // Replace with actual info/modal
             debugLog(`Warning button clicked for ${currency}`);
             return;
        }

        // Add other delegated listeners here if needed
        // e.g., Game item click
         const gameItem = event.target.closest('.game-item');
         if (gameItem) {
             const gameName = gameItem.querySelector('p')?.textContent || 'Unknown Game';
             alert(`Starting ${gameName}... (Implementation needed)`);
             debugLog(`Game item clicked: ${gameName}`);
             // Add logic to launch game or navigate
             return;
         }


    });

    debugLog("Global event listeners setup.");
}


// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded event fired.');
    debugLog("DOMContentLoaded event fired. Starting App Initialization.");
    // Set initial state for debug console visibility
    const consoleDiv = document.getElementById('debugConsole');
    if (consoleDiv) consoleDiv.style.display = 'none';

    initApp(); // Start the main application logic
});
