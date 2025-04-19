// js/uiUpdater.js

// Global variable to store fetched user data to reduce reads
// This variable is defined here and used/updated by functions in this file
let currentUserData = null;

// --- User Data Management ---

// Initialize user data in Firestore (create if new, update login/missing fields if existing)
// This function is exposed globally for use by main.js
async function initializeUserData() {
     // Uses debugLog from utils.js (globally available)
     // Uses telegramUser from telegramService.js (globally available)
     // Uses firebaseInitialized, db, firebase from firebaseService.js (implicitly global)
     debugLog("Initializing user data...");
    if (!window.telegramUser || !window.telegramUser.id) {
         console.warn("[UI UPDATER] Cannot initialize user data: No Telegram user available or no ID.");
         debugLog("User init skipped: No Telegram user ID.");
         return; // Cannot proceed without a user ID
    }
    if (!window.firebaseInitialized || !window.db) {
        console.error("[UI UPDATER] Firestore not initialized. Cannot initialize user data.");
        debugLog("User init skipped: Firestore not initialized.");
        // ensureFirebaseReady should have been called before this, but defensive check
        return;
    }

    const userIdStr = window.telegramUser.id.toString();
    const userDocRef = window.db.collection('userData').doc(userIdStr);
    const rankingDocRef = window.db.collection('users').doc(userIdStr); // Assuming 'users' for ranking

    try {
        const doc = await userDocRef.get();
        if (!doc.exists) {
            debugLog(`User ${userIdStr} not found in userData, creating new record.`);
            const newUser = {
                gems: 0,
                usdt: 0,
                ton: 0,
                referrals: 0,
                referralCredits: 0, // Track credits separately
                inviteRecords: [],
                claimHistory: [], // For credit claims
                landPieces: 0,
                foxMedals: 0,
                vipLevel: 0, // Initialize VIP level
                isReferred: false,
                referredBy: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Needs firebase global object (from SDK)
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                claimedQuests: [], // Store IDs of claimed non-repeatable quests
                adProgress: {}, // { questId: { watched: 0, claimed: false, lastClaimed: null } }
                walletAddress: null,
                // transactions: [] // Transactions are now a subcollection
            };
            await userDocRef.set(newUser);

            // Also create or update ranking entry
            const rankingEntry = {
                username: window.telegramUser.username || window.telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                foxMedals: 0, // Start with 0 medals
                photoUrl: window.telegramUser.photo_url || 'assets/icons/user-avatar.png', // Use local asset as fallback
                userId: userIdStr // Store ID for reference
            };
            // Use set with merge: true to create if not exists, or update if it does
            await rankingDocRef.set(rankingEntry, { merge: true });

            debugLog("New user data initialized in userData and users collections.");
             // Uses analytics from firebaseService.js (implicitly global)
             if (window.analytics) window.analytics.logEvent('user_signup', { userId: userIdStr });
        } else {
            debugLog(`User ${userIdStr} found. Updating last login and checking for missing fields.`);
            // Ensure essential fields exist if user doc was created before new fields were added
            const updates = {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp() // Needs firebase global object (from SDK)
            };
            const userData = doc.data();
            let fieldsAdded = false;

            // Check and initialize missing fields if necessary to ensure data structure consistency
            if (userData.gems === undefined) { updates.gems = 0; fieldsAdded = true; }
            if (userData.usdt === undefined) { updates.usdt = 0; fieldsAdded = true; }
            if (userData.ton === undefined) { updates.ton = 0; fieldsAdded = true; }
            if (userData.referrals === undefined) { updates.referrals = 0; fieldsAdded = true; }
            if (userData.referralCredits === undefined) { updates.referralCredits = 0; fieldsAdded = true; }
            if (userData.inviteRecords === undefined) { updates.inviteRecords = []; fieldsAdded = true; }
            if (userData.claimHistory === undefined) { updates.claimHistory = []; fieldsAdded = true; }
            if (userData.landPieces === undefined) { updates.landPieces = 0; fieldsAdded = true; }
            if (userData.foxMedals === undefined) { updates.foxMedals = 0; fieldsAdded = true; }
            if (userData.vipLevel === undefined) { updates.vipLevel = 0; fieldsAdded = true; }
            if (userData.isReferred === undefined) { updates.isReferred = false; fieldsAdded = true; }
            if (userData.referredBy === undefined) { updates.referredBy = null; fieldsAdded = true; }
            if (userData.claimedQuests === undefined) { updates.claimedQuests = []; fieldsAdded = true; }
            if (userData.adProgress === undefined) { updates.adProgress = {}; fieldsAdded = true; }
            if (userData.walletAddress === undefined) { updates.walletAddress = null; fieldsAdded = true; }
            // Add other checks as needed for any new fields in your data model

             // Only update if there are fields to add/correct besides just updating lastLogin
             if (fieldsAdded) {
                await userDocRef.update(updates);
                debugLog("Updated missing fields for existing user.");
             } else {
                 // Just update last login time if no new fields were needed
                 await userDocRef.update({ lastLogin: updates.lastLogin });
                 debugLog("Existing user data structure is up-to-date, only updated last login.");
             }

             // Ensure ranking entry exists and is consistent (username/photo)
             const rankDoc = await rankingDocRef.get();
             if (!rankDoc.exists) {
                  const rankingEntry = {
                      username: window.telegramUser.username || window.telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                      foxMedals: userData.foxMedals || 0, // Sync medals from userData
                      photoUrl: window.telegramUser.photo_url || 'assets/icons/user-avatar.png',
                      userId: userIdStr
                  };
                  await rankingDocRef.set(rankingEntry);
                  debugLog("Created missing ranking entry for existing user.");
             } else {
                 // Optionally update username/photo in ranking if changed in Telegram
                 const rankData = rankDoc.data();
                 const currentPhoto = window.telegramUser.photo_url || 'assets/icons/user-avatar.png';
                 const currentUsername = window.telegramUser.username || window.telegramUser.first_name || `User_${userIdStr.slice(-4)}`;
                 const rankUpdates = {};
                 if (rankData.photoUrl !== currentPhoto) rankUpdates.photoUrl = currentPhoto;
                 if (rankData.username !== currentUsername) rankUpdates.username = currentUsername;
                 // Sync medals just in case they got out of sync (optional, userData should be source of truth)
                 // if (rankData.foxMedals !== (userData.foxMedals || 0)) rankUpdates.foxMedals = userData.foxMedals || 0;

                 if (Object.keys(rankUpdates).length > 0) {
                     await rankingDocRef.update(rankUpdates);
                     debugLog("Updated ranking entry username/photo.");
                 } else {
                     debugLog("Ranking entry is up-to-date.");
                 }
             }
        }
         // Fetch the potentially newly created or updated data into cache
         await fetchAndUpdateUserData(); // Update the global currentUserData after init/check

    } catch (error) {
        console.error("[UI UPDATER] Error initializing/checking user data:", error);
        debugLog(`Error initializing user data for ${userIdStr}: ${error.message}`);
        alert("There was a problem loading your profile."); // Inform user about the issue
    }
}

