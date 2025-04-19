// js/sections/earn.js

// --- Earn Section (Quests) UI Update ---
// This function is exposed globally for use by navigation.js/main.js
async function updateEarnSectionUI() {
    // Uses debugLog from utils.js (globally available)
    // Uses firebaseInitialized, db from firebaseService.js (implicitly global)
    // Uses currentUserData, fetchAndUpdateUserData from uiUpdater.js (globally available)
    // Uses AD_QUEST_COOLDOWN_MS from config.js (globally available)

     debugLog("[QUEST DEBUG] Starting Earn section UI update...");
    // Get references to the DOM elements that need to be updated
    const dailyQuestList = document.getElementById('daily-quest-list');
    const basicQuestList = document.getElementById('basic-quest-list');
    const dailyQuestCountEl = document.getElementById('daily-quest-count');
    const basicQuestCountEl = document.getElementById('basic-quest-count');

     // Validate that the necessary DOM elements exist
     if (!dailyQuestList || !basicQuestList || !dailyQuestCountEl || !basicQuestCountEl) {
         console.error("[QUEST ERROR] Required DOM elements for quests not found! Skipping UI update.");
         debugLog("[QUEST ERROR] Quest list or count elements missing from DOM.");
         return; // Stop the function if elements are missing
     }

     // Set initial loading state in the UI
     dailyQuestList.innerHTML = `<li class="loading"><p>Loading daily quests...</p></li>`;
     basicQuestList.innerHTML = `<li class="loading"><p>Loading basic quests...</p></li>`;
     dailyQuestCountEl.textContent = '-'; // Show loading state for counts
     basicQuestCountEl.textContent = '-';

    try {
        // Ensure Firestore is initialized and accessible
        if (!window.firebaseInitialized || !window.db) {
           throw new Error("Firestore not initialized. Cannot fetch quest data.");
        }
        debugLog("[QUEST DEBUG] Firestore is ready for quest fetch.");

        // Use cached user data if available, otherwise fetch fresh data.
        // The user data is needed to check quest claim status and ad progress.
        let userData = window.currentUserData || await window.fetchAndUpdateUserData();

        // Ensure user data is available before proceeding with rendering
        if (!userData) {
             throw new Error("User data not available. Cannot determine quest status.");
        }
        // Ensure sub-objects needed for quest tracking exist on the user data object
        userData.adProgress = userData.adProgress || {};
        userData.claimedQuests = userData.claimedQuests || [];
        debugLog("[QUEST DEBUG] User data loaded for quest checks.");
        // debugLog("[QUEST DEBUG] User Data Snapshot:", JSON.stringify(userData)); // Careful, can be large


        // --- Fetch Daily Quests from Firestore ---
        debugLog("[QUEST DEBUG] Fetching daily quests from Firestore...");
        // Fetch the 'daily' document from the 'quests' collection
        // Use { source: 'server' } to ensure we get the latest data, not from cache
        const dailyQuestsSnapshot = await window.db.collection('quests').doc('daily').get({ source: 'server' });
        // Extract the 'tasks' array from the document data
        const dailyQuestsRaw = dailyQuestsSnapshot.exists ? dailyQuestsSnapshot.data() : {};
        const dailyQuests = dailyQuestsRaw.tasks || []; // Ensure it's an array, default to empty if missing

        debugLog(`[QUEST DEBUG] Fetched ${dailyQuests.length} daily quests.`);

        // Update the daily quest count display
        dailyQuestCountEl.textContent = dailyQuests.length;
        // Check if any daily quests were found
        if (dailyQuests.length === 0) {
            dailyQuestList.innerHTML = `<li class="no-quests"><p>No daily quests available today.</p></li>`;
        } else {
            // Generate and insert the HTML for each daily quest item
            dailyQuestList.innerHTML = dailyQuests.map(quest => {
                // Validate the essential properties of the quest object
                if (!quest || !quest.id || !quest.title || quest.reward === undefined) {
                     console.warn("[QUEST WARN] Skipping rendering of invalid daily quest object:", quest);
                     debugLog("[QUEST WARN] Skipping invalid daily quest object.");
                     return ''; // Return empty string to skip this item
                }
                // Check if the quest has already been claimed by the user (using claimedQuests array)
                const isClaimed = userData.claimedQuests.includes(quest.id);
                // Determine button text and class based on claimed status
                const buttonText = isClaimed ? 'Claimed' : (quest.action || 'GO'); // Default action text is 'GO'
                const buttonClass = isClaimed ? 'claimed-button' : 'go-button';
                const buttonDisabled = isClaimed; // Disable button if already claimed
                const reward = Number(quest.reward) || 0; // Ensure reward is a number, default to 0

                // Return the HTML string for a single daily quest list item
                return `
                    <li class="quest-item" data-quest-id="${quest.id}" data-quest-type="daily">
                        <img src="${quest.icon || 'assets/icons/quest_placeholder.png'}" alt="${quest.title}" onerror="this.src='assets/icons/quest_placeholder.png'">
                        <span>${quest.title}</span>
                        <div class="quest-reward">
                            <img src="assets/icons/gem.png" alt="Gem">
                            <span>+${reward.toLocaleString()}</span>
                            <button class="${buttonClass}"
                                    data-quest-link="${quest.link || ''}"
                                    data-quest-reward="${reward}"
                                    ${buttonDisabled ? 'disabled' : ''}>
                                ${buttonText}
                            </button>
                        </div>
                    </li>
                `;
            }).join(''); // Join all the HTML strings into one large string to set innerHTML
        }
        debugLog("[QUEST DEBUG] Daily quests HTML rendered.");


        // --- Fetch Basic Quests from Firestore ---
        debugLog("[QUEST DEBUG] Fetching basic quests from Firestore...");
        // Fetch the 'basic' document from the 'quests' collection
        const basicQuestsSnapshot = await window.db.collection('quests').doc('basic').get({ source: 'server' });
        // Extract the 'tasks' array
        const basicQuestsRaw = basicQuestsSnapshot.exists ? basicQuestsSnapshot.data() : {};
        const basicQuests = basicQuestsRaw.tasks || []; // Ensure it's an array


         // --- Important: Initialize adProgress structure for NEW ad quests ---
         // This loop ensures that every ad quest found in Firestore has an entry
         // in the user's adProgress map in their user data document.
         let adProgressUpdateNeeded = false;
         const adProgressUpdate = {}; // Object to hold updates for Firestore

         (basicQuestsRaw.tasks || []).forEach(quest => { // Iterate over raw quests from DB
            // Check if it's an ad quest and if it has an ID
            if (quest.type === 'ads' && quest.id) {
                // Check if the user's adProgress map is missing an entry for this quest ID
                if (!userData.adProgress[quest.id]) {
                    // If missing, create a default progress object
                    userData.adProgress[quest.id] = { watched: 0, claimed: false, lastClaimed: null };
                    // Add this default object to the update object for Firestore
                    adProgressUpdate[`adProgress.${quest.id}`] = userData.adProgress[quest.id];
                    adProgressUpdateNeeded = true; // Flag that we need to update Firestore
                    debugLog(`[QUEST DEBUG] Initializing default adProgress for new quest: ${quest.id}`);
                }
            }
         });

         // If any new adProgress entries were initialized locally, update Firestore
         if (adProgressUpdateNeeded && window.telegramUser?.id) { // Ensure user ID exists before updating
            debugLog("[QUEST DEBUG] Ad progress updates needed. Writing to Firestore...");
            try {
                // Use update to set the new adProgress structures. merge is automatic for nested objects.
                 // Use window.db and window.telegramUser (globally available)
                await window.db.collection('userData').doc(window.telegramUser.id.toString()).update(adProgressUpdate);
                debugLog("[QUEST DEBUG] User data updated with initial adProgress structures in Firestore.");
                // After updating Firestore, it's a good practice to refresh the local user data cache
                // to ensure it reflects the latest state for subsequent operations.
                userData = window.currentUserData || await window.fetchAndUpdateUserData(); // Refresh cache
                if (!userData) throw new Error("User data unavailable after adProgress init update.");
                 // Re-ensure adProgress structure locally from the refetched data
                 userData.adProgress = userData.adProgress || {};
                 userData.claimedQuests = userData.claimedQuests || []; // Also ensure claimedQuests exists
            } catch (updateError) {
                 console.error("[QUEST ERROR] Failed to update user data with initial adProgress:", updateError);
                 debugLog(`[QUEST ERROR] Failed to update initial adProgress: ${updateError.message}`);
                 // Decide how to handle this error - maybe alert user or continue with potentially stale local data?
                 // For now, we log and continue, potentially rendering quests with missing progress info.
            }
         } else {
             debugLog("[QUEST DEBUG] No new ad progress structures needed or user ID missing.");
         }
         // --- End Initialization of adProgress ---


         debugLog(`[QUEST DEBUG] Fetched ${basicQuests.length} basic quests.`);

         // Update the basic quest count display
         basicQuestCountEl.textContent = basicQuests.length;
         // Check if any basic quests were found
         if (basicQuests.length === 0) {
             basicQuestList.innerHTML = `<li class="no-quests"><p>No basic quests available right now.</p></li>`;
         } else {
             const currentTime = new Date(); // Get current time once for cooldown checks
             // Use the cooldown constant from config.js (globally available)
             const cooldownPeriod = window.AD_QUEST_COOLDOWN_MS;

              // Log the user's ad progress data that will be used for rendering
              if (userData?.adProgress) {
                  debugLog("[QUEST DEBUG] User adProgress data used for rendering basic quests:", JSON.stringify(userData.adProgress));
              } else {
                   debugLog("[QUEST DEBUG] User adProgress data not available for rendering basic quests.");
              }


             // Generate and insert the HTML for each basic quest item
             basicQuestList.innerHTML = basicQuests.map(quest => {
                 // Validate the essential properties of the quest object
                 if (!quest || !quest.id || !quest.title || quest.reward === undefined) {
                      console.warn("[QUEST WARN] Skipping rendering of invalid basic quest object:", quest);
                      debugLog("[QUEST WARN] Skipping invalid basic quest object.");
                      return ''; // Skip this item
                 }

                 const questId = quest.id;
                 const questType = quest.type || 'default'; // Default type
                 const questTitle = quest.title;
                 const questIcon = quest.icon || 'assets/icons/quest_placeholder.png';
                 const questReward = Number(quest.reward) || 0;
                 const questAction = quest.action || 'GO'; // Default action text
                 // Ensure adLimit is treated as a number and is at least 1 for ad quests
                 const adLimit = questType === 'ads' ? Math.max(1, Number(quest.adLimit) || 1) : 0;
                 const adType = quest.adType || 'rewarded_interstitial'; // Default ad type for ads quest

                 // Log details of the quest being processed before generating HTML
                 debugLog(`[QUEST DEBUG] Processing Basic Quest: ${questTitle}`, {
                     id: questId, type: questType, rawAdLimit: quest.adLimit, calculatedAdLimit: adLimit, reward: questReward, adType: adType
                 });


                 let buttonText = questAction; // Default button text
                 let buttonClass = 'go-button'; // Default button class
                 let buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Default GO style
                 let buttonDisabled = false; // Button is enabled by default
                 let progressText = ''; // Text for ad progress (e.g., 1/5)

                 // --- Logic specific to 'ads' type quests ---
                 if (questType === 'ads') {
                     // Get the user's specific progress for this ad quest from the userData cache
                     const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };
                     // Display current watched count / required watch count
                     progressText = `<span class="progress">${adProgress.watched}/${adLimit}</span>`;

                     const isCompleted = adProgress.watched >= adLimit; // Check if watch limit is reached
                     const isClaimed = adProgress.claimed; // Check if the reward has been claimed

                     // Logic for cooldown on repeatable ad quests
                     const lastClaimedTime = adProgress.lastClaimed ? new Date(adProgress.lastClaimed) : null;
                     const timeSinceLastClaim = lastClaimedTime ? currentTime.getTime() - lastClaimedTime.getTime() : Infinity; // Time in milliseconds since last claim
                     let isCooldownOver = timeSinceLastClaim >= cooldownPeriod; // Check if cooldown period has passed

                     // --- Cooldown Reset Logic (Handle repeatable quests) ---
                     // If the quest is completed, claimed, AND the cooldown period is over, reset its progress.
                     // This reset allows the user to watch ads and claim the reward again.
                     // Note: This update is performed asynchronously and doesn't block UI rendering.
                     if (isCompleted && isClaimed && isCooldownOver) {
                         debugLog(`[QUEST DEBUG] Cooldown over for repeatable ad quest ${questId}. Resetting progress locally and asynchronously in Firestore.`);
                         // Update the local 'adProgress' object immediately for correct rendering in this cycle.
                         // This prevents the UI from showing "Claimed" or "Wait Xm" if the cooldown is actually over.
                         adProgress.watched = 0;
                         adProgress.claimed = false; // Reset claimed status
                         adProgress.lastClaimed = null; // Clear last claimed time
                         // Ensure the global cache reflects this local reset immediately
                         if(window.currentUserData?.adProgress?.[questId]) {
                             window.currentUserData.adProgress[questId] = { watched: 0, claimed: false, lastClaimed: null };
                         }


                         // Perform the Firestore update asynchronously (don't 'await' it here)
                         window.db.collection('userData').doc(window.telegramUser.id.toString()).update({
                             [`adProgress.${questId}`]: { watched: 0, claimed: false, lastClaimed: null }
                         }).then(() => {
                             debugLog(`[QUEST DEBUG] Firestore updated asynchronously for repeatable quest ${questId} reset.`);
                             // After the async update, you might consider refreshing the local cache again
                             // to be absolutely sure it's in sync, though updating the local adProgress object
                             // above should suffice for the immediate render.
                             // window.fetchAndUpdateUserData(); // Optional: Re-fetch user data after async update
                         }).catch(err => {
                             console.error(`[QUEST ERROR] Failed asynchronous Firestore reset for repeatable ad quest ${questId}:`, err);
                             debugLog(`[QUEST ERROR] Failed async Firestore reset for ${questId}: ${err.message}`);
                             // If the async update fails, the local state might be reset but DB is not.
                             // This could lead to inconsistencies. Robust error handling might require
                             // alerting the user or preventing the local UI update if the async call fails.
                             // For now, we proceed with the assumption the async update will eventually succeed or be retried.
                         });
                     }


                     // --- Button State Logic for 'ads' quests (using potentially reset adProgress) ---
                     if (adProgress.claimed && !isCooldownOver) {
                         // If already claimed and cooldown is NOT over, show wait time
                         const timeLeftMillis = cooldownPeriod - timeSinceLastClaim;
                         // Calculate minutes left, round up, ensure minimum of 1 minute
                         const timeLeftMinutes = Math.max(1, Math.ceil(timeLeftMillis / 60000));
                         buttonText = `Wait ${timeLeftMinutes}m`;
                         buttonClass = 'claimed-button'; // Use claimed-button class
                         buttonStyle = 'background: #666; cursor: default;'; // Greyed out style
                         buttonDisabled = true; // Disable the button during cooldown
                     } else if (isCompleted && !adProgress.claimed) {
                         // If ads are watched but not claimed yet
                         buttonText = 'Claim'; // Button text is "Claim"
                         buttonClass = 'claim-button active'; // Use claim-button, add 'active' for styling
                         buttonStyle = 'background: linear-gradient(to right, #00ff00, #66ff66);'; // Green gradient style
                         buttonDisabled = false; // Button is enabled to claim
                     } else if (isCompleted && adProgress.claimed && isCooldownOver) {
                         // If completed, claimed, and cooldown is OVER (after reset logic above runs)
                         // This state should revert to the initial "Watch Ad" or "GO" state.
                         buttonText = questAction; // Reset to the original action text
                         buttonClass = 'go-button'; // Reset to go-button class
                         buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Reset to go style
                         buttonDisabled = false; // Button is enabled to start again
                     }
                     else { // If not completed (adProgress.watched < adLimit)
                         buttonText = questAction; // Button text is the default action (e.g., "Watch Ad", "GO")
                         buttonClass = 'go-button'; // Use go-button class
                         buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Go style
                         buttonDisabled = false; // Button is enabled to watch more ads
                     }
                 } else { // --- Logic for Default quest types (e.g., 'daily', link visits) ---
                     // Check if the quest has been claimed using the general claimedQuests array
                     const isClaimed = userData.claimedQuests.includes(questId);
                     if (isClaimed) {
                         buttonText = 'Claimed'; // Text is "Claimed"
                         buttonClass = 'claimed-button'; // Use claimed-button class
                         buttonStyle = 'background: #666; cursor: default;'; // Greyed out style
                         buttonDisabled = true; // Button is disabled
                     } else {
                         buttonText = questAction; // Text is the default action (e.g., "GO", "Visit")
                         buttonClass = 'go-button'; // Use go-button class
                         buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Go style
                         buttonDisabled = false; // Button is enabled
                     }
                 }

                 // Return the HTML string for a single basic quest list item
                 return `
                     <li class="quest-item" data-quest-id="${questId}" data-quest-type="${questType}" data-ad-limit="${adLimit}" data-ad-type="${adType}">
                         <img src="${questIcon}" alt="${questTitle}" onerror="this.src='assets/icons/quest_placeholder.png'">
                         <span>${questTitle}</span>
                         <div class="quest-reward">
                             <img src="assets/icons/gem.png" alt="Gem">
                             <span>+${questReward.toLocaleString()}</span>
                             ${progressText} <button class="${buttonClass}"
                                     data-quest-link="${questLink}"
                                     data-quest-reward="${questReward}"
                                     style="${buttonStyle}"
                                     ${buttonDisabled ? 'disabled' : ''}>
                                 ${buttonText}
                             </button>
                         </div>
                     </li>
                 `;
             }).join(''); // Join all HTML strings
         }
         debugLog("[QUEST DEBUG] Basic quests HTML rendered.");

    } catch (error) {
        // Handle any errors that occurred during the fetch or rendering process
        console.error("[QUEST ERROR] Failed to update Earn section UI:", error);
        debugLog(`[QUEST ERROR] Failed to update Earn section UI: ${error.message}\n${error.stack}`);
        // Display user-friendly error messages in the UI lists
        dailyQuestList.innerHTML = `<li class="error"><p>Failed to load daily quests. Please try again later.</p></li>`;
        basicQuestList.innerHTML = `<li class="error"><p>Failed to load basic quests. Please try again later.</p></li>`;
        // Update counts to indicate error
        dailyQuestCountEl.textContent = 'ERR';
        basicQuestCountEl.textContent = 'ERR';
    }
}

