// js/sections/chest.js

// Variable to keep track of the currently displayed chest index in the slider
// This variable is managed locally within this file
let currentChestIndex = 0;

// --- Chest UI Rendering ---
// Renders the initial HTML structure for the chests based on the CHESTS_DATA.
// This function should be called once during app initialization (e.g., from main.js).
// This function is exposed globally for use by main.js.
function renderChests() {
    // Uses debugLog from utils.js (globally available)
    // Uses CHESTS_DATA from config.js (globally available)
    // Calls updateChestUI from this file (implicitly global, or accessible after setup)

    debugLog("[CHEST] Rendering chests...");

    // Get the container element for the chest items
    const container = document.getElementById('chestContainer');
    // Ensure the container element exists before proceeding
    if (!container) {
        console.error("[CHEST ERROR] Chest container element (#chestContainer) not found! Cannot render chests.");
        debugLog("[CHEST ERROR] Chest container missing from DOM.");
        return; // Stop the function if the container is missing
    }

     // Use the chest data from config.js (globally available)
     const chestsData = window.CHESTS_DATA;
     if (!Array.isArray(chestsData) || chestsData.length === 0) {
          console.warn("[CHEST WARN] CHESTS_DATA is empty or not an array. Cannot render chests.");
          debugLog("[CHEST WARN] CHESTS_DATA is empty.");
          container.innerHTML = '<div class="chest-item"><p>No chest data available.</p></div>';
          // Potentially disable open chest button and nav arrows here
          return;
     }


    // Generate the HTML for each chest item in the CHESTS_DATA array
    // The data-index attribute is crucial for identifying which chest is which in the slider
    container.innerHTML = chestsData.map((chest, index) => {
        // Validate essential chest properties
        if (!chest || !chest.name || !chest.image || chest.gemCost === undefined || chest.vip === undefined) {
            console.warn("[CHEST WARN] Skipping rendering of invalid chest data object:", chest);
            debugLog("[CHEST WARN] Skipping invalid chest data object.");
            return ''; // Skip this item
        }
         // Determine text for the "Next" chest or "Max Level"
         const nextChestText = chest.next ? `Next: ${chest.next}` : 'Max Level';

        // Return the HTML string for a single chest item
        return `
            <div class="chest-item" data-index="${index}">
                <div class="chest-title">
                    <h2>${chest.name}</h2>
                    <span>${nextChestText}</span>
                </div>
                <div class="chest-image">
                    <img src="${chest.image}" alt="${chest.name}" onerror="this.src='assets/icons/chest_placeholder.png'">
                </div>
                 <div class="chest-cost-display" style="margin-top: 10px;"></div>
                 <div class="chest-vip-display" style="display: none; color: #ffcc00; margin-top: 10px;"></div>
                 <div class="chest-not-enough-display" style="display: none; color: #ffcc00; margin-top: 10px;">
                     <img src="assets/icons/gem.png" alt="Gem" style="width: 16px; height: 16px; vertical-align: middle;">
                     <span>NOT ENOUGH</span>
                 </div>
            </div>
        `;
    }).join(''); // Join all the HTML strings into a single string

     debugLog(`[CHEST] Rendered ${chestsData.length} chests HTML.`);

     // After rendering, update the UI to show the first chest and set button states
     updateChestUI();
     debugLog("[CHEST] Initial Chest UI update called after rendering.");

     // Note: Setting up event listeners for navigation and open button is handled in setupChestListeners,
     // which should be called after renderChests (e.g., from main.js).
}


