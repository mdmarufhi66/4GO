// js/navigation.js

console.log("--- TOP OF navigation.js script ---"); // <-- ADDED DEBUG LOG
alert("Navigation script is running!"); // <-- ADDED ALERT

function setupNavigation() {
    debugLog('[NAV] Setting up navigation...');
    const sections = document.querySelectorAll('.main-content .section'); // Be more specific
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');
    const bottomNav = document.querySelector('nav.bottom-nav');

    if (!bottomNav || sections.length === 0 || navButtons.length === 0) {
        console.error('[NAV ERROR] Required navigation elements not found!');
        debugLog('[NAV ERROR] Required navigation elements not found!');
        alert("UI Error: Navigation could not be set up.");
        return;
    }

     debugLog(`[NAV] Found ${sections.length} sections and ${navButtons.length} nav buttons.`);

     // Ensure nav is visible (redundant with !important styles, but safe)
     bottomNav.style.display = 'flex'; // Use 'flex' as per CSS
     bottomNav.style.visibility = 'visible';
     bottomNav.style.opacity = '1';

    navButtons.forEach((button, index) => {
        const sectionId = button.getAttribute('data-section');
         debugLog(`[NAV] Setting up listener for button ${index}: ${sectionId}`);
         if (!sectionId) {
             console.warn(`[NAV WARN] Button ${index} is missing data-section attribute.`);
             debugLog(`[NAV WARN] Button ${index} is missing data-section attribute.`);
             return; // Skip buttons without data-section
         }

        button.addEventListener('click', () => {
            debugLog(`[NAV] Click detected on button: ${sectionId}`);
            switchSection(sectionId); // Switch section on click
        });

         // Optional: Force visual styles again just in case
         button.style.visibility = 'visible';
         button.style.opacity = '1';
         const img = button.querySelector('img');
         if (img) img.onerror = () => {
            console.error(`[NAV ERROR] Image failed to load for button ${sectionId}: ${img.src}`);
            img.src='assets/icons/placeholder.png'; // Fallback placeholder
         };
    });

    // Set default section
    const defaultSection = 'earn'; // Or read from localStorage/hash
    debugLog(`[NAV] Setting default section to: ${defaultSection}`);
    switchSection(defaultSection, true); // Pass true for initial load

    debugLog('[NAV] Navigation setup complete.');
}

async function switchSection(sectionId, isInitialLoad = false) {
     debugLog(`[NAV] Attempting to switch to section: ${sectionId}`);
    const sections = document.querySelectorAll('.main-content .section');
    const navButtons = document.querySelectorAll('nav.bottom-nav .nav-button');

    let foundSection = false;
    sections.forEach(section => {
        if (section.id === sectionId) {
             if (!section.classList.contains('active')) {
                  section.classList.add('active');
                  debugLog(`[NAV] Activated section element: #${section.id}`);
             } else if (!isInitialLoad) { // Avoid logging if already active on initial load
                  debugLog(`[NAV] Section #${section.id} was already active.`);
             }
             foundSection = true;
        } else {
            if (section.classList.contains('active')) {
                section.classList.remove('active');
                 debugLog(`[NAV] Deactivated section element: #${section.id}`);
             }
        }
    });

    if (!foundSection) {
         console.error(`[NAV ERROR] Target section element with id "${sectionId}" not found in DOM.`);
         debugLog(`[NAV ERROR] Target section element with id "${sectionId}" not found.`);
         // Optionally switch to a default section like 'earn'
         // if (sectionId !== 'earn') {
         //     switchSection('earn');
         // }
         return; // Stop if section doesn't exist
    }

    let foundButton = false;
    navButtons.forEach(btn => {
         const btnSectionId = btn.getAttribute('data-section');
         if (btnSectionId === sectionId) {
             if (!btn.classList.contains('active')) {
                 btn.classList.add('active');
                 debugLog(`[NAV] Activated button: [data-section="${btnSectionId}"]`);
             }
             foundButton = true;
         } else {
             if (btn.classList.contains('active')) {
                 btn.classList.remove('active');
                 debugLog(`[NAV] Deactivated button: [data-section="${btnSectionId}"]`);
             }
         }
     });

     if (!foundButton) {
         console.warn(`[NAV WARN] Target button with data-section "${sectionId}" not found.`);
         debugLog(`[NAV WARN] Target button with data-section "${sectionId}" not found.`);
     }

    // Load data for the activated section (call functions from uiUpdater.js or section files)
     debugLog(`[NAV] Loading data for section: ${sectionId}`);
     try {
         // Use ensureFirebaseReady to handle data loading for relevant sections
         // Use window. to access functions defined in other files loaded globally
         if (sectionId === 'earn') await ensureFirebaseReady(window.updateEarnSectionUI, 'updateEarnSectionUI');
         else if (sectionId === 'invite') await ensureFirebaseReady(window.updateInviteSectionUI, 'updateInviteSectionUI');
         else if (sectionId === 'top') await ensureFirebaseReady(window.updateTopSectionUI, 'updateTopSectionUI');
         else if (sectionId === 'wallet') await ensureFirebaseReady(window.updateWalletSectionUI, 'updateWalletSectionUI');
         else if (sectionId === 'chest') {
             // Chests need user stats (gems, VIP) to update correctly
             await ensureFirebaseReady(window.updateUserStatsUI, 'updateChestUserStats');
             window.updateChestUI(); // Now update chest UI using cached stats
         } else if (sectionId === 'game') {
             // Add game section update logic if needed
             debugLog(`[NAV] No specific data load function defined for game section yet.`);
         }
          else {
            debugLog(`[NAV] No specific data load function mapped for section: ${sectionId}`);
         }

     } catch (error) {
         console.error(`[NAV ERROR] Error loading data for section ${sectionId}:`, error);
         debugLog(`[NAV ERROR] Error loading data for section ${sectionId}: ${error.message}`);
     }
 }