// Fetch user data from Firestore and store in the global cache (currentUserData)
// This function is exposed globally for use by other modules
async function fetchAndUpdateUserData() {
    // Uses debugLog from utils.js (globally available)
    // Uses telegramUser from telegramService.js (globally available)
    // Uses firebaseInitialized, db from firebaseService.js (implicitly global)
    // Updates currentUserData (global variable in this file)
    // debugLog("Fetching and updating user data..."); // Can be noisy, uncomment for detailed debugging

    // Ensure essential services and user are available before attempting fetch
    if (!window.telegramUser || !window.telegramUser.id || !window.firebaseInitialized || !window.db) {
        debugLog("User data fetch skipped: Essential conditions (user/firebase) not met.");
        currentUserData = null; // Ensure cache is null if dependencies aren't ready
        return null;
    }
    try {
        const userDocRef = window.db.collection('userData').doc(window.telegramUser.id.toString());
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            debugLog("User doc not found during fetch. Might be a new user or database issue.");
            currentUserData = null; // Ensure cache is null
             // Note: initializeUserData handles creation on startup. This fetch assumes user exists.
             // If this happens unexpectedly after startup, it might indicate a problem.
            return null;
        }
        currentUserData = userDoc.data(); // Update the global cache with the latest data
        // debugLog("User data fetched and cached:", currentUserData); // Can be noisy
        return currentUserData; // Return the fetched data
    } catch (error) {
        console.error("[UI UPDATER] Error fetching user data:", error);
        debugLog(`Error fetching user data: ${error.message}`);
        currentUserData = null; // Clear cache on error to prevent using stale/partial data
        // Optionally re-throw or handle the error further up the call stack
        // throw error;
        return null; // Return null to indicate fetch failed
    }
}

