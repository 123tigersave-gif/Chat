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
    snap.docs.forEach(d => { oldest = Math.min(oldest, tms(d)); });
    snap.docChanges().forEach(ch => {
      if (ch.type === 'removed') {
        const slid = snap.size >= lim && tms(ch.doc) < oldest;
        if (!slid) store.delete(ch.doc.id);
      } else store.set(ch.doc.id, ch.doc);
    });
    if (first) { if (snap.size < lim) hasMore = false; }
    render();
    if (first) { first = false; stick = false; }
  }, e => { console.error(e); $('msgs').innerHTML = '<div class="empty">Chat load nahi hui.</div>'; });
}

function render(mode) {
  const box = $('msgs');
  const prevH = box.scrollHeight, prevTop = box.scrollTop;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const docs = [...store.values()].sort((a, b) => tms(a) - tms(b));
  box.innerHTML = '';
  if (loadingOld) box.append(mk('div', 'loader', 'Purane message load ho rahe hain…'));
  docs.forEach(d => box.append(bubble(d, cur)));
  if (!docs.length) box.append(mk('div', 'empty', 'Abhi koi message nahi'));
  if (mode === 'prepend') box.scrollTop = prevTop + (box.scrollHeight - prevH);
  else if (stick || nearBottom) box.scrollTop = box.scrollHeight;
  else box.scrollTop = prevTop;
}

async function loadOlder() {
  if (!cur || !hasMore || loadingOld || !store.size) return;
  loadingOld = true; const my = token;
  const oldest = [...store.values()].sort((a, b) => tms(a) - tms(b))[0];
  try {
    const snap = await cur.col.orderBy('t').endBefore(oldest).limitToLast(CONFIG.pageSize).get();
    if (my !== token) return;
    snap.docs.forEach(d => store.set(d.id, d));
    if (snap.size < CONFIG.pageSize) hasMore = false;
  } catch (e) { console.error(e); hasMore = false; }
  loadingOld = false; render('prepend');
}
$('msgs').addEventListener('scroll', () => { if ($('msgs').scrollTop < 60) loadOlder(); });
