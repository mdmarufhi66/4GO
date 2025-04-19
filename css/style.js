/* Updated body structure */
body {
    background: linear-gradient(to bottom, #330033, #000000);
    color: white;
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* Main content area */
.main-content {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    padding-bottom: 70px; /* Space for bottom nav */
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    position: sticky;
    top: 0;
    background: linear-gradient(to bottom, #330033, #000000);
    z-index: 1000;
}
header h1 {
    font-size: 24px;
    margin: 0;
}
.back-arrow, .menu-dots {
    font-size: 24px;
    cursor: pointer;
}
.user-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 10px 0;
    padding: 0 10px;
}
.user-stats .logo img {
    width: 50px;
    height: 50px;
}
.user-stats .metric {
    display: flex;
    align-items: center;
    gap: 5px;
}
.user-stats .metric img {
    width: 20px;
    height: 20px;
}
.user-stats .profile-pic img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
}
.section {
    display: none; /* Sections hidden by default */
}
.section.active {
    display: block; /* Active section is visible */
}
.banner-placeholder {
    background: #1a1a3d;
    border-radius: 10px;
    padding: 10px;
    text-align: center;
    margin-bottom: 20px;
}
.banner-placeholder img {
    width: 100%;
    border-radius: 10px;
}
.quest-section h2 {
    font-size: 18px;
    margin: 10px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.quest-section .badge {
    background: #ff00ff;
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
}
.quest-list {
    list-style: none;
    padding: 0;
}
/* Style for error messages in lists */
.quest-list .error p {
    color: #ffcc00; /* Yellow/Orange for errors */
    font-style: italic;
}
.quest-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1a1a3d;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 10px;
}
.quest-item img {
    width: 30px;
    height: 30px;
    border-radius: 50%;
}
.quest-reward {
    display: flex;
    align-items: center;
    gap: 5px;
}
.quest-reward img {
    width: 20px;
    height: 20px;
}
.go-button, .claim-button, .claimed-button {
    border: none;
    color: white;
    padding: 5px 15px;
    border-radius: 15px;
    cursor: pointer;
    font-size: 14px;
}
.go-button {
    background: linear-gradient(to right, #ff00ff, #ff6666);
}
.claim-button {
    background: linear-gradient(to right, #00ff00, #66ff66); /* Default claim button */
}
.claimed-button {
    background: #ccc;
    cursor: default;
}
.quest-item .progress {
    font-size: 12px;
    color: #ccc;
    margin-left: 10px;
}
.claim-button.active {
    background: linear-gradient(to right, #00ff00, #66ff66); /* Active (ready to claim) state */
}
.wallet-section h2 {
    font-size: 18px;
    margin: 10px 0;
}
.balance-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1a1a3d;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 10px;
}
.balance-card img {
    width: 30px;
    height: 30px;
}
.balance-info span {
    display: block;
    font-size: 16px;
}
.balance-info small {
    font-size: 12px;
    color: #ccc;
}
.withdraw-button {
    background: #666; /* Default disabled color */
    border: none;
    color: white;
    padding: 5px 10px;
    border-radius: 15px;
    cursor: pointer;
}
.withdraw-button:not(:disabled) {
    background: #00ff00; /* Enabled color */
}
.warning-button {
    background: #ffcc00;
    border: none;
    color: black;
    padding: 5px 10px;
    border-radius: 50%;
    cursor: pointer;
}
.connect-button {
    background: linear-gradient(to right, #ff00ff, #ff6666);
    border: none;
    color: white;
    padding: 10px;
    border-radius: 15px;
    width: 100%;
    cursor: pointer;
    margin-top: 10px;
    transition: background 0.3s ease;
}
.connect-button.connected {
    background: linear-gradient(to right, #00ff00, #66ff66);
}
.connect-button:disabled {
    background: #666;
    cursor: not-allowed;
}
.wallet-status {
    text-align: center;
    margin: 10px 0;
}
.wallet-status.connected {
    color: #00ff00;
}
.wallet-status.disconnected {
    color: #ffcc00;
}
.transaction-history {
    margin-top: 20px;
}
.transaction-history ul {
    list-style: none;
    padding: 0;
}
.transaction-history li {
    background: #1a1a3d;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 10px;
}
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
}
.modal-content {
    background: #1a1a3d;
    padding: 20px;
    border-radius: 10px;
    color: white;
    width: 80%;
    max-width: 400px;
}
.modal-content input {
    width: calc(100% - 12px); /* Adjust for padding */
    padding: 5px;
    margin: 10px 0;
    box-sizing: border-box; /* Include padding in width */
}
.game-section h2 {
    font-size: 18px;
    margin: 10px 0;
}
.game-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); /* Responsive grid */
    gap: 10px;
}
.game-item {
    background: #1a1a3d;
    border-radius: 10px;
    text-align: center;
    padding: 5px;
}
.game-item img {
    width: 100%;
    max-width: 80px; /* Limit image size */
    height: auto;   /* Maintain aspect ratio */
    border-radius: 10px;
}
.game-item p {
    margin: 5px 0;
    font-size: 12px;
}
.invite-section .invite-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.invite-stats .spin-info {
    display: flex;
    align-items: center;
    gap: 5px;
}
.action-buttons {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}
.action-button {
    background: linear-gradient(to right, #00ff00, #66ff66);
    border: none;
    color: white;
    padding: 10px;
    border-radius: 15px;
    flex: 1;
    cursor: pointer;
}
.total-credit {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1a1a3d;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 20px;
}
.total-credit .credit-info { /* Wrapper for text */
    display: flex;
    flex-direction: column; /* Stack text */
}
.total-credit small {
    font-size: 12px;
    color: #ccc;
    display: flex; /* Align image and text */
    align-items: center;
    gap: 3px;
}
.total-credit small img {
    width: 15px;
    height: 15px;
    vertical-align: middle; /* Better alignment */
}
.record-section h3, .invite-record h3 {
    font-size: 16px;
    margin: 10px 0;
}
.no-frens {
    text-align: center;
    color: #ccc;
    padding: 20px 0; /* Add some padding */
}
.no-frens img {
    width: 50px;
    height: 50px;
    margin-bottom: 10px; /* Space below image */
}
.record-header {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    color: #ccc;
    margin-bottom: 10px;
    padding: 0 10px; /* Align with items */
}
.record-list { /* Container for items or no-frens message */
    /* Optional: Add styling if needed */
}
.record-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1a1a3d;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 10px;
}
.record-item img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
}
.record-item .user-info {
    flex: 1;
    margin-left: 10px;
}
.record-item .user-info span {
    display: block; /* Ensure username is on its own line */
}
.record-item .user-info small {
    color: #ccc;
    font-size: 12px;
}
.record-item .credit {
    background: #ff00ff;
    color: white;
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 12px; /* Slightly smaller */
}
.chest-section .chest-slider {
    position: relative;
    overflow: hidden;
    margin-bottom: 20px;
}
.chest-container {
    display: flex;
    transition: transform 0.3s ease;
}
.chest-item {
    flex: 0 0 100%;
    text-align: center;
    padding: 10px; /* Add padding */
    box-sizing: border-box;
}
.chest-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 16px;
    margin-bottom: 10px; /* Space below title */
}
.chest-title span {
    color: #ccc;
    font-size: 14px; /* Smaller text */
}
.chest-image img {
    width: 150px;
    height: 150px;
    margin-bottom: 10px; /* Space below image */
}
.not-enough {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    color: #ffcc00;
    margin-top: 10px;
}
.not-enough img {
    width: 20px;
    height: 20px;
}
.nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    padding: 10px;
    cursor: pointer;
    z-index: 100;
    border-radius: 50%; /* Make arrows round */
}
.nav-arrow.left {
    left: 5px; /* Adjust position */
}
.nav-arrow.right {
    right: 5px; /* Adjust position */
}
.rewards {
    display: flex;
    justify-content: space-around;
    margin-bottom: 20px;
}
.reward-item {
    text-align: center;
}
.reward-item img {
    width: 40px;
    height: 40px;
}
.reward-item p {
    margin: 5px 0;
    font-size: 12px;
}
.cost {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    margin-bottom: 10px;
    font-size: 16px; /* Make cost text larger */
}
.cost img {
    width: 20px;
    height: 20px;
}
.vip-requirement {
    text-align: center;
    color: #ffcc00;
    margin-bottom: 10px;
}
.open-chest-button {
    background: linear-gradient(to right, #ff00ff, #ff6666);
    border: none;
    color: white;
    padding: 10px;
    border-radius: 15px;
    width: 100%;
    cursor: pointer;
    font-size: 16px; /* Make button text larger */
}
.top-section h2 {
    font-size: 18px;
    margin: 10px 0;
}
.ranking-list {
    list-style: none;
    padding: 0;
}
.no-rankings {
    text-align: center;
    color: #ccc;
    padding: 20px 0;
}
.ranking-item {
    display: flex;
    align-items: center;
    background: #1a1a3d;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 10px;
}
.ranking-item img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 10px;
}
.ranking-item span {
    flex: 1;
}
.ranking-item .medal-count {
    display: flex;
    align-items: center;
    gap: 5px;
}
.ranking-item .medal-count img {
    width: 20px;
    height: 20px;
}

