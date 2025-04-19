// js/sections/invite.js

function generateReferralLink() {
    debugLog("Generating referral link...");
    // Needs global telegramUser
    if (!window.telegramUser || !window.telegramUser.id) {
         debugLog("Referral link generation skipped: No user ID.");
         return null; // Return null if no link generated
    }
    // Use constant from config.js
    const referralLink = `https://t.me/${REFERRAL_BOT_USERNAME}?start=ref_${window.telegramUser.id}`;
    debugLog("Referral link generated:", referralLink);
    return referralLink;
}

async function handleReferral() {
     debugLog("Checking for referral parameter...");
    // Needs globals telegramUser, firebaseInitialized, db
     if (!window.telegramUser || !window.telegramUser.id || !firebaseInitialized || !db) {
        debugLog("Referral check skipped: Conditions not met.");
        return;
     }

     const startParam = getTelegramStartParam(); // Use telegramService function

     if (startParam && startParam.startsWith('ref_')) {
         const referrerId = startParam.split('_')[1];
         const currentUserId = window.telegramUser.id.toString();
         debugLog(`Referral parameter found: ref_${referrerId}`);

         if (!referrerId || referrerId === currentUserId) {
            debugLog("Referral check skipped: Invalid or self-referral ID.");
            return;
         }

         const currentUserRef = db.collection('userData').doc(currentUserId);
         const referrerRef = db.collection('userData').doc(referrerId);

         try {
              // Use a transaction to ensure atomicity when updating both users
              await db.runTransaction(async (transaction) => {
                  const userDoc = await transaction.get(currentUserRef);
                   if (!userDoc.exists) {
                       // This should ideally not happen if initializeUserData runs first,
                       // but handle defensively. Wait for user data to be created.
                       throw new Error("Current user data not found yet. Cannot process referral.");
                   }
                  const userData = userDoc.data();

                  // Check if already referred
                  if (userData.isReferred) {
                      debugLog(`User ${currentUserId} already referred by ${userData.referredBy || 'someone'}. Skipping.`);
                      return; // Exit transaction without changes
                  }

                  debugLog(`Processing referral: User ${currentUserId} referred by ${referrerId}`);
                   // Mark current user as referred
                   transaction.update(currentUserRef, { isReferred: true, referredBy: referrerId });

                   // Check if referrer exists before trying to update
                  const referrerDoc = await transaction.get(referrerRef);
                   if (referrerDoc.exists) {
                        const referralCreditAmount = REFERRAL_CREDIT_AMOUNT; // Use constant from config.js

                        const newRecord = {
                            userId: currentUserId,
                            username: window.telegramUser.username || window.telegramUser.first_name || `User_${currentUserId.slice(-4)}`,
                            joinTime: new Date().toISOString(), // Use ISO string for consistency
                            creditAwarded: referralCreditAmount,
                        };

                        // Update referrer's data
                        transaction.update(referrerRef, {
                            referrals: firebase.firestore.FieldValue.increment(1), // Use firebase global
                            referralCredits: firebase.firestore.FieldValue.increment(referralCreditAmount),
                            inviteRecords: firebase.firestore.FieldValue.arrayUnion(newRecord)
                        });
                        debugLog(`Referrer ${referrerId} data prepared for update: +1 referral, +${referralCreditAmount} credits.`);
                   } else {
                       debugLog(`Referral handling warning: Referrer ${referrerId} document not found. Cannot award credits.`);
                       // Continue transaction to mark the current user as referred anyway
                   }
              });

             debugLog("Referral transaction completed successfully.");
             if (window.analytics) window.analytics.logEvent('referral_success', { userId: currentUserId, referrerId }); // Use analytics global
             // Refresh user data after successful referral processing
             await window.fetchAndUpdateUserData(); // Use window prefix

         } catch (error) {
             console.error("Error processing referral transaction:", error);
             debugLog(`Error processing referral: ${error.message}`);
             // Don't alert the user unless critical, log the error.
         }
     } else {
         debugLog("No referral parameter found or not in 'ref_' format.");
     }
 }