// --- Chest UI Update ---
// Updates the visual state of the chest slider, cost display, VIP requirement,
// "Not Enough" message, and the Open Chest button based on the current chest index and user stats.
// This function is called after rendering, when navigating chests, and after opening a chest.
// This function is exposed globally for use by navigation.js and main.js.
function updateChestUI() {
    // Uses debugLog from utils.js (globally available)
    // Uses CHESTS_DATA from config.js (globally available)
    // Uses currentUserData from uiUpdater.js (globally available - assumes it's been fetched)

    // Get the currently selected chest data based on currentChestIndex
    const chestsData = window.CHESTS_DATA; // Use global constant
    // Ensure the index is valid before accessing the array
    if (currentChestIndex < 0 || currentChestIndex >= chestsData.length) {
         console.error(`[CHEST UI ERROR] Invalid current chest index: ${currentChestIndex}. Resetting to 0.`);
         debugLog(`[CHEST UI ERROR] Invalid index: ${currentChestIndex}. Resetting.`);
         currentChestIndex = 0; // Reset index to a valid value
         // Check if the reset index is still valid (in case CHESTS_DATA is empty)
         if (currentChestIndex < 0 || currentChestIndex >= chestsData.length) {
              debugLog("[CHEST UI ERROR] CHESTS_DATA is empty even after index reset.");
              // Handle case where chestsData is empty - maybe disable everything
              const openButton = document.querySelector('.open-chest-button');
              if(openButton) {
                  openButton.textContent = 'No Chests';
                  openButton.disabled = true;
              }
              const navArrows = document.querySelectorAll('.nav-arrow');
               navArrows.forEach(arrow => arrow.style.display = 'none');
              return; // Cannot proceed if no chest data
         }
    }

    const chest = chestsData[currentChestIndex];
     debugLog(`[CHEST] Updating UI for Chest index: ${currentChestIndex} (${chest?.name || 'N/A'})...`); // Safer logging


    // Get references to the main chest container and elements within the currently active chest item
    const container = document.getElementById('chestContainer');
    // Select the specific chest item element based on its data-index attribute
    const currentChestItem = document.querySelector(`#chestContainer .chest-item[data-index="${currentChestIndex}"]`);
    // Get references to the common elements outside the slider that depend on the current chest
    const openButton = document.querySelector('.open-chest-button');
    const leftArrow = document.querySelector('.nav-arrow.left');
    const rightArrow = document.querySelector('.nav-arrow.right');

    // Validate that necessary DOM elements exist
    if (!container || !currentChestItem || !openButton || !leftArrow || !rightArrow) {
        console.error("[CHEST UI ERROR] Required DOM elements for Chest UI not found! Skipping update.");
        debugLog("[CHEST UI ERROR] Chest UI elements missing from DOM.");
        // Optionally ensure button/arrows are disabled/hidden
         if(openButton) { openButton.textContent = 'UI Error'; openButton.disabled = true; }
         if(leftArrow) leftArrow.style.display = 'none';
         if(rightArrow) rightArrow.style.display = 'none';
        return; // Stop if elements are missing
    }

     // Get references to the specific display elements within the current chest item
     const costDisplay = currentChestItem.querySelector(`.chest-cost-display`);
     const vipDisplay = currentChestItem.querySelector(`.chest-vip-display`);
     const notEnoughDisplay = currentChestItem.querySelector(`.chest-not-enough-display`);

     // Validate that necessary display elements within the chest item exist
     if (!costDisplay || !vipDisplay || !notEnoughDisplay) {
         console.error(`[CHEST UI ERROR] Required display elements for chest item ${currentChestIndex} not found! Skipping update for this item.`);
         debugLog(`[CHEST UI ERROR] Chest item display elements missing for index ${currentChestIndex}.`);
         // Continue with slider position and arrow updates, but skip cost/VIP/button logic for this item.
     } else {

        // --- Update Cost/VIP/Button State based on User Data ---
        // Use the cached user data from uiUpdater.js (globally available)
        // Assumes fetchAndUpdateUserData has been called previously (e.g., in main.js or switchSection)
        const userData = window.currentUserData;
        const userVipLevel = userData?.vipLevel ?? 0; // Use optional chaining and nullish coalescing
        const userGems = userData?.gems ?? 0; // Use optional chaining and nullish coalescing

        debugLog(`[CHEST CHECK] User VIP: ${userVipLevel}, User Gems: ${userGems}. Current Chest: ${chest.name} (Needs VIP ${chest.vip}, Cost ${chest.gemCost}).`);

        // Reset display states and button state initially
        costDisplay.style.display = 'none'; // Hide cost display by default
        vipDisplay.style.display = 'none'; // Hide VIP requirement display by default
        notEnoughDisplay.style.display = 'none'; // Hide "Not Enough" display by default
        openButton.disabled = false; // Enable Open button by default
        openButton.textContent = 'Open Chest'; // Set default button text

        // Check if the user meets the VIP level requirement
        if (chest.vip > userVipLevel) {
            debugLog(`[CHEST] VIP requirement not met. Needed: ${chest.vip}, Have: ${userVipLevel}.`);
            // Display the VIP requirement message
            vipDisplay.textContent = `NEED VIP ${chest.vip}`;
            vipDisplay.style.display = 'block'; // Show the VIP display
            openButton.disabled = true; // Disable the Open button
            openButton.textContent = `VIP ${chest.vip} Required`; // Update button text
        } else {
             debugLog(`[CHEST] VIP requirement met.`);
             // If VIP requirement is met, display the gem cost
             costDisplay.innerHTML = `<img src="assets/icons/gem.png" alt="Gem" style="width: 20px; height: 20px; vertical-align: middle;"> <span>${(chest.gemCost || 0).toLocaleString()}</span>`; // Display gem cost, formatted
             costDisplay.style.display = 'flex'; // Show the cost display (use flex for layout)
             costDisplay.style.justifyContent = 'center';
             costDisplay.style.alignItems = 'center';
             costDisplay.style.gap = '5px';


             // Check if the user has enough gems
             if (userGems < chest.gemCost) {
                 debugLog(`[CHEST] Insufficient gems. Needed: ${chest.gemCost}, Have: ${userGems}.`);
                  // Display the "Not Enough" message
                  notEnoughDisplay.style.display = 'flex'; // Show the "Not Enough" display (use flex)
                  notEnoughDisplay.style.justifyContent = 'center';
                  notEnoughDisplay.style.alignItems = 'center';
                  notEnoughDisplay.style.gap = '5px';
                 openButton.disabled = true; // Disable the Open button
                 // Button text remains "Open Chest" but is disabled
             } else {
                  debugLog(`[CHEST] User has enough gems.`);
                  // If user has enough gems and meets VIP, button remains enabled with default text
             }
        }
         debugLog("[CHEST] Cost/VIP/Button state updated.");

     }


    // --- Update Slider Position ---
    // Translate the chest container horizontally to show the current chest
    // The translation amount is the current index multiplied by 100% (since each item is 100% width)
    container.style.transform = `translateX(-${currentChestIndex * 100}%)`;
    debugLog(`[CHEST] Slider position updated for index ${currentChestIndex}.`);

    // --- Update Navigation Arrows Visibility ---
    // Hide the left arrow if on the first chest (index 0)
    leftArrow.style.display = currentChestIndex === 0 ? 'none' : 'block';
    // Hide the right arrow if on the last chest
    rightArrow.style.display = currentChestIndex === chestsData.length - 1 ? 'none' : 'block';
    debugLog("[CHEST] Navigation arrow visibility updated.");

    debugLog("[CHEST] Chest UI update complete.");
}