/* --- Navigation Styles --- */
nav.bottom-nav {
    display: flex !important;
    justify-content: space-around !important;
    background: #1a1a3d !important;
    padding: 5px 0 !important; /* Adjusted padding */
    position: fixed !important;
    bottom: 0 !important; /* Use 0, handle safe area via padding/margin if needed */
    padding-bottom: env(safe-area-inset-bottom, 5px) !important; /* Add padding for safe area */
    left: 0 !important;
    right: 0 !important;
    z-index: 100000 !important;
    height: 60px !important; /* Maintain height */
    visibility: visible !important;
    opacity: 1 !important;
    border-top: 1px solid #ff00ff !important; /* Adjusted border */
    box-shadow: 0 -2px 10px rgba(100, 0, 100, 0.4) !important; /* Adjusted shadow */
}

nav.bottom-nav .nav-button {
    background: none !important;
    border: none !important;
    color: #ccc !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    font-size: 10px !important; /* Slightly smaller text */
    width: auto !important; /* Allow flexible width */
    flex: 1 !important; /* Distribute space equally */
    height: 100% !important;
    visibility: visible !important;
    opacity: 1 !important;
    min-height: 40px !important;
    padding: 0 2px; /* Add minimal horizontal padding */
}

nav.bottom-nav .nav-button.active {
    color: white !important;
}