async function updateInviteSectionUI() {
    debugLog("Updating Invite section UI...");
     const myInviteEl = document.getElementById('my-invite');
     const totalCreditTextEl = document.getElementById('total-credit-text'); // Element containing the text part
     const totalCreditInfoEl = document.querySelector('.total-credit .credit-info'); // Parent div for structure check
     const inviteRecordTitleEl = document.getElementById('invite-record-title');
     const recordListContainer = document.getElementById('invite-record-list');
     const invitePlaceholder = document.getElementById('invite-record-placeholder');
     const claimRecordListContainer = document.getElementById('claim-record-list');
     const claimPlaceholder = document.getElementById('claim-record-placeholder');
     const claimButton = document.querySelector('.invite-section .claim-button'); // Get claim button

     // Basic element checks
     if (!myInviteEl || !totalCreditTextEl || !totalCreditInfoEl || !inviteRecordTitleEl || !recordListContainer || !invitePlaceholder || !claimRecordListContainer || !claimPlaceholder || !claimButton) {
        console.error("[INVITE UI ERROR] Required DOM elements for invite section not found!");
        debugLog("[INVITE UI ERROR] Invite section elements missing from DOM.");
        return;
     }

     // Set loading state
     myInviteEl.textContent = `My Invite: ...`;
     // Use textContent for the span, keep structure
     totalCreditTextEl.textContent = `Total Credit ! : ...`;
     totalCreditInfoEl.querySelector('small').innerHTML = `Loading...`; // Clear rate display
     inviteRecordTitleEl.textContent = `Invite Record (...)`;
     recordListContainer.innerHTML = ''; // Clear previous list
     invitePlaceholder.style.display = 'block';
     invitePlaceholder.querySelector('p').textContent = 'Loading invites...';
     claimRecordListContainer.innerHTML = ''; // Clear previous list
     claimPlaceholder.style.display = 'block';
     claimPlaceholder.querySelector('p').textContent = 'Loading claim history...';
     claimButton.disabled = true; // Disable claim button while loading


     // Use cached or fetch fresh user data
     // Needs globals currentUserData, fetchAndUpdateUserData
     const data = window.currentUserData || await window.fetchAndUpdateUserData();

     if (!data) {
         debugLog("Invite UI update: User data not found.");
         // Show appropriate message
         myInviteEl.textContent = `My Invite: 0`;
         totalCreditTextEl.textContent = `Total Credit ! : 0`;
         totalCreditInfoEl.querySelector('small').innerHTML = `${CREDIT_CONVERSION_RATE.toLocaleString()} C = 1 <img src="assets/icons/usdt.png" alt="USDT">`; // Show rate
         inviteRecordTitleEl.textContent = `Invite Record (0)`;
         invitePlaceholder.style.display = 'block';
         invitePlaceholder.querySelector('p').textContent = 'No invites yet';
         claimPlaceholder.style.display = 'block';
         claimPlaceholder.querySelector('p').textContent = 'No claim records yet';
         claimButton.disabled = true; // Still disabled if no data
         return;
     }

     const referrals = data.referrals || 0;
     const totalCredit = data.referralCredits || 0;
     const inviteRecords = data.inviteRecords || [];
     const claimHistory = data.claimHistory || [];

     // Update stats
     myInviteEl.textContent = `My Invite: ${referrals}`;
     totalCreditTextEl.textContent = `Total Credit ! : ${totalCredit.toLocaleString()}`;
     // Update conversion rate display
     totalCreditInfoEl.querySelector('small').innerHTML = `${CREDIT_CONVERSION_RATE.toLocaleString()} C = 1 <img src="assets/icons/usdt.png" alt="USDT">`;


     inviteRecordTitleEl.textContent = `Invite Record (${referrals})`;

     // Populate Invite Records
     if (inviteRecords.length === 0) {
         recordListContainer.innerHTML = ''; // Ensure it's empty
         invitePlaceholder.style.display = 'block';
         invitePlaceholder.querySelector('p').textContent = 'No invites yet';
     } else {
         invitePlaceholder.style.display = 'none';
         recordListContainer.innerHTML = inviteRecords
             // Sort by date (descending) - ensure joinTime is valid Date parsable string (ISO format recommended)
             .sort((a, b) => new Date(b.joinTime || 0) - new Date(a.joinTime || 0))
             .map(record => {
                 const joinTime = formatTimestamp(record.joinTime); // Use utility
                 const username = record.username || 'Unknown User';
                 // Basic avatar placeholder generation
                 const avatarLetter = (username === 'Unknown User' ? '?' : username[0]).toUpperCase();
                 const avatarUrl = `https://via.placeholder.com/40/808080/FFFFFF?text=${avatarLetter}`;

                 return `
                 <div class="record-item">
                     <img src="${avatarUrl}" alt="${username}">
                     <div class="user-info">
                         <span>${username}</span>
                         <small>${joinTime}</small>
                     </div>
                     <span class="credit">+${record.creditAwarded || 0} C</span> </div>
             `;
             }).join('');
     }

     // Populate Claim Records
     if (claimHistory.length === 0) {
         claimRecordListContainer.innerHTML = ''; // Ensure it's empty
         claimPlaceholder.style.display = 'block';
         claimPlaceholder.querySelector('p').textContent = 'No claim records yet';
     } else {
         claimPlaceholder.style.display = 'none';
         claimRecordListContainer.innerHTML = claimHistory
             // Sort by date (descending) - ensure claimTime is valid
             .sort((a, b) => new Date(b.claimTime || 0) - new Date(a.claimTime || 0))
             .map(record => {
                const claimTime = formatTimestamp(record.claimTime); // Use utility
                 return `
                 <div class="record-item">
                     <img src="assets/icons/usdt.png" alt="USDT Claim" style="border-radius: 0;">
                     <div class="user-info">
                         <span>Claimed ${record.usdtAmount?.toFixed(4) || '?'} USDT</span>
                         <small>${claimTime}</small>
                     </div>
                     <span class="credit" style="background: #00cc00;">-${record.creditsSpent?.toLocaleString() || '?'} C</span>
                 </div>
             `;
             }).join('');
     }

     // Enable/Disable Claim Button based on available credits
     claimButton.disabled = totalCredit < MINIMUM_CREDIT_CLAIM; // Use constant

     debugLog("Invite section UI updated successfully.");

 }

 // --- Event Listener Setup for Invite Section (called from main.js) ---
 function initInviteSectionListeners() {
     const inviteButton = document.querySelector('.invite-friend');
     const copyButton = document.querySelector('.copy-link');
     const claimButton = document.querySelector('.invite-section .claim-button');

     if (inviteButton) {
         inviteButton.addEventListener('click', () => {
             const link = generateReferralLink(); // Generate fresh link
             if (link) {
                openTelegramLink(link); // Use telegramService function
                debugLog("Opened Telegram invite link.");
                if (window.analytics) window.analytics.logEvent('invite_friend_share', { userId: window.telegramUser?.id, method: 'telegram' });
             } else {
                 alert("Could not generate referral link.");
             }
         });
     }

     if (copyButton) {
         copyButton.addEventListener('click', () => {
             const link = generateReferralLink(); // Generate fresh link
             if (link && navigator.clipboard) {
                 navigator.clipboard.writeText(link)
                     .then(() => {
                         alert("Referral link copied!");
                         debugLog("Referral link copied to clipboard.");
                         if (window.analytics) window.analytics.logEvent('invite_friend_share', { userId: window.telegramUser?.id, method: 'copy' });
                     })
                     .catch(err => {
                         console.error("Failed to copy link:", err);
                         alert("Failed to copy link. Please try again.");
                     });
             } else if (link) {
                  alert("Clipboard access not available. Please copy the link manually."); // Fallback for older browsers/http
             }
              else {
                 alert("Could not generate referral link.");
             }
         });
     }

     if (claimButton) {
         claimButton.addEventListener('click', handleClaimCredits); // Assign handler
     }
 }

 // --- Claim Credits Logic ---
 async function handleClaimCredits() {
     debugLog("[CREDIT CLAIM] Claim button clicked.");
     // Needs globals telegramUser, db, firebase, analytics
     if (!window.telegramUser || !window.telegramUser.id || !db || !firebase) {
        alert("Initialization error. Please reload.");
        return;
     }

     const claimButton = document.querySelector('.invite-section .claim-button');
     if (!claimButton || claimButton.disabled) return; // Exit if button doesn't exist or is disabled

     claimButton.disabled = true; claimButton.textContent = 'Checking...';

     const userDocRef = db.collection('userData').doc(window.telegramUser.id.toString());
     try {
         // --- Use a Transaction for Claiming ---
         const usdtToClaim = await db.runTransaction(async (transaction) => {
             const userDoc = await transaction.get(userDocRef);
             if (!userDoc.exists) throw new Error("User data not found for claim.");

             const data = userDoc.data();
             const currentCredits = data.referralCredits || 0;
             const conversionRate = CREDIT_CONVERSION_RATE; // Use constants from config.js
             const minimumClaim = MINIMUM_CREDIT_CLAIM;

             debugLog(`[CREDIT CLAIM] Current credits: ${currentCredits}`);
             if (currentCredits < minimumClaim) {
                 throw new Error(`Insufficient credits. Need ${minimumClaim.toLocaleString()}, have ${currentCredits.toLocaleString()}.`);
             }

             const calculatedUsdtToClaim = Math.floor(currentCredits / conversionRate);
             const creditsToSpend = calculatedUsdtToClaim * conversionRate;

             debugLog(`[CREDIT CLAIM] Attempting to claim ${calculatedUsdtToClaim} USDT for ${creditsToSpend} credits.`);
             claimButton.textContent = 'Claiming...'; // Update button text

             const claimRecord = {
                 claimTime: new Date().toISOString(), // Use ISO string
                 usdtAmount: calculatedUsdtToClaim,
                 creditsSpent: creditsToSpend,
                 rate: conversionRate
             };

             // Prepare updates for the transaction
             transaction.update(userDocRef, {
                 usdt: firebase.firestore.FieldValue.increment(calculatedUsdtToClaim),
                 referralCredits: firebase.firestore.FieldValue.increment(-creditsToSpend),
                 claimHistory: firebase.firestore.FieldValue.arrayUnion(claimRecord)
             });

             return calculatedUsdtToClaim; // Return the amount claimed for logging/alert
         });
         // --- Transaction End ---

         debugLog(`[CREDIT CLAIM] Successfully claimed ${usdtToClaim} USDT.`);
         if (window.analytics) window.analytics.logEvent('credit_claim', { userId: window.telegramUser.id, usdt: usdtToClaim });
         alert(`Successfully claimed ${usdtToClaim.toFixed(4)} USDT!`);

         // Update UI immediately after successful transaction
         await window.fetchAndUpdateUserData(); // Refresh cache
         await window.updateUserStatsUI();
         await updateInviteSectionUI(); // Update invite section specific elements

     } catch (error) {
         console.error("[CREDIT CLAIM ERROR] Error claiming credits:", error);
         debugLog(`[CREDIT CLAIM ERROR] ${error.message}`);
         alert(`Failed to claim credits: ${error.message}`); // Show specific error to user
         // Re-enable button and update UI on failure
         await updateInviteSectionUI(); // Ensure UI reflects correct state after error
     }
     // No finally needed, UI update handles button state
 }
