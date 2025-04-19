// js/walletService.js

// Forward declare globals
let tonConnectUI = null;

const TONCONNECT_MANIFEST_URL = 'https://fourgo.app/tonconnect-manifest.json'; // Or load from config.js
const TONCONNECT_CDN_URL = 'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';

function getWalletElements() {
   return {
        connectButton: document.querySelector('.connect-button'),
        connectionStatus: document.getElementById('connection-status'),
        withdrawButtons: document.querySelectorAll('.withdraw-button'), // Re-select if needed after cloning
        walletSection: document.getElementById('wallet'),
        transactionList: document.getElementById('transaction-list'),
        // Modal elements
        modal: document.getElementById('withdraw-modal'),
        amountInput: document.getElementById('withdraw-amount'),
        availableBalanceEl: document.getElementById('available-balance'),
        currencySpan: document.getElementById('currency'),
        feeSpan: document.getElementById('withdraw-fee'),
        feeCurrencySpan: document.getElementById('fee-currency'),
        confirmButton: document.getElementById('confirm-withdraw'),
        cancelButton: document.getElementById('cancel-withdraw')
    };
}

async function initializeTonConnect() {
    debugLog("Initializing TON Connect...");
    try {
        if (!window.TonConnectUI) {
            debugLog("Attempting to load TON Connect UI from CDN:", TONCONNECT_CDN_URL);
            await loadScript(TONCONNECT_CDN_URL); // Use utility function
            if (!window.TonConnectUI) throw new Error("Loaded from CDN, but TonConnectUI not defined.");
            debugLog("TON Connect UI loaded successfully from CDN.");
        } else {
             debugLog("TON Connect UI already available in window scope.");
        }

        // Check if UI instance already exists
        if (tonConnectUI) {
             debugLog("TON Connect UI instance already exists.");
             return tonConnectUI;
        }

        tonConnectUI = new TonConnectUI({
            manifestUrl: TONCONNECT_MANIFEST_URL,
            buttonRootId: null // We manage the button connection manually
        });
        debugLog("TON Connect UI instance created.");
        return tonConnectUI;

    } catch (error) {
        console.error(`TON Connect initialization failed: ${error.message}`);
        debugLog(`TON Connect initialization failed: ${error.message}`);
        alert("Wallet connection features are unavailable.");
        // Return a dummy object to prevent errors elsewhere if needed
        return { connected: false, account: null, connectWallet: async () => { alert("Wallet connection unavailable."); }, disconnect: async () => {}, onStatusChange: () => {} };
    }
}

async function handleConnectClick() {
    debugLog("[WALLET ACTION] Connect/Disconnect button clicked.");
    const elements = getWalletElements();
    if (!elements.connectButton || !tonConnectUI) {
        debugLog("Wallet connect button or TON Connect UI not ready.");
        return;
    }

    elements.connectButton.disabled = true; elements.connectButton.textContent = 'Processing...';
    try {
        if (tonConnectUI.connected) {
            debugLog("Disconnecting wallet...");
            await tonConnectUI.disconnect(); // Triggers status change listener
            debugLog("Wallet disconnect initiated.");
        } else {
            debugLog("Connecting wallet...");
             // The connectWallet method should handle opening the modal/redirects
             await tonConnectUI.connectWallet();
             // Status change listener will handle UI updates upon connection
            debugLog("Wallet connection process initiated via TON Connect UI.");
        }
    } catch (error) {
        console.error(`Wallet connection/disconnection error: ${error.message}`);
        debugLog(`Wallet connect/disconnect error: ${error.message}`);
        alert(`Wallet action failed: ${error.message}`);
        await updateWalletConnectionStatusUI(); // Update UI based on actual state on error
    } finally {
        // Re-enable button only if status change didn't handle it (safety net)
        // Status listener should ideally re-enable it.
        setTimeout(() => {
             const currentElements = getWalletElements(); // Re-fetch in case DOM changed
             if (currentElements.connectButton && currentElements.connectButton.textContent === 'Processing...') {
                  currentElements.connectButton.disabled = false;
                 updateWalletConnectionStatusUI(); // Ensure correct text/state
             }
         }, 1500); // Slightly longer timeout
    }
}

