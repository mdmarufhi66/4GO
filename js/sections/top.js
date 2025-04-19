// js/sections/top.js

async function updateTopSectionUI() {
     debugLog("Updating Top section UI (Ranking)...");
    const rankingList = document.getElementById('ranking-list');
     if (!rankingList) {
        debugLog("[RANKING UI ERROR] Ranking list element not found.");
        return;
    }
     rankingList.innerHTML = `<li class="loading"><p>Loading rankings...</p></li>`;

     // Needs globals firebaseInitialized, db
     if (!firebaseInitialized || !db) {
        rankingList.innerHTML = `<li class="error"><p>Database connection not ready.</p></li>`;
        return;
     }

     try {
         const rankingsSnapshot = await db.collection('users') // Ensure this collection name is correct
             .orderBy('foxMedals', 'desc')
             .limit(30) // Fetch top 30
             .get();

         const rankings = [];
         rankingsSnapshot.forEach(doc => {
             const data = doc.data();
             // Basic validation of data
             if (data && data.foxMedals !== undefined) {
                 rankings.push({
                     id: doc.id,
                     username: data.username || 'Anonymous',
                     foxMedals: data.foxMedals || 0,
                     photoUrl: data.photoUrl || 'assets/icons/user-avatar.png'
                 });
             } else {
                 console.warn("Skipping invalid ranking entry:", doc.id, data);
             }
         });
         debugLog(`Workspaceed ${rankings.length} valid ranking entries.`);

         if (rankings.length === 0) {
             rankingList.innerHTML = `<li class="no-rankings"><p>The ranking is empty right now.</p></li>`;
         } else {
             rankingList.innerHTML = rankings.map((user, index) => {
                 const rank = index + 1;
                 const avatarUrl = user.photoUrl || 'assets/icons/user-avatar.png';
                 // Simple medal display logic
                 let rankDisplay = `${rank}.`;
                 if (rank === 1) rankDisplay = '🥇';
                 else if (rank === 2) rankDisplay = '🥈';
                 else if (rank === 3) rankDisplay = '🥉';

                 return `
                 <li class="ranking-item" data-user-id="${user.id}">
                     <span class="rank-number" style="margin-right: 10px; font-weight: bold; width: 30px; text-align: center;">${rankDisplay}</span>
                     <img src="${avatarUrl}" alt="${user.username}" onerror="this.src='assets/icons/user-avatar.png'">
                     <span class="rank-username" style="flex-grow: 1; margin-left: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.username}</span>
                     <div class="medal-count">
                         <span>${user.foxMedals.toLocaleString()}</span>
                         <img src="assets/icons/fox-medal.png" alt="Fox Medal">
                     </div>
                 </li>
             `;
             }).join('');
         }
         debugLog("Top section UI updated successfully.");
     } catch (error) {
         console.error("Error updating top section UI:", error);
         debugLog(`Error updating ranking UI: ${error.message}`);
         rankingList.innerHTML = `<li class="error"><p>Failed to load rankings. Please try again.</p></li>`;
     }
 }
