/*
 * firebase-config.js - connects the site to its Firebase project.
 *
 * Paste the config from Firebase console -> Project settings -> Your apps -> Web app.
 * These values are not secret: every Firebase web app ships them to the browser.
 * What protects the data is firestore.rules (published in the Firebase console).
 *
 * While FIREBASE_CONFIG is null, the site cannot reach any data.
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD5uGzdsm4pBFW-plzOHVJFVbHdzK69EkM",
  authDomain: "feedmesimor-b4ac9.firebaseapp.com",
  projectId: "feedmesimor-b4ac9",
  storageBucket: "feedmesimor-b4ac9.firebasestorage.app",
  messagingSenderId: "858288321658",
  appId: "1:858288321658:web:897ee77f31f28f052b37c3"
};

// The admin's sign-in email (the user created in Firebase console -> Authentication).
// Must match the email in firestore.rules.
window.ADMIN_EMAIL = 'minerminer404@gmail.com';
