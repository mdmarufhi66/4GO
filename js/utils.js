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
            // Check if script already exists
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
                 document.head.removeChild(script); // Clean up failed script tag
                if (attempts < retries) {
                    console.warn(`Failed to load script: ${src}. Retrying (${attempts}/${retries})...`);
                    setTimeout(tryLoad, delay);
                } else {
                    const errorMsg = `Failed to load script after ${retries} attempts: ${src}`;
                    console.error(errorMsg);
                    debugLog(errorMsg); // Log to debug console too
                    reject(new Error(errorMsg));
                }
            };
            document.head.appendChild(script);
        };
        tryLoad();
    });
}

// Helper to format Firestore Timestamps safely
function formatTimestamp(timestamp) {
    let txTime = 'Invalid date';
    if (timestamp && typeof timestamp.toDate === 'function') {
       try { txTime = timestamp.toDate().toLocaleString(); } catch (dateErr) { console.warn("Error formatting date:", dateErr); }
    } else if (timestamp) {
        // Try parsing if it's a string or number
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
             txTime = date.toLocaleString();
        }
    }
    return txTime;
}
