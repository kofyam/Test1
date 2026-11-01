/*
 * firebase-adapter.js - gives the page the same window.claude.use(...) services it had
 * on claude.ai, backed by Firebase instead:
 *   db        -> Cloud Firestore (its compat API already has doc/collection/where/limit/onSnapshot)
 *   user      -> canEdit() is true while the admin is signed in
 *   downloads -> saves files with a normal browser download
 *   admin     -> admin sign-in with Firebase Authentication (email from firebase-config.js)
 * Does nothing while firebase-config.js is empty, so mock-claude.js takes over.
 */
(function () {
  'use strict';
  if (!window.FIREBASE_CONFIG || !window.firebase) return;

  firebase.initializeApp(window.FIREBASE_CONFIG);
  var fs = firebase.firestore();
  var auth = firebase.auth();
  var email = String(window.ADMIN_EMAIL || '').trim();

  function isAdmin(u) { return !!u && !!email && String(u.email || '').toLowerCase() === email.toLowerCase(); }

  // Resolves once Firebase has restored any saved sign-in, so canEdit() is right on first load.
  var ready = new Promise(function (res) { var off = auth.onAuthStateChanged(function () { off(); res(); }); });

  var user = {
    canEdit: function () { return ready.then(function () { return isAdmin(auth.currentUser); }); },
    can: function () { return Promise.resolve(true); }
  };

  var admin = {
    signIn: function (pw) {
      if (!email) return Promise.reject(new Error('ADMIN_EMAIL is not set in firebase-config.js'));
      return auth.signInWithEmailAndPassword(email, pw);
    },
    signOut: function () { return auth.signOut(); },
    resetPassword: function () { return auth.sendPasswordResetEmail(email); },
    changePassword: function (pw) {
      if (!auth.currentUser) return Promise.reject(new Error('not signed in'));
      return auth.currentUser.updatePassword(pw);
    },
    // Calls cb(true/false) now and whenever the admin signs in or out.
    onChange: function (cb) { return auth.onAuthStateChanged(function (u) { cb(isAdmin(u)); }); }
  };

  var downloads = {
    save: function (o) {
      var url = URL.createObjectURL(o.data instanceof Blob ? o.data : new Blob([o.data]));
      var a = document.createElement('a'); a.href = url; a.download = o.filename || 'download';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      return Promise.resolve({ status: 'saved' });
    }
  };

  var services = { db: fs, user: user, downloads: downloads, admin: admin };
  window.claude = { use: function (name) { return Promise.resolve(services[name] || null); } };
})();
