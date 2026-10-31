/*
 * mock-claude.js — TEST ONLY.
 * Stands in for claude.ai's window.claude runtime so weekly_food_order.html
 * can run on GitHub Pages or straight from disk, with EXAMPLE data.
 *
 * - Data lives in this browser's localStorage only (each visitor has their own copy).
 * - Add ?reset to the URL to wipe it and reload the example data.
 * - Example admin password: 1234
 */
(function () {
  'use strict';
  var KEY = 'mockdb_v2';

  /* ---------- helpers (same formats the page uses) ---------- */
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function sundayOf(d) { d = new Date(d); d.setDate(d.getDate() - d.getDay()); return iso(d); }
  function toHex(s) { return Array.from(new TextEncoder().encode(s)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function orderId(wk, name) { return 'o_' + wk + '_' + toHex(name.replace(/\s+/g, ' ').trim()); }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function pick(kind, item, sides, note) { return { kind: kind || '', item: item || '', sides: sides || [], note: note || '' }; }
  var NONE = pick();

  /* ---------- example data ---------- */
  function seed() {
    var wk = sundayOf(new Date());
    var db = {};

    db['config/current'] = { weekId: wk };
    db['config/employees'] = { names: ['אפי', 'דנה כהן', 'יוסי לוי', 'מיכל אברהם', 'אורי פרץ', 'נועה ביטון', 'רון מזרחי'] };
    // Admin password "1234" (PBKDF2-SHA256, 150000 iterations — same scheme the page uses)
    db['config/admin'] = { salt: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', iter: 150000, hash: 'de4290ecd9c571b52cc44c498119077ffe2b173e238fbd137908eab15302deba' };

    // Main dishes and salads as in the creator's screenshots (same every day);
    // stews and sides change weekly, so those are made-up examples.
    var mains = ['שניצל', 'פרגיות', 'קבב', 'מעורב הבית', 'חזה עוף', 'נקניקיות מרגז', 'נקניקיות צוריסו', 'חביתה/ירק - כריך', 'חביתה/ירק בצלחת'];
    var salads = ['סלט חזה עוף', 'סלט טונה וביצה', 'סלט ירקות גדול'];
    db['menus/' + wk] = {
      start: wk,
      company: 'מסעדה לדוגמה',
      footer: 'טלפון להזמנות: 03-0000000 (לדוגמה)',
      days: [
        { closed: false, mains: mains, salads: salads, stews: ['חמין', 'אורז עם עוף'], sides: ['אורז', 'צ׳יפס', 'ירקות מוקפצים'] },
        { closed: false, mains: mains, salads: salads, stews: ['גולאש'], sides: ['פירה', 'אורז', 'שעועית ירוקה'] },
        { closed: false, mains: mains, salads: salads, stews: ['מג׳דרה', 'קציצות ברוטב'], sides: ['קוסקוס', 'תפו״א אפויים'] },
        { closed: false, mains: mains, salads: salads, stews: ['עוף בתנור'], sides: ['אורז', 'צ׳יפס', 'סלט כרוב'] },
        { closed: false, mains: mains, salads: salads, stews: ['קובה סלק'], sides: ['אורז', 'פסטה', 'ירקות מאודים'] }
      ]
    };

    function order(name, picks) {
      db['orders/' + orderId(wk, name)] = { weekId: wk, name: name, picks: picks, updatedAt: new Date().toISOString() };
    }
    order('דנה כהן', [
      pick('main', 'שניצל', ['אורז', 'צ׳יפס']),
      pick('salad', 'סלט חזה עוף'),
      pick('stew', 'מג׳דרה', ['קוסקוס']),
      NONE,
      pick('main', 'פרגיות', ['פסטה'], 'בלי בצל')
    ]);
    order('יוסי לוי', [
      pick('stew', 'חמין', ['אורז']),
      pick('main', 'קבב', ['פירה']),
      NONE,
      pick('main', 'מעורב הבית', ['צ׳יפס', 'סלט כרוב']),
      pick('salad', 'סלט טונה וביצה')
    ]);
    order('מיכל אברהם', [
      pick('main', 'חביתה/ירק בצלחת', [], 'חביתה ירק, בלי לחם'),
      pick('main', 'חזה עוף', ['אורז', 'שעועית ירוקה']),
      pick('salad', 'סלט ירקות גדול'),
      pick('main', 'חזה עוף', ['אורז']),
      NONE
    ]);
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
  console.info('[mock-claude] Using EXAMPLE data from localStorage. Add ?reset to the URL to start over. Admin password: 1234');
})();
