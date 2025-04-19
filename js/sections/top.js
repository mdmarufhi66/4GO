// js/sections/top.js

// --- Top Section (Ranking) UI Update ---
// Fetches user ranking data from Firestore and updates the ranking list UI.
// This function is exposed globally for use by navigation.js.
async function updateTopSectionUI() {
    // Uses debugLog from utils.js (globally available)
    // Uses firebaseInitialized, db from firebaseService.js (implicitly global)
    // Depends on elements existing in index.html within the top section

     debugLog("[RANKING] Starting Top section UI update (Ranking)...");

    // Get the container element for the ranking list
    const rankingList = document.getElementById('ranking-list');
    // Ensure the ranking list element exists before proceeding
    if (!rankingList) {
         console.error("[RANKING ERROR] Ranking list element (#ranking-list) not found! Cannot update ranking UI.");
         debugLog("[RANKING ERROR] Ranking list element missing from DOM.");
         return; // Stop the function if the element is missing
    }

    // Set initial loading state in the UI
    rankingList.innerHTML = `<li class="loading"><p>Loading rankings...</p></li>`; // Show loading message


    try {
        // Ensure Firestore is initialized and accessible
        if (!window.firebaseInitialized || !window.db) {
            throw new Error("Firestore not initialized. Cannot fetch ranking data.");
        }
         debugLog("[RANKING] Firestore is ready for ranking fetch.");

        // Query the 'users' collection to get users, ordered by 'foxMedals' descending.
        // Limit the number of results (e.g., top 30).
        const rankingsSnapshot = await window.db.collection('users')
            .orderBy('foxMedals', 'desc') // Order by foxMedals in descending order
            .limit(30) // Limit to the top 30 users
            .get(); // Execute the query

        // Create an array to store the ranking data
        const rankings = [];
        // Iterate over the documents in the snapshot
        rankingsSnapshot.forEach(doc => {
            const data = doc.data(); // Get the data from each document
            // Push the relevant data into the rankings array
            rankings.push({
                id: doc.id, // Document ID (user ID)
                username: data.username || 'Anonymous', // Default username if missing
                foxMedals: data.foxMedals || 0, // Default medals to 0 if missing
                photoUrl: data.photoUrl || 'assets/icons/user-avatar.png' // Default photo if missing
            });
        });
         debugLog(`[RANKING] Fetched ${rankings.length} ranking entries from Firestore.`);

        // Check if any ranking entries were found
        if (rankings.length === 0) {
            debugLog("[RANKING] No ranking entries found. Displaying placeholder.");
            rankingList.innerHTML = `<li class="no-rankings"><p>The ranking is empty right now.</p></li>`; // Show empty state message
        } else {
             debugLog("[RANKING] Rendering ranking list HTML.");
            // Generate the HTML for each ranking item using the data
            // Map over the rankings array to create an array of HTML strings
            rankingList.innerHTML = rankings.map((user, index) => {
                // Return the HTML string for a single ranking list item
                return `
                    <li class="ranking-item">
                        <span class="rank-number" style="margin-right: 10px; font-weight: bold; width: 25px; text-align: right;">${index + 1}.</span> <img src="${user.photoUrl}" alt="${user.username}" onerror="this.src='assets/icons/user-avatar.png'"> <span class="rank-username" style="flex-grow: 1; margin-left: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.username}</span> <div class="medal-count">
                            <span>${(user.foxMedals || 0).toLocaleString()}</span> <img src="assets/icons/fox-medal.png" alt="Fox Medal"> </div>
                    </li>
                `;
            }).join(''); // Join all the HTML strings into a single string
             debugLog("[RANKING] Ranking list HTML rendered successfully.");
        }

         debugLog("[RANKING] Top section UI update complete.");

    } catch (error) {
        // Handle any errors that occurred during the fetch or rendering process
        console.error("[RANKING ERROR] Failed to update top section UI:", error);
        debugLog(`[RANKING ERROR] Failed to update ranking UI: ${error.message}`);
        // Display a user-friendly error message in the UI list
        rankingList.innerHTML = `<li class="error"><p>Failed to load rankings. Please try again later.</p></li>`; // Show error message
    }
}


// Make the ranking UI update function available globally
// This function is needed by navigation.js when switching to the Top section
window.updateTopSectionUI = updateTopSectionUI;