// --- Chest Navigation Logic (Called by Listeners set up in setupChestListeners) ---

// Moves the slider to the next chest
// This function is called by the click listener on the right navigation arrow.
function nextChest() {
    // Uses debugLog from utils.js (globally available)
    // Uses CHESTS_DATA from config.js (globally available)
    // Calls updateChestUI from this file (implicitly global, or accessible after setup)

    // Check if there is a next chest available
    const chestsData = window.CHESTS_DATA; // Use global constant
    if (currentChestIndex < chestsData.length - 1) {
        currentChestIndex++; // Increment the index
        debugLog(`[CHEST] Next button clicked. New index: ${currentChestIndex}`);
        updateChestUI(); // Update the UI to show the new chest
    } else {
        debugLog("[CHEST] Next button clicked, but already on the last chest.");
    }
}

// Moves the slider to the previous chest
// This function is called by the click listener on the left navigation arrow.
function prevChest() {
    // Uses debugLog from utils.js (globally available)
    // Calls updateChestUI from this file (implicitly global, or accessible after setup)

    // Check if there is a previous chest available
    if (currentChestIndex > 0) {
        currentChestIndex--; // Decrement the index
        debugLog(`[CHEST] Previous button clicked. New index: ${currentChestIndex}`);
        updateChestUI(); // Update the UI to show the new chest
    } else {
        debugLog("[CHEST] Previous button clicked, but already on the first chest.");
    }
}


