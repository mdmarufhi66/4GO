// js/sections/invite.js

// --- Referral System Logic ---

// Generates the unique referral link for the current user
// This function is called by main.js during initialization and by button listeners
// This function is exposed globally for use by main.js and other modules
function generateReferralLink() {
    // Uses debugLog from utils.js (globally available)
    // Uses telegramUser from telegramService.js (globally available)
    // Uses REFERRAL_BOT_USERNAME from config.js (globally available)

    debugLog("[INVITE] Generating referral link...");
    // Ensure Telegram user data is available
    if (!window.telegramUser || !window.telegramUser.id) {
         debugLog("[INVITE WARN] Referral link generation skipped: No Telegram user ID available.");
         // Potentially disable invite/copy buttons if no user
         const inviteButton = document.querySelector('.invite-friend');
         const copyButton = document.querySelector('.copy-link');
         if (inviteButton) inviteButton.disabled = true;
         if (copyButton) copyButton.disabled = true;
         return null; // Return null if no link can be generated
    }

    // Use the bot username from config.js (globally available)
    const botUsername = window.REFERRAL_BOT_USERNAME;
    if (!botUsername || botUsername === 'fourgobot') {
         console.warn("[INVITE WARN] REFERRAL_BOT_USERNAME is not set or is the default placeholder. Referral links may not work.");
         debugLog("[INVITE WARN] REFERRAL_BOT_USERNAME is not configured.");
         // Consider alerting user or logging production error
         // alert("Warning: Referral links are not fully configured.");
    }

    // Construct the referral link using the bot's start parameter format
    // Link format: https://t.me/{bot_username}?start=ref_{user_id}
    const referralLink = `https://t.me/${botUsername}?start=ref_${window.telegramUser.id}`;

    debugLog("[INVITE] Referral link generated:", referralLink);

    // Note: The link is generated, but it's not automatically put into the DOM here.
    // The button listeners or updateInviteSectionUI can retrieve this link.
    return referralLink; // Return the generated link
}

