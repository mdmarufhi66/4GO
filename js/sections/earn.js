// js/sections/earn.js

debugLog("earn.js script loaded."); // <-- ADDED DEBUG LOG

// Global state specific to chests (if not managed in main.js)
// let currentChestIndex = 0; // This seems to be misplaced here, belongs in chest.js
// const chests = CHESTS_DATA; // This belongs in chest.js

// Function to update the Earn section UI with quests
// This function is called by navigation.js's switchSection
async function updateEarnSectionUI() {
    debugLog("[EARN] Starting Earn section UI update..."); // <-- ADDED DEBUG LOG

    // Use debugLog from utils.js (globally available)
    // Uses firebaseInitialized, db from firebaseService.js (implicitly global)
    // Uses currentUserData, fetchAndUpdateUserData from uiUpdater.js (globally available)
    // Uses AD_QUEST_COOLDOWN_MS from config.js (globally available)
    // Uses formatTimestamp from utils.js (globally available)

    const dailyQuestList = document.getElementById('daily-quest-list');
    const basicQuestList = document.getElementById('basic-quest-list');
    const dailyQuestCountEl = document.getElementById('daily-quest-count');
    const basicQuestCountEl = document.getElementById('basic-quest-count');

    // Ensure all required DOM elements for quests are found
    if (!dailyQuestList || !basicQuestList || !dailyQuestCountEl || !basicQuestCountEl) {
        console.error("[EARN ERROR] Required DOM elements for quests not found!");
        debugLog("[EARN ERROR] Quest list or count elements missing from DOM."); // <-- ADDED DEBUG LOG
        // Display an error message in the section itself
        if (dailyQuestList) dailyQuestList.innerHTML = `<li class="error"><p>UI elements missing.</p></li>`;
        if (basicQuestList) basicQuestList.innerHTML = `<li class="error"><p>UI elements missing.</p></li>`;
        return; // Stop the function if elements are missing
    }

    // Set initial loading state in the UI
    dailyQuestList.innerHTML = `<li class="loading"><p>Loading daily quests...</p></li>`;
    basicQuestList.innerHTML = `<li class="loading"><p>Loading basic quests...</p></li>`;
    dailyQuestCountEl.textContent = '-';
    basicQuestCountEl.textContent = '-';
    debugLog("[EARN] Set initial loading state in UI."); // <-- ADDED DEBUG LOG


    try {
        // Ensure Firebase is initialized and the database instance is available
        if (!window.firebaseInitialized || !window.db) {
           const errorMsg = "Firestore not initialized for updating Earn section.";
           console.error("[EARN ERROR]", errorMsg);
           debugLog("[EARN ERROR]", errorMsg); // <-- ADDED DEBUG LOG
           throw new Error(errorMsg); // Throw to be caught below
        }
        debugLog("[EARN] Firestore is initialized."); // <-- ADDED DEBUG LOG


        // Use cached or fetch fresh user data
        // This is needed to check claimed quests and ad progress
        debugLog("[EARN] Fetching or using cached user data..."); // <-- ADDED DEBUG LOG
        let userData = window.currentUserData || await window.fetchAndUpdateUserData(); // Use globals from uiUpdater.js

        if (!userData) {
             const errorMsg = "User data not available for quest checks.";
             console.error("[EARN ERROR]", errorMsg);
             debugLog("[EARN ERROR]", errorMsg); // <-- ADDED DEBUG LOG
             throw new Error(errorMsg); // Throw to be caught below
        }
        // Ensure sub-objects exist in user data to prevent errors later
        userData.adProgress = userData.adProgress || {};
        userData.claimedQuests = userData.claimedQuests || [];
        debugLog("[EARN] User data loaded for quest checks. Structure ensured."); // <-- ADDED DEBUG LOG


        // --- Fetch Daily Quests ---
        debugLog("[EARN] Attempting to fetch daily quests from Firestore..."); // <-- ADDED DEBUG LOG
        // Ensure Firestore instance 'db' is available globally (from firebaseService.js)
        const dailyQuestsSnapshot = await window.db.collection('quests').doc('daily').get({ source: 'server' });
        debugLog("[EARN] Firestore query for daily quests finished."); // <-- ADDED DEBUG LOG

        const dailyQuestsRaw = dailyQuestsSnapshot.exists ? dailyQuestsSnapshot.data() : {};
        const dailyQuests = dailyQuestsRaw.tasks || []; // Get the tasks array, default to empty array
        debugLog(`[EARN] Fetched ${dailyQuests.length} raw daily quests.`, dailyQuestsRaw); // <-- ADDED DEBUG LOG


        // Render Daily Quests
        dailyQuestCountEl.textContent = dailyQuests.length; // Update count display
        if (dailyQuests.length === 0) {
            dailyQuestList.innerHTML = `<li class="no-quests"><p>No daily quests available today.</p></li>`;
            debugLog("[EARN] No daily quests found, displayed message."); // <-- ADDED DEBUG LOG
        } else {
            dailyQuestList.innerHTML = dailyQuests.map(quest => {
                // Validate essential quest object structure
                if (!quest || !quest.id || typeof quest.title !== 'string' || quest.reward === undefined) {
                     console.warn("[EARN WARN] Skipping invalid daily quest object:", quest);
                     debugLog("[EARN WARN] Skipping invalid daily quest object."); // <-- ADDED DEBUG LOG
                     return ''; // Return empty string for invalid quest HTML
                }
                const isClaimed = userData.claimedQuests.includes(quest.id);
                const buttonText = isClaimed ? 'Claimed' : (quest.action || 'GO');
                // Daily quests are typically non-repeatable link/action based, not ads
                const buttonClass = isClaimed ? 'claimed-button' : 'go-button';
                const buttonDisabled = isClaimed;
                const reward = Number(quest.reward) || 0; // Ensure reward is a number

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
            }).join(''); // Join array of HTML strings into a single string
            debugLog("[EARN] Daily quests rendered."); // <-- ADDED DEBUG LOG
        }


        // --- Fetch Basic Quests ---
        debugLog("[EARN] Attempting to fetch basic quests from Firestore..."); // <-- ADDED DEBUG LOG
        const basicQuestsSnapshot = await window.db.collection('quests').doc('basic').get({ source: 'server' });
        debugLog("[EARN] Firestore query for basic quests finished."); // <-- ADDED DEBUG LOG

        const basicQuestsRaw = basicQuestsSnapshot.exists ? basicQuestsSnapshot.data() : {};
        const basicQuests = basicQuestsRaw.tasks || []; // Get the tasks array, default to empty array
        debugLog(`[EARN] Fetched ${basicQuests.length} raw basic quests.`, basicQuestsRaw); // <-- ADDED DEBUG LOG

         // Ensure adProgress structure is initialized for all ad quests if not present
         // This updates user data in Firestore if new ad quests are found for the first time
         let adProgressUpdateNeeded = false;
         const adProgressUpdate = {};
         basicQuests.forEach(quest => {
            // Ensure quest and quest.id are valid before checking type
            if (quest && quest.id && quest.type === 'ads' && !userData.adProgress[quest.id]) {
                // Initialize progress for this specific ad quest
                userData.adProgress[quest.id] = { watched: 0, claimed: false, lastClaimed: null };
                // Prepare update object for Firestore using dot notation
                adProgressUpdate[`adProgress.${quest.id}`] = userData.adProgress[quest.id];
                adProgressUpdateNeeded = true; // Flag that an update is needed
                debugLog(`[EARN] Initializing adProgress structure for new quest: ${quest.id}`); // <-- ADDED DEBUG LOG
            }
         });

         // If new ad quests were found and user data needs updating in Firestore
         if (adProgressUpdateNeeded && window.telegramUser?.id) { // Check user ID exists
            debugLog("[EARN] Updating user data with initial adProgress structures..."); // <-- ADDED DEBUG LOG
            try {
                // Update the user document in Firestore
                 await window.db.collection('userData').doc(window.telegramUser.id.toString()).update(adProgressUpdate);
                 debugLog("[EARN] Firestore updated asynchronously for initial adProgress."); // <-- ADDED DEBUG LOG
                 // Re-fetch user data to ensure local cache (currentUserData) is consistent
                 // This fetch is important because the previous `userData` variable is based on potentially old data
                 userData = await window.fetchAndUpdateUserData(); // Refresh data after update
                 debugLog("[EARN] User data re-fetched after adProgress init update."); // <-- ADDED DEBUG LOG
                 if (!userData) throw new Error("User data unavailable after adProgress init."); // Should not happen if fetchAndUpdateUserData works
                 // Re-ensure structure just in case (belt and suspenders)
                 userData.adProgress = userData.adProgress || {};
                 userData.claimedQuests = userData.claimedQuests || [];
            } catch (updateError) {
                 console.error("[EARN ERROR] Failed Firestore update for initial adProgress:", updateError);
                 debugLog(`[EARN ERROR] Failed Firestore update for initial adProgress: ${updateError.message}`); // <-- ADDED DEBUG LOG
                 // Continue rendering with potentially stale adProgress for this cycle,
                 // the next app load or UI refresh should pick up correct structure.
            }
         }
        debugLog("[EARN] Ad progress structures ensured."); // <-- ADDED DEBUG LOG


        // Render Basic Quests
        basicQuestCountEl.textContent = basicQuests.length; // Update count display
        if (basicQuests.length === 0) {
            basicQuestList.innerHTML = `<li class="no-quests"><p>No basic quests available right now.</p></li>`;
             debugLog("[EARN] No basic quests found, displayed message."); // <-- ADDED DEBUG LOG
        } else {
            // Get current time once for cooldown checks
            const currentTime = new Date();
            const cooldownPeriod = window.AD_QUEST_COOLDOWN_MS; // Use global constant from config.js

             if (userData?.adProgress) {
                 debugLog("[EARN] adProgress data used for rendering basic quests:", JSON.stringify(userData.adProgress).substring(0, 200) + '...'); // Log start of data (can be large)
             } else {
                  debugLog("[EARN] adProgress data is null or undefined during basic quest render."); // <-- ADDED DEBUG LOG
             }

            basicQuestList.innerHTML = basicQuests.map(quest => {
                // Validate essential quest object structure
                if (!quest || !quest.id || typeof quest.title !== 'string' || quest.reward === undefined) {
                     console.warn("[EARN WARN] Skipping invalid basic quest object:", quest);
                      debugLog("[EARN WARN] Skipping invalid basic quest object."); // <-- ADDED DEBUG LOG
                     return ''; // Return empty string for invalid quest HTML
                }

                const questId = quest.id;
                const questType = quest.type || 'default';
                const questTitle = quest.title;
                const questIcon = quest.icon || 'assets/icons/quest_placeholder.png';
                const questReward = Number(quest.reward) || 0; // Ensure reward is a number
                const questAction = quest.action || 'GO';
                const questLink = quest.link || '';
                // Ensure adLimit is a positive number for 'ads' type
                const adLimit = questType === 'ads' ? Math.max(1, Number(quest.adLimit) || 1) : 0;
                const adType = quest.adType || 'rewarded_interstitial'; // Default if not specified

                // debugLog(`[EARN] Processing Basic Quest: ${questTitle}`, { // Can be very noisy
                //     id: questId, type: questType, adLimit: adLimit, reward: questReward, adType: adType
                // });

                let buttonText = questAction;
                let buttonClass = 'go-button';
                let buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Default GO style
                let buttonDisabled = false;
                let progressText = ''; // Text to show progress (e.g., 0/5)

                if (questType === 'ads') {
                    // Get ad progress for this specific quest from user data
                    const adProgress = userData.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
                     debugLog(`[EARN] Ad Quest ${questId} progress: watched=${adProgress.watched}, claimed=${adProgress.claimed}, lastClaimed=${adProgress.lastClaimed}`); // <-- ADDED DEBUG LOG

                    // Display progress text (e.g., 3/5)
                    progressText = `<span class="progress">${adProgress.watched}/${adLimit}</span>`;

                    const isCompleted = adProgress.watched >= adLimit; // Is the required number of ads watched?
                    let isClaimed = adProgress.claimed; // Has the reward been claimed?

                    const lastClaimedTime = adProgress.lastClaimed ? new Date(adProgress.lastClaimed) : null; // Parse last claimed time
                    // Calculate time since last claimed (handle null/invalid dates gracefully)
                    const timeSinceLastClaim = lastClaimedTime instanceof Date && !isNaN(lastClaimedTime.getTime()) ? (currentTime.getTime() - lastClaimedTime.getTime()) : Infinity;
                    let isCooldownOver = timeSinceLastClaim >= cooldownPeriod; // Is the cooldown period over?

                     debugLog(`[EARN] Ad Quest ${questId} checks: Completed=${isCompleted}, Claimed=${isClaimed}, CooldownOver=${isCooldownOver}, TimeSinceLastClaim=${timeSinceLastClaim}`); // <-- ADDED DEBUG LOG


                    // --- Cooldown Reset Logic ---
                    // If completed and claimed, and cooldown is over, reset the quest progress
                    // This needs to happen *before* determining the button state for the next cycle
                    if (isCompleted && isClaimed && isCooldownOver) {
                        debugLog(`[EARN] Cooldown over for ad quest ${questId}. Attempting to reset progress in Firestore.`); // <-- ADDED DEBUG LOG
                        try {
                             // Asynchronously update Firestore to reset the ad progress for this quest
                             // The UI will reflect the new state on the next render cycle (e.g., after a manual refresh or section switch)
                             // We update the local `userData` *after* the async update call for THIS render cycle's logic
                             const resetUpdate = { watched: 0, claimed: false, lastClaimed: null };
                             window.db.collection('userData').doc(window.telegramUser.id.toString()).update({
                                 [`adProgress.${questId}`]: resetUpdate
                             }).then(() => {
                                debugLog(`[EARN] Firestore reset successful for ${questId}.`);
                                // Optionally update local cache more reliably AFTER promise resolves
                                 if(window.currentUserData?.adProgress?.[questId]) {
                                     window.currentUserData.adProgress[questId] = resetUpdate;
                                 }
                             }).catch(resetError => {
                                 console.error(`[EARN ERROR] Failed Firestore reset for ${questId}:`, resetError);
                                 debugLog(`[EARN ERROR] Failed Firestore reset for ${questId}: ${resetError.message}`); // <-- ADDED DEBUG LOG
                                 // If reset fails, the UI might show 'Claimed' until a full refresh.
                             });

                            // --- Update local state *immediately* for correct button rendering THIS RENDER CYCLE ---
                            // Assume the reset *will* succeed for the UI logic *now*.
                            adProgress.watched = 0;
                            adProgress.claimed = false;
                            isClaimed = false; // Update variable used for button logic below
                            adProgress.lastClaimed = null;
                            isCooldownOver = false; // Reset cooldown status for UI logic
                             debugLog(`[EARN] Local state reset for ${questId} for immediate UI render.`); // <-- ADDED DEBUG LOG
                        } catch (resetErrorSync) {
                             // Catch sync errors during the update call setup itself
                             console.error(`[EARN ERROR] Synchronous error during Firestore reset setup for ${questId}:`, resetErrorSync);
                             debugLog(`[EARN ERROR] Sync error during Firestore reset setup: ${resetErrorSync.message}`); // <-- ADDED DEBUG LOG
                             // Do not reset local state if the update call setup failed
                             isCooldownOver = false; // Pretend cooldown isn't over for UI consistency if reset failed
                        }
                    }

                    // --- Button State Logic (using potentially reset adProgress/isClaimed/isCooldownOver) ---
                    if (isCompleted && isClaimed && !isCooldownOver) {
                         // Already completed AND claimed, and still within cooldown period
                         const timeLeftMillis = cooldownPeriod - timeSinceLastClaim;
                         // Show minutes left, minimum 1 minute
                         const timeLeftMinutes = Math.max(1, Math.ceil(timeLeftMillis / 60000));
                         buttonText = `Wait ${timeLeftMinutes}m`;
                         buttonClass = 'claimed-button'; // Use 'claimed-button' style for cooldown
                         buttonStyle = 'background: #ccc; cursor: default;'; // Grayed out
                         buttonDisabled = true;
                         debugLog(`[EARN] Ad quest ${questId} in cooldown state.`); // <-- ADDED DEBUG LOG

                    } else if (isCompleted && !isClaimed) {
                         // Completed, but not yet claimed
                         buttonText = 'Claim';
                         buttonClass = 'claim-button active'; // Use 'claim-button' style, make it active visually
                         buttonStyle = 'background: linear-gradient(to right, #00ff00, #66ff66);'; // Green Claim button
                         buttonDisabled = false; // Button is enabled
                         debugLog(`[EARN] Ad quest ${questId} ready to claim.`); // <-- ADDED DEBUG LOG

                    } else { // Not completed yet, or completed and claimed with cooldown over (handled by reset)
                        buttonText = questAction; // 'Watch Ad' or 'GO' from quest config
                        buttonClass = 'go-button'; // Use 'go-button' style
                        buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Default purple/pink GO style
                        // Button is enabled UNLESS it's an 'inApp' type which isn't manually triggered
                        buttonDisabled = (adType === 'inApp');
                         if (buttonDisabled) {
                             buttonText = 'Automatic'; // Indicate it's automatic
                             buttonStyle = 'background: #ccc; cursor: default;'; // Gray out automatic ones
                         }
                         debugLog(`[EARN] Ad quest ${questId} in GO state (watched < ${adLimit}). Disabled: ${buttonDisabled}`); // <-- ADDED DEBUG LOG
                    }
                } else { // Default quest type (e.g., visit link, join channel)
                    // Check if the quest ID is in the user's claimedQuests array
                    const isClaimed = userData.claimedQuests.includes(questId);
                    if (isClaimed) {
                        buttonText = 'Claimed'; // Already claimed
                        buttonClass = 'claimed-button'; // Use 'claimed-button' style
                        buttonStyle = 'background: #ccc; cursor: default;'; // Grayed out
                        buttonDisabled = true; // Button is disabled
                         debugLog(`[EARN] Default quest ${questId} already claimed.`); // <-- ADDED DEBUG LOG
                    } else {
                         buttonText = questAction; // 'GO', 'Join', etc. from quest config
                         buttonClass = 'go-button'; // Use 'go-button' style
                         buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Default GO style
                         buttonDisabled = false; // Button is enabled
                         debugLog(`[EARN] Default quest ${questId} ready to go.`); // <-- ADDED DEBUG LOG
                    }
                }

                // Return the HTML structure for this quest item
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
            }).join(''); // Join array of HTML strings into a single string
            debugLog("[EARN] Basic quests rendered."); // <-- ADDED DEBUG LOG
        }

        debugLog("--- [EARN] Earn section UI update finished successfully ---"); // <-- ADDED DEBUG LOG

    } catch (error) {
        // Handle errors that occur during the UI update process (fetching, processing, rendering)
        console.error("[EARN ERROR] Failed to update Earn section UI:", error);
        debugLog(`[EARN ERROR] Failed to update Earn section UI: ${error.message}\n${error.stack}`); // <-- ADDED DEBUG LOG
        // Display error messages in the UI where quests would normally show
        dailyQuestList.innerHTML = `<li class="error"><p>Failed to load daily quests. Please try again later.</p></li>`;
        basicQuestList.innerHTML = `<li class="error"><p>Failed to load basic quests. Please try again later.</p></li>`;
        dailyQuestCountEl.textContent = 'ERR'; // Indicate error in count
        basicQuestCountEl.textContent = 'ERR'; // Indicate error in count
         debugLog("[EARN] Displayed error messages in UI."); // <-- ADDED DEBUG LOG
    }
}


