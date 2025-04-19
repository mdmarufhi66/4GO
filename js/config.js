// js/config.js

// Firebase Configuration
export const firebaseConfig = { // Added export
    apiKey: "AIzaSyCUkEmFmJK2vr8k7M6JqYaxlcgBDf7WdJI", // Consider securing this (e.g., environment variables if possible)
    authDomain: "fourgo-cd98f.firebaseapp.com",
    projectId: "fourgo-cd98f",
    storageBucket: "fourgo-cd98f.firebasestorage.app",
    messagingSenderId: "511215742272",
    appId: "1:511215742272:web:04bd85a284919ae123dea5",
    measurementId: "G-DC7E6ECF2L"
};

// Chest Data
export const CHESTS_DATA = [ // Added export
     { name: "Wood Chest", next: "Bronze", image: "assets/graphics/wood-chest.png", gemCost: 200, vip: 0 },
     { name: "Bronze Chest", next: "Silver", image: "assets/graphics/bronze-chest.png", gemCost: 500, vip: 1 },
     { name: "Silver Chest", next: "Gold", image: "assets/graphics/silver-chest.png", gemCost: 1000, vip: 2 },
     { name: "Gold Chest", next: "Master", image: "assets/graphics/gold-chest.png", gemCost: 2000, vip: 3 },
     { name: "Master Chest", next: "Legendary", image: "assets/graphics/master-chest.png", gemCost: 5000, vip: 4 },
     { name: "Legendary Chest", next: "Mythic", image: "assets/graphics/legendary-chest.png", gemCost: 10000, vip: 5 },
     { name: "Mythic Chest", next: "", image: "assets/graphics/mythic-chest.png", gemCost: 20000, vip: 6 }
];

// Other constants if needed
export const REFERRAL_BOT_USERNAME = 'fourgobot'; // Added export
export const REFERRAL_CREDIT_AMOUNT = 10; // Added export
export const CREDIT_CONVERSION_RATE = 10000; // Added export
export const MINIMUM_CREDIT_CLAIM = 10000; // Added export
export const AD_QUEST_COOLDOWN_MS = 3600 * 1000; // Added export
