// js/sections/earn.js

async function updateEarnSectionUI() {
    debugLog("[QUEST DEBUG] Starting Earn section UI update...");
    const dailyQuestList = document.getElementById('daily-quest-list');
    const basicQuestList = document.getElementById('basic-quest-list');
    const dailyQuestCountEl = document.getElementById('daily-quest-count');
    const basicQuestCountEl = document.getElementById('basic-quest-count');

    if (!dailyQuestList || !basicQuestList || !dailyQuestCountEl || !basicQuestCountEl) {
        console.error("[QUEST ERROR] Required DOM elements for quests not found!");
        debugLog("[QUEST ERROR] Quest list or count elements missing from DOM.");
        return;
    }

    // Set initial loading state
    dailyQuestList.innerHTML = `<li class="loading"><p>Loading daily quests...</p></li>`;
    basicQuestList.innerHTML = `<li class="loading"><p>Loading basic quests...</p></li>`;
    dailyQuestCountEl.textContent = '-';
    basicQuestCountEl.textContent = '-';

    try {
        if (!firebaseInitialized || !db) { // Use globals from firebaseService.js
           throw new Error("Firestore not initialized for updating Earn section.");
        }
        // Use cached or fetch fresh user data
        let userData = window.currentUserData || await window.fetchAndUpdateUserData(); // Use globals from uiUpdater.js

        if (!userData) {
             throw new Error("User data not available for quest checks.");
        }
        // Ensure sub-objects exist
        userData.adProgress = userData.adProgress || {};
        userData.claimedQuests = userData.claimedQuests || [];
        debugLog("[QUEST DEBUG] User data loaded for quest checks.");


        // --- Fetch Daily Quests ---
        debugLog("[QUEST DEBUG] Fetching daily quests...");
        // Ensure Firestore instance 'db' is available
        const dailyQuestsSnapshot = await db.collection('quests').doc('daily').get({ source: 'server' });
        const dailyQuestsRaw = dailyQuestsSnapshot.exists ? dailyQuestsSnapshot.data() : {};
        const dailyQuests = dailyQuestsRaw.tasks || [];

        dailyQuestCountEl.textContent = dailyQuests.length;
        if (dailyQuests.length === 0) {
            dailyQuestList.innerHTML = `<li class="no-quests"><p>No daily quests available today.</p></li>`;
        } else {
            dailyQuestList.innerHTML = dailyQuests.map(quest => {
                // Validate quest object structure
                if (!quest || !quest.id || !quest.title || quest.reward === undefined) {
                     console.warn("Skipping invalid daily quest object:", quest);
                     return '';
                }
                const isClaimed = userData.claimedQuests.includes(quest.id);
                const buttonText = isClaimed ? 'Claimed' : (quest.action || 'GO');
                // Daily quests are typically non-repeatable link/action based, not ads
                const buttonClass = isClaimed ? 'claimed-button' : 'go-button';
                const buttonDisabled = isClaimed;
                const reward = Number(quest.reward) || 0;

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
            }).join('');
        }
        debugLog("[QUEST DEBUG] Daily quests rendered.");


        // --- Fetch Basic Quests ---
        debugLog("[QUEST DEBUG] Fetching basic quests...");
        const basicQuestsSnapshot = await db.collection('quests').doc('basic').get({ source: 'server' });
        const basicQuestsRaw = basicQuestsSnapshot.exists ? basicQuestsSnapshot.data() : {};
        const basicQuests = basicQuestsRaw.tasks || [];

         // Ensure adProgress structure is initialized for all ad quests if not present
         let adProgressUpdateNeeded = false;
         const adProgressUpdate = {};
         basicQuests.forEach(quest => {
            // Ensure quest and quest.id are valid before checking type
            if (quest && quest.id && quest.type === 'ads' && !userData.adProgress[quest.id]) {
                userData.adProgress[quest.id] = { watched: 0, claimed: false, lastClaimed: null };
                adProgressUpdate[`adProgress.${quest.id}`] = userData.adProgress[quest.id];
                adProgressUpdateNeeded = true;
                debugLog(`[QUEST DEBUG] Initializing adProgress for new quest: ${quest.id}`);
            }
         });
         if (adProgressUpdateNeeded && window.telegramUser?.id) { // Check user ID exists
            await db.collection('userData').doc(window.telegramUser.id.toString()).update(adProgressUpdate);
            debugLog("[QUEST DEBUG] Updated user data with initial adProgress structures.");
            // Re-fetch user data or merge update locally if needed immediately
            userData = await window.fetchAndUpdateUserData(); // Refresh data after update
            if (!userData) throw new Error("User data unavailable after adProgress init.");
            userData.adProgress = userData.adProgress || {}; // Ensure it exists after refetch
            userData.claimedQuests = userData.claimedQuests || [];
         }


        basicQuestCountEl.textContent = basicQuests.length;
        if (basicQuests.length === 0) {
            basicQuestList.innerHTML = `<li class="no-quests"><p>No basic quests available right now.</p></li>`;
        } else {
            const currentTime = new Date(); // Get current time once for cooldown checks
            const cooldownPeriod = AD_QUEST_COOLDOWN_MS; // Use constant from config.js

             if (userData?.adProgress) {
                 debugLog("[QUEST DEBUG] adProgress data used for rendering basic quests:", JSON.stringify(userData.adProgress));
             }

            basicQuestList.innerHTML = basicQuests.map(quest => {
                // Validate quest object structure
                if (!quest || !quest.id || !quest.title || quest.reward === undefined) {
                     console.warn("Skipping invalid basic quest object:", quest);
                     return '';
                }

                const questId = quest.id;
                const questType = quest.type || 'default';
                const questTitle = quest.title;
                const questIcon = quest.icon || 'assets/icons/quest_placeholder.png';
                const questReward = Number(quest.reward) || 0;
                const questAction = quest.action || 'GO';
                const questLink = quest.link || '';
                const adLimit = questType === 'ads' ? Math.max(1, Number(quest.adLimit) || 1) : 0;
                const adType = quest.adType || 'rewarded_interstitial'; // Default if not specified

                debugLog(`[QUEST DEBUG] Processing Basic Quest: ${questTitle}`, {
                    id: questId, type: questType, rawAdLimit: quest.adLimit, calculatedAdLimit: adLimit, reward: questReward, adType: adType
                });

                let buttonText = questAction;
                let buttonClass = 'go-button';
                let buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Default GO style
                let buttonDisabled = false;
                let progressText = '';

                if (questType === 'ads') {
                    const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };
                    progressText = `<span class="progress">${adProgress.watched}/${adLimit}</span>`;
                    const isCompleted = adProgress.watched >= adLimit;
                    let isClaimed = adProgress.claimed; // Use let to allow modification after cooldown reset
                    const lastClaimedTime = adProgress.lastClaimed ? new Date(adProgress.lastClaimed) : null;
                    const timeSinceLastClaim = lastClaimedTime ? currentTime - lastClaimedTime : Infinity;
                    let isCooldownOver = timeSinceLastClaim >= cooldownPeriod;

                    // Cooldown Reset Logic (handle potential errors during reset)
                    if (isClaimed && isCooldownOver) {
                        debugLog(`[QUEST DEBUG] Cooldown over for ad quest ${questId}. Resetting progress.`);
                        try {
                             // Asynchronously update Firestore
                             await db.collection('userData').doc(window.telegramUser.id.toString()).update({
                                 [`adProgress.${questId}`]: { watched: 0, claimed: false, lastClaimed: null }
                             });
                            // Update local state immediately for correct button rendering THIS RENDER CYCLE
                            adProgress.watched = 0;
                            adProgress.claimed = false; // Update local state
                            isClaimed = false; // Update variable used for button logic
                            adProgress.lastClaimed = null;
                            debugLog(`[QUEST DEBUG] Firestore updated asynchronously for ${questId} reset.`);
                             // Update the main userData cache
                             if(window.currentUserData?.adProgress?.[questId]) {
                                 window.currentUserData.adProgress[questId] = { watched: 0, claimed: false, lastClaimed: null };
                             }
                        } catch (resetError) {
                             console.error(`[QUEST ERROR] Failed Firestore reset for ${questId}:`, resetError);
                             debugLog(`[QUEST ERROR] Failed Firestore reset for ${questId}: ${resetError.message}`);
                             // Don't reset local state if DB update failed, keep showing cooldown timer
                             isCooldownOver = false; // Pretend cooldown isn't over for UI consistency
                        }
                    }

                    // Button State Logic (using potentially reset adProgress/isClaimed)
                    if (isClaimed && !isCooldownOver && lastClaimedTime) { // Added lastClaimedTime check
                        const timeLeftMillis = cooldownPeriod - timeSinceLastClaim;
                         const timeLeftMinutes = Math.max(1, Math.ceil(timeLeftMillis / 60000)); // Show at least 1m
                         buttonText = `Wait ${timeLeftMinutes}m`;
                         buttonClass = 'claimed-button';
                         buttonStyle = 'background: #ccc; cursor: default;';
                         buttonDisabled = true;
                    } else if (isCompleted && !isClaimed) {
                        buttonText = 'Claim';
                        buttonClass = 'claim-button active'; // Ensure 'active' class is present for styling
                        buttonStyle = 'background: linear-gradient(to right, #00ff00, #66ff66);'; // Claim style
                        buttonDisabled = false;
                    } else if (isCompleted && isClaimed) { // Already completed and claimed, waiting for cooldown
                         buttonText = 'Claimed'; // Or show cooldown timer again if needed
                         buttonClass = 'claimed-button';
                         buttonStyle = 'background: #ccc; cursor: default;';
                         buttonDisabled = true;
                    }
                     else { // Not completed
                        buttonText = questAction; // 'Watch Ad' or 'GO'
                        buttonClass = 'go-button';
                        buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Go style
                        buttonDisabled = false;
                    }
                } else { // Default quest type (e.g., visit link, join channel)
                    const isClaimed = userData.claimedQuests.includes(questId);
                    if (isClaimed) {
                        buttonText = 'Claimed';
                        buttonClass = 'claimed-button';
                        buttonStyle = 'background: #ccc; cursor: default;';
                        buttonDisabled = true;
                    } else {
                         buttonText = questAction; // 'GO', 'Join', etc.
                         buttonClass = 'go-button';
                         buttonStyle = 'background: linear-gradient(to right, #ff00ff, #ff6666);'; // Go style
                         buttonDisabled = false;
                    }
                }

                return `
                    <li class="quest-item" data-quest-id="${questId}" data-quest-type="${questType}" data-ad-limit="${adLimit}" data-ad-type="${adType}">
                        <img src="${questIcon}" alt="${questTitle}" onerror="this.src='assets/icons/quest_placeholder.png'">
                        <span>${questTitle}</span>
                        <div class="quest-reward">
                            <img src="assets/icons/gem.png" alt="Gem">
                            <span>+${questReward.toLocaleString()}</span>
                            ${progressText}
                            <button class="${buttonClass}"
                                    data-quest-link="${questLink}"
                                    data-quest-reward="${questReward}"
                                    style="${buttonStyle}"
                                    ${buttonDisabled ? 'disabled' : ''}>
                                ${buttonText}
                            </button>
                        </div>
                    </li>
                `;
            }).join('');
        }
        debugLog("[QUEST DEBUG] Basic quests rendered.");

    } catch (error) {
        console.error("[QUEST ERROR] Failed to update Earn section UI:", error);
        debugLog(`[QUEST ERROR] Failed to update Earn section UI: ${error.message}\n${error.stack}`);
        // Display error messages in the UI
        dailyQuestList.innerHTML = `<li class="error"><p>Failed to load daily quests. Please try again later.</p></li>`;
        basicQuestList.innerHTML = `<li class="error"><p>Failed to load basic quests. Please try again later.</p></li>`;
        dailyQuestCountEl.textContent = 'ERR';
        basicQuestCountEl.textContent = 'ERR';
    }
}


