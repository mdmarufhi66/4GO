// js/sections/chest.js

// Global state specific to chests (if not managed in main.js)
let currentChestIndex = 0;
const chests = CHESTS_DATA; // Use constant from config.js

function renderChests() {
    debugLog("[CHEST] Rendering chests...");
    const container = document.getElementById('chestContainer');
    const slider = document.querySelector('.chest-slider'); // Get slider element
    if (!container || !slider) {
        debugLog("[CHEST ERROR] Chest container or slider not found.");
        return;
     }

     // Hide slider until chests are rendered to prevent layout shift
     slider.style.visibility = 'hidden';

    container.innerHTML = chests.map((chest, index) => `
        <div class="chest-item" data-index="${index}">
            <div class="chest-title">
                <h2>${chest.name}</h2>
                <span>${chest.next ? `Next: ${chest.next}` : 'Max Level'}</span>
            </div>
            <div class="chest-image">
                <img src="${chest.image}" alt="${chest.name}" onerror="this.src='assets/icons/chest_placeholder.png'">
            </div>
             <div class="chest-cost-display" style="display: flex; justify-content: center; align-items: center; gap: 5px; margin-top: 10px;"></div>
             <div class="chest-vip-display" style="display: none; color: #ffcc00; margin-top: 5px; font-size: 14px; text-align: center;"></div>
             <div class="chest-not-enough-display" style="display: none; color: #ffcc00; margin-top: 5px; font-size: 14px; text-align: center; align-items: center; justify-content: center; gap: 3px;">
                 <img src="assets/icons/gem.png" alt="Gem" style="width: 16px; height: 16px; vertical-align: middle;">
                 <span>NOT ENOUGH</span>
             </div>
        </div>
    `).join('');

    // Show slider after rendering
    slider.style.visibility = 'visible';

    debugLog(`[CHEST] Rendered ${chests.length} chests.`);
    setupChestListeners(); // Add listeners for arrows and open button
    updateChestUI(); // Initial UI update for the first chest
}

function setupChestListeners() {
     const leftArrow = document.querySelector('.chest-slider .nav-arrow.left');
     const rightArrow = document.querySelector('.chest-slider .nav-arrow.right');
     const openButton = document.querySelector('.chest-section .open-chest-button');

     if (leftArrow) {
         leftArrow.onclick = () => prevChest(); // Use arrow function to call
     }
     if (rightArrow) {
         rightArrow.onclick = () => nextChest(); // Use arrow function to call
     }
     if (openButton) {
         openButton.onclick = () => openChest(); // Use arrow function to call
     }
}