// --- Quest Interaction Logic ---
// This function is called by the global delegated click listener in main.js
async function handleQuestClick(button) {
     // Uses debugLog from utils.js (globally available)
     // Uses firebaseInitialized, db, firebase, analytics from firebaseService.js (implicitly global)
     // Uses telegramUser from telegramService.js (globally available)
     // Uses fetchAndUpdateUserData, updateUserStatsUI from uiUpdater.js (globally available)
     // Uses showAd from adService.js (globally available)
     // Uses AD_QUEST_COOLDOWN_MS from config.js (globally available)
     // Calls openTelegramLink from telegramService.js (globally available)
     // Calls updateEarnSectionUI from this file (implicitly global)


    const taskItem = button.closest('.quest-item'); // Find the parent quest item element
    if (!taskItem) {
        debugLog("[EARN ACTION] Quest button click - Parent quest item not found."); // <-- ADDED DEBUG LOG
        return; // Exit if parent item not found
    }

    // Extract data attributes from the quest item and button
    const questId = taskItem.dataset.questId;
    const questType = taskItem.dataset.questType;
    const reward = parseInt(button.dataset.questReward || '0'); // Ensure reward is an integer
    const link = button.dataset.questLink || '';
    // Ensure adLimit is an integer, default to 0 or 1 for ads
    const adLimit = parseInt(taskItem.dataset.adLimit || (questType === 'ads' ? '1' : '0'));
    const adType = taskItem.dataset.adType || 'rewarded_interstitial'; // Default ad type

    debugLog(`[EARN ACTION] Button clicked for quest: ${questId}`, { type: questType, reward, link: link || 'N/A', adLimit, adType }); // <-- ADDED DEBUG LOG


    // Ensure Firebase and User are ready before proceeding with any action
     if (!window.firebaseInitialized || !window.db || !window.telegramUser || !window.telegramUser.id) {
        const errorMsg = "Initialization error or user not identified. Please reload.";
        console.error("[EARN ACTION ERROR]", errorMsg);
        debugLog("[EARN ACTION ERROR]", errorMsg); // <-- ADDED DEBUG LOG
        alert(errorMsg);
        // Re-enable button or ensure UI updates to reflect non-actionable state
        button.disabled = false; // Attempt to re-enable the clicked button
        updateEarnSectionUI(); // Refresh the list state
        return; // Stop action
     }
     debugLog("[EARN ACTION] Firebase and User ready."); // <-- ADDED DEBUG LOG


    const userDocRef = window.db.collection('userData').doc(window.telegramUser.id.toString()); // Reference to the user's document

    // --- IMPORTANT: Fetch the latest user data *before* processing the click ---
    // This ensures we have the most up-to-date state for claimed quests and ad progress
    debugLog("[EARN ACTION] Fetching latest user data before processing..."); // <-- ADDED DEBUG LOG
    let userData = await window.fetchAndUpdateUserData(); // Use global function
    if (!userData) {
        const errorMsg = "Could not load your data. Please try again.";
        console.error("[EARN ACTION ERROR]", errorMsg);
        debugLog("[EARN ACTION ERROR]", errorMsg); // <-- ADDED DEBUG LOG
        alert(errorMsg);
         button.disabled = false; // Attempt to re-enable button
         updateEarnSectionUI(); // Refresh the list state
        return; // Stop action
    }
    // Ensure sub-objects exist after fetching for safety
    userData.adProgress = userData.adProgress || {};
    userData.claimedQuests = userData.claimedQuests || [];
    debugLog("[EARN ACTION] Latest user data fetched and structure ensured."); // <-- ADDED DEBUG LOG


    // --- Handle CLAIM button clicks (specifically for completed ad quests) ---
    if (button.classList.contains('claim-button') && questType === 'ads') {
        debugLog(`[EARN ACTION] Handling CLAIM for ad quest: ${questId}`); // <-- ADDED DEBUG LOG
        const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };

        // Double-check if the quest is actually completed and not yet claimed based on latest data
        if (adProgress.watched < adLimit) {
            debugLog(`[EARN ACTION WARN] Claim clicked but not enough ads watched for ${questId} (${adProgress.watched}/${adLimit}). Aborting claim.`); // <-- ADDED DEBUG LOG
            alert("Please watch the required number of ads first.");
             button.disabled = false; // Re-enable the button
             updateEarnSectionUI(); // Refresh UI state
            return; // Stop action
        }
        if (adProgress.claimed) {
            debugLog(`[EARN ACTION WARN] Claim clicked but already claimed for ${questId}. Aborting claim.`); // <-- ADDED DEBUG LOG
            // UI should ideally prevent this, but safety check here.
             button.disabled = false; // Re-enable the button
             updateEarnSectionUI(); // Refresh UI state
            return; // Stop action
        }

        // Disable button and show claiming state while processing
        button.disabled = true; button.textContent = 'Claiming...';
        debugLog("[EARN ACTION] Claim button disabled, text set to Claiming."); // <-- ADDED DEBUG LOG

        try {
            const currentTimeISO = new Date().toISOString(); // Get current time in ISO format
            debugLog(`[EARN ACTION] Updating Firestore for ad quest ${questId} claim...`); // <-- ADDED DEBUG LOG
            // Update user document: increment gems and update the specific ad progress entry
            await userDocRef.update({
                gems: firebase.firestore.FieldValue.increment(reward), // Use global firebase object
                [`adProgress.${questId}`]: { // Update the specific ad progress object
                    watched: adProgress.watched, // Keep the watched count as it was when claimed
                    claimed: true, // Mark as claimed
                    lastClaimed: currentTimeISO // Record claim time for cooldown
                 }
            });
            debugLog(`[EARN ACTION] Ad quest ${questId} claimed successfully. Awarded ${reward} gems. Firestore updated.`); // <-- ADDED DEBUG LOG

            // Log analytics event for the claim
            if (window.analytics) window.analytics.logEvent('ads_quest_claimed', { userId: window.telegramUser.id, questId, reward }); // Use global analytics

            // Inform the user
            alert(`Reward claimed! You earned ${reward.toLocaleString()} gems.`);

             // Refresh local user data cache with the latest changes
             await window.fetchAndUpdateUserData();
             debugLog("[EARN ACTION] User data re-fetched after claim."); // <-- ADDED DEBUG LOG

            // Update UI elements: header stats and the quest list state
            await window.updateUserStatsUI(); // Update header stats
            await updateEarnSectionUI(); // Refresh the quest list specifically to show 'Claimed' state

        } catch (error) {
             // Handle errors during the Firestore update for claiming
             console.error("[EARN ERROR] Error claiming ad reward:", error);
             debugLog(`[EARN ERROR] Error claiming ad reward for ${questId}: ${error.message}`); // <-- ADDED DEBUG LOG
             alert(`Failed to claim reward: ${error.message}. Please try again.`);
             // Ensure button is re-enabled and UI reflects the correct state (likely still claimable if update failed)
             button.disabled = false; button.textContent = 'Claim'; // Reset button text
             updateEarnSectionUI(); // Refresh UI state
        }
    }
    // --- Handle GO button clicks ---
    else if (button.classList.contains('go-button')) {
        debugLog(`[EARN ACTION] Handling GO for quest: ${questId}`); // <-- ADDED DEBUG LOG

        // --- GO for Ad Quests (Manual Trigger) ---
        if (questType === 'ads') {
            debugLog(`[EARN ACTION] GO clicked for Ad Quest: ${questId}`); // <-- ADDED DEBUG LOG
            const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };

            // Check if already completed or claimed and in cooldown
            if (adProgress.watched >= adLimit) {
                debugLog(`[EARN ACTION] Ad quest ${questId} already completed (${adProgress.watched}/${adLimit}). Ignoring GO click.`); // <-- ADDED DEBUG LOG
                alert("You have already watched the required ads. Click 'Claim' if available.");
                updateEarnSectionUI(); // Refresh UI state
                return; // Stop action
             }
            if (adProgress.claimed) {
                 const lastClaimedTime = adProgress.lastClaimed ? new Date(adProgress.lastClaimed) : null;
                 const timeSinceLastClaim = lastClaimedTime ? (new Date() - lastClaimedTime) : Infinity;
                 // Check if still within cooldown period
                 if (timeSinceLastClaim < window.AD_QUEST_COOLDOWN_MS) {
                     const timeLeftMinutes = Math.max(1, Math.ceil((window.AD_QUEST_COOLDOWN_MS - timeSinceLastClaim) / 60000));
                     alert(`Quest is on cooldown. Please wait ${timeLeftMinutes}m.`);
                     debugLog(`[EARN ACTION] Ad quest ${questId} on cooldown. Ignoring GO click.`); // <-- ADDED DEBUG LOG
                     updateEarnSectionUI(); // Refresh UI state
                    return; // Stop action
                 } else {
                    // Cooldown finished, but somehow button wasn't updated?
                     debugLog(`[EARN ACTION WARN] Cooldown finished for ${questId}, but GO button was clicked. UI might be out of sync. Proceeding as if reset.`); // <-- ADDED DEBUG LOG
                     // Proceed to show ad as if reset occurred - the UI update after ad will handle the reset logic if it wasn't done prior.
                 }
            }

            // Check if the adType is 'inApp' - these are handled automatically, reject manual trigger
            if (adType === 'inApp') {
                debugLog("[EARN ACTION WARN] Manual trigger attempted for 'inApp' ad type. This type is automatic."); // <-- ADDED DEBUG LOG
                alert("This ad reward is handled automatically as you use the app.");
                updateEarnSectionUI(); // Refresh UI state
                return; // Prevent manual trigger
            }

            // Attempt to show the ad
            debugLog(`[EARN ACTION] Attempting to show ad (${adType}) for quest: ${questId}`); // <-- ADDED DEBUG LOG
            button.disabled = true; button.textContent = 'Loading Ad...'; // Disable button and show loading state
            debugLog("[EARN ACTION] GO button disabled, text set to Loading Ad."); // <-- ADDED DEBUG LOG

            try {
                // Call the showAd function from adService.js (globally available)
                // This promise resolves when the ad is shown or closed.
                await window.showAd(adType);
                debugLog(`[EARN ACTION] Ad shown successfully (or closed/skipped) for quest: ${questId}.`); // <-- ADDED DEBUG LOG

                // --- IMPORTANT: Re-fetch user data *after* ad interaction, *before* updating Firestore ---
                // This gets the absolute latest state, crucial if other ads/quests were completed concurrently
                debugLog("[EARN ACTION] Re-fetching user data after ad interaction..."); // <-- ADDED DEBUG LOG
                const userDataAfterAd = await window.fetchAndUpdateUserData(); // Use global function
                if (!userDataAfterAd) {
                     const errorMsg = "User data disappeared after ad.";
                     console.error("[EARN ACTION ERROR]", errorMsg);
                     debugLog("[EARN ACTION ERROR]", errorMsg); // <-- ADDED DEBUG LOG
                     throw new Error(errorMsg); // Propagate error
                }
                 // Ensure structure exists in the re-fetched data
                userDataAfterAd.adProgress = userDataAfterAd.adProgress || {};

                // Get the LATEST known progress for THIS specific quest
                const currentAdProgress = userDataAfterAd.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
                const newWatchedCount = currentAdProgress.watched + 1;
                 debugLog(`[EARN ACTION] Ad watched. Current watched count: ${currentAdProgress.watched}, New count: ${newWatchedCount}`); // <-- ADDED DEBUG LOG


                // --- Update Firestore: Increment the watched count ---
                debugLog(`[EARN ACTION] Updating Firestore: Incrementing adProgress.${questId}.watched by 1.`); // <-- ADDED DEBUG LOG
                // Use firebase.firestore.FieldValue.increment for an atomic update
                await userDocRef.update({
                    [`adProgress.${questId}.watched`]: firebase.firestore.FieldValue.increment(1)
                    // Only update watched count here. Claim status/time handled by the CLAIM action.
                });
                debugLog(`[EARN ACTION] Ad progress updated in Firestore for ${questId}.`); // <-- ADDED DEBUG LOG


                 // *** Refresh the local cache AFTER the successful Firestore update ***
                 // This ensures window.currentUserData is consistent with the database
                 await window.fetchAndUpdateUserData(); // Use global function
                 debugLog(`[EARN ACTION] Refreshed local user data cache after Firestore update.`); // <-- ADDED DEBUG LOG


                // Log analytics event for the ad watch
                if (window.analytics) window.analytics.logEvent('ads_quest_watch', { userId: window.telegramUser.id, questId, adType }); // Use global analytics


                // Inform the user about their progress or completion
                // Use the `userDataAfterAd` (or refetched currentUserData) for the most accurate count to show the user
                const latestUserData = window.currentUserData || userDataAfterAd; // Prefer latest cache
                const latestWatchedCount = latestUserData?.adProgress?.[questId]?.watched ?? newWatchedCount; // Use updated count or fallback

                if (latestWatchedCount >= adLimit) {
                    alert(`Ad watched! (${latestWatchedCount}/${adLimit}) You can now claim your reward.`);
                } else {
                    alert(`Ad watched! Progress: ${latestWatchedCount}/${adLimit}`);
                }

                // --- Update UI (Now uses the refreshed cache) ---
                debugLog("[EARN ACTION] Calling updateEarnSectionUI() to refresh quest list."); // <-- ADDED DEBUG LOG
                await updateEarnSectionUI(); // Refresh the quest list to show updated progress or Claim button state

            } catch (error) {
                // Handle errors during ad showing or progress updating
                console.error("[EARN ERROR] Failed to show ad or update progress:", error);
                debugLog(`[EARN ERROR] Failed showing ad/updating progress for ${questId}: ${error.message}`); // <-- ADDED DEBUG LOG
                 // Check if the error message indicates the user closed the ad early vs a technical failure
                 if (error.message.includes("closed early")) {
                     alert("Ad skipped or closed early. Progress not updated.");
                 } else {
                    alert(`Failed to show ad: ${error.message || 'Unknown error'}. Please try again.`); // Show specific error if possible
                 }
                 // Refresh UI to reset button state based on actual state after failure
                 debugLog("[EARN ACTION] Calling updateEarnSectionUI() after ad error."); // <-- ADDED DEBUG LOG
                await updateEarnSectionUI(); // Re-enable button and update UI
            }
             // No finally needed as updateEarnSectionUI is called in both try and catch paths after ad attempt
        }
        // --- GO for Daily/Default Link Quests ---
        else { // questType is 'daily' or 'default'
            debugLog(`[EARN ACTION] GO clicked for Default/Daily Quest: ${questId}`); // <-- ADDED DEBUG LOG
            // Check if the quest is already claimed based on latest data
            if (userData.claimedQuests.includes(questId)) {
                debugLog(`[EARN ACTION WARN] GO clicked but default quest ${questId} already claimed. Aborting.`); // <-- ADDED DEBUG LOG
                 // UI should ideally prevent this
                alert("This quest has already been claimed.");
                 button.disabled = false; // Re-enable button
                 updateEarnSectionUI(); // Refresh UI state
                return; // Stop action
             }
            // Check if a link is provided for link-based quests
            if (!link) {
                debugLog(`[EARN ACTION WARN] GO clicked for ${questId} but no link found.`); // <-- ADDED DEBUG LOG
                alert("No link associated with this quest.");
                 button.disabled = false; // Re-enable button
                 updateEarnSectionUI(); // Refresh UI state
                return; // Stop action
             }

            debugLog(`[EARN ACTION] Processing link/action for quest ${questId}: ${link}`); // <-- ADDED DEBUG LOG
            button.disabled = true; button.textContent = 'Processing...'; // Disable button and show processing state
            debugLog("[EARN ACTION] GO button disabled, text set to Processing."); // <-- ADDED DEBUG LOG

            try {
                debugLog(`[EARN ACTION] Updating Firestore for default quest ${questId} completion...`); // <-- ADDED DEBUG LOG
                // Update user document: increment gems and add quest ID to claimedQuests array
                await userDocRef.update({
                    gems: firebase.firestore.FieldValue.increment(reward), // Use global firebase object
                    claimedQuests: firebase.firestore.FieldValue.arrayUnion(questId) // Use global firebase object
                });
                debugLog(`[EARN ACTION] Default/Daily quest ${questId} marked complete. Awarded ${reward} gems. Firestore updated.`); // <-- ADDED DEBUG LOG

                // Log analytics event for the completion
                if (window.analytics) window.analytics.logEvent('quest_completed', { userId: window.telegramUser.id, questId, reward }); // Use global analytics

                 // Open the link AFTER successfully updating the database
                 debugLog(`[EARN ACTION] Opening Telegram link: ${link}`); // <-- ADDED DEBUG LOG
                 window.openTelegramLink(link); // Use global function from telegramService.js

                // Inform the user
                alert(`Quest completed! You earned ${reward.toLocaleString()} gems.`);

                // Refresh local user data cache and update UI elements
                await window.fetchAndUpdateUserData(); // Refresh cache
                debugLog("[EARN ACTION] User data re-fetched after default quest completion."); // <-- ADDED DEBUG LOG
                await window.updateUserStatsUI(); // Update header stats
                await updateEarnSectionUI(); // Refresh the quest list to show 'Claimed' state

            } catch (error) {
                // Handle errors during the Firestore update for completing the quest
                console.error("[EARN ERROR] Error completing default/daily quest:", error);
                debugLog(`[EARN ERROR] Error completing quest ${questId}: ${error.message}`); // <-- ADDED DEBUG LOG
                alert(`Failed to complete quest: ${error.message}. Please try again.`);
                // Re-enable button and update UI on failure
                 button.disabled = false; button.textContent = questAction; // Reset to original action text
                 updateEarnSectionUI(); // Refresh UI state
            }
        }
    }
    // Ignore clicks on 'Claimed' or disabled/waiting buttons silently
    else if (button.classList.contains('claimed-button') || button.disabled) {
        debugLog(`[EARN ACTION] Click ignored on disabled/claimed button for quest: ${questId}`); // <-- ADDED DEBUG LOG
    }
}

// Make updateEarnSectionUI available globally for navigation.js
window.updateEarnSectionUI = updateEarnSectionUI;
// handleQuestClick is called by the global event listener in main.js, no need to globalize it explicitly
// window.handleQuestClick = handleQuestClick; // Not strictly needed if only called by delegated listener


