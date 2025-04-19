// js/walletService.js

// Forward declare global variable defined in this file, used by other scripts
let tonConnectUI = null; // TON Connect UI instance

// Define CDN URL for TON Connect UI (Manifest URL is in config.js)
const TONCONNECT_CDN_URL = 'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';

// Helper to get references to key DOM elements in the wallet section
function getWalletElements() {
   return {
        // These elements are assumed to exist in index.html within the wallet section
        connectButton: document.querySelector('.wallet-section .connect-button'),
        connectionStatus: document.querySelector('.wallet-section #connection-status'),
        withdrawButtons: document.querySelectorAll('.wallet-section .withdraw-button'), // Select buttons within the wallet section
        walletSection: document.getElementById('wallet'), // The wallet section container itself
        transactionList: document.querySelector('.wallet-section #transaction-list'), // Transaction history list
        // Modal elements (assumed to be in index.html, potentially outside the section but managed by walletService)
        modal: document.getElementById('withdraw-modal'), // The modal container
        amountInput: document.getElementById('withdraw-amount'), // Amount input field
        availableBalanceEl: document.getElementById('available-balance'), // Element to display available balance
        currencySpan: document.querySelector('#withdraw-modal #currency'), // Element to display currency in modal
        feeSpan: document.getElementById('withdraw-fee'), // Element to display withdrawal fee
        feeCurrencySpan: document.querySelector('#withdraw-modal #fee-currency'), // Element to display fee currency in modal
        confirmButton: document.getElementById('confirm-withdraw'), // Confirm withdrawal button
        cancelButton: document.getElementById('cancel-withdraw') // Cancel withdrawal button
    };
}

