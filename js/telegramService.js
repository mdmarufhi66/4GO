// js/telegramService.js

// Forward declare global variable defined in this file, used by other scripts
let telegramUser = null; // Store Telegram user data

// --- Telegram Web App Setup ---
// This function is exposed globally for use by main.js
function initializeTelegram() {
     // Uses debugLog from utils.js (globally available)
     // Depends on the Telegram Web App SDK being loaded in index.html
     debugLog("Initializing Telegram Web App...");
    try {
        // Check if the Telegram WebApp object is available
        if (!window.Telegram || !window.Telegram.WebApp) {
            // If not available, this is likely not running in a Telegram Web App context,
            // or the SDK script failed to load.
            throw new Error("Telegram WebApp script not loaded or available.");
        }
        window.Telegram.WebApp.ready(); // Signal readiness to Telegram

        // Safely access initData and user information using optional chaining
        const initData = window.Telegram.WebApp.initDataUnsafe || {};
        telegramUser = initData.user;

        if (telegramUser) {
            debugLog("Telegram user data found:", { id: telegramUser.id, username: telegramUser.username });
            // Update profile pic in UI if the element exists (UI update logic is in uiUpdater.js,
            // but setting the src can happen here or in uiUpdater based on available data)
             const profilePic = document.querySelector('.profile-pic img');
             if (profilePic) {
                 profilePic.src = telegramUser.photo_url || 'assets/icons/user-avatar.png';
                 profilePic.onerror = () => { // Add error handling for profile pics
                     profilePic.src = 'assets/icons/user-avatar.png';
                     console.warn("[TELEGRAM SERVICE] Failed to load Telegram profile picture, using default.");
                 };
             }
        } else {
            // No user data in initDataUnsafe (e.g., running outside Telegram, or issue with initData)
            console.warn("No Telegram user data available in initDataUnsafe. Running in test mode or outside Telegram.");
            debugLog("No Telegram user data found. Using test user.");
            // Define a fallback test user if needed for development outside Telegram
            // IMPORTANT: This test user data is NOT authenticated or secure.
            telegramUser = {
                id: "test_user_" + Date.now(), // Unique test ID (non-secure)
                username: "TestUser",
                first_name: "Test",
                last_name: "",
                language_code: "en",
                // Use a placeholder image for the test user
                photo_url: "https://via.placeholder.com/40/808080/000000?text=T"
            };
             const profilePic = document.querySelector('.profile-pic img');
             if (profilePic) profilePic.src = telegramUser.photo_url;
        }
        debugLog("Telegram Web App initialized successfully.");
        return true; // Indicate successful (though potentially fallback) initialization
    } catch (error) {
        console.error("Telegram Web App initialization failed:", error);
        debugLog(`Telegram Web App initialization failed: ${error.message}`);
         // Define a fallback test user even if Telegram SDK init failed catastrophically
         telegramUser = {
             id: "fallback_user_" + Date.now(), // Unique fallback ID
             username: "FallbackUser",
             first_name: "Fallback",
             last_name: "",
             language_code: "en",
             photo_url: "https://via.placeholder.com/40/FF0000/FFFFFF?text=F" // Error indicator image
         };
         const profilePic = document.querySelector('.profile-pic img');
         if (profilePic) profilePic.src = telegramUser.photo_url;
         alert("Could not initialize Telegram features. Using fallback mode."); // Inform the user
        return false; // Indicate initialization failure
    }
}

// Get the start parameter from Telegram initData
// This function is exposed globally for use by other modules (e.g., invite.js)
function getTelegramStartParam() {
    try {
        // Safely access start_param using optional chaining
        return window.Telegram?.WebApp?.initDataUnsafe?.start_param || null;
    } catch (e) {
        debugLog("Error accessing Telegram start_param:", e);
        return null;
    }
}

// Open a link using Telegram's method if available, fallback to window.open
// This function is exposed globally for use by other modules (e.g., earn.js, invite.js)
function openTelegramLink(link) {
     // Uses debugLog from utils.js (globally available)
     if (!link) {
         debugLog("[TELEGRAM SERVICE] Attempted to open empty link.");
         return;
     }
     if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
        debugLog(`[TELEGRAM SERVICE] Opening link via Telegram: ${link}`);
        window.Telegram.WebApp.openTelegramLink(link);
     } else {
        debugLog(`[TELEGRAM SERVICE] Not in Telegram context or method unavailable, opening link in new tab: ${link}`);
        window.open(link, '_blank');
     }
}


// Make the Telegram user variable and functions available globally
window.telegramUser = telegramUser; // This will be updated by initializeTelegram
window.initializeTelegram = initializeTelegram;
window.getTelegramStartParam = getTelegramStartParam;
window.openTelegramLink = openTelegramLink;