nav.bottom-nav .nav-button img {
    width: 24px !important;
    height: 24px !important;
    margin-bottom: 3px !important; /* Adjusted spacing */
    display: block !important;
}

nav.bottom-nav .nav-button span {
    display: block !important;
    white-space: nowrap; /* Prevent text wrapping */
}

/* Additional styles for wallet integration */
.error-message {
    color: #ffcc00;
    text-align: center;
    margin: 10px 0;
    display: none;
}

.tx-status.pending { color: #ffcc00; }
.tx-status.completed { color: #00ff00; }
.tx-status.failed { color: #ff0000; }
.tx-status.unknown { color: #ccc; } /* Added for safety */

/* Debug Console Style */
#debugConsole {
    position: fixed;
    bottom: 70px; /* Above nav bar */
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.85); /* Slightly more opaque */
    color: #0f0; /* Green text */
    padding: 10px;
    font-family: monospace;
    font-size: 10px; /* Smaller font */
    max-height: 150px; /* Adjust height */
    overflow-y: auto;
    z-index: 99999; /* Below nav bar but high */
    display: none; /* Hidden by default */
    border-top: 1px solid #0f0;
}
#toggleDebugButton { /* Style the toggle button */
    position: fixed;
    bottom: 80px; /* Position relative to debug console */
    right: 10px;
    z-index: 100000; /* Above debug console */
    padding: 3px 8px;
    background: #ff00ff;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 10px;
    cursor: pointer;
}
