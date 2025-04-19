// js/main.js

console.log("--- TOP OF main.js script ---"); // <-- ADDED DEBUG LOG

// Uses debugLog from utils.js (globally available)
if (window.debugLog) {
    debugLog("--- TOP OF main.js script --- (via debugLog)"); // <-- ADDED DEBUG LOG
} else {
    console.warn("debugLog function not available at top of main.js"); // <-- ADDED WARN if debugLog is missing
}


// --- Global Error Handling ---
// Basic global error handler to log errors to the debug console and browser console
window.onerror = function(message, source, lineno, colno, error) {
    // Uses debugLog from utils.js (globally available)
    const errorMessage = `[GLOBAL ERROR] ${message} at ${source}:${lineno}:${colno}`;
    console.error(errorMessage, error);
    // Log the error to the in-app debug console
    if (window.debugLog) { // Check if debugLog is available
        window.debugLog(errorMessage, error);
    }
    // Return true to suppress the default browser error handling
    // return true; // Be careful with suppressing errors, can hide issues
};

// Handle unhandled promise rejections (important for async operations)
window.addEventListener('unhandledrejection', function(event) {
    // Uses debugLog from utils.js (globally available)
    const errorMessage = `[UNHANDLED PROMISE REJECTION] ${event.reason}`;
    console.error(errorMessage, event.reason);
    // Log the rejection reason to the in-app debug console
    if (window.debugLog) { // Check if debugLog is available
        window.debugLog(errorMessage, event.reason);
    }
    // Prevent default handling (e.g., logging to console again, though useful)
    // event.preventDefault(); // Be careful with preventing defaults
});

debugLog("Main script loaded."); // Confirm main.js is loaded (this log was already here)


