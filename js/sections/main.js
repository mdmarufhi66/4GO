// js/main.js

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

debugLog("Main script loaded."); // Confirm main.js is loaded


// --- Main Application Initialization Function ---
// This async function orchestrates the startup of all application components.
async function initApp() {
    debugLog("--- App Initialization Sequence Start ---");

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
    // This function sets up listeners for the bottom nav buttons.
    // CRITICALLY, setupNavigation also calls switchSection for the default section ('earn').
    // The switchSection function then calls the appropriate section-specific UI update function (e.g., updateEarnSectionUI).
    // This means the initial loading and display of the default section happens as part of this step.
    window.setupNavigation(); // This should be the LAST UI setup step as it activates the default section
    debugLog("initApp step 11: setupNavigation() call completed."); // <-- ADDED DEBUG LOG
    debugLog("initApp step 11: Main navigation setup complete. Default section activated."); // <-- This line executes *after* setupNavigation potentially calls switchSection


    // 12. Initial UI Updates for other sections that might not be the default
    // (Optional, depending on if you want them to load data immediately or on click)
    // Your current setup loads data only when switching sections via navigation.
    // If a section (like Wallet, Invite, Top) is NOT the default and needs data
    // loaded regardless of whether the user clicks the button, you would call
    // its update function here (e.g., updateWalletSectionUI(), updateInviteSectionUI(), updateTopSectionUI()).
    // Based on your provided code, the section update calls are *inside* switchSection in navigation.js,
    // so they will be called when the default section is activated, and then on subsequent button clicks.
    // No extra update calls needed here based on your current logic flow.
    debugLog("initApp step 12: Initial UI updates for non-default sections handled by navigation."); // <-- ADDED DEBUG LOG


    debugLog("--- App Initialization Sequence Finished ---"); // <-- ADDED DEBUG LOG
}


// --- Global Delegated Event Listeners ---
// Use a single listener on the document body to handle clicks on multiple elements,
// especially those that are added dynamically or exist in different sections.
// This is more efficient than adding listeners to each individual button.
document.body.addEventListener('click', async (event) => {
    // Uses debugLog from utils.js (globally available)
    // Calls handleQuestClick from earn.js (globally available)
    // Uses updateEarnSectionUI from earn.js (globally available) // Maybe not directly, handleQuestClick does
    // Calls generateReferralLink from invite.js (globally available) // Called within invite listeners
    // Calls openTelegramLink from telegramService.js (globally available) // Called within invite listeners
    // Calls handleClaimCredits from invite.js (globally available) // Called by invite listeners
    // Calls nextChest, prevChest, openChest from chest.js (implicitly global) // Called by chest listeners
    // Uses updateChestUI from chest.js (globally available) // Called by chest listeners


    // --- Handle Debug Console Toggle Button ---
    // Find the closest button with the ID 'toggleDebugButton'
    const debugButton = event.target.closest('#toggleDebugButton');
    if (debugButton) {
        debugLog("[MAIN] Debug toggle button clicked.");
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole) {
            // Toggle the display style between 'block' and 'none'
            debugConsole.style.display = debugConsole.style.display === 'none' ? 'block' : 'none';
            debugLog(`Debug console is now: ${debugConsole.style.display}`);
        } else {
            console.warn("[MAIN WARN] Debug console element not found.");
            debugLog("[MAIN WARN] Debug console element missing.");
        }
        return; // Stop processing this event after handling the debug button
    }


    // --- Handle Quest Reward Button Clicks (GO, Claim) ---
    // Find the closest button with the class 'go-button' or 'claim-button' or 'claimed-button'
    // that is inside a '.quest-reward' div.
    const questButton = event.target.closest('.quest-reward button');
    if (questButton) {
        // If a quest button was clicked, pass the button element to the handler in earn.js
        // handleQuestClick is expected to be globally available from earn.js
        debugLog("[MAIN] Quest button clicked. Calling handleQuestClick.");
        await window.handleQuestClick(questButton); // Await the async handler
        // After the handler finishes, it should update the UI (e.g., updateEarnSectionUI)
        // No need to manually update UI here again unless handleQuestClick doesn't.
        return; // Stop processing this event after handling the quest button
    }

     // --- Handle Chest Navigation Arrow Clicks ---
     // Find the closest button with the class 'nav-arrow'
     const navArrow = event.target.closest('.nav-arrow');
     if (navArrow) {
         debugLog("[MAIN] Chest navigation arrow clicked.");
         // Check if it's the left or right arrow and call the corresponding handler
         // nextChest and prevChest are expected to be globally available from chest.js
         if (navArrow.classList.contains('left')) {
              debugLog("[MAIN] Calling prevChest().");
             window.prevChest(); // Call the previous chest function
         } else if (navArrow.classList.contains('right')) {
              debugLog("[MAIN] Calling nextChest().");
             window.nextChest(); // Call the next chest function
         }
         // updateChestUI is called by nextChest/prevChest, so no need to call here.
         return; // Stop processing after handling the arrow
     }

     // --- Handle Open Chest Button Click ---
     // Find the closest button with the class 'open-chest-button'
     const openChestButton = event.target.closest('.open-chest-button');
     if (openChestButton) {
         debugLog("[MAIN] Open Chest button clicked. Calling openChest().");
         // Call the openChest function. It's an async operation.
         // openChest is expected to be globally available from chest.js
         await window.openChest(); // Await the async function
         // openChest handles its own UI updates after processing.
         return; // Stop processing after handling the open button
     }

    // Note: Click listeners for bottom nav buttons, invite/copy/claim buttons
    // are set up specifically within navigation.js and invite.js's init functions,
    // not handled by this global delegated listener. This listener is mainly for
    // dynamically added elements or elements where a single listener is more efficient.

    // If the click event wasn't handled by any of the specific checks above,
    // it will simply propagate normally.
});


// --- DOMContentLoaded Event Listener ---
// This event fires when the initial HTML document has been completely loaded and parsed,
// without waiting for stylesheets, images, and subframes to finish loading.
// This is the standard place to start your application's main initialization logic.
document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded event fired.');
    debugLog("DOMContentLoaded event fired. Starting App Initialization.");
    // Start the main application initialization process
    initApp();
});