async function initWalletSystem() {
    debugLog("Initializing wallet system...");
    tonConnectUI = await initializeTonConnect(); // Ensure TON Connect is ready
    if (!tonConnectUI) return;

    const elements = getWalletElements();
    if (!elements.connectButton) {
        debugLog("Wallet connect button not found during init.");
        return;
    }

    try {
        // TON Connect status change listener
        tonConnectUI.onStatusChange(async (walletInfo) => {
            const isConnected = !!walletInfo;
            debugLog(`[WALLET STATUS CHANGE] Wallet status changed. Connected: ${isConnected}`, walletInfo ? { address: walletInfo.account.address, chain: walletInfo.account.chain } : null);

             // Re-fetch user data to ensure consistency, especially if wallet address changes state
             await window.fetchAndUpdateUserData();

            await updateWalletConnectionStatusUI(); // Update UI based on new status
            const currentElements = getWalletElements(); // Re-fetch
             if (currentElements.connectButton) currentElements.connectButton.disabled = false; // Re-enable button

             // Store or clear wallet address on status change
             if (isConnected && walletInfo.account?.address) {
                await Storage.setItem('walletAddress', walletInfo.account.address);
                debugLog(`Wallet connected: Address ${walletInfo.account.address} stored.`);
             } else if (!isConnected) {
                 // Optionally clear stored address on disconnect if desired
                 // await Storage.setItem('walletAddress', null);
                 // debugLog("Wallet disconnected, cleared stored address.");
             }

        }, (error) => {
             console.error("[WALLET STATUS CHANGE ERROR]", error);
             debugLog(`[WALLET STATUS CHANGE ERROR] ${error.message || 'Unknown error'}`);
             // Maybe update UI to show an error state?
        });

        // Add connect/disconnect button listener (ensure only one listener)
        elements.connectButton.removeEventListener('click', handleConnectClick); // Remove previous if any
        elements.connectButton.addEventListener('click', handleConnectClick);

        // Setup withdraw button listeners
        setupWithdrawListeners();

        // Initial UI update based on current state
        await updateWalletConnectionStatusUI();

        debugLog("Wallet system initialized successfully.");
    } catch (error) {
        console.error(`Wallet system init failed: ${error.message}`);
        debugLog(`Wallet system init failed: ${error.message}`);
    }
}

function setupWithdrawListeners() {
     const elements = getWalletElements();
     elements.withdrawButtons.forEach(button => {
         const card = button.closest('.balance-card');
         // Remove old listeners before adding new ones to prevent duplicates
         button.replaceWith(button.cloneNode(true)); // Simple way to remove all listeners
     });
     // Re-select buttons after cloning
     const newWithdrawButtons = document.querySelectorAll('.wallet-section .withdraw-button');
     newWithdrawButtons.forEach(button => {
         const card = button.closest('.balance-card');
         if (card) {
             button.addEventListener('click', () => showWithdrawModal(card));
         } else {
             debugLog("[WALLET WARN] Could not find parent card for withdraw button during listener setup.");
         }
     });

     // Setup modal cancel listener
     const modalElements = getWalletElements();
     if (modalElements.cancelButton) {
         modalElements.cancelButton.onclick = () => {
             if(modalElements.modal) modalElements.modal.style.display = 'none';
             debugLog("Withdraw modal cancelled.");
         };
     }
     // Confirm listener is added in showWithdrawModal
}


function showWithdrawModal(cardElement) {
    debugLog("Showing withdraw modal...");
    const elements = getWalletElements(); // Get modal elements
    if (!elements.modal || !elements.amountInput || !elements.availableBalanceEl || !elements.currencySpan || !elements.feeSpan || !elements.feeCurrencySpan || !elements.confirmButton || !elements.cancelButton) {
        debugLog("Withdraw modal elements not found.");
        return;
     }

    const isUsdt = cardElement.classList.contains('usdt-card');
    const currency = isUsdt ? 'USDT' : 'TON';
    // Fetch balance directly from cached user data for accuracy
    const balance = isUsdt ? (window.currentUserData?.usdt || 0) : (window.currentUserData?.ton || 0);
    const fee = isUsdt ? 0.01 : 0.005; // TODO: Fetch fees dynamically if they change

    elements.availableBalanceEl.textContent = balance.toFixed(4);
    elements.currencySpan.textContent = currency;
    elements.feeSpan.textContent = fee.toFixed(isUsdt ? 2 : 3);
    elements.feeCurrencySpan.textContent = currency;
    elements.amountInput.value = '';
    elements.amountInput.max = Math.max(0, balance - fee).toFixed(4);
    elements.amountInput.step = isUsdt ? "0.0001" : "0.001";

    // Re-enable confirm button and set default text
    elements.confirmButton.disabled = false;
    elements.confirmButton.textContent = 'Confirm';

    // Add confirm listener (replace old one if exists)
    const newConfirmButton = elements.confirmButton.cloneNode(true);
    elements.confirmButton.parentNode.replaceChild(newConfirmButton, elements.confirmButton);
    newConfirmButton.onclick = () => confirmWithdraw(currency, balance, fee);

    elements.modal.style.display = 'flex';
    debugLog(`Withdraw modal shown for ${currency}. Balance: ${balance}, Fee: ${fee}`);
}

