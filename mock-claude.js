/*
 * mock-claude.js — TEST ONLY.
 * Stands in for claude.ai's window.claude runtime so index.html
 * can run on GitHub Pages or straight from disk, with the data from the owner's export.
 *
 * - Only runs while firebase-config.js is empty; once Firebase is set up, the real database is used.
 * - Data lives in this browser's localStorage only (each visitor has their own copy).
 * - Add ?reset to the URL to wipe local changes and reload the exported data.
 * - Test admin password: 1234 (the real one was not included in the export)
 */
(function () {
  'use strict';
  if (window.claude) return; // Firebase is configured (firebase-adapter.js): use the real database instead
  var KEY = 'mockdb_v3';

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  /* ---------- data: seed-data.js (the owner's export), plus a TEST admin password ---------- */
  function seed() {
    var db = clone(window.SEED_DATA || {});
    // The export left out the admin password on purpose. Test password "1234"
    // (PBKDF2-SHA256, 150000 iterations - same scheme the page uses). TEST ONLY.
    db["config/admin"] = { salt: "a1b2c3d4e5f60718293a4b5c6d7e8f90", iter: 150000, hash: "de4290ecd9c571b52cc44c498119077ffe2b173e238fbd137908eab15302deba" };
    return db;
  }

  /* ---------- storage ---------- */
  var data;
  try {
    if (/[?&]reset\b/.test(location.search)) localStorage.removeItem(KEY);
    data = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (e) { data = null; }
  if (!data) { data = seed(); persist(); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  /* ---------- tiny Firestore-like API ---------- */
  var listeners = [];
  function notify() { listeners.slice().forEach(function (l) { try { l(); } catch (e) { console.error(e); } }); }
  function docSnap(path) {
    var v = data[path];
    return { id: path.split('/').pop(), exists: v !== undefined, data: function () { return clone(v); } };
  }
  function later(fn) { setTimeout(fn, 0); }

  function doc(path) {
    return {
      get: function () { return Promise.resolve(docSnap(path)); },
      set: function (v) { data[path] = clone(v); persist(); later(notify); return Promise.resolve(); },
      delete: function () { delete data[path]; persist(); later(notify); return Promise.resolve(); },
      onSnapshot: function (cb) {
        var l = function () { cb(docSnap(path)); };
        listeners.push(l); later(l);
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      }
    };
  }

  function collection(name, filters, max) {
    filters = filters || []; max = max || Infinity;
    function run() {
      var prefix = name + '/';
      var docs = Object.keys(data)
        .filter(function (p) { return p.indexOf(prefix) === 0 && p.slice(prefix.length).indexOf('/') < 0; })
        .filter(function (p) { return filters.every(function (f) { return data[p] && data[p][f[0]] === f[1]; }); })
        .slice(0, max)
        .map(docSnap);
      return { docs: docs, size: docs.length, empty: !docs.length };
    }
    return {
      where: function (field, op, value) {
        if (op !== '==') throw new Error('mock db only supports ==');
        return collection(name, filters.concat([[field, value]]), max);
      },
      limit: function (n) { return collection(name, filters, n); },
      get: function () { return Promise.resolve(run()); },
      onSnapshot: function (cb) {
        var l = function () { cb(run()); };
        listeners.push(l); later(l);
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      }
    };
  }

  var db = { doc: doc, collection: collection };
  var user = { canEdit: function () { return Promise.resolve(true); }, can: function () { return Promise.resolve(true); } };
  var downloads = {
    save: function (o) {
      var url = URL.createObjectURL(o.data instanceof Blob ? o.data : new Blob([o.data]));
      var a = document.createElement('a'); a.href = url; a.download = o.filename || 'download';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      return Promise.resolve({ status: 'saved' });
    }
  };

  window.claude = {
    use: function (name) {
      return Promise.resolve({ db: db, user: user, downloads: downloads }[name] || null);
    }
  };
  console.info('[mock-claude] Using data from the owner export (kept in localStorage). Add ?reset to the URL to start over. Test admin password: 1234');
})();