function updateChestUI() {
    // Ensure chests array is populated and index is valid
    if (!chests || chests.length === 0) {
        debugLog("[CHEST UI ERROR] Chest data not loaded.");
        return;
    }
    if (currentChestIndex < 0 || currentChestIndex >= chests.length) {
        console.error(`[CHEST UI ERROR] Invalid chest index: ${currentChestIndex}`);
        debugLog(`[CHEST UI ERROR] Invalid chest index: ${currentChestIndex}. Resetting to 0.`);
        currentChestIndex = 0; // Reset to first chest
    }

    const chest = chests[currentChestIndex];
     debugLog(`[CHEST] Updating UI for Chest index: ${currentChestIndex} (${chest.name})`);

    const container = document.getElementById('chestContainer');
    // Find the specific item being displayed + the general controls
    const currentChestItem = document.querySelector(`#chestContainer .chest-item[data-index="${currentChestIndex}"]`);
    const costDisplay = currentChestItem?.querySelector(`.chest-cost-display`); // Find within the specific item
    const vipDisplay = currentChestItem?.querySelector(`.chest-vip-display`);
    const notEnoughDisplay = currentChestItem?.querySelector(`.chest-not-enough-display`);
    const openButton = document.querySelector('.chest-section .open-chest-button'); // Main button outside slider
    const leftArrow = document.querySelector('.chest-slider .nav-arrow.left');
    const rightArrow = document.querySelector('.chest-slider .nav-arrow.right');
    const globalCostDisplay = document.getElementById('chestCost'); // The cost display below slider (if still used)


     if (!container || !currentChestItem || !costDisplay || !vipDisplay || !notEnoughDisplay || !openButton || !leftArrow || !rightArrow) {
        debugLog("[CHEST UI ERROR] One or more chest UI elements not found.");
        return;
     }

    // Update Slider Position Smoothly
    container.style.transform = `translateX(-${currentChestIndex * 100}%)`;

    // --- Update Cost/VIP/Button State ---
     costDisplay.style.display = 'none'; // Hide individual item displays initially
     vipDisplay.style.display = 'none';
     notEnoughDisplay.style.display = 'none';
     openButton.disabled = true; // Disable button by default until checks pass
     openButton.textContent = 'Open Chest'; // Default text

     // Use cached user data for checks
     // Needs global currentUserData
     const userData = window.currentUserData;
     const userVipLevel = userData?.vipLevel ?? -1; // Use ?? for null/undefined check, -1 if no data
     const userGems = userData?.gems ?? -1;

      // Ensure user data is loaded before proceeding
      if (userVipLevel === -1 || userGems === -1) {
          debugLog("[CHEST UI WARN] User data not available for chest checks. Disabling open button.");
          openButton.textContent = 'Loading...';
          // Hide cost/vip/not enough displays for the item
          costDisplay.style.display = 'none';
          vipDisplay.style.display = 'none';
          notEnoughDisplay.style.display = 'none';
           // Also update the global cost display if used
           if (globalCostDisplay) {
                globalCostDisplay.innerHTML = `<img src="assets/icons/gem.png" alt="Gem"> <span>...</span>`;
           }
      } else {
           debugLog(`[CHEST CHECK] User VIP: ${userVipLevel}, User Gems: ${userGems}, Chest: ${chest.name} (Needs VIP ${chest.vip}, Cost ${chest.gemCost})`);

          // Check VIP Level FIRST
          if (chest.vip > userVipLevel) {
              vipDisplay.textContent = `NEED VIP ${chest.vip}`;
              vipDisplay.style.display = 'block'; // Show VIP requirement in the item
              openButton.disabled = true;
              openButton.textContent = `VIP ${chest.vip} Required`;
              debugLog(`[CHEST] VIP ${chest.vip} required, user has ${userVipLevel}. Button disabled.`);
              // Hide cost and not enough displays
              costDisplay.style.display = 'none';
              notEnoughDisplay.style.display = 'none';
               // Also update the global cost display if used
               if (globalCostDisplay) {
                    globalCostDisplay.innerHTML = `<img src="assets/icons/gem.png" alt="Gem"> <span>${chest.gemCost.toLocaleString()}</span> (VIP ${chest.vip} Req.)`;
               }
          } else {
               // VIP Met, now check Gems
               costDisplay.innerHTML = `<img src="assets/icons/gem.png" alt="Gem" style="width: 20px; height: 20px; vertical-align: middle;"> <span>${chest.gemCost.toLocaleString()}</span>`;
               costDisplay.style.display = 'flex'; // Show cost in the item

               // Also update the global cost display if used
               if (globalCostDisplay) {
                    globalCostDisplay.innerHTML = `<img src="assets/icons/gem.png" alt="Gem"> <span>${chest.gemCost.toLocaleString()}</span>`;
               }


               if (userGems < chest.gemCost) {
                    notEnoughDisplay.style.display = 'flex'; // Show "NOT ENOUGH" in the item
                    openButton.disabled = true;
                    openButton.textContent = 'Open Chest'; // Keep text, but disabled
                    debugLog(`[CHEST] Insufficient gems. Need ${chest.gemCost}, user has ${userGems}. Button disabled.`);
               } else {
                   // VIP and Gems Met
                   openButton.disabled = false; // Enable the button!
                   openButton.textContent = 'Open Chest';
                   debugLog(`[CHEST] User meets VIP and Gem requirements. Button enabled.`);
               }
               // Ensure VIP display is hidden if requirements met
               vipDisplay.style.display = 'none';
          }
     }

    // Update Navigation Arrows Visibility
    leftArrow.style.display = currentChestIndex === 0 ? 'none' : 'block';
    rightArrow.style.display = currentChestIndex === chests.length - 1 ? 'none' : 'block';

     // Update Possible Rewards section (if it needs to change per chest type)
     updatePossibleRewardsUI(chest);
}

