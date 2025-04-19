// js/uiUpdater.js

// --- User Data / Stats UI ---

async function initializeUserData() {
     debugLog("Initializing user data...");
    // Needs global telegramUser from main.js
    if (!window.telegramUser || !window.telegramUser.id) {
         console.warn("Cannot initialize user data: No Telegram user available or no ID.");
         debugLog("User init skipped: No Telegram user ID.");
         return;
    }
    if (!firebaseInitialized || !db) { // Needs globals from firebaseService.js
        console.error("Firestore not initialized. Cannot initialize user data.");
        debugLog("User init skipped: Firestore not initialized.");
        return;
    }

    const userIdStr = window.telegramUser.id.toString();
    const userDocRef = db.collection('userData').doc(userIdStr);
    const rankingDocRef = db.collection('users').doc(userIdStr); // Assuming 'users' for ranking

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
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Needs firebase global
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                claimedQuests: [],
                adProgress: {},
                walletAddress: null,
                // transactions: [] // Transactions are now a subcollection
            };
            await userDocRef.set(newUser);
            // Initialize transactions subcollection (optional, happens on first transaction)
            // await userDocRef.collection('transactions').doc('initial').set({ init: true });

            // Also create ranking entry
            const rankingEntry = {
                username: window.telegramUser.username || window.telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                foxMedals: 0,
                photoUrl: window.telegramUser.photo_url || 'assets/icons/user-avatar.png',
                userId: userIdStr
            };
            await rankingDocRef.set(rankingEntry, { merge: true });

            debugLog("New user data initialized in userData and users collections.");
            if (window.analytics) window.analytics.logEvent('user_signup', { userId: userIdStr }); // Needs analytics global
        } else {
            debugLog(`User ${userIdStr} found. Updating last login and checking fields.`);
            // Ensure essential fields exist if user doc was created before fields were added
            const updates = {
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            const userData = doc.data();
            // Check and initialize missing fields if necessary
            if (userData.gems === undefined) updates.gems = 0;
            if (userData.usdt === undefined) updates.usdt = 0;
            if (userData.ton === undefined) updates.ton = 0;
            if (userData.referrals === undefined) updates.referrals = 0;
            if (userData.referralCredits === undefined) updates.referralCredits = 0;
            if (userData.inviteRecords === undefined) updates.inviteRecords = [];
            if (userData.claimHistory === undefined) updates.claimHistory = [];
            if (userData.landPieces === undefined) updates.landPieces = 0;
            if (userData.foxMedals === undefined) updates.foxMedals = 0;
            if (userData.vipLevel === undefined) updates.vipLevel = 0;
            if (userData.isReferred === undefined) updates.isReferred = false;
            if (userData.referredBy === undefined) updates.referredBy = null;
            if (userData.claimedQuests === undefined) updates.claimedQuests = [];
            if (userData.adProgress === undefined) updates.adProgress = {};
            if (userData.walletAddress === undefined) updates.walletAddress = null;
            // Add other checks as needed

             // Only update if there are fields to add/correct besides lastLogin
             if (Object.keys(updates).length > 1) {
                await userDocRef.update(updates);
                debugLog("Updated missing fields for existing user.");
             } else {
                 await userDocRef.update({ lastLogin: updates.lastLogin }); // Just update login time
             }

             // Ensure ranking entry exists too
             const rankDoc = await rankingDocRef.get();
             if (!rankDoc.exists) {
                  const rankingEntry = {
                      username: window.telegramUser.username || window.telegramUser.first_name || `User_${userIdStr.slice(-4)}`,
                      foxMedals: userData.foxMedals || 0, // Sync medals
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
                 }
             }
        }
         // Fetch the potentially newly created or updated data into cache
         await window.fetchAndUpdateUserData(); // Use window. prefix

    } catch (error) {
        console.error("Error initializing/checking user data:", error);
        debugLog(`Error initializing user data for ${userIdStr}: ${error.message}`);
        alert("There was a problem loading your profile.");
    }
}

