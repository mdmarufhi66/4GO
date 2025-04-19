// js/config.js

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCUkEmFmJK2vr8k7M6JqYaxlcgBDf7WdJI", // WARNING: Exposing API key directly in client-side code is insecure for production. Consider using environment variables or server-side proxies.
    authDomain: "fourgo-cd98f.firebaseapp.com",
    projectId: "fourgo-cd98f",
    storageBucket: "fourgo-cd98f.firebasestorage.app",
    messagingSenderId: "511215742272",
    appId: "1:511215742272:web:04bd85a284919ae123dea5",
    measurementId: "G-DC7E6ECF2L"
};

// Chest Data (Consider fetching from Firestore later if dynamic)
const CHESTS_DATA = [
     { name: "Wood Chest", next: "Bronze", image: "assets/graphics/wood-chest.png", gemCost: 200, vip: 0 },
     { name: "Bronze Chest", next: "Silver", image: "assets/graphics/bronze-chest.png", gemCost: 500, vip: 1 },
     { name: "Silver Chest", next: "Gold", image: "assets/graphics/silver-chest.png", gemCost: 1000, vip: 2 },
     { name: "Gold Chest", next: "Master", image: "assets/graphics/gold-chest.png", gemCost: 2000, vip: 3 },
     { name: "Master Chest", next: "Legendary", image: "assets/graphics/5000.png", gemCost: 5000, vip: 4 }, // Corrected image path example
     { name: "Legendary Chest", next: "Mythic", image: "assets/graphics/10000.png", gemCost: 10000, vip: 5 }, // Corrected image path example
     { name: "Mythic Chest", next: "", image: "assets/graphics/20000.png", gemCost: 20000, vip: 6 } // Corrected image path example
];

// Referral System Constants
const REFERRAL_BOT_USERNAME = 'fourgobot'; // !!! REPLACE with your actual bot username !!!
const REFERRAL_CREDIT_AMOUNT = 10; // Credits awarded per referral
const CREDIT_CONVERSION_RATE = 10000; // 10,000 credits = 1 USDT
const MINIMUM_CREDIT_CLAIM = 10000; // Minimum credits required to claim USDT

// Ad Quest Constants
const AD_QUEST_COOLDOWN_MS = 3600 * 1000; // 1 hour cooldown for repeatable ad quests

// TON Connect Manifest URL
const TONCONNECT_MANIFEST_URL = 'https://fourgo.app/tonconnect-manifest.json'; // Ensure this URL is correct and the file is hosted here

// Monetag SDK Function Name (from your SDK script tag)
const AD_SDK_FUNCTION_NAME = 'show_9180370';


// Making constants available globally (or use ES Modules if preferred)
window.firebaseConfig = firebaseConfig;
window.CHESTS_DATA = CHESTS_DATA;
window.REFERRAL_BOT_USERNAME = REFERRAL_BOT_USERNAME;
window.REFERRAL_CREDIT_AMOUNT = REFERRAL_CREDIT_AMOUNT;
window.CREDIT_CONVERSION_RATE = CREDIT_CONVERSION_RATE;
window.MINIMUM_CREDIT_CLAIM = MINIMUM_CREDIT_CLAIM;
window.AD_QUEST_COOLDOWN_MS = AD_QUEST_COOLDOWN_MS;
window.TONCONNECT_MANIFEST_URL = TONCONNECT_MANIFEST_URL;
window.AD_SDK_FUNCTION_NAME = AD_SDK_FUNCTION_NAME;

