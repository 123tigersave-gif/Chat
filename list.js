function setTab(t) {
  tab = t;
  $('tU').classList.toggle('on', t === 'users');
  $('tR').classList.toggle('on', t === 'rooms');
  $('q').value = ''; loadList();
}
$('tU').onclick = function () { setTab('users'); };
$('tR').onclick = function () { setTab('rooms'); };
$('q').oninput = function () { loadList(); };

function loadList() {
  if (unsubL) unsubL();
  const q = $('q').value.trim(), box = $('list');
  if (tab === 'users') {
    const ql = q.toLowerCase();
    let r = db.collection('users').orderBy('nameLower');
    if (ql) r = r.startAt(ql).endAt(ql + String.fromCharCode(63743));
    unsubL = r.limit(30).onSnapshot(function (snap) {
      box.innerHTML = '';
      snap.forEach(function (d) {
        const u = d.data(); if (!u || u.uid === me.uid) return;
        const row = mk('div', 'row');
        let av;
        if (safePhoto(u.photo)) { av = mk('img', 'av'); av.src = u.photo; av.referrerPolicy = 'no-referrer'; }
        else av = mk('div', 'av', String(u.name || '?')[0]);
        row.append(av, mk('div', '', String(u.name || '')));
        row.onclick = function () { openUser(u); }; box.append(row);
      });
      if (!box.children.length) box.append(mk('div', 'empty', q ? 'Koi nahi mila' : 'Abhi koi aur user nahi hai.'));
    }, function (e) { console.error(e); alert('List error: ' + e.message); });
  } else {
    unsubL = db.collection('rooms').orderBy('created', 'desc').limit(30).onSnapshot(function (snap) {
      box.innerHTML = '';
      snap.forEach(function (d) {
        const r = d.data();
        if (q && !String(r.name).toLowerCase().includes(q.toLowerCase())) return;
        const row = mk('div', 'row');
        row.append(mk('div', 'av', r.type === 'channel' ? 'C' : 'G'));
        const t = mk('div', '', String(r.name || '')); t.append(mk('small', '', r.type === 'channel' ? 'Channel' : 'Group'));
        row.append(t); row.onclick = function () { openRoom(r, d.id); }; box.append(row);
      });
      if (!box.children.length) box.append(mk('div', 'empty', 'Koi group ya channel nahi. Upar + Naya dabao.'));
    }, function (e) { console.error(e); alert('List error: ' + e.message); });
  }
}

$('newRoom').onclick = async function () {
  const name = (prompt('Naam likho (max 60 akshar)') || '').trim().slice(0, 60);
  if (!name) return;
  const type = confirm('OK = Channel (sirf aap post karoge)\nCancel = Group (sab bol sakte hain)') ? 'channel' : 'group';
  try {
    await db.collection('rooms').add({ type: type, name: name, owner: me.uid, created: TS() });
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
    isOwner: isOwner, isStaff: isStaff, roomRef: ref, title: (r.type === 'channel' ? 'Channel: ' : 'Group: ') + r.name });
    }