// Fetch user data and store globally
async function fetchAndUpdateUserData() {
    // debugLog("Fetching and updating user data..."); // Can be noisy
    // Needs globals telegramUser, firebaseInitialized, db from main.js/firebaseService.js
    if (!window.telegramUser || !window.telegramUser.id || !firebaseInitialized || !db) {
        debugLog("User data fetch skipped: Conditions not met.");
        window.currentUserData = null; // Reset cache (use window. prefix)
        return null;
    }
    try {
        const userDocRef = db.collection('userData').doc(window.telegramUser.id.toString());
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            debugLog("User doc not found during fetch. Might be new user.");
            window.currentUserData = null; // Reset cache
            // If user doc doesn't exist here, initializeUserData should handle it on startup.
            // Avoid recursive calls by not calling initializeUserData here.
            return null;
        }
        window.currentUserData = userDoc.data(); // Update cache
        // debugLog("User data fetched and cached:", window.currentUserData);
        return window.currentUserData;
    } catch (error) {
        console.error("Error fetching user data:", error);
        debugLog(`Error fetching user data: ${error.message}`);
        window.currentUserData = null; // Reset cache on error
        return null;
    }
}

// Update the top stats bar and potentially other common elements
function updateUserStatsUI() {
     // debugLog("Updating user stats UI..."); // Can be noisy
     const data = window.currentUserData; // Use cached data (use window. prefix)

     const gemsEl = document.getElementById('gems');
     const usdtEl = document.getElementById('usdt');
     const tonEl = document.getElementById('ton');
     // Wallet balances might be updated separately in updateWalletSectionUI, but syncing here is okay
     const walletUsdtEl = document.getElementById('wallet-usdt');
     const walletTonEl = document.getElementById('wallet-ton');
     const profilePic = document.querySelector('.profile-pic img');

     if (!gemsEl || !usdtEl || !tonEl || !walletUsdtEl || !walletTonEl || !profilePic) {
         console.warn("One or more UI elements for stats not found.");
         debugLog("Stats UI update skipped: Missing elements.");
         return;
     }

     if (!data) {
          debugLog("Stats UI update skipped: No user data available in cache.");
          // Set UI to defaults or loading state
          gemsEl.textContent = 0;
          usdtEl.textContent = '0.0000';
          tonEl.textContent = '0.0000';
          walletUsdtEl.textContent = '0.0000';
          walletTonEl.textContent = '0.0000';
          profilePic.src = 'assets/icons/user-avatar.png'; // Default avatar
          return;
     }

    try {
        gemsEl.textContent = (data.gems || 0).toLocaleString();
        usdtEl.textContent = (data.usdt || 0).toFixed(4);
        tonEl.textContent = (data.ton || 0).toFixed(4);
        walletUsdtEl.textContent = (data.usdt || 0).toFixed(4);
        walletTonEl.textContent = (data.ton || 0).toFixed(4);

        // Update profile picture if telegramUser is available
        if (window.telegramUser && profilePic) {
            profilePic.src = window.telegramUser.photo_url || 'assets/icons/user-avatar.png';
            profilePic.onerror = () => { // Add error handling for profile pics
                profilePic.src = 'assets/icons/user-avatar.png';
                console.warn("Failed to load Telegram profile picture, using default.");
            };
        }

        // debugLog("User stats UI updated successfully."); // Can be noisy
    } catch (error) {
        console.error("Error updating user stats UI:", error);
        debugLog(`Error updating stats UI: ${error.message}`);
    }
}

// --- Wallet UI Updates ---

