// js/adService.js

const AD_SDK_FUNCTION_NAME = 'show_9180370'; // Make configurable if needed

// Function to show ads (Rewarded Interstitial, Pop, etc.)
function showAd(adType = 'rewarded_interstitial') {
    debugLog(`[AD] Attempting to show ad of type: ${adType} via manual trigger.`);
    return new Promise((resolve, reject) => {

        // Reject manual 'inApp' triggers - these are initialized separately
        if (adType === 'inApp') {
            const errorMsg = "In-App ads are shown automatically, not via manual quest trigger.";
            debugLog(`[AD WARN] ${errorMsg}`);
            return reject(new Error(errorMsg));
        }

        const maxWaitTime = 30000; // 30 seconds timeout

        // Check if SDK function exists
        if (typeof window[AD_SDK_FUNCTION_NAME] !== 'function') {
            const errorMsg = `Monetag SDK function '${AD_SDK_FUNCTION_NAME}' not found.`;
            console.warn(`[AD WARN] ${errorMsg} Simulating ad success after delay.`);
            debugLog(`[AD WARN] ${errorMsg} Simulating success.`);
            setTimeout(() => {
                debugLog("[AD] Simulated ad finished.");
                resolve(); // Simulate success for development/testing
            }, 3000);
            // For production, you might want to reject instead:
            // reject(new Error(errorMsg));
            return;
        }

        let adPromise = null;
        let adTriggered = false;
        let requiresPromiseHandling = false; // Does the SDK call return a promise?

        // Cleanup function
        const cleanup = (timeoutHandle, success, error = null) => {
            clearTimeout(timeoutHandle);
            if (success) {
                resolve();
            } else {
                const defaultError = new Error(`Ad failed, timed out, or was closed early (${adType})`);
                reject(error || defaultError);
            }
        };

        // Timeout Logic
        const timeoutId = setTimeout(() => {
            console.warn(`[AD WARN] Ad timed out after ${maxWaitTime / 1000}s (${adType}). Rejecting.`);
            debugLog(`[AD WARN] Ad timed out: ${adType}`);
            cleanup(timeoutId, false, new Error(`Ad timed out (${adType})`));
        }, maxWaitTime);

        try {
            debugLog(`[AD] Calling Monetag SDK (${AD_SDK_FUNCTION_NAME}) for ad type: ${adType}`);

            // Trigger Ad Based on Type
            if (adType === 'rewarded_popup') {
                adPromise = window[AD_SDK_FUNCTION_NAME]('pop'); // Example for popup
                adTriggered = true;
                requiresPromiseHandling = true; // Assume pop returns a promise
            } else if (adType === 'rewarded_interstitial') {
                adPromise = window[AD_SDK_FUNCTION_NAME](); // Default call might be interstitial
                adTriggered = true;
                requiresPromiseHandling = true; // Assume default returns a promise
            }
            // Add other adType mappings if needed based on Monetag SDK docs
            else {
                console.warn(`[AD WARN] Unsupported or unknown adType: ${adType} for manual trigger. Falling back to standard interstitial.`);
                 adPromise = window[AD_SDK_FUNCTION_NAME](); // Fallback
                 adTriggered = true;
                 requiresPromiseHandling = true;
            }

            // Handle Promise (if applicable)
            if (requiresPromiseHandling && adPromise && typeof adPromise.then === 'function') {
                debugLog(`[AD] SDK returned a Promise for type ${adType}. Waiting for resolution...`);
                adPromise.then(() => {
                    debugLog(`[AD] SDK Promise resolved successfully for type: ${adType}. Ad likely watched/closed.`);
                    cleanup(timeoutId, true); // Resolve the outer promise on success
                }).catch(e => {
                    const errorMsg = e?.message || e || 'Unknown SDK error';
                    console.error(`[AD ERROR] SDK Promise rejected for type ${adType}:`, errorMsg);
                    debugLog(`[AD ERROR] SDK Promise rejected for ${adType}: ${errorMsg}`);
                    cleanup(timeoutId, false, new Error(`Ad failed or was closed early (${adType}): ${errorMsg}`)); // Reject the outer promise on failure
                });
            } else if (adTriggered && requiresPromiseHandling) {
                 // Safety net if adPromise wasn't a promise but was expected to be
                 console.warn(`[AD WARN] SDK call for ${adType} was triggered but did not return a standard promise. Relying on timeout/callbacks if any.`);
                 // If the SDK uses callbacks instead, that logic needs to be integrated here.
                 // For now, we rely on the timeout as the primary completion mechanism if no promise.
            } else if (!adTriggered) {
                // Should not happen if adType mapping is correct
                cleanup(timeoutId, false, new Error(`Could not trigger ad for type ${adType}`));
            }

        } catch (error) {
            // Catch immediate errors from calling the SDK function itself
            console.error("[AD ERROR] Failed to trigger Monetag ad:", error);
            debugLog(`[AD ERROR] Failed to trigger ad ${adType}: ${error.message}`);
            cleanup(timeoutId, false, error); // Reject the outer promise if the call fails immediately
        }
    });
}

// Function to initialize automatic In-App ads
function initializeAutomaticAds() {
    try {
        if (typeof window[AD_SDK_FUNCTION_NAME] === 'function') {
            // Define the settings for automatic display (adjust as needed)
            const autoInAppSettings = {
                frequency: 2,      // Max 2 ads per session defined by capping
                capping: 0.016,    // Session duration = 0.016 hours (~1 minute)
                interval: 30,     // Minimum 30 seconds between ads
                timeout: 5,       // 5-second delay before the *first* ad in a session might show
                everyPage: false   // Show on page load or specific triggers? Check SDK docs.
            };
            debugLog('[AD INIT] Initializing automatic In-App ads with settings:', JSON.stringify(autoInAppSettings));
            // Initialize automatic ads using the SDK function
            window[AD_SDK_FUNCTION_NAME]({ type: 'inApp', inAppSettings: autoInAppSettings });
            debugLog('[AD INIT] Automatic In-App ads initialization called.');
        } else {
            debugLog('[AD INIT WARN] Monetag SDK function not found, cannot initialize automatic ads.');
        }
    } catch (initAdError) {
        console.error('[AD INIT ERROR] Error initializing automatic In-App ads:', initAdError);
        debugLog(`[AD INIT ERROR] Error initializing automatic ads: ${initAdError.message}`);
    }
}

