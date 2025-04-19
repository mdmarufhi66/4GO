// js/adService.js

// Get the SDK function name from config.js (globally available)
// const AD_SDK_FUNCTION_NAME = 'show_9180370'; // Defined in config.js

// Function to show ads (Rewarded Interstitial, Pop, etc.) via manual trigger
// This function is exposed globally for use by other modules (e.g., earn.js)
function showAd(adType = 'rewarded_interstitial') {
    // Uses debugLog from utils.js (globally available)
    // Uses AD_SDK_FUNCTION_NAME from config.js (globally available)
    // Depends on the Ad SDK being loaded in index.html

    debugLog(`[AD] Attempting to show ad of type: ${adType} via manual trigger.`);
    return new Promise((resolve, reject) => {

        // --- Reject manual 'inApp' triggers ---
        // Automatic 'inApp' ads are initialized separately in initializeAutomaticAds.
        // Manual trigger attempts for this type should be rejected.
        if (adType === 'inApp') {
            const errorMsg = "In-App ads are shown automatically, not via manual quest trigger.";
            debugLog(`[AD WARN] ${errorMsg}`);
            console.warn(`[AD WARN] ${errorMsg}`);
            // Immediately reject the promise
            return reject(new Error(errorMsg));
        }
        // --- End Rejection ---


        // Define a maximum time to wait for the ad to complete or error
        const maxWaitTime = 30000; // 30 seconds timeout

        // Check if the expected SDK function exists in the window scope
        if (typeof window[window.AD_SDK_FUNCTION_NAME] !== 'function') {
            const errorMsg = `Monetag SDK function '${window.AD_SDK_FUNCTION_NAME}' not found.`;
            console.warn(`[AD WARN] ${errorMsg} Simulating ad success after delay for development/testing.`);
            debugLog(`[AD WARN] ${errorMsg} Simulating success.`);
            // Simulate a successful ad display for development/testing if the SDK is missing
            // In a production environment, you might want to reject immediately here.
            setTimeout(() => {
                debugLog("[AD] Simulated ad finished.");
                resolve(); // Simulate success
            }, 3000); // Simulate a 3-second ad duration
            return; // Exit the function
        }

        let adPromise = null; // To potentially hold a Promise returned by the SDK call
        let adTriggered = false; // Flag to know if the SDK function was called
        let requiresPromiseHandling = false; // Does the triggered ad type return a Promise we should wait for?

        // Cleanup function to clear timeout and resolve/reject the main Promise
        const cleanup = (success, error = null) => {
            clearTimeout(timeoutId); // Clear the timeout to prevent it from triggering later
            if (success) {
                resolve(); // Resolve the main Promise if the ad was successful
            } else {
                // Reject the main Promise with an error
                const defaultError = new Error(`Ad failed, timed out, or was closed early (${adType})`);
                reject(error || defaultError);
            }
        };

        // Set a timeout for the ad display process
        const timeoutId = setTimeout(() => {
            console.warn(`[AD WARN] Ad process timed out after ${maxWaitTime / 1000}s (${adType}).`);
            debugLog(`[AD WARN] Ad timed out: ${adType}`);
            cleanup(false, new Error(`Ad timed out or failed to respond (${adType})`)); // Clean up and reject
        }, maxWaitTime);

        try {
            debugLog(`[AD] Calling Monetag SDK (${window.AD_SDK_FUNCTION_NAME}) for ad type: ${adType}`);

            // --- Trigger Ad Based on Type (excluding 'inApp', which is rejected earlier) ---
            // Check your Monetag SDK documentation for the correct way to trigger specific ad types.
            // This is an example based on potential SDK usage patterns.
            if (adType === 'rewarded_popup') {
                // Example: If 'pop' argument triggers a rewarded popup
                adPromise = window[window.AD_SDK_FUNCTION_NAME]('pop');
                adTriggered = true;
                requiresPromiseHandling = true; // Assume this call returns a promise
            } else if (adType === 'rewarded_interstitial') {
                // Example: If calling without arguments triggers a rewarded interstitial
                adPromise = window[window.AD_SDK_FUNCTION_NAME]();
                adTriggered = true;
                requiresPromiseHandling = true; // Assume this call returns a promise
            }
            // Add more adType mappings here if needed based on your quest configuration and SDK docs
            // else if (adType === 'another_type') { ... }
            else {
                // Fallback or warning for unsupported/unknown types for manual trigger
                console.warn(`[AD WARN] Unsupported or unknown adType for manual trigger: ${adType}. Falling back to default call.`);
                debugLog(`[AD WARN] Unsupported manual adType: ${adType}. Falling back.`);
                 adPromise = window[window.AD_SDK_FUNCTION_NAME](); // Fallback to default call
                 adTriggered = true;
                 requiresPromiseHandling = true; // Assume fallback call returns a promise
            }

            // --- Handle Promise returned by the SDK (if applicable) ---
            // If the SDK call returns a Promise, we wait for it to resolve or reject.
            if (requiresPromiseHandling && adPromise && typeof adPromise.then === 'function') {
                debugLog(`[AD] SDK call for type ${adType} returned a Promise. Waiting for resolution...`);
                adPromise.then(() => {
                    // The Promise resolved, indicating the ad process finished (watched, closed normally, etc.)
                    debugLog(`[AD] SDK Promise resolved successfully for type: ${adType}.`);
                    cleanup(true); // Ad process successful
                }).catch(e => {
                    // The Promise rejected, indicating an error or the ad was closed early
                    const errorMsg = e?.message || e || 'Unknown SDK error';
                    console.error(`[AD ERROR] SDK Promise rejected for type ${adType}:`, errorMsg);
                    debugLog(`[AD ERROR] SDK Promise rejected for ${adType}: ${errorMsg}`);
                    // Pass the error along, or a generic "closed early" message
                    cleanup(false, new Error(`Ad failed or was closed early (${adType}): ${errorMsg}`));
                });
            } else if (adTriggered && requiresPromiseHandling) {
                 // This case should theoretically not happen if the SDK returns a standard Promise as expected
                 console.warn(`[AD WARN] SDK call for ${adType} was triggered but did not return a standard promise despite being expected. Relying on timeout.`);
                 debugLog(`[AD WARN] SDK call for ${adType} did not return promise.`);
                 // If the SDK uses callbacks instead of promises, that callback logic needs to be integrated here.
                 // For now, we rely on the timeout as the primary completion mechanism if no promise is handled.
            } else if (!adTriggered) {
                // This case should only happen if none of the adType conditions were met,
                // which implies an incorrect adType was passed.
                cleanup(false, new Error(`Could not trigger ad: Invalid or unhandled ad type "${adType}" for manual trigger.`));
            }

        } catch (error) {
            // Catch immediate errors from calling the window[AD_SDK_FUNCTION_NAME] function itself
            console.error("[AD ERROR] Failed to trigger Monetag ad:", error);
            debugLog(`[AD ERROR] Failed to trigger ad ${adType}: ${error.message}`);
            cleanup(false, error); // Reject the outer promise immediately on trigger failure
        }
        // No finally block needed; cleanup is called in all resolution paths (resolve, reject, timeout, initial catch)
    });
}