async function updateWalletSectionUI() {
     debugLog("Updating Wallet section UI...");
     if (!window.currentUserData) {
        await window.fetchAndUpdateUserData(); // Ensure data is fetched if not present
     }
     updateUserStatsUI(); // Update balances shown in the wallet section from cached data
     await updateWalletConnectionStatusUI(); // Update connection button/status text
     await updateTransactionHistory(); // Update tx list
     setupWithdrawListeners(); // Re-attach listeners in case elements were re-rendered
     debugLog("Wallet section UI update complete.");
 }

 async function updateWalletConnectionStatusUI() {
     debugLog("Updating Wallet Connection Status UI...");
     const elements = getWalletElements(); // Use function from walletService.js
     if (!elements.connectButton || !elements.connectionStatus) {
        debugLog("Wallet connect button or status element not found.");
        return;
     }

     const isConnected = tonConnectUI && tonConnectUI.connected; // Use global from walletService.js
     debugLog(`Wallet connection status: ${isConnected}`);

     const userHasWallet = !!window.currentUserData?.walletAddress;

     if (isConnected) {
         const wallet = tonConnectUI.wallet;
         let address = wallet?.account?.address;
         let shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';

         elements.connectionStatus.textContent = `Connected: ${shortAddress}`;
         elements.connectionStatus.className = 'wallet-status connected';
         elements.connectButton.textContent = 'DISCONNECT';
         elements.connectButton.classList.add('connected');
         // Enable withdraw buttons only if user has balance (check should happen in confirmWithdraw)
         elements.withdrawButtons.forEach(btn => btn.disabled = false );

         // Update stored address if different or not set
         const storedAddress = await Storage.getItem('walletAddress'); // Use Storage from firebaseService.js
         if (address && address !== storedAddress) {
             await Storage.setItem('walletAddress', address);
             debugLog(`Wallet connected: Address ${address} stored/updated.`);
             // Refresh currentUserData if needed
             if (window.currentUserData) window.currentUserData.walletAddress = address;
         } else if (address) {
             debugLog(`Wallet connected: Address ${address} already stored.`);
         } else {
             debugLog("Wallet connected, but address not immediately available in walletInfo.");
         }

     } else {
         elements.connectionStatus.textContent = 'Disconnected';
         elements.connectionStatus.className = 'wallet-status disconnected';
         elements.connectButton.textContent = 'CONNECT TON WALLET';
         elements.connectButton.classList.remove('connected');
         elements.withdrawButtons.forEach(btn => btn.disabled = true );
         debugLog("Wallet disconnected state UI updated.");
         // Optionally clear stored address on explicit disconnect?
         // await Storage.setItem('walletAddress', null);
     }
     elements.connectButton.disabled = false; // Ensure button is enabled after update
 }


async function updateTransactionHistory() {
    debugLog("Updating transaction history...");
    const elements = getWalletElements(); // Use function from walletService.js
    if (!elements.transactionList) {
        debugLog("Transaction list element not found.");
        return;
     }
    elements.transactionList.innerHTML = '<li><p>Loading history...</p></li>'; // Use <p> for consistency

    if (!firebaseInitialized || !db || !window.telegramUser || !window.telegramUser.id) {
        elements.transactionList.innerHTML = '<li><p>History unavailable.</p></li>';
        return;
    }

    try {
        // Reference the subcollection correctly
        const txCollectionRef = db.collection('userData').doc(window.telegramUser.id.toString()).collection('transactions');
        const snapshot = await txCollectionRef.orderBy('timestamp', 'desc').limit(15).get();

        if (snapshot.empty) {
             elements.transactionList.innerHTML = '<li><p>No transactions yet</p></li>';
             return;
        }

        debugLog(`Workspaceed ${snapshot.docs.length} transaction history entries.`);
        elements.transactionList.innerHTML = snapshot.docs.map(doc => {
            const tx = doc.data();
            const txTime = formatTimestamp(tx.timestamp); // Use utility function

            let detail = '';
            const status = tx.status || 'unknown';
            const statusClass = status.toLowerCase(); // Ensure class is lowercase

            // Build detail string based on type
            if (tx.type === 'withdrawal') {
                 detail = `Withdraw ${tx.amount?.toFixed(4) || '?'} ${tx.currency || '?'} (Fee: ${tx.fee?.toFixed(4) || '?'})`;
            } else if (tx.type === 'credit_claim') {
                 detail = `Claimed ${tx.usdtAmount?.toFixed(4) || '?'} USDT (${tx.creditsSpent?.toLocaleString() || '?'} C)`;
            } else if (tx.type === 'quest_reward') { // Example for future expansion
                 detail = `Quest Reward: +${tx.rewardAmount?.toLocaleString() || '?'} ${tx.rewardCurrency || '?'}`;
            } else {
                detail = `Type: ${tx.type || 'Unknown'} | Amount: ${tx.amount || 'N/A'}`; // Generic fallback
            }
            // Add destination for withdrawals if needed
            // if (tx.type === 'withdrawal' && tx.destination) {
            //     detail += ` to ${tx.destination.slice(0, 6)}...${tx.destination.slice(-4)}`;
            // }

            return `<li> ${detail} - <span class="tx-status ${statusClass}">${status}</span><br><small>${txTime}</small> </li>`; // Added line break and small tag for time
        }).join('');
    } catch (error) {
        console.error(`Error updating transaction history: ${error.message}`);
        debugLog(`Error updating transaction history: ${error.message}`);
        elements.transactionList.innerHTML = `<li><p class="error">Error loading history.</p></li>`;
    }
}


// Add update functions for other sections if needed (e.g., Game list if dynamic)
// function updateGameSectionUI() { ... }

