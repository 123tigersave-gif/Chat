function bubble(d, c) {
  const m = d.data({ serverTimestamps: 'estimate' }), mine = m.from === me.uid;
  const el = mk('div', 'm' + (mine ? ' me' : ''));
  if (!mine && m.name) el.append(mk('b', '', String(m.name)));
  if (m.reply) el.append(mk('div', 'q', String(m.reply)));
  el.append(mk('span', '', String(m.text || '')));
  const when = m.t ? m.t.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '…';
  el.append(mk('time', '', when + (m.edited ? ' · edited' : '')));
  el.onclick = () => {
    const old = el.querySelector('.acts');
    if (old) { old.remove(); return; }
    const a = mk('div', 'acts');
    const add = (label, fn) => {
      const b = mk('button', '', label);
      b.onclick = async ev => { ev.stopPropagation(); try { await fn(); } catch (x) { alert(x.message); } };
      a.append(b);
    };
    if (c.canPost) add('Reply', () => {
      replyTo = (String(m.name || 'Aap') + ': ' + m.text).slice(0, 100);
      $('rtxt').textContent = '↩ ' + replyTo; $('rbar').style.display = 'flex'; $('text').focus(); a.remove();
    });
    if (mine) add('Edit', async () => {
      const t = (prompt('Message badlo', m.text) || '').trim().slice(0, CONFIG.maxText);
      if (t && t !== m.text) await d.ref.update({ text: t, edited: true });
    });
    if (mine || c.isStaff) add('Delete', async () => { if (confirm('Ye message delete karna hai?')) await d.ref.delete(); });
    if (!mine) add('Report', async () => {
      const why = (prompt('Kya dikkat hai? (chhota likho)') || '').trim().slice(0, 200);
      if (why) { await db.collection('reports').add({ by: me.uid, path: d.ref.path, reason: why, t: TS() }); alert('Report bhej di gayi.'); }
    });
    if (!mine && c.isOwner && c.roomRef) add('Ban', async () => {
      if (confirm('Is user ko is room se ban karna hai?')) {
        await c.roomRef.update({ banned: firebase.firestore.FieldValue.arrayUnion(m.from) }); alert('Ban ho gaya.');
      }
    });
    el.append(a);
  };
  return el;
}

function clearReply() { replyTo = ''; $('rbar').style.display = 'none'; }
$('rx').onclick = clearReply;

async function send() {
  const text = $('text').value.trim().slice(0, CONFIG.maxText);
  if (!text || !cur || !me) return;
  if (Date.now() - lastSend < CONFIG.slowSeconds * 1000) { alert(CONFIG.slowSeconds + ' second ruko, phir bhejo.'); return; }
  lastSend = Date.now(); stick = true;
  $('text').value = '';
  const data = { from: me.uid, name: myName, text, t: TS() };
  if (replyTo) data.reply = replyTo;
  clearReply();
  try { await cur.col.add(data); } catch (e) { alert('Message nahi gaya: ' + e.message); }
}
$('send').onclick = send;
$('text').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
$('back').onclick = () => document.body.classList.remove('open');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
