firebase.initializeApp(CONFIG.firebase);
const auth = firebase.auth(), db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
const $ = id => document.getElementById(id);
const TS = () => firebase.firestore.FieldValue.serverTimestamp();

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
    return 'Naam 3 se 30 akshar ka ho (akshar, number, space, _ . - chalega).';
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