// --- Chest Opening Logic ---
// Handles the process of opening the currently selected chest.
// This function is called by the click listener on the Open Chest button.
// This function is exposed globally for use by event listeners (can be local too).
async function openChest() {
     // Uses debugLog from utils.js (globally available)
     // Uses CHESTS_DATA from config.js (globally available)
     // Uses currentUserData, fetchAndUpdateUserData, updateUserStatsUI from uiUpdater.js (globally available)
     // Uses firebaseInitialized, db, firebase, analytics, ensureFirebaseReady from firebaseService.js (implicitly global)
     // Uses telegramUser from telegramService.js (globally available)
     // Calls updateChestUI from this file (implicitly global, or accessible after setup)

     debugLog(`[CHEST ACTION] Attempting to open chest at index ${currentChestIndex}...`);

     // Get the currently selected chest data
     const chestsData = window.CHESTS_DATA; // Use global constant
     // Ensure the index is valid
     if (currentChestIndex < 0 || currentChestIndex >= chestsData.length) {
         console.error("[CHEST ACTION ERROR] Cannot open chest: Invalid current chest index.");
         debugLog(`[CHEST ACTION ERROR] Invalid chest index: ${currentChestIndex}.`);
         alert("Error: Could not determine which chest to open."); // Inform user
         // Attempt to update UI to reflect state (might show disabled button)
         updateChestUI();
         return; // Stop the function
     }
     const chest = chestsData[currentChestIndex];
     debugLog(`[CHEST ACTION] Attempting to open chest: ${chest.name}`);


     // Get the Open Chest button element
     const openButton = document.querySelector('.open-chest-button');
     // Ensure the button exists before trying to disable/update it
     if (openButton) {
         openButton.disabled = true; // Disable the button immediately
         openButton.textContent = 'Opening...'; // Show processing text
     } else {
         console.warn("[CHEST ACTION WARN] Open Chest button element not found.");
         debugLog("[CHEST ACTION WARN] Open Chest button missing from DOM.");
         // Continue process even if button is missing, but log warning
     }


     // --- Critical Checks: Ensure user, database, and data are ready ---
     if (!window.telegramUser || !window.telegramUser.id) {
         alert("Initialization error: User not identified. Please reload.");
         debugLog("[CHEST ACTION ERROR] User not identified.");
          if(openButton) { openButton.disabled = false; updateChestUI(); } // Re-enable button
         return; // Stop if user not ready
     }
     if (!window.firebaseInitialized || !window.db) {
         alert("Initialization error: Database connection not ready. Please reload.");
         debugLog("[CHEST ACTION ERROR] Firestore not ready.");
         if(openButton) { openButton.disabled = false; updateChestUI(); } // Re-enable button
         // ensureFirebaseReady should have been called before this...
         // await window.ensureFirebaseReady(() => {}, 'openChest: Firebase check');
         // if (!window.firebaseInitialized || !window.db) return;
         return; // Stop if Firebase not ready
     }
     debugLog("[CHEST ACTION] User and Database confirmed ready.");


     try {
          // --- IMPORTANT: Fetch the latest user data *before* opening the chest ---
          // This is crucial to get the most up-to-date gem count and VIP level for validation.
          // This updates the global window.currentUserData cache.
          const userData = await window.fetchAndUpdateUserData(); // Fetch fresh data
          if (!userData) {
              // If user data is null after fetch, something is wrong.
              throw new Error("User data not found. Cannot open chest.");
          }
          debugLog("[CHEST ACTION] User data fetched successfully before opening chest.");

          // Use the data from the recent fetch for validation
          const currentGems = userData.gems ?? 0; // Use nullish coalescing
          const userVipLevel = userData.vipLevel ?? 0; // Use nullish coalescing

          debugLog(`[CHEST ACTION CHECK] Checking requirements: Need VIP ${chest.vip} (Have ${userVipLevel}), Need Gems ${chest.gemCost} (Have ${currentGems}).`);

          // --- Validate Requirements (Double-check on server-side too for security!) ---
          // Client-side validation helps user experience, but server-side is essential for security.
          if (chest.vip > userVipLevel) {
              throw new Error(`VIP Level ${chest.vip} required to open this chest.`);
          }
          if (currentGems < chest.gemCost) {
              throw new Error(`Insufficient gems. You need ${chest.gemCost.toLocaleString()} gems to open this chest.`);
          }
          debugLog("[CHEST ACTION] User meets requirements.");


          // --- Simulate Reward Calculation ---
          // Note: This is a client-side simulation for demo purposes.
          // In a real application, reward calculation should happen securely on a backend server
          // AFTER the payment/cost deduction is confirmed server-side.
          debugLog("[CHEST ACTION] Simulating reward calculation...");
          const rewards = {
              // USDT reward: Base amount + random bonus, scaled by chest cost/level
              // Ensures positive value. Scale factor examples: 4000, 10000. Adjust as needed.
              usdt: parseFloat((Math.random() * (chest.gemCost / 4000) + (chest.gemCost / 10000)).toFixed(4)),
              // Land Piece reward: Small chance, maybe higher for higher chests
              // Example: 10% chance (0.1), adjust probability as needed.
              landPiece: Math.random() < (0.1 + currentChestIndex * 0.01) ? 1 : 0, // Increased chance slightly per chest level
              // Fox Medal reward: Guaranteed minimum + random bonus, scaled by chest level
              // Ensures at least 1 medal, scales with index.
              foxMedal: Math.floor(Math.random() * (currentChestIndex + 1)) + 1 // Example: Wood chest (0) gives 1-1, Bronze (1) gives 1-2, etc.
          };
          // Ensure rewards are non-negative integers for items like land pieces and medals
          rewards.landPiece = Math.max(0, Math.floor(rewards.landPiece));
          rewards.foxMedal = Math.max(0, Math.floor(rewards.foxMedal));
           // USDT should be a number with decimals
           rewards.usdt = parseFloat(rewards.usdt.toFixed(4));


          debugLog("[CHEST ACTION] Simulated rewards:", rewards);


          // --- Update User Data in Firestore (Deduct cost, Add rewards) ---
          // Use a Firestore Transaction for Atomicity:
          // Deducting gems and adding rewards should happen together.
          // If the update fails after deduction, the rewards might be lost.
          // If adding rewards fails after deduction, user loses gems for nothing.
          // A transaction prevents these partial updates.
          debugLog("[CHEST ACTION] Starting Firestore update transaction...");
          const userDocRef = window.db.collection('userData').doc(window.telegramUser.id.toString()); // Get user doc ref again
          const rankingDocRef = window.db.collection('users').doc(window.telegramUser.id.toString()); // Get ranking doc ref

          await window.db.runTransaction(async (transaction) => {
               // Read the user doc again *within* the transaction for an absolute final check
               const latestUserDoc = await transaction.get(userDocRef);
               if (!latestUserDoc.exists) {
                    throw new Error("User data disappeared during chest opening transaction.");
               }
               const latestUserData = latestUserDoc.data();
               const latestGems = latestUserData?.gems ?? 0;

               // FINAL double-check on gems within the transaction
               if (latestGems < chest.gemCost) {
                   throw new Error(`Insufficient gems in transaction. Needed ${chest.gemCost.toLocaleString()}, have ${latestGems.toLocaleString()}.`);
               }

               // Prepare the updates for the user document
               const userUpdates = {
                   gems: firebase.firestore.FieldValue.increment(-chest.gemCost), // Deduct gem cost
                   usdt: firebase.firestore.FieldValue.increment(rewards.usdt), // Add USDT reward
                   landPieces: firebase.firestore.FieldValue.increment(rewards.landPiece), // Add Land Piece reward
                   foxMedals: firebase.firestore.FieldValue.increment(rewards.foxMedal) // Add Fox Medal reward
                   // Add other rewards here
               };
               // Update the user's document within the transaction
               transaction.update(userDocRef, userUpdates);
               debugLog(`[CHEST TRANSACTION] User data prepared for update: deducted ${chest.gemCost} gems, added rewards.`);


               // Update the ranking document if medals were awarded
               // This also needs to be part of the same transaction to ensure consistency
               if (rewards.foxMedal > 0) {
                    // Check if ranking document exists before updating within the transaction
                    const rankingDoc = await transaction.get(rankingDocRef);
                    if (rankingDoc.exists) {
                         // Increment foxMedals in the ranking document
                         transaction.update(rankingDocRef, {
                            foxMedals: firebase.firestore.FieldValue.increment(rewards.foxMedal)
                         });
                         debugLog(`[CHEST TRANSACTION] Ranking data prepared for update: added ${rewards.foxMedal} medals.`);
                    } else {
                         // If ranking doc doesn't exist (shouldn't happen if initializeUserData runs),
                         // create it within the transaction.
                         console.warn(`[CHEST TRANSACTION WARN] Ranking document for user ${window.telegramUser.id} not found. Creating it.`);
                         const newRankingEntry = {
                            username: window.telegramUser.username || window.telegramUser.first_name || `User_${window.telegramUser.id.toString().slice(-4)}`,
                            foxMedals: rewards.foxMedal, // Set initial medals
                            photoUrl: window.telegramUser.photo_url || 'assets/icons/user-avatar.png',
                            userId: window.telegramUser.id.toString()
                         };
                         transaction.set(rankingDocRef, newRankingEntry);
                         debugLog("[CHEST TRANSACTION] Created missing ranking entry within transaction.");
                    }
               }
          });
          // --- Transaction End ---

          // If the transaction completed successfully, the data is updated in Firestore
          debugLog("[CHEST ACTION] Firestore transaction successful. Chest opened and rewards processed.");

          // Log analytics event for opening a chest
          // Uses analytics from firebaseService.js (implicitly global)
          if (window.analytics) window.analytics.logEvent('chest_opened', {
               userId: window.telegramUser.id,
               chestName: chest.name,
               cost: chest.gemCost,
               rewards: { usdt: rewards.usdt, landPiece: rewards.landPiece, foxMedal: rewards.foxMedal }
           });


          // --- Inform User about Rewards ---
          // Build a message listing the rewards obtained
          let rewardString = `Opened ${chest.name}! Rewards:\n`;
          if (rewards.usdt > 0) rewardString += `- ${rewards.usdt.toFixed(4)} USDT\n`;
          if (rewards.landPiece > 0) rewardString += `- ${rewards.landPiece} Land Piece\n`;
          if (rewards.foxMedal > 0) rewardString += `- ${rewards.foxMedal} Fox Medal\n`;

          // Add a message if no specific rewards were obtained (excluding the cost deduction)
          if (rewards.usdt <= 0 && rewards.landPiece <= 0 && rewards.foxMedal <= 0) {
             rewardString += "- Nothing this time (you still paid the gem cost)!";
          }
          // Show the rewards message to the user
          alert(rewardString);


          // --- Update UI after successful opening ---
          // Fetch the latest user data *after* the Firestore update to refresh the cache with new balances
          await window.fetchAndUpdateUserData(); // Refresh global currentUserData cache
          debugLog("[CHEST ACTION] User data refreshed after opening chest.");

          // Update the user stats display in the header (gems, usdt, ton)
          await window.updateUserStatsUI(); // Update header/stats UI
          debugLog("[CHEST ACTION] User stats UI updated after opening chest.");

          // Update the Chest section UI to reflect the new gem balance and re-evaluate button state
          updateChestUI(); // Re-render the chest item and update button/displays
          debugLog("[CHEST ACTION] Chest section UI updated after opening chest.");


     } catch (error) {
         // Handle errors that occur during validation or the Firestore transaction
         console.error("[CHEST ERROR] Error opening chest:", error);
         debugLog(`[CHEST ERROR] ${error.message}`);

         // Inform the user about the failure reason
         alert(`Failed to open chest: ${error.message}`); // Show the specific error message to the user

         // --- Update UI on opening failure ---
         // It's important to refresh the Chest section UI on failure to re-enable the button
         // and reflect the true gem/VIP state (which should be unchanged if the transaction failed).
         updateChestUI(); // Update button state and displays based on actual (unchanged) data
     } finally {
         // This block is called whether the try or catch block finishes.
         // Ensure the Open Chest button is re-enabled if updateChestUI didn't cover it for all paths.
         // However, updateChestUI is called in both try and catch, which handles button state,
         // so a redundant re-enable here might not be strictly necessary but could act as a safety net.
         // If (openButton && openButton.disabled && openButton.textContent === 'Opening...') {
         //    updateChestUI(); // Re-evaluate state
         // }
     }
 }