// --- Quest Interaction Logic ---
async function handleQuestClick(button) {
    const taskItem = button.closest('.quest-item');
    if (!taskItem) return;

    const questId = taskItem.dataset.questId;
    const questType = taskItem.dataset.questType;
    const reward = parseInt(button.dataset.questReward || '0');
    const link = button.dataset.questLink || '';
    const adLimit = parseInt(taskItem.dataset.adLimit || '0');
    const adType = taskItem.dataset.adType || 'rewarded_interstitial';

    debugLog(`[QUEST ACTION] Button clicked for quest: ${questId}`, { type: questType, reward, link: link || 'N/A', adLimit, adType });

    if (!firebaseInitialized || !db || !window.telegramUser || !window.telegramUser.id) {
        alert("Initialization error or user not identified. Please reload.");
        debugLog("[QUEST ACTION ERROR] Firestore or User not ready.");
        return;
     }

    const userDocRef = db.collection('userData').doc(window.telegramUser.id.toString());
    // --- IMPORTANT: Fetch latest user data *before* processing the click ---
    let userData = await window.fetchAndUpdateUserData(); // Use window prefix
    if (!userData) {
        alert("Could not load your data. Please try again.");
        debugLog("[QUEST ACTION ERROR] Failed to fetch user data before action.");
        return;
    }
    // Ensure sub-objects exist after fetching
    userData.adProgress = userData.adProgress || {};
    userData.claimedQuests = userData.claimedQuests || [];


    // --- Handle CLAIM button clicks (specifically for completed ad quests) ---
    if (button.classList.contains('claim-button') && questType === 'ads') {
        debugLog(`[QUEST ACTION] Handling CLAIM for ad quest: ${questId}`);
        const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };

        if (adProgress.watched < adLimit) {
            debugLog(`[QUEST ACTION WARN] Claim clicked but not enough ads watched for ${questId} (${adProgress.watched}/${adLimit})`);
            alert("Please watch the required number of ads first.");
            return; // Should not happen if UI is correct, but safety check
        }
        if (adProgress.claimed) {
            debugLog(`[QUEST ACTION WARN] Claim clicked but already claimed for ${questId}`);
            // UI should prevent this, but log it.
            return;
        }

        button.disabled = true; button.textContent = 'Claiming...';
        try {
            const currentTimeISO = new Date().toISOString();
            await userDocRef.update({
                gems: firebase.firestore.FieldValue.increment(reward), // Use firebase global
                [`adProgress.${questId}`]: { // Update the specific ad progress object
                    watched: adProgress.watched, // Keep watched count
                    claimed: true,
                    lastClaimed: currentTimeISO // Record claim time for cooldown
                 }
            });
            debugLog(`[QUEST ACTION] Ad quest ${questId} claimed successfully. Awarded ${reward} gems.`);
            if (window.analytics) window.analytics.logEvent('ads_quest_claimed', { userId: window.telegramUser.id, questId, reward }); // Use analytics global

            alert(`Reward claimed! You earned ${reward.toLocaleString()} gems.`);

             // Fetch latest data AFTER successful claim
             await window.fetchAndUpdateUserData();
            // Update UI elements
            await window.updateUserStatsUI(); // Use window prefix
            await updateEarnSectionUI(); // Update quest list specifically

        } catch (error) {
             console.error("[QUEST ERROR] Error claiming ad reward:", error);
             debugLog(`[QUEST ERROR] Error claiming ad reward for ${questId}: ${error.message}`);
             alert("Failed to claim reward. Please try again.");
             // Re-enable button ONLY if the error occurred, UI update will handle correct state on success
             button.disabled = false; button.textContent = 'Claim';
        }
    }
    // --- Handle GO button clicks ---
    else if (button.classList.contains('go-button')) {
        debugLog(`[QUEST ACTION] Handling GO for quest: ${questId}`);

        // --- GO for Ad Quests (Manual Trigger) ---
        if (questType === 'ads') {
            const adProgress = userData.adProgress[questId] || { watched: 0, claimed: false, lastClaimed: null };
            if (adProgress.watched >= adLimit) {
                debugLog(`[QUEST ACTION] Ad quest ${questId} already completed (${adProgress.watched}/${adLimit}). Ignoring GO click.`);
                alert("You have already watched the required ads. Click 'Claim' if available.");
                return;
             }
            if (adProgress.claimed) {
                 // If claimed, check cooldown (though button should be disabled by UI update)
                 const lastClaimedTime = adProgress.lastClaimed ? new Date(adProgress.lastClaimed) : null;
                 const timeSinceLastClaim = lastClaimedTime ? (new Date() - lastClaimedTime) : Infinity;
                 if (timeSinceLastClaim < AD_QUEST_COOLDOWN_MS) {
                     const timeLeftMinutes = Math.max(1, Math.ceil((AD_QUEST_COOLDOWN_MS - timeSinceLastClaim) / 60000));
                    alert(`Quest is on cooldown. Please wait ${timeLeftMinutes}m.`);
                    debugLog(`[QUEST ACTION] Ad quest ${questId} on cooldown. Ignoring GO click.`);
                    return;
                 } else {
                    // Cooldown finished, but somehow button didn't reset? Log warning.
                     debugLog(`[QUEST ACTION WARN] Cooldown finished for ${questId}, but GO button was clicked. UI might be out of sync.`);
                     // Proceed to show ad as if reset occurred
                 }
            }

            // Check if the adType is 'inApp' - handled automatically, reject manual trigger
            if (adType === 'inApp') {
                debugLog("[QUEST ACTION] Manual trigger attempted for 'inApp' ad type. This type is automatic.");
                alert("This ad reward is handled automatically as you use the app.");
                return; // Prevent manual trigger
            }

            debugLog(`[QUEST ACTION] Attempting to show ad (${adType}) for quest: ${questId}`);
            button.disabled = true; button.textContent = 'Loading Ad...';

            try {
                await window.showAd(adType); // Use adService function (window prefix)
                debugLog(`[QUEST ACTION] Ad shown successfully (or closed/skipped) for quest: ${questId}`);

                // --- IMPORTANT: Re-fetch user data *after* ad interaction, *before* update ---
                const userDataAfterAd = await window.fetchAndUpdateUserData(); // Use window prefix
                if (!userDataAfterAd) throw new Error("User data disappeared after ad.");

                // Use the LATEST known progress before applying the increment
                const currentAdProgress = userDataAfterAd.adProgress?.[questId] || { watched: 0, claimed: false, lastClaimed: null };
                const newWatchedCount = currentAdProgress.watched + 1;

                // --- Update Firestore ---
                await userDocRef.update({
                    [`adProgress.${questId}.watched`]: firebase.firestore.FieldValue.increment(1) // More atomic update for watched count
                    // Only update watched count here. Claim status/time handled by CLAIM action.
                });
                debugLog(`[QUEST ACTION] Ad progress updated in Firestore for ${questId}: ${newWatchedCount}/${adLimit}`);

                 // *** Refresh the local cache AFTER the successful update ***
                 await window.fetchAndUpdateUserData(); // Use window prefix
                 debugLog(`[QUEST ACTION] Refreshed local user data cache after Firestore update.`);

                if (window.analytics) window.analytics.logEvent('ads_quest_watch', { userId: window.telegramUser.id, questId, adType }); // Use analytics global

                // Show alert based on the new count
                if (newWatchedCount >= adLimit) {
                    alert(`Ad watched! (${newWatchedCount}/${adLimit}) You can now claim your reward.`);
                } else {
                    alert(`Ad watched! Progress: ${newWatchedCount}/${adLimit}`);
                }

                // --- Update UI (Now uses the refreshed cache) ---
                await updateEarnSectionUI(); // Refresh quest list

            } catch (error) {
                console.error("[QUEST ERROR] Failed to show ad or update progress:", error);
                debugLog(`[QUEST ERROR] Failed showing ad/updating progress for ${questId}: ${error.message}`);
                 // Check if the error message indicates ad not available vs user closed early
                 if (error.message.includes("closed early")) {
                     alert("Ad skipped or closed early. Progress not updated.");
                 } else {
                    alert(`Failed to show ad: ${error.message || 'Unknown error'}. Please try again.`); // Show specific error if possible
                 }
                 // Refresh UI to reset button state regardless of error type
                await updateEarnSectionUI();
            }
             // No finally needed as updateEarnSectionUI is called in both try and catch paths after ad attempt
        }
        // --- GO for Daily/Default Link Quests ---
        else { // questType is 'daily' or 'default'
            if (userData.claimedQuests.includes(questId)) {
                debugLog(`[QUEST ACTION WARN] GO clicked but default quest ${questId} already claimed.`);
                 // UI should prevent this
                return;
             }
            if (!link) {
                alert("No link associated with this quest.");
                debugLog(`[QUEST ACTION WARN] GO clicked for ${questId} but no link found.`);
                return;
             }

            debugLog(`[QUEST ACTION] Processing link/action for quest ${questId}: ${link}`);
            button.disabled = true; button.textContent = 'Processing...';
            try {
                await userDocRef.update({
                    gems: firebase.firestore.FieldValue.increment(reward), // Use firebase global
                    claimedQuests: firebase.firestore.FieldValue.arrayUnion(questId) // Use firebase global
                });
                debugLog(`[QUEST ACTION] Default/Daily quest ${questId} marked complete. Awarded ${reward} gems.`);
                if (window.analytics) window.analytics.logEvent('quest_completed', { userId: window.telegramUser.id, questId, reward }); // Use analytics global

                 // Open the link AFTER successfully updating the database
                 openTelegramLink(link); // Use telegramService function

                alert(`Quest completed! You earned ${reward.toLocaleString()} gems.`);

                // Refresh data and UI
                await window.fetchAndUpdateUserData(); // Use window prefix
                await window.updateUserStatsUI(); // Use window prefix
                await updateEarnSectionUI(); // Update quest list

            } catch (error) {
                console.error("[QUEST ERROR] Error completing default/daily quest:", error);
                debugLog(`[QUEST ERROR] Error completing quest ${questId}: ${error.message}`);
                alert("Failed to complete quest. Please try again.");
                // Re-enable button only on failure
                button.disabled = false; button.textContent = questAction; // Reset to original action text
            }
        }
    }
    // Ignore clicks on 'Claimed' or disabled/waiting buttons silently
    else if (button.classList.contains('claimed-button') || button.disabled) {
        debugLog(`[QUEST ACTION] Click ignored on disabled/claimed button for quest: ${questId}`);
    }
}