// Checks for an incoming referral parameter in the Telegram Web App start parameter
// If found, it processes the referral by updating user data in Firestore.
// This function is called by main.js during app initialization.
// This function is exposed globally for use by main.js
async function handleReferral() {
     // Uses debugLog from utils.js (globally available)
     // Uses telegramUser, getTelegramStartParam from telegramService.js (globally available)
     // Uses firebaseInitialized, db, firebase, ensureFirebaseReady from firebaseService.js (implicitly global)
     // Uses fetchAndUpdateUserData from uiUpdater.js (globally available)
     // Uses analytics from firebaseService.js (implicitly global)
     // Uses REFERRAL_CREDIT_AMOUNT from config.js (globally available)

     debugLog("[INVITE] Checking for referral parameter...");

     // Ensure necessary services and user data are available
     if (!window.telegramUser || !window.telegramUser.id) {
        debugLog("[INVITE WARN] Referral check skipped: Telegram user ID not available.");
        return; // Cannot process referral without user ID
     }
     if (!window.firebaseInitialized || !window.db) {
        debugLog("[INVITE WARN] Referral check skipped: Firestore not initialized.");
        // ensureFirebaseReady should have been called before this, but defensive check
         // await window.ensureFirebaseReady(() => {}, 'handleReferral: Firebase check');
         // if (!window.firebaseInitialized || !window.db) return;
         return;
     }
     debugLog("[INVITE] Dependencies for referral handling are ready.");


     // Get the start parameter from the Telegram Web App init data
     // getTelegramStartParam is expected to be globally available from telegramService.js
     const startParam = window.getTelegramStartParam();
     debugLog(`[INVITE] Telegram start_param: ${startParam || 'None'}`);


     // Check if the start parameter exists and starts with the referral prefix 'ref_'
     if (startParam && startParam.startsWith('ref_')) {
         // Extract the referrer's user ID from the start parameter
         const referrerId = startParam.substring(4); // Get the part after 'ref_'
         const currentUserId = window.telegramUser.id.toString();

         debugLog(`[INVITE] Referral parameter found. Referrer ID: ${referrerId}, Current User ID: ${currentUserId}`);

         // Validate the referrer ID: must exist and not be the current user's ID
         if (!referrerId || referrerId === currentUserId) {
            debugLog("[INVITE WARN] Referral check skipped: Invalid or self-referral ID.");
            return; // Stop if referrer ID is invalid or user is referring themselves
         }
         debugLog(`[INVITE] Valid referral detected: User ${currentUserId} referred by ${referrerId}`);


         // Get references to the current user's and the referrer's documents in Firestore
         const currentUserRef = window.db.collection('userData').doc(currentUserId);
         const referrerRef = window.db.collection('userData').doc(referrerId);


         try {
              // --- Use a Firestore Transaction for Atomicity ---
              // A transaction ensures that checking if the current user is already referred
              // and updating both the current user's and the referrer's documents are done atomically.
              // If any part fails, the whole transaction is rolled back, preventing inconsistencies.
              debugLog("[INVITE] Starting referral processing transaction...");
              await window.db.runTransaction(async (transaction) => {
                  // 1. Read the current user's document *within* the transaction
                  const userDoc = await transaction.get(currentUserRef);
                   if (!userDoc.exists) {
                       // This is a critical error if the doc should exist by this point (initializeUserData)
                       throw new Error("Current user data not found in transaction. Cannot process referral.");
                   }
                  const userData = userDoc.data();

                  // 2. Check if the current user is *already* marked as referred
                  if (userData.isReferred) {
                      debugLog(`[INVITE TRANSACTION] User ${currentUserId} already referred by ${userData.referredBy || 'someone'}. Aborting transaction.`);
                      return; // Exit the transaction successfully without making any changes
                  }

                  debugLog(`[INVITE TRANSACTION] User ${currentUserId} is not yet referred. Proceeding.`);
                   // 3. Update the current user's document: Mark as referred and store referrer's ID
                   transaction.update(currentUserRef, { isReferred: true, referredBy: referrerId });
                   debugLog(`[INVITE TRANSACTION] Marked user ${currentUserId} as referred by ${referrerId}.`);


                   // 4. Check if the referrer's document exists before attempting to update it
                  const referrerDoc = await transaction.get(referrerRef);
                   if (referrerDoc.exists) {
                        // Get the credit amount from config.js (globally available)
                        const referralCreditAmount = window.REFERRAL_CREDIT_AMOUNT;

                        // Create a record for the referral
                        const newRecord = {
                            userId: currentUserId, // The ID of the referred user
                            // Use referred user's username/name from Telegram data (globally available)
                            username: window.telegramUser.username || window.telegramUser.first_name || `User_${currentUserId.slice(-4)}`,
                            joinTime: new Date().toISOString(), // Record the timestamp of the join
                            creditAwarded: referralCreditAmount, // Amount of credit awarded for this referral
                        };
                        debugLog("[INVITE TRANSACTION] Referral record created:", newRecord);


                        // 5. Update the referrer's document: Increment referral count, add credits, add invite record
                        transaction.update(referrerRef, {
                            referrals: firebase.firestore.FieldValue.increment(1), // Increment the referrer's count
                            referralCredits: firebase.firestore.FieldValue.increment(referralCreditAmount), // Add credits to the referrer
                            inviteRecords: firebase.firestore.FieldValue.arrayUnion(newRecord) // Add the new referral record to the array
                        });
                        debugLog(`[INVITE TRANSACTION] Referrer ${referrerId} data prepared for update: +1 referral, +${referralCreditAmount} credits, added record.`);

                         // Also update the referrer's ranking entry if needed (e.g., if medals are given for referrals)
                         // This would require reading the 'users' collection document within the transaction
                         // const referrerRankingRef = window.db.collection('users').doc(referrerId);
                         // transaction.update(referrerRankingRef, { /* updates like medal increment */ });

                   } else {
                       // If the referrer's document doesn't exist, we can't award credits or add a record to them.
                       // We still mark the current user as referred to prevent them from being referred again.
                       debugLog(`[INVITE TRANSACTION WARN] Referrer ${referrerId} document not found in transaction. Cannot award credits or add record.`);
                       // The transaction will still commit the update to the current user's document.
                   }
              });
              // --- Transaction End ---

             // If the transaction completed without errors (including successful early exit if already referred)
             debugLog("[INVITE] Referral transaction completed successfully.");

             // Log analytics event for a successful referral process (only when not already referred)
             // Uses analytics from firebaseService.js (implicitly global)
             // Check currentUserData again after the transaction to see if isReferred was just set
             const userDataAfterTx = window.currentUserData || await window.fetchAndUpdateUserData();
             if (userDataAfterTx && userDataAfterTx.isReferred && userDataAfterTx.referredBy === referrerId && !userData.isReferred) { // Check if it was just set in this transaction
                 if (window.analytics) window.analytics.logEvent('referral_success', { userId: currentUserId, referrerId });
                  debugLog("[INVITE] Analytics logged for new referral.");
             } else {
                  debugLog("[INVITE] Analytics not logged: user was already referred or transaction didn't mark as referred.");
             }


             // Refresh user data after successful referral processing to update local cache
             await window.fetchAndUpdateUserData(); // Update window.currentUserData
             debugLog("[INVITE] User data refreshed after referral handling.");


         } catch (error) {
             // Handle errors that occur during the Firestore transaction
             console.error("[INVITE ERROR] Error processing referral transaction:", error);
             debugLog(`[INVITE ERROR] Referral transaction failed: ${error.message}`);
             // Decide how to handle this error from a user perspective.
             // The transaction failed, so user data should be consistent (not marked as referred if it failed before commit).
             // Alerting the user might be confusing if the transaction rolled back.
             // Logging the error is important.
             // alert("There was an error processing your referral. Please try again."); // Optional alert
         }
     } else {
         debugLog("[INVITE] No referral parameter found or format is incorrect ('ref_').");
     }
 }