// Set up event listeners for the withdraw buttons
// This function is called by initWalletSystem and potentially after UI updates
function setupWithdrawListeners() {
     // Uses getWalletElements from this file (implicitly global)
     // Calls showWithdrawModal from this file (implicitly global)
    debugLog("[WALLET] Setting up withdraw listeners...");
    const elements = getWalletElements(); // Get current elements

     // Ensure we are targeting buttons within the wallet section
    const withdrawButtons = document.querySelectorAll('.wallet-section .withdraw-button');

     withdrawButtons.forEach(button => {
         // To prevent adding duplicate listeners if this function is called multiple times,
         // we can clone and replace the node. This removes all existing listeners efficiently.
         const newButton = button.cloneNode(true); // Clone the button node
         if (button.parentNode) { // Check if the button still has a parent (is in the DOM)
             button.parentNode.replaceChild(newButton, button); // Replace the old button with the new clone
         } else {
             debugLog("[WALLET WARN] Could not replace withdraw button node, parent missing.");
         }
     });

     // Re-select the buttons after replacing them in the DOM
     const updatedWithdrawButtons = document.querySelectorAll('.wallet-section .withdraw-button');

     updatedWithdrawButtons.forEach(button => {
         const card = button.closest('.balance-card'); // Find the parent balance card
         if (card) {
             // Add the click listener to the new button clone
             button.addEventListener('click', () => {
                 debugLog("[WALLET ACTION] Withdraw button clicked.");
                 showWithdrawModal(card); // Call showWithdrawModal when clicked
             });
         } else {
             debugLog("[WALLET WARN] Could not find parent card for withdraw button during listener setup.");
         }
     });

     // Also set up listener for the warning button in the balance cards
     const warningButtons = document.querySelectorAll('.wallet-section .warning-button');
     warningButtons.forEach(button => {
          const newButton = button.cloneNode(true); // Clone the button
          if (button.parentNode) {
              button.parentNode.replaceChild(newButton, button); // Replace
          } else {
              debugLog("[WALLET WARN] Could not replace warning button node, parent missing.");
          }
          newButton.addEventListener('click', (event) => {
              const card = event.target.closest('.balance-card');
              const currency = card.classList.contains('usdt-card') ? 'USDT' : 'TON';
              alert(`Information about ${currency} balance or withdrawal process.`); // Replace with actual info/modal
              debugLog(`Warning button clicked for ${currency}`);
          });
     });


     // Setup modal cancel listener once (assuming modal is not re-rendered)
     const modalElements = getWalletElements();
     if (modalElements.cancelButton) {
         // Ensure only one listener by cloning or using removeEventListener if modal is static
         const newCancelButton = modalElements.cancelButton.cloneNode(true);
         modalElements.cancelButton.parentNode.replaceChild(newCancelButton, modalElements.cancelButton);
         modalElements.cancelButton = newCancelButton; // Update the reference

         modalElements.cancelButton.onclick = () => {
             if(modalElements.modal) modalElements.modal.style.display = 'none';
             debugLog("Withdraw modal cancelled.");
         };
         debugLog("Withdraw modal cancel listener setup.");
     } else {
          debugLog("[WALLET WARN] Withdraw modal cancel button not found during listener setup.");
     }
     // Note: Confirm button listener is set up dynamically in showWithdrawModal
 }

 // Show the withdrawal modal and populate it with details based on the clicked card
 function showWithdrawModal(cardElement) {
     // Uses debugLog from utils.js (globally available)
     // Uses getWalletElements from this file (implicitly global)
     // Uses currentUserData from uiUpdater.js (globally available)
     // Calls confirmWithdraw from this file (implicitly global)

     debugLog("Showing withdraw modal...");
     const elements = getWalletElements(); // Get current modal elements

     // Ensure all required modal elements exist
     if (!elements.modal || !elements.amountInput || !elements.availableBalanceEl || !elements.currencySpan || !elements.feeSpan || !elements.feeCurrencySpan || !elements.confirmButton || !elements.cancelButton) {
         debugLog("[WALLET MODAL ERROR] One or more withdraw modal elements not found. Cannot show modal.");
         console.error("[WALLET MODAL ERROR] Required modal elements missing.");
         return; // Stop if elements are missing
      }

     // Determine currency and get balance from cached user data
     const isUsdt = cardElement.classList.contains('usdt-card');
     const currency = isUsdt ? 'USDT' : 'TON';
     // Use currentUserData cache from uiUpdater.js (globally available) for accurate balance
     const balance = isUsdt ? (window.currentUserData?.usdt ?? 0) : (window.currentUserData?.ton ?? 0);
     // TODO: Fetch fees dynamically from backend/config if they can change
     const fee = isUsdt ? 0.01 : 0.005; // Example fixed fee

     // Populate modal elements with details
     elements.availableBalanceEl.textContent = balance.toFixed(4); // Display available balance, formatted
     elements.currencySpan.textContent = currency; // Display currency symbol/name
     elements.feeSpan.textContent = fee.toFixed(isUsdt ? 4 : 4); // Display fee, formatted
     elements.feeCurrencySpan.textContent = currency; // Display fee currency

     // Configure amount input
     elements.amountInput.value = ''; // Clear previous input
     // Set max amount user can withdraw (balance minus fee, ensure non-negative)
     elements.amountInput.max = Math.max(0, balance - fee).toFixed(4);
     // Set step for the number input based on currency precision
     elements.amountInput.step = isUsdt ? "0.0001" : "0.0001"; // Set step for decimals

     // Re-enable the confirm button and set its default text
     elements.confirmButton.disabled = false;
     elements.confirmButton.textContent = 'Confirm';

     // Add confirm listener (replace old one if exists to prevent duplicates)
     // Cloning is a reliable way to ensure only one listener is attached.
     const oldConfirmButton = elements.confirmButton;
     const newConfirmButton = oldConfirmButton.cloneNode(true);
     oldConfirmButton.parentNode.replaceChild(newConfirmButton, oldConfirmButton);
     elements.confirmButton = newConfirmButton; // Update the reference to the new button

     // Attach the click listener to the new confirm button
     // Use an arrow function to correctly capture `currency`, `balance`, and `fee` from this scope
     elements.confirmButton.onclick = () => confirmWithdraw(currency, balance, fee);

     // Display the modal
     elements.modal.style.display = 'flex';
     debugLog(`Withdraw modal shown for ${currency}. Balance: ${balance}, Fee: ${fee}`);
 }

 // Handle the confirmation of a withdrawal (simulation)
 // This function is called when the confirm button in the modal is clicked
 async function confirmWithdraw(currency, balance, fee) {
     // Uses debugLog from utils.js (globally available)
     // Uses getWalletElements from this file (implicitly global)
     // Uses tonConnectUI from this file (implicitly global)
     // Uses db, firebase, firebaseInitialized from firebaseService.js (implicitly global)
     // Uses telegramUser from telegramService.js (globally available)
     // Uses fetchAndUpdateUserData, updateUserStatsUI from uiUpdater.js (globally available)
     // Uses analytics from firebaseService.js (implicitly global)
     // Calls updateTransactionHistory from this file (implicitly global)

     debugLog(`[WITHDRAW ACTION] Confirming withdrawal for ${currency}...`);
     const elements = getWalletElements(); // Get current modal elements (again, defensive)
     if (!elements.modal || !elements.amountInput || !elements.confirmButton) {
         debugLog("[WITHDRAW ERROR] Modal or button elements missing during confirmation.");
          alert("Withdrawal process error. Please close and try again.");
          // Attempt to hide modal if elements are missing
          if (elements.modal) elements.modal.style.display = 'none';
          return;
     }

     // Get the entered amount and calculate the total deduction
     const amount = parseFloat(elements.amountInput.value);
     const totalDeduction = amount + fee;

     // Disable the confirm button and show processing state
     elements.confirmButton.disabled = true;
     elements.confirmButton.textContent = 'Processing...';

     // --- Input and State Validation ---
     if (isNaN(amount) || amount <= 0) {
          alert("Invalid amount entered. Amount must be a positive number.");
          elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm'; // Re-enable and reset text
          return; // Stop validation
     }
      // Validate against the current available balance (fetched in showWithdrawModal and passed)
      if (totalDeduction > balance) {
         alert(`Insufficient balance (including fee). Available: ${balance.toFixed(4)} ${currency}. Needed: ${totalDeduction.toFixed(4)} ${currency}.`);
         elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm'; // Re-enable and reset text
         return; // Stop validation
      }
      // Validate TON Connect state
      if (!window.tonConnectUI || !window.tonConnectUI.connected || !window.tonConnectUI.account?.address) {
         alert("Wallet not connected or address unavailable. Please connect your wallet.");
         elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm'; // Re-enable and reset text
         elements.modal.style.display = 'none'; // Hide modal if wallet isn't connected
         return; // Stop validation
      }
      // Validate Firebase/User state
      if (!window.firebaseInitialized || !window.db || !window.telegramUser || !window.telegramUser.id) {
          alert("App initialization error. Please reload.");
          elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm'; // Re-enable and reset text
          elements.modal.style.display = 'none'; // Hide modal on critical error
          debugLog("[WITHDRAW ERROR] Firebase or User not ready.");
          return; // Stop validation
      }
      // --- End Validation ---


     const destinationAddress = window.tonConnectUI.account.address; // Get the connected wallet address
     const userDocRef = window.db.collection('userData').doc(window.telegramUser.id.toString()); // Reference to the user's document
     const balanceField = currency.toLowerCase(); // Field name in Firestore ('usdt' or 'ton')

     try {
         debugLog(`[WITHDRAW SIMULATION] Initiating withdrawal: ${amount} ${currency} to ${destinationAddress} (Fee: ${fee} ${currency}, Total: ${totalDeduction})`);

         // --- Use a Firestore Transaction for Atomicity ---
         // Transactions ensure that balance deduction and transaction record creation
         // happen together, preventing inconsistencies.
         await window.db.runTransaction(async (transaction) => {
             // Read the user's document *within* the transaction to get the absolute latest balance
             const userDoc = await transaction.get(userDocRef);
             if (!userDoc.exists) {
                  // This is a critical error if the doc existed during validation but not now
                  throw new Error("User data document not found during withdrawal transaction.");
             }
             const userData = userDoc.data();
             const currentBalance = userData[balanceField] || 0; // Get the latest balance

             debugLog(`[WITHDRAW TRANSACTION] User's current balance in TX: ${currentBalance} ${currency}. Total deduction: ${totalDeduction}.`);

             // Double-check balance within the transaction (defense in depth)
             if (currentBalance < totalDeduction) {
                 throw new Error(`Insufficient balance in transaction. Available: ${currentBalance.toFixed(4)} ${currency}. Needed: ${totalDeduction.toFixed(4)} ${currency}.`);
             }

             // Generate a more robust transaction ID (timestamp + random string)
             const transactionId = `withdraw_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

             // Create the transaction record object
             const transactionRecord = {
                 txId: transactionId,
                 userId: window.telegramUser.id.toString(),
                 amount: amount, // Amount requested by user
                 currency: currency,
                 fee: fee,
                 totalDeducted: totalDeduction, // Amount deducted from user's balance
                 destination: destinationAddress, // Wallet address receiving funds
                 status: 'pending', // Initial status
                 timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Server timestamp for the record
                 type: 'withdrawal' // Transaction type
             };

             // 1. Deduct the balance from the user's document
             transaction.update(userDocRef, {
                 [balanceField]: firebase.firestore.FieldValue.increment(-totalDeduction)
             });
             debugLog(`[WITHDRAW TRANSACTION] Balance deduction prepared: -${totalDeduction} ${currency}`);

             // 2. Add the pending transaction record to the user's subcollection
             const txRef = userDocRef.collection('transactions').doc(transactionId); // Use generated ID as doc ID
             transaction.set(txRef, transactionRecord); // Use set() within transaction
             debugLog(`[WITHDRAW TRANSACTION] Pending transaction record prepared: ${transactionId}`);

             // Return the transaction ID and amount from the transaction to be used outside
             return { transactionId, amount };

         });
         // --- Transaction End ---

         // If the transaction completes without error, the balance is deducted and record is created (pending)
         debugLog(`[WITHDRAW ACTION] Firestore transaction successful. Withdrawal initiated.`);

         // Close the modal immediately after the transaction is successful
         elements.modal.style.display = 'none';

         // Refresh user data cache and update UI to show new balance and the pending transaction
         await window.fetchAndUpdateUserData(); // Refresh cached balance
         await window.updateUserStatsUI(); // Update header/wallet balances
         await updateWalletSectionUI(); // Update the wallet section UI, including the transaction history

         // Log analytics event for initiation
         // Uses analytics from firebaseService.js (implicitly global)
         if (window.analytics) window.analytics.logEvent('withdrawal_initiated', { userId: window.telegramUser.id, currency, amount, fee, destination: destinationAddress });

         // Inform the user that the withdrawal is initiated (mentioning it's a simulation)
         alert(`Withdrawal of ${amount.toFixed(4)} ${currency} initiated (Fee: ${fee.toFixed(4)} ${currency}). Please check history for status. (This is a simulation, no real crypto is sent).`);


         // --- SIMULATION: Simulate background processing and status update ---
         // This part is ONLY for simulation. In a real app, a backend process
         // would handle sending the crypto and updating the transaction status in Firestore.
         debugLog(`[WITHDRAW SIMULATION] Starting simulation process for transaction...`);
         const simulationSuccess = Math.random() > 0.1; // 90% success rate simulation
         const simulationDuration = 5000 + Math.random() * 3000; // Simulate 5-8 second processing time

         setTimeout(async () => {
              debugLog(`[WITHDRAW SIMULATION] Simulation complete after ${simulationDuration}ms. Success: ${simulationSuccess}`);
              const finalStatus = simulationSuccess ? 'completed' : 'failed';
              const txRef = window.db.collection('userData').doc(window.telegramUser.id.toString()).collection('transactions').doc(transactionId); // Use the generated ID

              try {
                  const updateData = { status: finalStatus };
                  if (!simulationSuccess) {
                      updateData.failureReason = 'Simulated transaction failure.'; // Add a reason for simulation failure
                  }
                  await txRef.update(updateData); // Update the status in Firestore
                  debugLog(`[WITHDRAW SIMULATION] Transaction ${transactionId} status updated to '${finalStatus}' in Firestore.`);

                  // If simulation failed, potentially "refund" the fee or the whole amount
                  // This is complex and depends on real-world logic. For simulation, we just mark failed.
                  // A real app needs robust reconciliation.

                  await updateTransactionHistory(); // Refresh history UI to show final status
                  debugLog(`[WITHDRAW SIMULATION] Transaction history UI updated.`);

              } catch (simUpdateError) {
                  console.error(`[WITHDRAW SIMULATION ERROR] Failed to update simulated transaction status (${finalStatus}) for ${transactionId}:`, simUpdateError);
                  debugLog(`[WITHDRAW SIMULATION ERROR] Failed updating tx status: ${simUpdateError.message}`);
                  // Even if the status update fails, try to refresh history to show potential partial updates
                  await updateTransactionHistory();
              }
          }, simulationDuration);
         // --- END SIMULATION ---


     } catch (error) {
         // Handle errors that occur during the Firestore transaction or validation before the transaction
         console.error(`[WITHDRAW ERROR] Withdrawal process failed: ${error.message}`);
         debugLog(`[WITHDRAW ERROR] ${error.message}`);
         alert(`Withdrawal failed: ${error.message}`); // Inform the user about the specific failure reason

         // Ensure the confirm button is re-enabled and the modal state is correct after failure
         elements.confirmButton.disabled = false;
         elements.confirmButton.textContent = 'Confirm'; // Reset button text
         // Do NOT close the modal on failure automatically, let the user see the error message.

         // It's important to re-fetch user data on failure to ensure the UI reflects the true balance
         // especially if an error occurred *after* some local state changes but before the DB transaction completed.
         // If the transaction failed, the balance in the DB should be unchanged, but UI might be stale.
         await window.fetchAndUpdateUserData();
         await window.updateUserStatsUI();
         await updateWalletSectionUI(); // Refresh the wallet section UI
     }
     // No finally block needed; button state and modal visibility are managed explicitly in try/catch blocks
  }

 // Update the transaction history list in the wallet section
 // This function is called by updateWalletSectionUI and after withdrawal simulations
 async function updateTransactionHistory() {
     // Uses debugLog from utils.js (globally available)
     // Uses getWalletElements from this file (implicitly global)
     // Uses firebaseInitialized, db from firebaseService.js (implicitly global)
     // Uses telegramUser from telegramService.js (globally available)
     // Uses formatTimestamp from utils.js (globally available)

     debugLog("Updating transaction history...");
     const elements = getWalletElements(); // Get elements

     // Ensure the transaction list element exists
     if (!elements.transactionList) {
         debugLog("[WALLET HISTORY ERROR] Transaction list element not found. Skipping history update.");
         console.error("[WALLET HISTORY ERROR] Transaction list element missing.");
         return; // Stop if element is missing
      }

     // Display a loading message
     elements.transactionList.innerHTML = '<li><p>Loading history...</p></li>'; // Use <p> inside <li> for structure

     // Ensure Firebase and user are ready before fetching history
     if (!window.firebaseInitialized || !window.db || !window.telegramUser || !window.telegramUser.id) {
         debugLog("[WALLET HISTORY ERROR] Firebase or User not ready for history fetch.");
         elements.transactionList.innerHTML = '<li><p>History unavailable. Please try again later.</p></li>'; // Show unavailable message
         return; // Stop fetch
     }

     try {
         // Reference the transactions subcollection for the current user
         const txCollectionRef = window.db.collection('userData').doc(window.telegramUser.id.toString()).collection('transactions');

         // Fetch the latest transactions, ordered by timestamp
         const snapshot = await txCollectionRef.orderBy('timestamp', 'desc').limit(15).get(); // Limit to latest 15

         // Check if there are any transaction records
         if (snapshot.empty) {
              debugLog("[WALLET HISTORY] No transaction records found.");
              elements.transactionList.innerHTML = '<li><p>No transactions yet</p></li>'; // Show empty state message
              return; // Stop here
         }

         debugLog(`[WALLET HISTORY] Fetched ${snapshot.docs.length} transaction history entries.`);

         // Generate HTML for each transaction record
         elements.transactionList.innerHTML = snapshot.docs.map(doc => {
             const tx = doc.data(); // Get the transaction data

             // Format the timestamp using the utility function
             const txTime = window.formatTimestamp(tx.timestamp); // Use global formatTimestamp

             // Build the detail string based on transaction type
             let detail = '';
             const status = tx.status || 'unknown'; // Default status if missing
             const statusClass = status.toLowerCase(); // Use lowercase status for CSS class

             if (tx.type === 'withdrawal') {
                  detail = `Withdraw ${tx.amount?.toFixed(4) || '?'} ${tx.currency || '?'} (Fee: ${tx.fee?.toFixed(4) || '?'})`;
                  // Optionally add destination address snippet
                  // if (tx.destination) detail += ` to ${tx.destination.slice(0, 6)}...${tx.destination.slice(-4)}`;
             } else if (tx.type === 'credit_claim') {
                  detail = `Claimed ${tx.usdtAmount?.toFixed(4) || '?'} USDT (${tx.creditsSpent?.toLocaleString() || '?'} C)`;
              } else if (tx.type === 'quest_reward') { // Example for future quest rewards
                  detail = `Quest Reward: +${tx.rewardAmount?.toLocaleString() || '?'} ${tx.rewardCurrency || '?'}`;
              } else {
                 // Generic fallback for unknown types
                 detail = `Type: ${tx.type || 'Unknown'} | Amount: ${tx.amount || 'N/A'}`;
             }

             // Return the HTML for a list item
             return `
                 <li>
                     ${detail}
                     - <span class="tx-status ${statusClass}">${status}</span>
                     <br><small>${txTime}</small>
                     ${tx.failureReason ? `<br><small style="color: #ff4500;">Reason: ${tx.failureReason}</small>` : ''}
                 </li>
             `;
         }).join(''); // Join the array of list item HTML strings into a single string

         debugLog("Transaction history UI updated successfully.");

     } catch (error) {
         console.error("[WALLET HISTORY ERROR] Error updating transaction history:", error);
         debugLog(`[WALLET HISTORY ERROR] Error updating history: ${error.message}`);
         elements.transactionList.innerHTML = `<li><p class="error">Failed to load transaction history. Please try again.</p></li>`; // Show error message
     }
 }


// Make key wallet system variables and functions available globally
window.tonConnectUI = tonConnectUI; // Expose the TonConnectUI instance
window.initWalletSystem = initWalletSystem; // Expose the main initialization function
// Expose UI update functions so navigation/main can call them
window.updateWalletSectionUI = updateWalletSectionUI;
window.updateWalletConnectionStatusUI = updateWalletConnectionStatusUI;
window.updateTransactionHistory = updateTransactionHistory;
// Helper functions like getWalletElements, showWithdrawModal, confirmWithdraw, setupWithdrawListeners
// can remain local or be exposed if needed elsewhere explicitly.
// Based on the original code structure, they seem to be primarily internal to walletService.