// Function to initialize automatic In-App ads or other ad types meant for automatic display
// This function should be called once during app initialization (e.g., from main.js)
// This function is exposed globally for use by main.js
function initializeAutomaticAds() {
    // Uses debugLog from utils.js (globally available)
    // Uses AD_SDK_FUNCTION_NAME from config.js (globally available)
    // Depends on the Ad SDK being loaded in index.html

    debugLog('[AD INIT] Attempting to initialize automatic ads.');
    try {
        // Ensure the SDK function is available before trying to call it
        if (typeof window[window.AD_SDK_FUNCTION_NAME] === 'function') {
            // Define the settings for automatic In-App ad display
            // Adjust these values based on Monetag docs and desired behavior for automatic ads
            const autoInAppSettings = {
                frequency: 2,      // Max 2 ads per session defined by capping
                capping: 0.016,    // Session duration = 0.016 hours (~1 minute) - adjust as needed for your app's session definition
                interval: 30,     // Minimum 30 seconds between ads
                timeout: 5,       // 5-second delay before the *first* ad in a session might show
                everyPage: false   // 'true' could show ads on page load (usually not desired in SPA)
                                   // 'false' means the SDK manages when to show them based on other triggers or session activity
            };
            debugLog('[AD INIT] Initializing automatic In-App ads with settings:', JSON.stringify(autoInAppSettings));
            // Call the SDK function with the type and settings for automatic display
            // Note: The argument structure { type: 'inApp', inAppSettings: ... } is an example
            // and should match the specific requirements of the Monetag SDK for initializing automatic ads.
            window[window.AD_SDK_FUNCTION_NAME]({ type: 'inApp', inAppSettings: autoInAppSettings });
            debugLog('[AD INIT] Automatic In-App ads initialization called.');
        } else {
            debugLog('[AD INIT WARN] Monetag SDK function not found, cannot initialize automatic ads.');
            console.warn('[AD INIT WARN] Monetag SDK function not available. Automatic ads not initialized.');
        }
    } catch (initAdError) {
        console.error('[AD INIT ERROR] Error initializing automatic In-App ads:', initAdError);
        debugLog(`[AD INIT ERROR] Error initializing automatic ads: ${initAdError.message}`);
        // Optionally alert the user or log this error to a remote logging service
    }
}


// Make the ad functions available globally
window.showAd = showAd; // For manual ad triggers (like quest completion)
window.initializeAutomaticAds = initializeAutomaticAds; // For app startup initialization