// Update the UI elements that display user stats (gems, usdt, ton)
// This function is exposed globally for use by main.js and other modules
function updateUserStatsUI() {
     // Uses debugLog from utils.js (globally available)
     // Reads currentUserData (global variable in this file)
     // Reads telegramUser from telegramService.js (globally available)
     // debugLog("Updating user stats UI..."); // Can be noisy

     // Use the cached data. If not available, attempt a quick fetch.
     // Note: Dependent functions like initializeUserData or switchSection's ensureFirebaseReady
     // should ideally ensure currentUserData is populated before this is called,
     // but adding a fallback fetch here can be a safeguard if not called during init.
     const data = currentUserData;

     const gemsEl = document.getElementById('gems');
     const usdtEl = document.getElementById('usdt');
     const tonEl = document.getElementById('ton');
     // Wallet balances might be updated separately in updateWalletSectionUI,
     // but syncing here is okay as wallet section also shows these
     const walletUsdtEl = document.getElementById('wallet-usdt');
     const walletTonEl = document.getElementById('wallet-ton');
     const profilePic = document.querySelector('.profile-pic img');

     // Ensure all required elements are found before attempting to update
     if (!gemsEl || !usdtEl || !tonEl || !walletUsdtEl || !walletTonEl || !profilePic) {
         console.warn("[UI UPDATER] One or more UI elements for stats not found. Skipping update.");
         debugLog("Stats UI update skipped: Missing required DOM elements.");
         // No need to set to defaults if elements aren't there
         return;
     }

     if (!data) {
          debugLog("Stats UI update skipped: No user data available in cache.");
          // Set UI elements to default/zero state if data is missing
          gemsEl.textContent = '0';
          usdtEl.textContent = '0.0000';
          tonEl.textContent = '0.0000';
          walletUsdtEl.textContent = '0.0000';
          walletTonEl.textContent = '0.0000';
          // Set profile pic to default as well if user data is missing
          profilePic.src = 'assets/icons/user-avatar.png'; // Default avatar
          return; // Stop here if no data
     }

    try {
        // Update text content using optional chaining and toLocaleString for numbers
        gemsEl.textContent = (data.gems ?? 0).toLocaleString(); // Use ?? for null/undefined check
        usdtEl.textContent = (data.usdt ?? 0).toFixed(4);
        tonEl.textContent = (data.ton ?? 0).toFixed(4);

        // Update wallet section balances as well
        walletUsdtEl.textContent = (data.usdt ?? 0).toFixed(4);
        walletTonEl.textContent = (data.ton ?? 0).toFixed(4);

        // Update profile picture using telegramUser data (from telegramService.js)
        if (window.telegramUser && profilePic) {
            profilePic.src = window.telegramUser.photo_url || 'assets/icons/user-avatar.png';
             profilePic.onerror = () => { // Add error handling for profile pics if URL is bad
                 profilePic.src = 'assets/icons/user-avatar.png';
                 console.warn("[UI UPDATER] Failed to load Telegram profile picture, using default.");
             };
        } else if (profilePic) {
             // If telegramUser isn't available but profilePic element exists, set default
             profilePic.src = 'assets/icons/user-avatar.png';
        }


        // debugLog("User stats UI updated successfully."); // Can be noisy
    } catch (error) {
        console.error("[UI UPDATER] Error updating user stats UI:", error);
        debugLog(`Error updating stats UI: ${error.message}`);
        // Optionally set UI elements to error state or re-run fetch
        // gemsEl.textContent = 'ERR'; etc.
    }
}


// Make the currentUserData variable and key functions available globally
// This is necessary for other scripts to access the cached data and update UI
window.currentUserData = currentUserData; // Expose the cache variable itself
window.initializeUserData = initializeUserData;
window.fetchAndUpdateUserData = fetchAndUpdateUserData;
window.updateUserStatsUI = updateUserStatsUI;