function updatePossibleRewardsUI(chest) {
    // Example: If rewards change based on chest, update the UI here.
    // For now, it seems static in the HTML, so this function might be simple.
    const rewardsContainer = document.querySelector('.chest-section .rewards');
    if (rewardsContainer) {
        // Modify content if needed, e.g., highlight likely rewards for 'chest.name'
        // Example: Add a class to highlight rewards based on chest type
        rewardsContainer.querySelectorAll('.reward-item').forEach(item => item.classList.remove('highlight'));
        if (chest.name === "Gold Chest") { // Example condition
            rewardsContainer.querySelector('.reward-item.usdt')?.classList.add('highlight');
        }
    }
     // Update VIP requirement text if the separate element exists
     const vipRequirementEl = document.getElementById('chestVipRequirement');
     if (vipRequirementEl) {
         if (chest.vip > 0) {
             vipRequirementEl.textContent = `NEED VIP ${chest.vip}`;
             // Show/hide based on whether the *currently viewed* chest needs VIP > 0
             // This element seems redundant if the logic is handled by the button state + item display
             // vipRequirementEl.style.display = 'block';
             vipRequirementEl.style.display = 'none'; // Prefer showing in item/button
         } else {
             vipRequirementEl.style.display = 'none';
         }
     }
}


function nextChest() {
    if (currentChestIndex < chests.length - 1) {
        currentChestIndex++;
        debugLog(`[CHEST] Next button clicked. New index: ${currentChestIndex}`);
        updateChestUI();
    }
}

function prevChest() {
    if (currentChestIndex > 0) {
        currentChestIndex--;
        debugLog(`[CHEST] Previous button clicked. New index: ${currentChestIndex}`);
        updateChestUI();
    }
}