// --- Quest Interaction Logic (Called by Global Event Listener in main.js) ---
// This function handles the click events on quest buttons
// This function is exposed globally for use by main.js's delegated event listener
async function handleQuestClick(button) {
    // Uses debugLog from utils.js (globally available)
    // Uses firebaseInitialized, db, firebase, analytics from firebaseService.js (implicitly global)
    // Uses telegramUser from telegramService.js (globally available)
    // Uses currentUserData, fetchAndUpdateUserData, updateUserStatsUI from uiUpdater.js (globally available)
    // Uses showAd from adService.js (globally available)
    // Uses AD_QUEST_COOLDOWN_MS from config.js (globally available)
    // Uses openTelegramLink from telegramService.js (globally available)
    // Calls updateEarnSectionUI from this file (implicitly global)

    // Find the parent quest item element
    const taskItem = button.closest('.quest-item');
    // If no parent quest item is found, this click wasn't on a quest button we handle here
    if (!taskItem) {
        debugLog("[QUEST ACTION] Clicked button is not inside a quest item. Ignoring.");
        return;
    }

    // Extract data attributes from the quest item and the button
    const questId = taskItem.dataset.questId;
    const questType = taskItem.dataset.questType;
    const reward = parseInt(button.dataset.questReward || '0'); // Ensure reward is a number
    const link = button.dataset.questLink || ''; // Get the link for link-based quests
    const adLimit = parseInt(taskItem.dataset.adLimit || '0'); // Get ad limit for ad quests
    const adType = taskItem.dataset.adType || 'rewarded_interstitial'; // Get ad type for ad quests

    // Log details of the quest button click
    debugLog(`[QUEST ACTION] Button clicked for quest: ${questId}`, { type: questType, reward, link: link || 'N/A', adLimit, adType });

    // --- Critical Check: Ensure Firebase, DB, and User are ready ---
    if (!window.firebaseInitialized || !window.db) {
        alert("Initialization error: Database connection not ready. Please reload.");
        debugLog("[QUEST ACTION ERROR] Firestore not ready for quest action.");
        return; // Stop if Firebase/DB isn't ready
     }
     if (!window.telegramUser || !window.telegramUser.id) {
         alert("Initialization error: User not identified. Please reload.");
         debugLog("[QUEST ACTION ERROR] User not identified.");
         return; // Stop if user isn't identified
     }
     debugLog("[QUEST ACTION] Firebase, DB, and User confirmed ready.");

    // Get a reference to the user's document in Firestore
    const userDocRef = window.db.collection('userData').doc(window.telegramUser.id.toString());

    // --- IMPORTANT: Fetch the latest user data *before* processing the click ---
    // This is crucial, especially for ad quests, to get the most up-to-date watch count and claimed status.
    let userData = await window.fetchAndUpdateUserData(); // Fetch fresh data and update cache
    if (!userData) {
        alert("Could not load your data to process the quest. Please try again.");
        debugLog("[QUEST ACTION ERROR] Failed to fetch user data before action.");
        return; // Stop if user data cannot be fetched
    }
    // Ensure sub-objects exist on the fetched user data
    userData.adProgress = userData.adProgress || {};
    userData.claimedQuests = userData.claimedQuests || [];
    debugLog("[QUEST ACTION] User data fetched successfully before action.");
    // debugLog("[QUEST ACTION] User Data Snapshot before action:", JSON.stringify(userData)); // Can be verbose


    // --- Handle CLAIM button clicks (specifically for completed ad quests) ---
    if (button.classList.contains('claim-button') && questType === 'ads') {
        debugLog(`[QUEST ACTION] Handling CLAIM for ad quest: ${questId}`);
        // Get the current ad progress for this specific quest
        const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };

        // Validate if the quest is actually completed and not yet claimed
        if (adProgress.watched < adLimit) {
            debugLog(`[QUEST ACTION WARN] Claim clicked but not enough ads watched for ${questId} (${adProgress.watched}/${adLimit}).`);
            alert("Please watch the required number of ads first before claiming.");
            return; // Stop if not completed
        }
        if (adProgress.claimed) {
            debugLog(`[QUEST ACTION WARN] Claim clicked but already claimed for ${questId}.`);
            // The UI should ideally prevent this by disabling the button, but this is a safety check.
            alert("Reward for this quest has already been claimed.");
            return; // Stop if already claimed
        }

        // Disable the claim button and show processing text
        button.disabled = true;
        button.textContent = 'Claiming...';

        try {
            debugLog(`[QUEST ACTION] Attempting to claim reward for quest ${questId}. Awarding ${reward} gems.`);
            const currentTimeISO = new Date().toISOString(); // Get current time in ISO format for timestamp

            // --- Update Firestore atomically ---
            // Use Firestore update to atomically increment gems and update the specific ad progress field.
            await userDocRef.update({
                gems: firebase.firestore.FieldValue.increment(reward), // Increment user's gem balance
                [`adProgress.${questId}`]: { // Update the specific ad progress object for this quest
                    watched: adProgress.watched, // Keep the watched count as it was when claiming
                    claimed: true, // Mark as claimed
                    lastClaimed: currentTimeISO // Record the time of claiming for cooldown
                 }
            });
            debugLog(`[QUEST ACTION] Ad quest ${questId} claimed successfully in Firestore.`);

            // Log analytics event for the claim
            // Uses analytics from firebaseService.js (implicitly global)
            if (window.analytics) window.analytics.logEvent('ads_quest_claimed', { userId: window.telegramUser.id, questId, reward });

            // Inform the user about the successful claim
            alert(`Reward claimed! You earned ${reward.toLocaleString()} gems.`);

             // --- Update UI after successful claim ---
             // Fetch the latest user data to update the cache with new gem balance and claimed status
             await window.fetchAndUpdateUserData(); // Refresh cache
             debugLog("[QUEST ACTION] User data refreshed after claim.");

             // Update the user stats display in the header
             await window.updateUserStatsUI(); // Update header/stats UI
             debugLog("[QUEST ACTION] User stats UI updated after claim.");

            // Refresh the Earn section UI to show the updated state (e.g., "Claimed" button, start cooldown timer)
            await updateEarnSectionUI(); // Re-render the quest list
            debugLog("[QUEST ACTION] Earn section UI updated after claim.");


        } catch (error) {
             // Handle errors during the Firestore update
             console.error("[QUEST ERROR] Error claiming ad reward:", error);
             debugLog(`[QUEST ERROR] Error claiming ad reward for ${questId}: ${error.message}`);
             alert("Failed to claim reward. Please try again."); // Inform the user

             // --- Update UI on claim failure ---
             // Re-enable the claim button
             button.disabled = false;
             button.textContent = 'Claim'; // Reset button text to "Claim"

             // It's important to refresh the UI to reflect the state *before* the failed attempt
             // in case any local state was changed incorrectly.
             // Re-fetching data and updating the UI ensures consistency.
             await window.fetchAndUpdateUserData(); // Refresh cache
             await updateEarnSectionUI(); // Re-render the quest list

        }
         // No finally block needed as button state and UI updates are handled in try/catch blocks
    }
    // --- Handle GO button clicks ---
    else if (button.classList.contains('go-button')) {
        debugLog(`[QUEST ACTION] Handling GO for quest: ${questId}`);

        // --- GO for Ad Quests (Manual Trigger via button) ---
        if (questType === 'ads') {
             debugLog(`[QUEST ACTION] Processing GO for ad quest: ${questId}`);
            // Get the current ad progress for this specific quest from the userData cache
            const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };
             debugLog(`[QUEST ACTION] Current ad progress for ${questId}: ${adProgress.watched}/${adLimit}, Claimed: ${adProgress.claimed}`);

            // Validate if the quest is already completed or claimed (should be prevented by UI state, but safety check)
            if (adProgress.watched >= adLimit) {
                debugLog(`[QUEST ACTION] Ad quest ${questId} already completed (${adProgress.watched}/${adLimit}). Ignoring GO click.`);
                alert("You have already watched the required ads for this quest. Please click 'Claim' if available.");
                // Update UI to ensure button state is correct (should be "Claim" or "Claimed")
                await updateEarnSectionUI();
                return;
             }
            if (adProgress.claimed) {
                 debugLog(`[QUEST ACTION] Ad quest ${questId} already claimed. Ignoring GO click.`);
                 alert("This quest has already been claimed.");
                 // Update UI to ensure button state is correct ("Claimed" or "Wait Xm")
                 await updateEarnSectionUI();
                 return;
            }

            // Check if the adType is 'inApp' - these are handled automatically and should not be triggered by a manual button click
            if (adType === 'inApp') {
                debugLog("[QUEST ACTION] Manual trigger attempted for 'inApp' ad type. This type is handled automatically by the ad service.");
                alert("This ad reward is handled automatically as you use the app.");
                // Update UI to ensure button state is correct (maybe disabled or different text?)
                await updateEarnSectionUI();
                return; // Prevent manual trigger
            }

            debugLog(`[QUEST ACTION] Attempting to show ad (${adType}) for quest: ${questId}`);
            // Disable the button and show loading text while the ad is loading/playing
            button.disabled = true;
            button.textContent = 'Loading Ad...';

            try {
                 // Call the showAd function from adService.js (globally available)
                 // This function returns a Promise that resolves when the ad is finished (watched, closed)
                 // or rejects if there was an error or the ad was closed early.
                await window.showAd(adType); // Pass the adType from the quest data
                debugLog(`[QUEST ACTION] showAd Promise resolved for quest: ${questId}. Ad finished.`);

                 // --- IMPORTANT: Re-fetch user data *after* the ad interaction ---
                 // This is critical because the ad progress might have been updated by the ad service SDK
                 // or another background process (less likely, but safe practice).
                 // Fetching fresh data ensures we get the correct 'watched' count before incrementing it.
                 const userDataAfterAd = await window.fetchAndUpdateUserData(); // Fetch fresh data
                 if (!userDataAfterAd) {
                     // If user data disappears after the ad, something is seriously wrong.
                     throw new Error("User data not found after ad completion.");
                 }
                 debugLog("[QUEST ACTION] User data refreshed after showAd resolved.");

                 // Use the LATEST known progress from the refreshed data before applying the increment
                 const currentAdProgress = userDataAfterAd.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
                 const newWatchedCount = currentAdProgress.watched + 1; // Calculate the new watched count

                 debugLog(`[QUEST ACTION] Updating ad progress in Firestore for ${questId}: watched ${newWatchedCount}/${adLimit}`);

                 // --- Update Firestore atomically ---
                 // Use Firestore update to increment the specific ad progress field for this quest.
                 // This update needs to be carefully structured to only update the 'watched' count
                 // and leave 'claimed' and 'lastClaimed' as they were.
                 // Using a simple update on a nested object like this works IF the nested object exists.
                 // If it might not exist, a transaction or ensure check is needed.
                 // Based on updateEarnSectionUI init logic, adProgress[questId] should exist now.
                 await userDocRef.update({
                     // Update just the 'watched' count using FieldValue.increment
                     // Note: Firestore increment on a nested field requires specifying the full path
                     [`adProgress.${questId}.watched`]: firebase.firestore.FieldValue.increment(1) // Use firebase global object
                     // Do NOT update 'claimed' or 'lastClaimed' here, that's for the CLAIM action.
                 });
                 debugLog(`[QUEST ACTION] Ad progress updated in Firestore for ${questId}: watched count is now ${newWatchedCount}.`);

                  // *** === THIS IS THE FIX FOR SYNC === ***
                  // Explicitly refresh the local cache *immediately* AFTER the successful Firestore update.
                  // This ensures that the subsequent updateEarnSectionUI call uses the very latest data,
                  // preventing the UI from showing the wrong watched count or enabling the Claim button prematurely.
                  await window.fetchAndUpdateUserData(); // Refresh global currentUserData cache
                  debugLog(`[QUEST ACTION] Refreshed local user data cache after Firestore update.`);
                  // *** ================================ ***

                 // Log analytics event for watching an ad
                 // Uses analytics from firebaseService.js (implicitly global)
                 if (window.analytics) window.analytics.logEvent('ads_quest_watch', { userId: window.telegramUser.id, questId, adType });

                 // Inform the user about their progress or if they can now claim
                 if (newWatchedCount >= adLimit) {
                     alert(`Ad watched! (${newWatchedCount}/${adLimit}) You have completed this quest. Click 'Claim' to get your reward.`);
                 } else {
                     alert(`Ad watched! Progress: ${newWatchedCount}/${adLimit}`);
                 }

                 // --- Update UI after successful ad watch and progress update ---
                 // Refresh the entire Earn section UI to reflect the new watched count and potentially updated button state ("Claim")
                 await updateEarnSectionUI(); // Re-render the quest list


             } catch (error) {
                 // Handle errors that occur while showing the ad or updating progress
                 console.error("[QUEST ERROR] Failed to show ad or update progress:", error);
                 debugLog(`[QUEST ERROR] Failed showing ad/updating progress for ${questId}: ${error.message}`);

                  // Inform the user about the failure
                  // Check the error message to provide more specific feedback if possible
                  const userFacingError = error.message.includes("closed early")
                     ? "Ad skipped or closed early. Progress not updated."
                     : `Failed to show ad: ${error.message || 'Unknown error'}. Please try again.`;
                  alert(userFacingError);

                 // --- Update UI on ad watch failure ---
                 // It's crucial to refresh the Earn section UI on failure to reset the button state
                 // (e.g., from "Loading Ad..." back to "Watch Ad" or "GO") based on the actual
                 // state in the database (which shouldn't have changed if the update failed).
                 await updateEarnSectionUI(); // Re-render the quest list

             }
             // No finally block needed as button state and UI updates are handled in both try and catch blocks.
        }
        // --- GO for Daily/Default Link Quests ---
        else { // questType is 'daily' or 'default'
             debugLog(`[QUEST ACTION] Processing GO for daily/default quest: ${questId}`);
            // Check if the quest has already been claimed using the general claimedQuests array
            if (userData.claimedQuests.includes(questId)) {
                debugLog(`[QUEST ACTION WARN] GO clicked but default quest ${questId} already claimed. Ignoring.`);
                 // The UI should ideally prevent this by disabling the button.
                 alert("This quest has already been completed.");
                 // Update UI to ensure button state is correct ("Claimed")
                 await updateEarnSectionUI();
                return;
             }
            // Check if a link is provided for link-based quests
            if (!link) {
                alert("No link or action associated with this quest.");
                debugLog(`[QUEST ACTION WARN] GO clicked for ${questId} but no link found.`);
                // Update UI to ensure button state is correct
                await updateEarnSectionUI();
                return;
             }

            debugLog(`[QUEST ACTION] Attempting to complete link/action quest ${questId}. Awarding ${reward} gems.`);
            // Disable the button and show processing text
            button.disabled = true;
            button.textContent = 'Processing...';

            try {
                 // --- Update Firestore atomically ---
                 // Use Firestore update to atomically increment gems and add the quest ID to the claimedQuests array.
                await userDocRef.update({
                    gems: firebase.firestore.FieldValue.increment(reward), // Increment user's gem balance
                    claimedQuests: firebase.firestore.FieldValue.arrayUnion(questId) // Add the quest ID to the claimedQuests array
                });
                debugLog(`[QUEST ACTION] Default/Daily quest ${questId} marked complete in Firestore. Awarded ${reward} gems.`);

                // Log analytics event for completing a quest
                // Uses analytics from firebaseService.js (implicitly global)
                if (window.analytics) window.analytics.logEvent('quest_completed', { userId: window.telegramUser.id, questId, reward });

                 // --- Open the link AFTER successfully updating the database ---
                 // This prevents awarding rewards if opening the link fails.
                 // Use openTelegramLink from telegramService.js (globally available)
                 window.openTelegramLink(link);

                // Inform the user about the successful completion and reward
                alert(`Quest completed! You earned ${reward.toLocaleString()} gems.`);

                // --- Update UI after successful completion ---
                // Fetch the latest user data to update the cache with new gem balance and claimed status
                await window.fetchAndUpdateUserData(); // Refresh cache
                debugLog("[QUEST ACTION] User data refreshed after default quest completion.");

                // Update the user stats display in the header
                await window.updateUserStatsUI(); // Update header/stats UI
                debugLog("[QUEST ACTION] User stats UI updated after default quest completion.");

                // Refresh the Earn section UI to show the updated state (e.g., "Claimed" button)
                await updateEarnSectionUI(); // Re-render the quest list
                debugLog("[QUEST ACTION] Earn section UI updated after default quest completion.");


            } catch (error) {
                // Handle errors during the Firestore update
                console.error("[QUEST ERROR] Error completing default/daily quest:", error);
                debugLog(`[QUEST ERROR] Error completing quest ${questId}: ${error.message}`);
                alert("Failed to complete quest. Please try again."); // Inform the user

                // --- Update UI on completion failure ---
                // Re-enable the button and reset its text
                button.disabled = false;
                button.textContent = questAction; // Reset text to the original action (e.g., "GO")

                // It's important to refresh the UI to reflect the state *before* the failed attempt.
                await window.fetchAndUpdateUserData(); // Refresh cache
                await updateEarnSectionUI(); // Re-render the quest list
            }
             // No finally block needed as button state and UI updates are handled in try/catch blocks.
        }
    }
    // If the click is on a button that is already disabled (e.g., "Claimed" or "Wait Xm"),
    // or if it's not a button within a quest-reward div, the click is silently ignored
    // by the initial `if (!button) return;` and `if (button.classList.contains('claimed-button') || button.disabled)` checks
    else if (button.classList.contains('claimed-button') || button.disabled) {
        debugLog(`[QUEST ACTION] Click ignored on disabled/claimed button for quest: ${questId}`);
    }
}

// Make the Earn section UI update and quest click handler functions globally available
window.updateEarnSectionUI = updateEarnSectionUI;
window.handleQuestClick = handleQuestClick; // This function will be called by the global listener in main.js
