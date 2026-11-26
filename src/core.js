  /* MeMeet - core: gedeelde toestand (A), hulpfuncties en downloaden; staat vooraan in de build */
  /* ================================================================== Vergaderapp */
  var DEFAULT_TYPES = ['Overleg', 'MT DGSenB', 'PMT DGSenB', 'Stafoverleg DGSenB/MRB', 'Stafoverleg DGSenB/SJenV', 'Stafoverleg DGSenB/SRb'];
  var A = { store: null, data: { version: 1, types: DEFAULT_TYPES.slice(), meetings: [] }, sort: { key: 'date', dir: 1 }, f: { q: '', type: '', year: '' }, draft: null };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nl2iso(s) { var m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s || ''); return m ? m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]) : ''; }
  function isoDate(iso) { var p = (iso || '').split('-'); return p.length === 3 ? new Date(+p[0], p[1] - 1, +p[2]) : null; }
  function fmtLong(iso) { var d = isoDate(iso); return d ? d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Geen datum'; }
  function fmtShort(iso) { var d = isoDate(iso); return d ? pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear() : '—'; }
  function safe(n) { return String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 90) || 'bestand'; }
  function isCal(f) { return /\.ics$/i.test(f.name) || f.type === 'text/calendar'; }
  function isMail(f) { return /\.(msg|eml)$/i.test(f.name) || f.type === 'message/rfc822' || f.type === 'application/vnd.ms-outlook'; }
  function toast(t, kind) { var e = $('#toast'); e.textContent = t; e.className = 'show ' + (kind || ''); clearTimeout(toast.t); toast.t = setTimeout(function () { e.className = ''; }, 4200); }


  /* ------------------------------------------------------------- export */
  function exportName(m) { return safe((m.title || 'Vergadering') + ' - ' + (m.date ? fmtShort(m.date) : 'zonder datum') + (m.start ? ' ' + m.start.replace(':', '.') + (m.end ? '-' + m.end.replace(':', '.') : '') : '')).slice(0, 150) + '.pdf'; }
  /* Downloaden. Begint een download pas na rekenwerk (PDF maken, mail opbouwen), dan ziet de browser hem als automatische download en
     kan hij hem stil blokkeren. Daarom staat er rechtsonder steeds een balkje met "Opnieuw downloaden": die klik komt van jou en wordt niet geblokkeerd. */
  function dlFire(u, name) { var a = D.createElement('a'); a.href = u; a.download = name; D.body.appendChild(a); a.click(); a.remove(); }
  function dl(b, name) {
    var u = URL.createObjectURL(b); dlFire(u, name);
    var old = $('#dlbar'); if (old) { clearTimeout(old._t); old._close(); }
    var bar = D.createElement('div'); bar.id = 'dlbar'; bar.setAttribute('role', 'status');
    var tx = D.createElement('div'); tx.className = 'dlt';
    var nm = D.createElement('b'); nm.appendChild(icEl('download')); nm.appendChild(D.createTextNode(' ' + name)); var sub = D.createElement('span'); sub.textContent = 'Staat het niet in je Downloads?';
    tx.appendChild(nm); tx.appendChild(sub);
    var again = D.createElement('button'); again.type = 'button'; again.className = 'btn sm'; again.textContent = 'Opnieuw downloaden';
    var x = D.createElement('button'); x.type = 'button'; x.className = 'dlx'; x.title = 'Sluiten'; x.setAttribute('aria-label', 'Sluiten'); x.appendChild(icEl('close'));
    bar.appendChild(tx); bar.appendChild(again); bar.appendChild(x); D.body.appendChild(bar);
    bar._close = function () { if (bar.parentNode) bar.parentNode.removeChild(bar); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); };
    again.onclick = function () { dlFire(u, name); clearTimeout(bar._t); bar._t = setTimeout(bar._close, 25000); };
    x.onclick = function () { clearTimeout(bar._t); bar._close(); };
    bar._t = setTimeout(bar._close, 25000);
  }
