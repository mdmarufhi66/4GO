// js/utils.js

// Debug Logging Helper
function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[DEBUG] ${timestamp}: ${message}`, data !== null ? data : '');
    const debugConsole = document.getElementById('debugConsole');
    if (debugConsole) {
        const entry = document.createElement('div');
        entry.textContent = `${timestamp}: ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`;
        debugConsole.appendChild(entry);
        // Auto-scroll to bottom
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
}

// Dynamically load a script and return a Promise
function loadScript(src, retries = 3, delay = 1000) {
     debugLog(`Attempting to load script: ${src}`);
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const tryLoad = () => {
             // Check if script already exists to prevent multiple loads
             if (document.querySelector(`script[src="${src}"]`)) {
                 debugLog(`Script already loaded: ${src}`);
                 resolve();
                 return;
             }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                debugLog(`Script loaded successfully: ${src}`);
                resolve();
            };
            script.onerror = () => {
                attempts++;
                 // Clean up the failed script tag from the DOM
                 if (script.parentNode) {
                     script.parentNode.removeChild(script);
                 }
                if (attempts < retries) {
                    console.warn(`Failed to load script: ${src}. Retrying (${attempts}/${retries})...`);
                    // Log to debug console as well
                    debugLog(`Failed to load script: ${src}. Retrying (${attempts}/${retries})...`);
                    setTimeout(tryLoad, delay);
                } else {
                    const errorMsg = `Failed to load script after ${retries} attempts: ${src}`;
                    console.error(errorMsg);
                    debugLog(errorMsg); // Log to debug console
                    reject(new Error(errorMsg));
                }
            };
            document.head.appendChild(script);
        };
        tryLoad();
    });
}

// Helper to format Firestore Timestamps or Date strings safely
function formatTimestamp(timestamp) {
    let formattedTime = 'Invalid date';
    if (timestamp) {
        try {
             let date;
             // Check if it's a Firestore Timestamp object
             if (typeof timestamp.toDate === 'function') {
                 date = timestamp.toDate();
             } else {
                 // Assume it's a string or number parseable by Date constructor
                 date = new Date(timestamp);
             }

            if (!isNaN(date.getTime())) {
                 // Use toLocaleString for a user-friendly format including date and time
                 formattedTime = date.toLocaleString();
            } else {
                console.warn("Could not parse timestamp into a valid Date:", timestamp);
                debugLog(`Could not parse timestamp into a valid Date: ${timestamp}`);
            }
        } catch (error) {
            console.error("Error formatting timestamp:", error);
            debugLog(`Error formatting timestamp: ${error.message}`);
        }
    } else {
         debugLog("Attempted to format null or undefined timestamp.");
    }
    return formattedTime;
}


// Make utility functions available globally (or use ES Modules)
// This is necessary for other scripts to call these functions directly
window.debugLog = debugLog;
window.loadScript = loadScript;
window.formatTimestamp = formatTimestamp;
