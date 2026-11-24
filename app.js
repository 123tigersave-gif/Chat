firebase.initializeApp(CONFIG.firebase);
const auth = firebase.auth(), db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
const $ = id => document.getElementById(id);
const TS = () => firebase.firestore.FieldValue.serverTimestamp();

// Ye shabd naam mein nahi chalenge. Apna channel naam bhi yahan jod do.
const BAD = ['admin', 'support', 'official', 'moderator', 'system', 'youtube', 'owner'];

let me = null, myName = '', cur = null, unsubM = null, unsubL = null;
let tab = 'users', replyTo = '', lastSend = 0;
let store = new Map(), hasMore = false, loadingOld = false, stick = true, token = 0;

const safePhoto = u => typeof u === 'string' && /^https:\/\//.test(u) && u.length < 500;
const chatId = (a, b) => [a, b].sort().join('_');
const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const tms = d => { const t = d.data({ serverTimestamps: 'estimate' }).t; return t ? t.toMillis() : Date.now(); };

function show(s) {
  $('login').style.display = s === 'login' ? 'grid' : 'none';
  $('nameScreen').style.display = s === 'name' ? 'grid' : 'none';
  document.body.classList.toggle('in', s === 'app');
}

$('loginBtn').onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => alert(e.message));
$('logout').onclick = () => auth.signOut();
$('nameOut').onclick = () => auth.signOut();

auth.onAuthStateChanged(async user => {
  me = user;
  if (unsubM) { unsubM(); unsubM = null; }
  if (unsubL) { unsubL(); unsubL = null; }
  cur = null; token++;
  document.body.classList.remove('open');
  if (!user) { show('login'); return; }
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    const d = snap.exists ? snap.data() : null;
    if (d && d.chosen) {
      myName = d.name;
      enterApp();
      db.collection('users').doc(user.uid).update({ lastSeen: TS() }).catch(() => {});
    } else {
      $('nameInput').value = ''; $('nameErr').textContent = '';
      show('name');
    }
  } catch (e) { alert('Load nahi hua: ' + e.message); }
});

function enterApp() {
  show('app');
  $('me').textContent = myName;
  loadList();
}

function checkName(n) {
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.\-]{2,29}$/u.test(n))
    return 'Naam 3 se 30 akshar ka ho (akshar, number, space, _ . - chalega) aur akshar ya number se shuru ho.';
  const k = n.toLowerCase();
  if (BAD.some(w => k.includes(w))) return 'Ye naam allowed nahi hai.';
  return '';
}

async function saveName() {
  const name = $('nameInput').value.trim().replace(/\s+/g, ' ');
  const err = checkName(name);
  if (err) { $('nameErr').textContent = err; return; }
  const key = name.toLowerCase();
  $('nameBtn').disabled = true; $('nameErr').textContent = '';
  try {
    const ref = db.collection('usernames').doc(key);
    await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      if (s.exists) { if (s.data().uid !== me.uid) throw new Error('TAKEN'); }
      else tx.set(ref, { uid: me.uid });
    });
    await db.collection('users').doc(me.uid).set({
      uid: me.uid, name, nameLower: key,
      photo: safePhoto(me.photoURL) ? me.photoURL : '',
      chosen: true, lastSeen: TS()
    }, { merge: true });
    myName = name; enterApp();
  } catch (e) {
    $('nameErr').textContent = e.message === 'TAKEN' ? 'Ye naam pehle se kisi ne le liya hai. Doosra chuno.' : 'Nahi hua: ' + e.message;
  }
  $('nameBtn').disabled = false;
}
$('nameBtn').onclick = saveName;
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });

function setTab(t) {
  tab = t;
  $('tU').classList.toggle('on', t === 'users');
  $('tR').classList.toggle('on', t === 'rooms');
  $('q').value = ''; loadList();
}
$('tU').onclick = () => setTab('users');
$('tR').onclick = () => setTab('rooms');
$('q').oninput = () => loadList();

function loadList() {
  if (unsubL) unsubL();
  const q = $('q').value.trim(), box = $('list');
  if (tab === 'users') {
    const ql = q.toLowerCase();
    let r = db.collection('users').orderBy('nameLower');
    if (ql) r = r.startAt(ql).endAt(ql + '\uf8ff');
    unsubL = r.limit(30).onSnapshot(snap => {
      box.innerHTML = '';
      snap.forEach(d => {
        const u = d.data(); if (!u || u.uid === me.uid) return;
        const row = mk('div', 'row');
        let av;
        if (safePhoto(u.photo)) { av = mk('img', 'av'); av.src = u.photo; av.referrerPolicy = 'no-referrer'; }
        else av = mk('div', 'av', String(u.name || '?')[0]);
        row.append(av, mk('div', '', String(u.name || '')));
        row.onclick = () => openUser(u); box.append(row);
      });
      if (!box.children.length) box.append(mk('div', 'empty', q ? 'Koi nahi mila' : 'Abhi koi aur user nahi hai.'));
    }, e => console.error(e));
  } else {
    unsubL = db.collection('rooms').orderBy('created', 'desc').limit(30).onSnapshot(snap => {
      box.innerHTML = '';
      snap.forEach(d => {
        const r = d.data();
        if (q && !String(r.name).toLowerCase().includes(q.toLowerCase())) return;
        const row = mk('div', 'row');
        row.append(mk('div', 'av', r.type === 'channel' ? '📢' : '👥'));
        const t = mk('div', '', String(r.name || '')); t.append(mk('small', '', r.type === 'channel' ? 'Channel' : 'Group'));
        row.append(t); row.onclick = () => openRoom(r, d.id); box.append(row);
      });
      if (!box.children.length) box.append(mk('div', 'empty', 'Koi group ya channel nahi. Upar "+ Naya" dabao.'));
    }, e => console.error(e));
  }
}

$('newRoom').onclick = async () => {
  const name = (prompt('Naam likho (max 60 akshar)') || '').trim().slice(0, 60);
  if (!name) return;
  const type = confirm('OK = Channel (sirf aap post karoge)\nCancel = Group (sab bol sakte hain)') ? 'channel' : 'group';
  try {
    await db.collection('rooms').add({ type, name, owner: me.uid, created: TS() });
    setTab('rooms');
  } catch (e) { alert('Nahi bana: ' + e.message); }
};

function openUser(u) {
  start({ col: db.collection('chats').doc(chatId(me.uid, u.uid)).collection('messages'),
    canPost: true, isOwner: false, isStaff: false, roomRef: null, title: String(u.name || '') });
}
function openRoom(r, id) {
  const isOwner = r.owner === me.uid;
  const isStaff = isOwner || (Array.isArray(r.admins) && r.admins.includes(me.uid));
  const ref = db.collection('rooms').doc(id);
  start({ col: ref.collection('messages'), canPost: r.type === 'group' || isStaff,
    isOwner, isStaff, roomRef: ref, title: (r.type === 'channel' ? '📢 ' : '👥 ') + r.name });
}

function start(c) {
  cur = c; clearReply(); token++;
  const my = token, lim = CONFIG.pageSize;
  store = new Map(); hasMore = true; loadingOld = false; stick = true;
  let first = true;
  document.body.classList.add('open');
  $('title').textContent = c.title;
  $('bar').style.display = c.canPost ? 'flex' : 'none';
  $('note').style.display = c.canPost ? 'none' : 'block';
  $('msgs').innerHTML = '';
  if (unsubM) unsubM();
  unsubM = c.col.orderBy('t').limitToLast(lim).onSnapshot(snap => {
    if (my !== token) return;
    let oldest = Infinity;
    snap.docs.forEach