async function confirmWithdraw(currency, balance, fee) {
    debugLog(`[WITHDRAW ACTION] Confirming withdrawal for ${currency}...`);
    const elements = getWalletElements(); // Get modal elements
    if (!elements.modal || !elements.amountInput || !elements.confirmButton) return;

    const amount = parseFloat(elements.amountInput.value);

    elements.confirmButton.disabled = true; elements.confirmButton.textContent = 'Processing...';

    // --- Input Validation ---
    if (isNaN(amount) || amount <= 0) {
         alert("Invalid amount entered.");
         elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm';
         return;
    }
    const totalDeduction = amount + fee;
     if (totalDeduction > balance) { // Check against accurate balance
        alert("Insufficient balance (including fee).");
        elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm';
        return;
     }
     if (!tonConnectUI || !tonConnectUI.connected || !tonConnectUI.account?.address) {
        alert("Wallet not connected or address unavailable.");
        elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm';
        elements.modal.style.display = 'none';
        return;
     }
     // --- End Validation ---

    const destinationAddress = tonConnectUI.account.address;
    const userDocRef = db.collection('userData').doc(window.telegramUser.id.toString());
    const balanceField = currency.toLowerCase(); // 'usdt' or 'ton'

    try {
        debugLog(`[WITHDRAW SIMULATION] Initiating withdrawal: ${amount} ${currency} to ${destinationAddress} (Fee: ${fee} ${currency}, Total: ${totalDeduction})`);

        // Create Transaction Record (Pending) in subcollection
        const transaction = {
            txId: `sim_tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, // More unique ID
            userId: window.telegramUser.id.toString(),
            amount: amount, currency: currency, fee: fee, totalDeducted: totalDeduction,
            destination: destinationAddress, status: 'pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(), type: 'withdrawal'
        };
        const txRef = userDocRef.collection('transactions').doc(transaction.txId);
        await txRef.set(transaction);
        debugLog(`[WITHDRAW SIMULATION] Pending transaction record created: ${transaction.txId}`);

        // Deduct Balance from User Data atomically
        await userDocRef.update({ [balanceField]: firebase.firestore.FieldValue.increment(-totalDeduction) });
        debugLog(`[WITHDRAW SIMULATION] User balance deducted: -${totalDeduction} ${currency}`);

        // Update UI immediately to show pending state and reduced balance
        await window.fetchAndUpdateUserData(); // Refresh cache
        await updateWalletSectionUI(); // Update wallet UI (shows new balance, pending tx)

        // Simulate Processing Delay & Completion/Failure
        setTimeout(async () => {
             const shouldSucceed = Math.random() > 0.1; // 90% success rate for simulation
             try {
                 const finalStatus = shouldSucceed ? 'completed' : 'failed';
                 const updateData = { status: finalStatus };
                 if (!shouldSucceed) {
                     updateData.failureReason = 'Simulated transaction failure.';
                 }
                 await txRef.update(updateData);
                 debugLog(`[WITHDRAW SIMULATION] Transaction ${transaction.txId} marked as ${finalStatus}.`);
                 await updateTransactionHistory(); // Refresh history UI
             } catch (simError) {
                  console.error("Error updating simulated transaction status:", simError);
                  debugLog(`[WITHDRAW SIMULATION ERROR] Failed updating tx ${transaction.txId} status: ${simError.message}`);
                  // Attempt to mark as failed in Firestore if update failed
                  try { await txRef.update({ status: 'failed', failureReason: `Update error: ${simError.message}` }); } catch (failErr) { console.error("Failed to mark tx as failed:", failErr); }
                  await updateTransactionHistory(); // Refresh history UI even on error
             }
         }, 5000 + Math.random() * 3000); // 5-8 second delay for simulation

        if (window.analytics) window.analytics.logEvent('withdrawal_initiated', { userId: window.telegramUser.id, currency, amount, fee });

        elements.modal.style.display = 'none';
        alert(`Withdrawal of ${amount.toFixed(4)} ${currency} initiated (Fee: ${fee.toFixed(4)} ${currency}). Status will update in history (Simulation).`);

    } catch (error) {
        console.error(`Withdrawal error: ${error.message}`);
        debugLog(`[WITHDRAW ERROR] ${error.message}`);
        alert(`Withdrawal failed: ${error.message}`);
        // Attempt to revert UI changes or show error clearly
        elements.confirmButton.disabled = false; elements.confirmButton.textContent = 'Confirm';
        // Consider re-fetching user data to ensure consistency after failure
        await window.fetchAndUpdateUserData();
        await updateWalletSectionUI();
    }
    // No finally needed as button state handled above
}

