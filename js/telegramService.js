// js/telegramService.js

// Forward declare global
let telegramUser;

function initializeTelegram() {
     debugLog("Initializing Telegram Web App...");
    try {
        if (!window.Telegram || !window.Telegram.WebApp) {
            throw new Error("Telegram WebApp script not loaded or available.");
        }
        window.Telegram.WebApp.ready();
        // Use initDataUnsafe for user data, but be aware of potential security implications if validating server-side
        const initData = window.Telegram.WebApp.initDataUnsafe || {};
        telegramUser = initData.user;

        if (telegramUser) {
            debugLog("Telegram user data found:", { id: telegramUser.id, username: telegramUser.username });
            // Update profile pic in uiUpdater.js or main.js after initialization
        } else {
            console.warn("No Telegram user data available. Running in test mode or outside Telegram.");
            debugLog("No Telegram user data found. Using test user.");
            // Define a fallback test user if needed for development outside Telegram
            telegramUser = {
                id: "test_user_" + Date.now(), // Unique test ID
                username: "TestUser",
                first_name: "Test",
                last_name: "",
                language_code: "en",
                photo_url: "https://via.placeholder.com/40/808080/000000?text=T"
            };
            // Update profile pic in uiUpdater.js or main.js
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
             last_name: "",
             language_code: "en",
             photo_url: "https://via.placeholder.com/40/FF0000/FFFFFF?text=F" // Error indicator
         };
         // Update profile pic in uiUpdater.js or main.js
         alert("Could not initialize Telegram features. Using fallback mode.");
        return false;
    }
}

function getTelegramStartParam() {
    try {
        return window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    } catch (e) {
        debugLog("Error accessing Telegram start_param:", e);
        return null;
    }
}

function openTelegramLink(link) {
     if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(link);
     } else {
        window.open(link, '_blank');
        debugLog("[TELEGRAM WARN] Not in Telegram context or method unavailable, opening link in new tab.");
     }
}