// --- Invite Section UI Update ---
// Updates the display of referral stats, invite records, and claim history.
// This function is exposed globally for use by navigation.js
async function updateInviteSectionUI() {
    // Uses debugLog from utils.js (globally available)
    // Uses currentUserData, fetchAndUpdateUserData from uiUpdater.js (globally available)
    // Uses REFERRAL_CREDIT_AMOUNT, CREDIT_CONVERSION_RATE, MINIMUM_CREDIT_CLAIM from config.js (globally available)
    // Uses formatTimestamp from utils.js (globally available)
    // Depends on elements existing in index.html within the invite section

    debugLog("[INVITE] Updating Invite section UI...");

     // Get references to the DOM elements that need updating
     const myInviteEl = document.getElementById('my-invite');
     // Select the span inside the total-credit div for the credit number
     const totalCreditNumberEl = document.querySelector('#total-credit-text');
     const totalCreditInfoEl = document.querySelector('.total-credit .credit-info small'); // Element containing the rate text and USDT icon
     const inviteRecordTitleEl = document.getElementById('invite-record-title');
     const recordListContainer = document.getElementById('invite-record-list');
     const invitePlaceholder = document.getElementById('invite-record-placeholder');
     const claimRecordListContainer = document.getElementById('claim-record-list');
     const claimPlaceholder = document.getElementById('claim-record-placeholder');
     // Get the claim button
     const claimButton = document.querySelector('.invite-section .claim-button');


     // Validate that the necessary DOM elements exist
     if (!myInviteEl || !totalCreditNumberEl || !totalCreditInfoEl || !inviteRecordTitleEl || !recordListContainer || !invitePlaceholder || !claimRecordListContainer || !claimPlaceholder || !claimButton) {
        console.error("[INVITE UI ERROR] Required DOM elements for invite section not found! Skipping UI update.");
        debugLog("[INVITE UI ERROR] Invite section elements missing from DOM.");
        // Optionally show a global error message or error state for the section
        return; // Stop the function if elements are missing
     }
     debugLog("[INVITE] Invite section UI elements found.");


     // Set initial loading state in the UI
     myInviteEl.textContent = `My Invite: ...`;
     // Use textContent for the span showing the number, keep the structure around it
     totalCreditNumberEl.textContent = `Total Credit ! : ...`;
     // Clear or set loading state for the conversion rate info
     totalCreditInfoEl.innerHTML = `Loading rate...`;
     inviteRecordTitleEl.textContent = `Invite Record (...)`;
     recordListContainer.innerHTML = ''; // Clear previous list content
     invitePlaceholder.style.display = 'block'; // Show placeholder initially
     invitePlaceholder.querySelector('p').textContent = 'Loading invites...'; // Set placeholder text
     claimRecordListContainer.innerHTML = ''; // Clear previous list content
     claimPlaceholder.style.display = 'block'; // Show placeholder initially
     claimPlaceholder.querySelector('p').textContent = 'Loading claim history...'; // Set placeholder text
     claimButton.disabled = true; // Disable claim button while loading data


     try {
         // Use cached user data if available, otherwise fetch fresh data.
         // The user data contains referrals, credits, and record arrays.
         // fetchAndUpdateUserData is expected to be globally available from uiUpdater.js
         const data = window.currentUserData || await window.fetchAndUpdateUserData();

         // Ensure user data is available before proceeding with rendering
         if (!data) {
             debugLog("[INVITE] User data not found for Invite UI update. Displaying default/empty state.");
             // Show appropriate default/empty state messages in the UI
             myInviteEl.textContent = `My Invite: 0`;
             totalCreditNumberEl.textContent = `Total Credit ! : 0`;
             // Display the conversion rate even if no user data
             totalCreditInfoEl.innerHTML = `${window.CREDIT_CONVERSION_RATE.toLocaleString()} C = 1 <img src="assets/icons/usdt.png" alt="USDT">`; // Use global constant
             inviteRecordTitleEl.textContent = `Invite Record (0)`;
             invitePlaceholder.style.display = 'block'; // Ensure placeholder is visible
             invitePlaceholder.querySelector('p').textContent = 'No invites yet'; // Set appropriate text
             claimPlaceholder.style.display = 'block'; // Ensure placeholder is visible
             claimPlaceholder.querySelector('p').textContent = 'No claim records yet'; // Set appropriate text
             claimButton.disabled = true; // Button remains disabled if no data
             return; // Stop the function
         }
         debugLog("[INVITE] User data loaded for Invite UI update.");
         // debugLog("[INVITE] User Data Snapshot:", JSON.stringify(data)); // Can be verbose

         // Extract relevant data fields, defaulting to empty/zero if missing
         const referrals = data.referrals || 0;
         const totalCredit = data.referralCredits || 0;
         const inviteRecords = data.inviteRecords || []; // Ensure it's an array
         const claimHistory = data.claimHistory || []; // Ensure it's an array


         // --- Update basic stats displays ---
         myInviteEl.textContent = `My Invite: ${referrals}`;
         totalCreditNumberEl.textContent = `Total Credit ! : ${totalCredit.toLocaleString()}`; // Format number with commas
         // Display the conversion rate below the total credit number
         totalCreditInfoEl.innerHTML = `${window.CREDIT_CONVERSION_RATE.toLocaleString()} C = 1 <img src="assets/icons/usdt.png" alt="USDT">`; // Use global constant

         inviteRecordTitleEl.textContent = `Invite Record (${referrals})`; // Update title with count


         // --- Populate Invite Records List ---
         if (inviteRecords.length === 0) {
             debugLog("[INVITE] No invite records found. Displaying placeholder.");
             recordListContainer.innerHTML = ''; // Ensure the list is empty
             invitePlaceholder.style.display = 'block'; // Show the "No invites yet" placeholder
             invitePlaceholder.querySelector('p').textContent = 'No invites yet'; // Set appropriate text
         } else {
             debugLog(`[INVITE] Found ${inviteRecords.length} invite records. Rendering list.`);
             invitePlaceholder.style.display = 'none'; // Hide the placeholder
             // Sort records by join time, newest first
             recordListContainer.innerHTML = inviteRecords
                 .sort((a, b) => {
                     // Use the formatTimestamp utility for safer date parsing/comparison
                     const dateA = new Date(a.joinTime || 0); // Use 0 for invalid/missing dates to avoid errors
                     const dateB = new Date(b.joinTime || 0);
                     return dateB.getTime() - dateA.getTime(); // Sort descending (newest first)
                 })
                 .map(record => {
                     // Format the join time using the utility function
                     const joinTime = window.formatTimestamp(record.joinTime); // Use global formatTimestamp
                     // Use a default username if missing
                     const username = record.username || 'Unknown User';
                     // Basic avatar placeholder based on the first letter of the username
                     const avatarLetter = (username === 'Unknown User' ? '?' : username[0]).toUpperCase();
                     const avatarUrl = `https://via.placeholder.com/40/808080/FFFFFF?text=${avatarLetter}`; // Example placeholder image service

                     // Return the HTML string for a single invite record list item
                     return `
                         <div class="record-item">
                             <img src="${avatarUrl}" alt="${username}">
                             <div class="user-info">
                                 <span>${username}</span>
                                 <small>${joinTime}</small>
                             </div>
                             <span class="credit">+${(record.creditAwarded || 0).toLocaleString()} C</span> </div>
                     `;
                 }).join(''); // Join all the HTML strings
             debugLog("[INVITE] Invite records HTML rendered.");
         }

         // --- Populate Claim Records List ---
         if (claimHistory.length === 0) {
             debugLog("[INVITE] No claim records found. Displaying placeholder.");
             claimRecordListContainer.innerHTML = ''; // Ensure the list is empty
             claimPlaceholder.style.display = 'block'; // Show the "No claim records yet" placeholder
             claimPlaceholder.querySelector('p').textContent = 'No claim records yet'; // Set appropriate text
         } else {
             debugLog(`[INVITE] Found ${claimHistory.length} claim records. Rendering list.`);
             claimPlaceholder.style.display = 'none'; // Hide the placeholder
             // Sort claim history by claim time, newest first
             claimRecordListContainer.innerHTML = claimHistory
                 .sort((a, b) => {
                     // Use the formatTimestamp utility for safer date parsing/comparison
                     const dateA = new Date(a.claimTime || 0); // Use 0 for invalid/missing dates
                     const dateB = new Date(b.claimTime || 0);
                     return dateB.getTime() - dateA.getTime(); // Sort descending
                 })
                 .map(record => {
                     // Format the claim time using the utility function
                     const claimTime = window.formatTimestamp(record.claimTime); // Use global formatTimestamp

                     // Return the HTML string for a single claim record list item
                     return `
                         <div class="record-item">
                             <img src="assets/icons/usdt.png" alt="USDT Claim" style="border-radius: 0;"> <div class="user-info">
                                 <span>Claimed ${record.usdtAmount?.toFixed(4) || '?'} USDT</span> <small>${claimTime}</small> </div>
                             <span class="credit" style="background: #00cc00;">-${record.creditsSpent?.toLocaleString() || '?'} C</span> </div>
                     `;
                 }).join(''); // Join all the HTML strings
             debugLog("[INVITE] Claim records HTML rendered.");
         }


         // --- Enable/Disable Claim Button ---
         // Check if the total available credit meets the minimum required for claiming.
         // Use global constants from config.js
         const minimumClaim = window.MINIMUM_CREDIT_CLAIM;
         if (totalCredit >= minimumClaim) {
             claimButton.disabled = false; // Enable the button
             claimButton.textContent = `Claim ${Math.floor(totalCredit / window.CREDIT_CONVERSION_RATE).toLocaleString()} USDT`; // Update text to show claimable amount
             claimButton.style.background = 'linear-gradient(to right, #00ff00, #66ff66)'; // Green gradient style
         } else {
             claimButton.disabled = true; // Disable the button
             claimButton.textContent = `Need ${minimumClaim.toLocaleString()} C`; // Show required amount
             claimButton.style.background = '#666'; // Greyed out style
         }
          debugLog(`[INVITE] Claim button state updated. Total Credits: ${totalCredit}, Minimum needed: ${minimumClaim}. Button disabled: ${claimButton.disabled}`);


     } catch (error) {
         // Handle errors during the fetch or rendering process
         console.error("[INVITE ERROR] Failed to update Invite section UI:", error);
         debugLog(`[INVITE ERROR] Failed to update Invite section UI: ${error.message}\n${error.stack}`);
         // Display user-friendly error messages in the UI
         myInviteEl.textContent = `My Invite: ERR`;
         totalCreditNumberEl.textContent = `Total Credit ! : ERR`;
         totalCreditInfoEl.innerHTML = 'Error loading rate';
         inviteRecordTitleEl.textContent = `Invite Record (ERR)`;
         invitePlaceholder.style.display = 'block';
         invitePlaceholder.querySelector('p').textContent = 'Error loading invites';
         claimPlaceholder.style.display = 'block';
         claimPlaceholder.querySelector('p').textContent = 'Error loading claims';
         claimButton.disabled = true; // Ensure button is disabled on error
         claimButton.textContent = 'Error';
     }
 }

 // --- Claim Credits Logic ---
 // This function handles the process of claiming referral credits for USDT.
 // It is called when the claim button is clicked (listener set up in initInviteSectionListeners).
 async function handleClaimCredits() {
     // Uses debugLog from utils.js (globally available)
     // Uses telegramUser from telegramService.js (globally available)
     // Uses db, firebase, firebaseInitialized, analytics from firebaseService.js (implicitly global)
     // Uses currentUserData, fetchAndUpdateUserData, updateUserStatsUI from uiUpdater.js (globally available)
     // Uses CREDIT_CONVERSION_RATE, MINIMUM_CREDIT_CLAIM from config.js (globally available)
     // Calls updateInviteSectionUI from this file (implicitly global)

     debugLog("[CREDIT CLAIM] Claim button clicked. Starting claim process.");

     // Get the claim button element
     const claimButton = document.querySelector('.invite-section .claim-button');

     // Ensure necessary services and user are ready
     if (!window.telegramUser || !window.telegramUser.id) {
         alert("Initialization error: User not identified. Please reload.");
         debugLog("[CREDIT CLAIM ERROR] User not identified.");
         // Update button state if needed
         if(claimButton) { claimButton.disabled = true; claimButton.textContent = 'Error'; }
         return; // Stop if user isn't ready
     }
     if (!window.firebaseInitialized || !window.db) {
         alert("Initialization error: Database connection not ready. Please reload.");
         debugLog("[CREDIT CLAIM ERROR] Firestore not ready.");
          // Update button state if needed
         if(claimButton) { claimButton.disabled = true; claimButton.textContent = 'Error'; }
         // ensureFirebaseReady should have been called before this...
         // await window.ensureFirebaseReady(() => {}, 'handleClaimCredits: Firebase check');
         // if (!window.firebaseInitialized || !window.db) return;
         return;
     }
     debugLog("[CREDIT CLAIM] Dependencies are ready.");


     // Ensure the claim button exists and is not already disabled
     if (!claimButton || claimButton.disabled) {
         debugLog("[CREDIT CLAIM WARN] Claim button not found or already disabled. Ignoring click.");
         return; // Stop if button is not in a clickable state
     }

     // Disable the button and show processing text
     claimButton.disabled = true;
     claimButton.textContent = 'Checking...';

     // Get a reference to the user's document
     const userDocRef = window.db.collection('userData').doc(window.telegramUser.id.toString());

     try {
         // --- Use a Firestore Transaction for Atomicity ---
         // This transaction ensures that checking the credit balance, deducting credits,
         // incrementing USDT, and adding the claim record happen together atomically.
         debugLog("[CREDIT CLAIM] Starting claim credits transaction...");
         const usdtClaimedAmount = await window.db.runTransaction(async (transaction) => {
             // 1. Read the user's document *within* the transaction to get the absolute latest credit balance
             const userDoc = await transaction.get(userDocRef);
             if (!userDoc.exists) {
                 // Critical error if the doc doesn't exist at this stage
                 throw new Error("User data document not found during claim transaction.");
             }
             const data = userDoc.data();
             const currentCredits = data.referralCredits || 0; // Get the latest credit balance

             // Get conversion rate and minimum claim from config.js (globally available)
             const conversionRate = window.CREDIT_CONVERSION_RATE;
             const minimumClaim = window.MINIMUM_CREDIT_CLAIM;

             debugLog(`[CREDIT CLAIM TRANSACTION] Current credits in TX: ${currentCredits}. Minimum needed: ${minimumClaim}.`);

             // 2. Check if the user has enough credits *within* the transaction
             if (currentCredits < minimumClaim) {
                 // Throw an error to abort the transaction if not enough credits
                 throw new Error(`Insufficient credits. Need ${minimumClaim.toLocaleString()}, have ${currentCredits.toLocaleString()}.`);
             }

             // 3. Calculate the amount of USDT to claim and the credits to spend
             // Use Math.floor to ensure we only claim whole units of USDT based on the conversion rate
             const calculatedUsdtToClaim = Math.floor(currentCredits / conversionRate);
             const creditsToSpend = calculatedUsdtToClaim * conversionRate; // The exact amount of credits corresponding to the whole USDT units

             debugLog(`[CREDIT CLAIM TRANSACTION] Attempting to claim ${calculatedUsdtToClaim} USDT for ${creditsToSpend} credits.`);
             // Update button text inside transaction if needed, though it might cause race conditions if UI updates outside are happening.
             // Better to update UI state *after* transaction success/failure.
             // claimButton.textContent = 'Claiming...';

             // 4. Create a record for this claim transaction
             const claimRecord = {
                 claimTime: new Date().toISOString(), // Timestamp for the claim
                 usdtAmount: calculatedUsdtToClaim, // Amount of USDT claimed
                 creditsSpent: creditsToSpend, // Amount of credits deducted
                 rate: conversionRate // Conversion rate used for this claim
             };
             debugLog("[CREDIT CLAIM TRANSACTION] Claim record created:", claimRecord);


             // 5. Prepare updates for the user's document *within* the transaction
             transaction.update(userDocRef, {
                 usdt: firebase.firestore.FieldValue.increment(calculatedUsdtToClaim), // Increment USDT balance
                 referralCredits: firebase.firestore.FieldValue.increment(-creditsToSpend), // Deduct spent credits
                 claimHistory: firebase.firestore.FieldValue.arrayUnion(claimRecord) // Add the claim record to the history array
             });
             debugLog(`[CREDIT CLAIM TRANSACTION] Firestore updates prepared: +${calculatedUsdtToClaim} USDT, -${creditsToSpend} C, added claim record.`);


             // Return the amount claimed from the transaction to be used outside
             return calculatedUsdtToClaim; // This value is returned by db.runTransaction if the transaction is successful
         });
         // --- Transaction End ---


         // If the transaction completes successfully, usdtClaimedAmount will hold the returned value
         debugLog(`[CREDIT CLAIM] Transaction successful. Successfully claimed ${usdtClaimedAmount} USDT.`);

         // Log analytics event for the successful claim
         // Uses analytics from firebaseService.js (implicitly global)
         if (window.analytics) window.analytics.logEvent('credit_claim', { userId: window.telegramUser.id, usdt: usdtClaimedAmount, creditsSpent: usdtClaimedAmount * window.CREDIT_CONVERSION_RATE }); // Log credits spent

         // Inform the user about the successful claim
         alert(`Successfully claimed ${usdtClaimedAmount.toFixed(4)} USDT!`); // Format USDT amount


         // --- Update UI after successful claim ---
         // Fetch the latest user data to update the cache with new balances and history
         await window.fetchAndUpdateUserData(); // Refresh global currentUserData cache
         debugLog("[CREDIT CLAIM] User data refreshed after claim.");

         // Update the user stats display in the header (gems, usdt, ton)
         await window.updateUserStatsUI(); // Update header/stats UI
         debugLog("[CREDIT CLAIM] User stats UI updated after claim.");

         // Refresh the Invite section UI to reflect the updated credit balance and claim history
         await updateInviteSectionUI(); // Re-render invite section UI
         debugLog("[CREDIT CLAIM] Invite section UI updated after claim.");


     } catch (error) {
         // Handle errors that occur during the Firestore transaction or validation
         console.error("[CREDIT CLAIM ERROR] Error claiming credits:", error);
         debugLog(`[CREDIT CLAIM ERROR] ${error.message}`);

         // Inform the user about the failure reason
         alert(`Failed to claim credits: ${error.message}`); // Show the specific error message to the user

         // --- Update UI on claim failure ---
         // It's important to refresh the Invite section UI on failure to reset the button state
         // and reflect the true credit balance (which should be unchanged if the transaction failed).
         // This prevents the button from being stuck in a processing state.
         await updateInviteSectionUI(); // Re-render the invite section UI

     } finally {
         // This block is called whether the try or catch block finishes.
         // Ensure the claim button is re-enabled in case the UI update didn't cover it for some error paths.
         // The updateInviteSectionUI function already sets the correct disabled state based on credit amount,
         // so this might be redundant if updateInviteSectionUI is always called, but provides safety.
         // claimButton.disabled = false;
         // updateInviteSectionUI() will set the correct text ("Claim" or "Need X C")
     }
 }


 // --- Event Listener Setup for Invite Section ---
 // Sets up click listeners for the Invite, Copy, and Claim buttons.
 // This function should be called by main.js during app initialization.
 // This function is exposed globally for use by main.js
 function initInviteSectionListeners() {
     // Uses debugLog from utils.js (globally available)
     // Uses generateReferralLink from this file (implicitly global)
     // Uses openTelegramLink from telegramService.js (globally available)
     // Uses handleClaimCredits from this file (implicitly global)
     // Uses analytics from firebaseService.js (implicitly global)

     debugLog("[INVITE] Setting up invite section listeners...");

     // Get references to the buttons
     const inviteButton = document.querySelector('.invite-friend');
     const copyButton = document.querySelector('.copy-link');
     const claimButton = document.querySelector('.invite-section .claim-button');


     // Set up listener for the "Invite Friend" button
     if (inviteButton) {
         // Remove existing listeners to prevent duplicates if this function is called multiple times
         const newInviteButton = inviteButton.cloneNode(true);
         inviteButton.parentNode?.replaceChild(newInviteButton, inviteButton);
         inviteButton = newInviteButton; // Update the reference


         inviteButton.addEventListener('click', () => {
             debugLog("[INVITE ACTION] 'Invite Friend' button clicked.");
             // Generate the referral link when the button is clicked
             const link = generateReferralLink(); // Call the function defined in this file

             if (link) {
                 // Open the link using Telegram's method or fallback to window.open
                 // openTelegramLink is expected to be globally available from telegramService.js
                window.openTelegramLink(link);
                debugLog("[INVITE ACTION] Opened Telegram invite link.");
                // Log analytics event
                if (window.analytics) window.analytics.logEvent('invite_friend_share', { userId: window.telegramUser?.id, method: 'telegram' }); // Use global analytics and telegramUser
             } else {
                 // Handle case where link could not be generated (e.g., no user ID)
                 alert("Could not generate referral link. Please ensure you are logged in.");
                 debugLog("[INVITE ACTION ERROR] Failed to open invite link: link was null.");
             }
         });
         debugLog("[INVITE] 'Invite Friend' button listener setup.");
     } else {
          debugLog("[INVITE WARN] 'Invite Friend' button element not found.");
     }

     // Set up listener for the "Copy Link" button
     if (copyButton) {
         // Remove existing listeners
         const newCopyButton = copyButton.cloneNode(true);
         copyButton.parentNode?.replaceChild(newCopyButton, copyButton);
         copyButton = newCopyButton; // Update the reference


         copyButton.addEventListener('click', () => {
             debugLog("[INVITE ACTION] 'Copy Link' button clicked.");
             // Generate the referral link when the button is clicked
             const link = generateReferralLink(); // Call the function defined in this file

             if (link) {
                 // Use the Clipboard API to copy the link
                 if (navigator.clipboard && navigator.clipboard.writeText) {
                     navigator.clipboard.writeText(link)
                         .then(() => {
                             // Success message
                             alert("Referral link copied!");
                             debugLog("[INVITE ACTION] Referral link copied to clipboard.");
                             // Log analytics event
                            if (window.analytics) window.analytics.logEvent('invite_friend_share', { userId: window.telegramUser?.id, method: 'copy' }); // Use global analytics and telegramUser
                         })
                         .catch(err => {
                             // Error handling for clipboard write
                             console.error("[INVITE ERROR] Failed to copy link to clipboard:", err);
                             debugLog(`[INVITE ERROR] Failed to copy link: ${err.message}`);
                             alert("Failed to copy link. Please try again or copy manually.");
                         });
                 } else {
                      // Fallback for browsers that don't support the Clipboard API
                      debugLog("[INVITE WARN] Clipboard API not available. Alerting link for manual copy.");
                      alert(`Clipboard access not available. Please copy the link manually:\n${link}`);
                 }
             } else {
                 // Handle case where link could not be generated
                 alert("Could not generate referral link. Please ensure you are logged in.");
                 debugLog("[INVITE ACTION ERROR] Failed to copy link: link was null.");
             }
         });
         debugLog("[INVITE] 'Copy Link' button listener setup.");
     } else {
         debugLog("[INVITE WARN] 'Copy Link' button element not found.");
     }

     // Set up listener for the "Claim" button
     if (claimButton) {
          // Remove existing listeners
          const newClaimButton = claimButton.cloneNode(true);
          claimButton.parentNode?.replaceChild(newClaimButton, claimButton);
          claimButton = newClaimButton; // Update the reference

         // Add the click listener, calling the handleClaimCredits function
         // handleClaimCredits is defined in this file and handles the claiming process
         claimButton.addEventListener('click', handleClaimCredits); // Call the handler function
         debugLog("[INVITE] 'Claim' button listener setup.");
     } else {
         debugLog("[INVITE WARN] 'Claim' button element not found.");
     }

     debugLog("[INVITE] Invite section listeners setup complete.");
 }


// Make the key Invite section functions available globally
window.generateReferralLink = generateReferralLink; // Called by initInviteSectionListeners
window.handleReferral = handleReferral; // Called by main.js
window.updateInviteSectionUI = updateInviteSectionUI; // Called by navigation.js
window.handleClaimCredits = handleClaimCredits; // Called by Claim button listener
window.initInviteSectionListeners = initInviteSectionListeners; // Called by main.js