async function openChest() {
     // Ensure chests array is populated and index is valid
     if (!chests || chests.length === 0 || currentChestIndex < 0 || currentChestIndex >= chests.length) {
         alert("Error: Chest data not loaded or invalid chest selected.");
         debugLog("[CHEST ACTION ERROR] Invalid chest state for opening.");
         return;
     }
     const chest = chests[currentChestIndex];
     debugLog(`[CHEST ACTION] Attempting to open chest: ${chest.name}`);

     const openButton = document.querySelector('.chest-section .open-chest-button');
     if (!openButton || openButton.disabled) {
         debugLog("[CHEST ACTION WARN] Open button not found or disabled.");
         return; // Don't proceed if button is disabled
     }
     openButton.disabled = true; openButton.textContent = 'Opening...';

     // Needs globals telegramUser, db, firebase, analytics
     if (!window.telegramUser || !window.telegramUser.id || !firebaseInitialized || !db || !firebase) {
        alert("User or Database not ready. Please reload.");
        openButton.disabled = false; // Re-enable button
        updateChestUI(); // Refresh UI state
        return;
     }

     const userDocRef = db.collection('userData').doc(window.telegramUser.id.toString());
     const rankingDocRef = db.collection('users').doc(window.telegramUser.id.toString());

     try {
          // --- Use a Transaction for Opening ---
          const rewards = await db.runTransaction(async (transaction) => {
              // Fetch latest data *within* the transaction for check
              const userDoc = await transaction.get(userDocRef);
              if (!userDoc.exists) throw new Error("User data not found to open chest.");
              const userData = userDoc.data();

             const currentGems = userData.gems || 0;
             const userVipLevel = userData.vipLevel || 0;

             debugLog(`[CHEST ACTION CHECK - TX] Checking requirements: Need VIP ${chest.vip} (Have ${userVipLevel}), Need Gems ${chest.gemCost} (Have ${currentGems})`);

             if (chest.vip > userVipLevel) throw new Error(`VIP Level ${chest.vip} required.`);
             if (currentGems < chest.gemCost) throw new Error(`Insufficient gems. Need ${chest.gemCost.toLocaleString()}, have ${currentGems.toLocaleString()}.`);

             // Simulate Reward Calculation (can be made more sophisticated)
             const calculatedRewards = {
                 usdt: parseFloat((Math.random() * (chest.gemCost / 4000) + (chest.gemCost / 10000)).toFixed(4)),
                 landPiece: Math.random() < 0.1 ? 1 : 0, // 10% chance for land piece
                 foxMedal: Math.floor(Math.random() * (currentChestIndex + 1)) + (chest.vip > 0 ? chest.vip : 1) // Example: More medals for higher chests/VIP
             };
             // Ensure rewards are non-negative
             calculatedRewards.usdt = Math.max(0, calculatedRewards.usdt);
             calculatedRewards.landPiece = Math.max(0, calculatedRewards.landPiece);
             calculatedRewards.foxMedal = Math.max(0, calculatedRewards.foxMedal);

             debugLog("[CHEST ACTION - TX] Calculated rewards:", calculatedRewards);

             // Prepare Firestore updates within the transaction
             const updates = {
                 gems: firebase.firestore.FieldValue.increment(-chest.gemCost),
                 usdt: firebase.firestore.FieldValue.increment(calculatedRewards.usdt),
                 landPieces: firebase.firestore.FieldValue.increment(calculatedRewards.landPiece),
                 foxMedals: firebase.firestore.FieldValue.increment(calculatedRewards.foxMedal)
             };
             transaction.update(userDocRef, updates);

             // Update ranking document if medals were awarded
             if (calculatedRewards.foxMedal > 0) {
                  // Use set with merge to ensure document exists or is updated atomically within the transaction
                  // Note: Reading the rankingDoc within the transaction might be needed if increments depend on previous value
                  transaction.set(rankingDocRef, {
                      foxMedals: firebase.firestore.FieldValue.increment(calculatedRewards.foxMedal)
                  }, { merge: true });
             }
             debugLog(`[CHEST ACTION - TX] Firestore updates prepared.`);
             return calculatedRewards; // Return rewards from transaction
          });
          // --- Transaction End ---

          debugLog(`[CHEST ACTION] Transaction successful. Chest opened. Rewards:`, rewards);
          if (window.analytics) window.analytics.logEvent('chest_opened', { userId: window.telegramUser.id, chestName: chest.name, cost: chest.gemCost, rewards });

          // Show Rewards Alert
          let rewardString = `Opened ${chest.name}! Rewards:\n`;
          if (rewards.usdt > 0) rewardString += `- ${rewards.usdt.toFixed(4)} USDT\n`;
          if (rewards.landPiece > 0) rewardString += `- ${rewards.landPiece} Land Piece\n`;
          if (rewards.foxMedal > 0) rewardString += `- ${rewards.foxMedal} Fox Medal\n`;
          if (rewards.usdt <= 0 && rewards.landPiece <= 0 && rewards.foxMedal <= 0) {
             rewardString += "- Nothing this time!"; // Handle case where all rewards are 0
          }
          alert(rewardString);

          // Update UI AFTER successful transaction
          await window.fetchAndUpdateUserData(); // Refresh cache with new balances
          await window.updateUserStatsUI(); // Update header stats
          updateChestUI(); // Re-check requirements/costs for the current chest & update button state

     } catch (error) {
         console.error("Error opening chest:", error);
         debugLog(`[CHEST ERROR] ${error.message}`);
         alert(`Failed to open chest: ${error.message}`);
         // Ensure button is re-enabled and UI reflects potential unchanged state
         openButton.disabled = false; // Re-enable after error
         updateChestUI(); // Crucial to reset button state based on actual data after failure

     }
     // No finally needed, button state handled by updateChestUI in success/error paths
 }