// --- Event Listener Setup for Chest Section ---
// Sets up click listeners for the navigation arrows and the Open Chest button.
// This function should be called by main.js after renderChests.
// This function is exposed globally for use by main.js.
function setupChestListeners() {
    // Uses debugLog from utils.js (globally available)
    // Uses nextChest, prevChest, openChest from this file (implicitly global, or accessible after setup)
    // Depends on elements existing in index.html within the chest section

    debugLog("[CHEST] Setting up chest section listeners...");

    // Get references to the navigation arrows and the open button
    const leftArrow = document.querySelector('.chest-section .nav-arrow.left'); // Select within the chest section
    const rightArrow = document.querySelector('.chest-section .nav-arrow.right'); // Select within the chest section
    const openButton = document.querySelector('.chest-section .open-chest-button'); // Select within the chest section

    // Set up listener for the left navigation arrow
    if (leftArrow) {
        // Remove existing listeners to prevent duplicates if this function is called multiple times
        const newLeftArrow = leftArrow.cloneNode(true);
        leftArrow.parentNode?.replaceChild(newLeftArrow, leftArrow);
        leftArrow = newLeftArrow; // Update the reference

        // Add the click listener, calling the prevChest function
        leftArrow.addEventListener('click', prevChest); // Call the handler function
        debugLog("[CHEST] Left nav arrow listener setup.");
    } else {
         debugLog("[CHEST WARN] Left nav arrow element not found.");
    }

    // Set up listener for the right navigation arrow
    if (rightArrow) {
         // Remove existing listeners
         const newRightArrow = rightArrow.cloneNode(true);
         rightArrow.parentNode?.replaceChild(newRightArrow, rightArrow);
         rightArrow = newRightArrow; // Update the reference

        // Add the click listener, calling the nextChest function
        rightArrow.addEventListener('click', nextChest); // Call the handler function
        debugLog("[CHEST] Right nav arrow listener setup.");
    } else {
         debugLog("[CHEST WARN] Right nav arrow element not found.");
    }

    // Set up listener for the Open Chest button
    if (openButton) {
         // Remove existing listeners
         const newOpenButton = openButton.cloneNode(true);
         openButton.parentNode?.replaceChild(newOpenButton, openButton);
         openButton = newOpenButton; // Update the reference

        // Add the click listener, calling the openChest function
        openButton.addEventListener('click', openChest); // Call the handler function
        debugLog("[CHEST] Open Chest button listener setup.");
    } else {
         debugLog("[CHEST WARN] Open Chest button element not found.");
    }

    debugLog("[CHEST] Chest section listeners setup complete.");
}


// Make key Chest section functions available globally
// renderChests needs to be called by main.js during setup
window.renderChests = renderChests;
// updateChestUI needs to be called by navigation.js when switching to the chest section
window.updateChestUI = updateChestUI;
// setupChestListeners needs to be called by main.js during setup
window.setupChestListeners = setupChestListeners;

// nextChest, prevChest, openChest are primarily called by the listeners setup here,
// they don't necessarily *need* to be global, but exposing them matches the original
// code structure and might be intended for other uses or debugging.
// Keeping them "implicitly global" via `function name() {}` within this script file is fine
// as long as this script file is loaded before any script that calls them.
// If using ES Modules, you would need explicit exports and imports.