// --- Main Application Initialization Function ---
// This async function orchestrates the startup of all application components.
async function initApp() {
    debugLog("--- App Initialization Sequence Start ---"); // <-- This was already here, should now appear if initApp is called


    // 1. Initialize Telegram Interface
    debugLog("initApp step 1: Initializing Telegram Interface..."); // <-- ADDED DEBUG LOG
    window.initializeTelegram(); // Calls initializeTelegram from telegramService.js (globally available)
    debugLog("initApp step 1: Telegram Interface initialized."); // <-- ADDED DEBUG LOG


    // 2. Ensure Firebase is ready and initialized
    debugLog("initApp step 2: Ensuring Firebase is ready..."); // <-- ADDED DEBUG LOG
    const firebaseReady = await window.ensureFirebaseReady(() => {}, 'main.js: Initial Firebase Check');
    if (!firebaseReady) {
        debugLog("App Init Failed: Firebase could not be initialized. Stopping init sequence.");
        // The ensureFirebaseReady function might already alert the user.
        // You could add more specific error handling here if needed.
        return; // Stop initialization if Firebase failed
    }
    debugLog("initApp step 2: Firebase is confirmed ready."); // <-- ADDED DEBUG LOG


    // 3. Initialize User Data (create/fetch user document in Firestore)
    debugLog("initApp step 3: Initializing User Data..."); // <-- ADDED DEBUG LOG
    await window.initializeUserData(); // Calls initializeUserData from uiUpdater.js (globally available)
    debugLog("initApp step 3: User data initialization complete."); // <-- ADDED DEBUG LOG


    // 4. Handle Incoming Referrals (check start parameter and update referrer/user)
    debugLog("initApp step 4: Handling Incoming Referrals..."); // <-- ADDED DEBUG LOG
    await window.handleReferral(); // Calls handleReferral from invite.js (globally available)
    debugLog("initApp step 4: Referral handling complete."); // <-- ADDED DEBUG LOG


    // 5. Generate User's Referral Link (prepares the link for invite/copy buttons)
    debugLog("initApp step 5: Generating Referral Link..."); // <-- ADDED DEBUG LOG
    window.generateReferralLink(); // Calls generateReferralLink from invite.js (globally available)
    debugLog("initApp step 5: Referral link generation complete."); // <-- ADDED DEBUG LOG


     // 6. Initialize TON Connect UI instance
     debugLog("initApp step 6: Initializing TON Connect UI..."); // <-- ADDED DEBUG LOG
     window.tonConnectUI = await window.initializeTonConnect(); // Calls initializeTonConnect from walletService.js (globally available)
     if (!window.tonConnectUI || typeof window.tonConnectUI.onStatusChange !== 'function') {
          debugLog("App Init Failed: TON Connect UI could not be initialized.");
          // initializeTonConnect should handle user alerts.
          // We continue, but wallet features will be unavailable.
     } else {
         debugLog("initApp step 6: TON Connect UI initialization complete."); // <-- ADDED DEBUG LOG
     }


     // 7. Setup Wallet System Listeners & Initial UI State
     debugLog("initApp step 7: Setting up Wallet System..."); // <-- ADDED DEBUG LOG
     // Calls initWalletSystem from walletService.js (globally available)
     await window.initWalletSystem(); // Await because it might do async UI updates
     debugLog("initApp step 7: Wallet system setup complete."); // <-- ADDED DEBUG LOG


    // 8. Render Dynamic Components (Chests)
    debugLog("initApp step 8: Rendering Dynamic Components (Chests)..."); // <-- ADDED DEBUG LOG
    window.renderChests(); // Calls renderChests from chest.js (globally available)
    debugLog("initApp step 8: Initial chest rendering complete."); // <-- ADDED DEBUG LOG

    // 9. Setup Chest Section Listeners (Navigation arrows, Open button)
    debugLog("initApp step 9: Setting up Chest Section Listeners..."); // <-- ADDED DEBUG LOG
    window.setupChestListeners(); // Calls setupChestListeners from chest.js (globally available)
    debugLog("initApp step 9: Chest section listeners setup complete."); // <-- ADDED DEBUG LOG


    // 10. Initialize Automatic Ads (e.g., In-App ads via Monetag SDK)
    debugLog("initApp step 10: Initializing Automatic Ads..."); // <-- ADDED DEBUG LOG
    window.initializeAutomaticAds(); // Calls initializeAutomaticAds from adService.js (globally available)
    debugLog("initApp step 10: Automatic ads initialization complete."); // <-- ADDED DEBUG LOG


    // 11. Setup Main Navigation
    debugLog("initApp step 11: Setting up Main Navigation - Calling setupNavigation()..."); // <-- ADDED DEBUG LOG
    // Calls setupNavigation from navigation.js (globally available)
    window.setupNavigation(); // This should be the LAST UI setup step as it activates the default section
    debugLog("initApp step 11: setupNavigation() call completed."); // <-- ADDED DEBUG LOG
    debugLog("initApp step 11: Main navigation setup complete. Default section activated.");


    // 12. Initial UI Updates for other sections that might not be the default
    // (Optional, depending on if you want them to load data immediately or on click)
    // Your current setup loads data only when switching sections via navigation.
    // If a section (like Wallet, Invite, Top) is NOT the default and needs data
    // loaded regardless of whether the user clicks the button, you would call
    // its update function here (e.g., updateWalletSectionUI(), updateInviteSectionUI(), updateTopSectionUI()).
    // Based on your provided code, the section update calls are *inside* switchSection in navigation.js,
    // so they will be called when the default section is activated, and then on subsequent button clicks.
    // No extra update calls needed here based on your current logic flow.
    debugLog("initApp step 12: Initial UI updates for non-default sections handled by navigation.");


    debugLog("--- App Initialization Sequence Finished ---"); // <-- This was already here, should now appear if initApp finishes
}


// --- Global Delegated Event Listeners ---
document.body.addEventListener('click', async (event) => {
    // ... (rest of your delegated click listener code) ...
});


// --- DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded event fired.'); // <-- This was already here
    debugLog("DOMContentLoaded event fired. Starting App Initialization."); // <-- This was already here
    // Start the main application initialization process
    initApp(); // <-- This calls the function
    debugLog("DOMContentLoaded listener finished calling initApp."); // <-- ADDED DEBUG LOG
});
