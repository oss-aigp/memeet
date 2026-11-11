  /* ================================================================== PowerPoint: dia's getrouw weergeven
     Leest thema (kleuren, lettertypen, opmaakstijlen), diamaster en -indeling (achtergrond, vaste vormen, tijdelijke aanduidingen
     en tekststijlen), en tekent per dia: achtergrond, vormen (vooraf ingestelde en eigen geometrie), lijnen en pijlen, groepen,
     afbeeldingen (met bijsnijden), tekst (opsommingen, nummering, uitlijning, regelafstand, automatisch passend maken),
     tabellen (met tabelstijl), grafieken (staaf, lijn, vlak, cirkel, ring) en SmartArt (via de opgeslagen tekening).
     De dia wordt als HTML/SVG opgebouwd. Voor de PDF wordt die getekend op een canvas; er komt onzichtbare tekst over, zodat zoeken werkt. */
  var PX_W = 960; /* breedte van een dia in CSS-pixels; alles schaalt mee */
  var SVGNS_P = 'http://www.w3.org/2000/svg';
  function pAt(e, n, d) { var v = e && e.getAttribute(n); return v == null || v === '' ? d : v; }
  function pNum(e, n, d) { var v = e && e.getAttribute(n); return v == null || v === '' ? d : +v; }
  function pOn(e, n) { var v = e && e.getAttribute(n); return v === '1' || v === 'true' || v === 'on'; }
  function chs(e, n) { return kids(e).filter(function (c) { return c.localName === n; }); }
  function relTarget(rels, re) { for (var k in rels) if (rels[k] && re.test(rels[k])) return rels[k]; return null; }

  async function pptxLoad(bytes) {
    var z = await JSZip.loadAsync(bytes), pp = 'ppt/presentation.xml', pf = z.file(pp);
    if (!pf) throw new Error('Geen PowerPoint-bestand');
    var px = xmlDoc(await pf.async('string')), rels = await relsOf(z, pp), sz = desc(px, 'sldSz')[0];
    var deck = { z: z, SW: pNum(sz, 'cx', 9144000), SH: pNum(sz, 'cy', 6858000), slides: [], parts: {}, themes: {}, imgs: {}, defStyle: ch(px, 'defaultTextStyle'), tblStyles: null };
    desc(px, 'sldId').forEach(function (id) { var p = rels[id.getAttribute('r:id')]; if (p && z.file(p)) deck.slides.push({ path: p, n: deck.slides.length + 1 }); });
    var ts = z.file('ppt/tableStyles.xml'); if (ts) deck.tblStyles = xmlDoc(await ts.async('string'));
    return deck;
  }
  function pptPart(deck, path) {
    if (!deck.parts[path]) deck.parts[path] = (async function () { var f = deck.z.file(path); if (!f) return null; return { path: path, x: xmlDoc(await f.async('string')), rels: await relsOf(deck.z, path) }; })();
    return deck.parts[path];
  }
  async function pptTheme(deck, path) {
    if (deck.themes[path]) return deck.themes[path];
    var t = { clr: {}, major: 'Calibri Light', minor: 'Calibri', fill: [], ln: [], bg: [] }, p = path && await pptPart(deck, path);
    if (p) {
      var cs = desc(p.x, 'clrScheme')[0];
      kids(cs).forEach(function (c) { var v = kids(c)[0]; if (!v) return; t.clr[c.localName] = v.localName === 'sysClr' ? pAt(v, 'lastClr', v.getAttribute('val') === 'window' ? 'FFFFFF' : '000000') : pAt(v, 'val', '000000'); });
      var mj = desc(p.x, 'majorFont')[0], mn = desc(p.x, 'minorFont')[0];
      if (mj && ch(mj, 'latin')) t.major = ch(mj, 'latin').getAttribute('typeface') || t.major;
      if (mn && ch(mn, 'latin')) t.minor = ch(mn, 'latin').getAttribute('typeface') || t.minor;
      t.fill = kids(desc(p.x, 'fillStyleLst')[0]); t.ln = kids(desc(p.x, 'lnStyleLst')[0]); t.bg = kids(desc(p.x, 'bgFillStyleLst')[0]);
    }
    return (deck.themes[path] = t);
  }
  /* alles wat nodig is om één dia te tekenen */
  async function pptCtx(deck, i) {
    var s = await pptPart(deck, deck.slides[i].path);
    var lp = relTarget(s.rels, /slideLayouts\//), lay = lp ? await pptPart(deck, lp) : null;
    var mp = lay && relTarget(lay.rels, /slideMasters\//), mas = mp ? await pptPart(deck, mp) : null;
    var tp = mas && relTarget(mas.rels, /theme\//), th = await pptTheme(deck, tp);
    var map = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' };
    function applyMap(e) { if (!e) return; for (var k = 0; k < e.attributes.length; k++) map[e.attributes[k].localName] = e.attributes[k].value; }
    if (mas) applyMap(desc(mas.x, 'clrMap')[0]);
    [lay, s].forEach(function (p) { var o = p && desc(p.x, 'overrideClrMapping')[0]; if (o) applyMap(o); });
    return { deck: deck, s: s, lay: lay, mas: mas, th: th, map: map, n: deck.slides[i].n, k: PX_W / deck.SW, imgs: deck.imgs };
  }

  /* ---------- kleuren */
  var PRST = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', darkGray: 'A9A9A9', lightGray: 'D3D3D3', orange: 'FFA500', navy: '000080', purple: '800080' };
  function hex2c(h) { h = (h || '000000').replace('#', ''); return { r: parseInt(h.substr(0, 2), 16) || 0, g: parseInt(h.substr(2, 2), 16) || 0, b: parseInt(h.substr(4, 2), 16) || 0, a: 1 }; }
  function rgb2hsl(c) { var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn; if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function hsl2rgb(h, s, l, a) { function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; } var r, g, b; if (!s) r = g = b = l; else { var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); } return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: a }; }
  function pClrEl(C, ce, ph) {
    if (!ce) return null;
    var t = ce.localName, c;
    if (t === 'srgbClr') c = hex2c(ce.getAttribute('val'));
    else if (t === 'sysClr') c = hex2c(pAt(ce, 'lastClr', ce.getAttribute('val') === 'window' ? 'FFFFFF' : '000000'));
    else if (t === 'prstClr') c = hex2c(PRST[ce.getAttribute('val')] || '000000');
    else if (t === 'scrgbClr') c = { r: Math.round(pNum(ce, 'r', 0) / 1000 * 2.55), g: Math.round(pNum(ce, 'g', 0) / 1000 * 2.55), b: Math.round(pNum(ce, 'b', 0) / 1000 * 2.55), a: 1 };
    else if (t === 'hslClr') c = hsl2rgb(pNum(ce, 'hue', 0) / 21600000, pNum(ce, 'sat', 0) / 100000, pNum(ce, 'lum', 0) / 100000, 1);
    else if (t === 'schemeClr') {
      var v = ce.getAttribute('val');
      if (v === 'phClr') c = ph ? Object.assign({}, ph) : hex2c(C.th.clr[C.map.tx1] || '000000');
      else c = hex2c(C.th.clr[C.map[v] || v] || C.th.clr[v] || '000000');
    } else return null;
    kids(ce).forEach(function (m) {
      var n = m.localName, v = pNum(m, 'val', 0) / 100000, hsl;
      if (n === 'alpha') c.a = v;
      else if (n === 'lumMod' || n === 'lumOff' || n === 'satMod' || n === 'satOff' || n === 'hueOff' || n === 'hueMod') {
        hsl = rgb2hsl(c);
        if (n === 'lumMod') hsl[2] *= v; else if (n === 'lumOff') hsl[2] += v; else if (n === 'satMod') hsl[1] *= v; else if (n === 'satOff') hsl[1] += v; else if (n === 'hueOff') hsl[0] += pNum(m, 'val', 0) / 21600000; else hsl[0] *= v;
        c = hsl2rgb(((hsl[0] % 1) + 1) % 1, Math.max(0, Math.min(1, hsl[1])), Math.max(0, Math.min(1, hsl[2])), c.a);
      } else if (n === 'tint') { c = { r: Math.round(c.r * v + 255 * (1 - v)), g: Math.round(c.g * v + 255 * (1 - v)), b: Math.round(c.b * v + 255 * (1 - v)), a: c.a }; }
      else if (n === 'shade') { c = { r: Math.round(c.r * v), g: Math.round(c.g * v), b: Math.round(c.b * v), a: c.a }; }
      else if (n === 'inv') { c = { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b, a: c.a }; }
      else if (n === 'gray') { var y = Math.round(c.r * 0.3 + c.g * 0.59 + c.b * 0.11); c = { r: y, g: y, b: y, a: c.a }; }
    });
    return c;
  }
  var CLRS = ['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr'];
  function pClr(C, holder, ph) { if (!holder) return null; for (var i = 0; i < holder.children.length; i++) if (CLRS.indexOf(holder.children[i].localName) >= 0) return pClrEl(C, holder.children[i], ph); return null; }
  function cssC(c) { return !c ? 'transparent' : c.a < 1 ? 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (+c.a.toFixed(3)) + ')' : 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }

  /* ---------- afbeeldingen (als data-URL, zodat ze ook in de PDF-weergave meegaan) */
  async function pptImg(C, rels, rid) {
    var path = rid && rels[rid]; if (!path) return null;
    if (C.imgs[path] !== undefined) return C.imgs[path];
    var f = C.deck.z.file(path), url = null;
    if (f && /\.(png|jpe?g|gif|bmp|svg|webp)$/i.test(path)) {
      var b64 = await f.async('base64'), ext = path.split('.').pop().toLowerCase();
      url = 'data:' + (ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : 'image/' + ext) + ';base64,' + b64;
    }
    return (C.imgs[path] = url);
  }

  /* ---------- vulling en lijn */
  async function pptFillEl(C, f, ph, rels) {
    if (!f) return null;
    var n = f.localName;
    if (n === 'noFill') return { none: 1 };
    if (n === 'solidFill') { var c = pClr(C, f, ph); return c ? { css: cssC(c), c: c } : null; }
    if (n === 'gradFill') {
      var gs = desc(f, 'gs').map(function (g) { return { p: pNum(g, 'pos', 0) / 1000, c: pClr(C, g, ph) }; }).filter(function (g) { return g.c; }).sort(function (a, b) { return a.p - b.p; });
      if (!gs.length) return null;
      var stops = gs.map(function (g) { return cssC(g.c) + ' ' + g.p + '%'; }).join(', '), lin = ch(f, 'lin'), path = ch(f, 'path');
      var css = path ? 'radial-gradient(circle, ' + stops + ')' : 'linear-gradient(' + ((lin ? pNum(lin, 'ang', 0) / 60000 : 90) + 90) + 'deg, ' + stops + ')';
      return { css: css, c: gs[Math.floor(gs.length / 2)].c, grad: gs, ang: lin ? pNum(lin, 'ang', 0) / 60000 : 90, radial: !!path };
    }
    if (n === 'blipFill') { var bl = ch(f, 'blip'), u = bl && rels ? await pptImg(C, rels, bl.getAttribute('r:embed')) : null; return u ? { img: u, tile: !!ch(f, 'tile') } : null; }
    if (n === 'pattFill') { var fg = pClr(C, ch(f, 'fgClr'), ph), bgc = pClr(C, ch(f, 'bgClr'), ph); return fg ? { css: cssC(bgc ? { r: (fg.r + bgc.r) >> 1, g: (fg.g + bgc.g) >> 1, b: (fg.b + bgc.b) >> 1, a: 1 } : fg), c: fg } : null; }
    if (n === 'grpFill') return { grp: 1 };
    return null;
  }
  var FILLS = ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'];
  function fillChild(e) { return kids(e).filter(function (c) { return FILLS.indexOf(c.localName) >= 0; })[0] || null; }
  async function pptFill(C, spPr, style, rels, grpFill) {
    var f = fillChild(spPr);
    if (f) { var r = await pptFillEl(C, f, null, rels); if (r && r.grp) return grpFill || null; return r; }
    var fr = style && ch(style, 'fillRef');
    if (fr) { var idx = pNum(fr, 'idx', 0), ph = pClr(C, fr); if (!idx) return null; var lst = idx >= 1000 ? C.th.bg : C.th.fill, se = lst[(idx >= 1000 ? idx - 1001 : idx - 1)]; return se ? await pptFillEl(C, se, ph, rels) : (ph ? { css: cssC(ph), c: ph } : null); }
    return null;
  }
  function pptLine(C, spPr, style) {
    var ln = spPr && ch(spPr, 'ln'), lr = style && ch(style, 'lnRef'), base = null, ph = lr ? pClr(C, lr) : null;
    if (lr && pNum(lr, 'idx', 0) > 0) base = C.th.ln[pNum(lr, 'idx', 0) - 1] || null;
    function pick(n) { var v = ln && ch(ln, n); if (v) return v; return base ? ch(base, n) : null; }
    if (ln && ch(ln, 'noFill')) return null;
    var fill = (ln && (ch(ln, 'solidFill') || ch(ln, 'gradFill'))) || (base && (ch(base, 'solidFill') || ch(base, 'gradFill'))), c = null;
    if (!fill) { if (!ln && !base) return null; if (base && ch(base, 'noFill')) return null; if (!base) return null; }
    if (fill) c = fill.localName === 'solidFill' ? pClr(C, fill, ph) : pClr(C, desc(fill, 'gs')[0], ph);
    if (!c) return null;
    var w = pNum(ln, 'w', pNum(base, 'w', 9525)), dash = pick('prstDash');
    return { c: c, w: Math.max(0.5, w * C.k), dash: dash ? dash.getAttribute('val') : 'solid', head: pick('headEnd'), tail: pick('tailEnd') };
  }

  /* ---------- geometrie: SVG-pad in pixels */
  function pptGeom(g, w, h) {
    var prst = g && g.localName === 'prstGeom' ? g.getAttribute('prst') : null, av = {}, ss = Math.min(w, h);
    if (g) desc(g, 'gd').forEach(function (d) { var m = /val\s+(-?\d+)/.exec(d.getAttribute('fmla') || ''); if (m) av[d.getAttribute('name')] = +m[1]; });
    function A(n, d) { return (av[n] != null ? av[n] : d) / 100000; }
    function poly(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' L') + ' Z'; }
    function rr(r) { r = Math.min(r, w / 2, h / 2); return 'M' + r + ',0 H' + (w - r) + ' A' + r + ',' + r + ' 0 0 1 ' + w + ',' + r + ' V' + (h - r) + ' A' + r + ',' + r + ' 0 0 1 ' + (w - r) + ',' + h + ' H' + r + ' A' + r + ',' + r + ' 0 0 1 0,' + (h - r) + ' V' + r + ' A' + r + ',' + r + ' 0 0 1 ' + r + ',0 Z'; }
    if (g && g.localName === 'custGeom') {
      var out = '';
      desc(g, 'path').forEach(function (p) {
        var pw = pNum(p, 'w', 0) || w / 1, ph = pNum(p, 'h', 0) || h / 1, sx = pNum(p, 'w', 0) ? w / pw : 1, sy = pNum(p, 'h', 0) ? h / ph : 1, cx = 0, cy = 0;
        function pt(e) { return [pNum(e, 'x', 0) * sx, pNum(e, 'y', 0) * sy]; }
        kids(p).forEach(function (c) {
          var pts = chs(c, 'pt').map(pt), n = c.localName;
          if (n === 'moveTo' && pts[0]) { out += 'M' + pts[0].join(','); cx = pts[0][0]; cy = pts[0][1]; }
          else if (n === 'lnTo' && pts[0]) { out += 'L' + pts[0].join(','); cx = pts[0][0]; cy = pts[0][1]; }
          else if (n === 'cubicBezTo' && pts.length === 3) { out += 'C' + pts.map(function (q) { return q.join(','); }).join(' '); cx = pts[2][0]; cy = pts[2][1]; }
          else if (n === 'quadBezTo' && pts.length === 2) { out += 'Q' + pts.map(function (q) { return q.join(','); }).join(' '); cx = pts[1][0]; cy = pts[1][1]; }
          else if (n === 'arcTo') {
            var wr = pNum(c, 'wR', 0) * sx, hr = pNum(c, 'hR', 0) * sy, st = pNum(c, 'stAng', 0) / 60000 * Math.PI / 180, sw = pNum(c, 'swAng', 0) / 60000 * Math.PI / 180;
            var ox = cx - wr * Math.cos(st), oy = cy - hr * Math.sin(st), ex = ox + wr * Math.cos(st + sw), ey = oy + hr * Math.sin(st + sw);
            out += 'A' + wr + ',' + hr + ' 0 ' + (Math.abs(sw) > Math.PI ? 1 : 0) + ' ' + (sw > 0 ? 1 : 0) + ' ' + ex + ',' + ey; cx = ex; cy = ey;
          } else if (n === 'close') out += 'Z';
        });
      });
      return { d: out || 'M0,0 H' + w + ' V' + h + ' H0 Z' };
    }
    switch (prst) {
      case 'line': case 'straightConnector1': case 'bentConnector2': case 'bentConnector3': case 'curvedConnector3': return { d: 'M0,0 L' + w + ',' + h, line: 1 };
      case 'ellipse': case 'flowChartConnector': case 'cloud': case 'flowChartOnlineStorage': return { d: 'M0,' + h / 2 + ' A' + w / 2 + ',' + h / 2 + ' 0 1 1 ' + w + ',' + h / 2 + ' A' + w / 2 + ',' + h / 2 + ' 0 1 1 0,' + h / 2 + ' Z', tr: [w * 0.1464, h * 0.1464, w * 0.8536, h * 0.8536] };
      case 'roundRect': case 'flowChartAlternateProcess': var ri = ss * A('adj', 16667) * 0.29289; return { d: rr(ss * A('adj', 16667)), tr: [ri, ri, w - ri, h - ri] };
      case 'flowChartTerminator': return { d: rr(h / 2) };
      case 'triangle': case 'flowChartExtract': return { d: poly([[w * A('adj', 50000), 0], [w, h], [0, h]]), tr: [w * A('adj', 50000) / 2, h / 2, w - w * (1 - A('adj', 50000)) / 2, h] };
      case 'rtTriangle': return { d: poly([[0, 0], [w, h], [0, h]]) };
      case 'diamond': case 'flowChartDecision': return { d: poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]), tr: [w / 4, h / 4, w * 3 / 4, h * 3 / 4] };
      case 'parallelogram': case 'flowChartInputOutput': var pa = ss * A('adj', 25000); return { d: poly([[pa, 0], [w, 0], [w - pa, h], [0, h]]) };
      case 'trapezoid': var ta = ss * A('adj', 25000); return { d: poly([[ta, 0], [w - ta, 0], [w, h], [0, h]]) };
      case 'homePlate': var hp = ss * A('adj', 50000); return { d: poly([[0, 0], [w - hp, 0], [w, h / 2], [w - hp, h], [0, h]]), tr: [0, 0, w - hp / 2, h] };
      case 'chevron': var cv = ss * A('adj', 50000); return { d: poly([[0, 0], [w - cv, 0], [w, h / 2], [w - cv, h], [0, h], [cv, h / 2]]), tr: [cv, 0, w - cv, h] };
      case 'pentagon': return { d: poly([[w / 2, 0], [w, h * 0.38], [w * 0.81, h], [w * 0.19, h], [0, h * 0.38]]) };
      case 'hexagon': var hx = ss * A('adj', 25000); return { d: poly([[hx, 0], [w - hx, 0], [w, h / 2], [w - hx, h], [hx, h], [0, h / 2]]) };
      case 'octagon': var oc = ss * A('adj', 29289); return { d: poly([[oc, 0], [w - oc, 0], [w, oc], [w, h - oc], [w - oc, h], [oc, h], [0, h - oc], [0, oc]]) };
      case 'plus': var pl = ss * A('adj', 25000); return { d: poly([[pl, 0], [w - pl, 0], [w - pl, pl], [w, pl], [w, h - pl], [w - pl, h - pl], [w - pl, h], [pl, h], [pl, h - pl], [0, h - pl], [0, pl], [pl, pl]]) };
      case 'rightArrow': case 'leftArrow': case 'upArrow': case 'downArrow': {
        var vert = prst === 'upArrow' || prst === 'downArrow', L = vert ? h : w, T = vert ? w : h, sh = T * A('adj1', 50000), hl = Math.min(L, ss * A('adj2', 50000)), y1 = (T - sh) / 2, y2 = y1 + sh;
        var pts = [[0, y1], [L - hl, y1], [L - hl, 0], [L, T / 2], [L - hl, T], [L - hl, y2], [0, y2]];
        if (prst === 'leftArrow' || prst === 'upArrow') pts = pts.map(function (p) { return [L - p[0], p[1]]; });
        if (vert) pts = pts.map(function (p) { return [p[1], p[0]]; });
        var tr0 = prst === 'leftArrow' || prst === 'upArrow' ? [hl / 2, y1, L, y2] : [0, y1, L - hl / 2, y2];
        return { d: poly(pts), tr: vert ? [tr0[1], tr0[0], tr0[3], tr0[2]] : tr0 };
      }
      case 'leftRightArrow': var la = h * A('adj1', 50000), lh = Math.min(w / 2, ss * A('adj2', 50000)), a1 = (h - la) / 2; return { d: poly([[0, h / 2], [lh, 0], [lh, a1], [w - lh, a1], [w - lh, 0], [w, h / 2], [w - lh, h], [w - lh, a1 + la], [lh, a1 + la], [lh, h]]) };
      case 'star5': { var p5 = []; for (var i = 0; i < 10; i++) { var r = i % 2 ? 0.38 : 1, an = -Math.PI / 2 + i * Math.PI / 5; p5.push([w / 2 + r * w / 2 * Math.cos(an), h / 2 + r * h / 2 * Math.sin(an) * 1.05 + h * 0.03]); } return { d: poly(p5) }; }
      case 'snip1Rect': var s1 = ss * A('adj', 16667); return { d: poly([[0, 0], [w - s1, 0], [w, s1], [w, h], [0, h]]) };
      case 'round1Rect': var r1 = Math.min(ss * A('adj', 16667), w / 2, h / 2); return { d: 'M0,0 H' + (w - r1) + ' A' + r1 + ',' + r1 + ' 0 0 1 ' + w + ',' + r1 + ' V' + h + ' H0 Z' };
      case 'round2SameRect': var r2 = Math.min(ss * A('adj1', 16667), w / 2, h / 2); return { d: 'M' + r2 + ',0 H' + (w - r2) + ' A' + r2 + ',' + r2 + ' 0 0 1 ' + w + ',' + r2 + ' V' + h + ' H0 V' + r2 + ' A' + r2 + ',' + r2 + ' 0 0 1 ' + r2 + ',0 Z' };
      case 'wedgeRectCallout': case 'wedgeRoundRectCallout': case 'wedgeEllipseCallout': {
        var tx = w / 2 + w * A('adj1', -20833), ty = h / 2 + h * A('adj2', 62500), body = prst === 'wedgeEllipseCallout' ? 'M0,' + h / 2 + ' A' + w / 2 + ',' + h / 2 + ' 0 1 1 ' + w + ',' + h / 2 + ' A' + w / 2 + ',' + h / 2 + ' 0 1 1 0,' + h / 2 + ' Z' : prst === 'wedgeRoundRectCallout' ? rr(ss * 0.16667) : 'M0,0 H' + w + ' V' + h + ' H0 Z';
        var bx = Math.max(w * 0.2, Math.min(w * 0.8, tx)), by = ty > h ? h : ty < 0 ? 0 : h / 2;
        return { d: body + ' M' + (bx - w * 0.08) + ',' + by + ' L' + tx + ',' + ty + ' L' + (bx + w * 0.08) + ',' + by + ' Z' };
      }
      case 'donut': var dn = ss * A('adj', 25000); return { d: 'M0,' + h / 2 + ' A' + w / 2 + ',' + h / 2 + ' 0 1 1 ' + w + ',' + h / 2 + ' A' + w / 2 + ',' + h / 2 + ' 0 1 1 0,' + h / 2 + ' Z M' + dn + ',' + h / 2 + ' A' + (w / 2 - dn) + ',' + (h / 2 - dn) + ' 0 1 0 ' + (w - dn) + ',' + h / 2 + ' A' + (w / 2 - dn) + ',' + (h / 2 - dn) + ' 0 1 0 ' + dn + ',' + h / 2 + ' Z', evenodd: 1 };
      case 'frame': var fr = ss * A('adj1', 12500); return { d: 'M0,0 H' + w + ' V' + h + ' H0 Z M' + fr + ',' + fr + ' V' + (h - fr) + ' H' + (w - fr) + ' V' + fr + ' Z', evenodd: 1 };
      case 'flowChartDocument': return { d: 'M0,0 H' + w + ' V' + h * 0.83 + ' C' + w * 0.75 + ',' + h * 0.7 + ' ' + w * 0.5 + ',' + h * 1.05 + ' 0,' + h * 0.92 + ' Z' };
      case 'can': case 'flowChartMagneticDisk': var cn = h * Math.min(0.25, A('adj', 25000)) / 2; return { d: 'M0,' + cn + ' A' + w / 2 + ',' + cn + ' 0 0 1 ' + w + ',' + cn + ' V' + (h - cn) + ' A' + w / 2 + ',' + cn + ' 0 0 1 0,' + (h - cn) + ' Z M0,' + cn + ' A' + w / 2 + ',' + cn + ' 0 0 0 ' + w + ',' + cn };
      default: return { d: 'M0,0 H' + w + ' V' + h + ' H0 Z' };
    }
  }

  /* ---------- tijdelijke aanduidingen (placeholders) en overerving */
  function phInfo(sp) { var ph = desc(ch(sp, 'nvSpPr') || ch(sp, 'nvPicPr') || ch(sp, 'nvGraphicFramePr') || sp, 'ph')[0]; return ph ? { type: ph.getAttribute('type') || 'obj', idx: ph.getAttribute('idx') } : null; }
  function phFind(prt, ph, master) {
    if (!prt || !ph) return null;
    var list = desc(desc(prt.x, 'spTree')[0], 'sp'), want = ph.type, byIdx = null, byType = null;
    var norm = function (t) { return t === 'ctrTitle' ? 'title' : /^(title|dt|ftr|sldNum)$/.test(t) ? t : 'body'; };
    for (var i = 0; i < list.length; i++) {
      var o = phInfo(list[i]); if (!o) continue;
      if (!master && ph.idx != null && o.idx === ph.idx) { byIdx = list[i]; break; }
      if (!byType && (o.type === want || norm(o.type) === norm(want) && (master || o.type === want || norm(want) === 'title'))) byType = list[i];
    }
    if (!master && !byIdx && !byType) for (i = 0; i < list.length; i++) { o = phInfo(list[i]); if (o && norm(o.type) === norm(want)) { byType = list[i]; break; } }
    return byIdx || byType;
  }
  function xfrmOf(e) { var x = e && (ch(ch(e, 'spPr') || ch(e, 'grpSpPr'), 'xfrm') || ch(e, 'xfrm')); if (!x) return null; var o = ch(x, 'off'), s = ch(x, 'ext'); if (!o || !s) return null; return { x: pNum(o, 'x', 0), y: pNum(o, 'y', 0), w: pNum(s, 'cx', 0), h: pNum(s, 'cy', 0), rot: pNum(x, 'rot', 0) / 60000, fh: pOn(x, 'flipH'), fv: pOn(x, 'flipV') }; }

  /* ---------- tekststijlen */
  function lvlEl(lst, lvl) { return lst ? ch(lst, 'lvl' + (lvl + 1) + 'pPr') : null; }
  function mergeP(P, e) {
    if (!e) return;
    ['algn', 'marL', 'indent', 'rtl'].forEach(function (k) { if (e.getAttribute(k) != null) P[k] = e.getAttribute(k); });
    kids(e).forEach(function (c) {
      var n = c.localName;
      if (n === 'lnSpc' || n === 'spcBef' || n === 'spcAft') { var pc = ch(c, 'spcPct'), pt = ch(c, 'spcPts'); P[n] = pc ? { pct: pNum(pc, 'val', 100000) / 100000 } : pt ? { pt: pNum(pt, 'val', 0) / 100 } : P[n]; }
      else if (n === 'buNone') { P.bu = null; }
      else if (n === 'buChar') P.bu = { ch: c.getAttribute('char') || '•' };
      else if (n === 'buAutoNum') P.bu = { num: c.getAttribute('type') || 'arabicPeriod', start: pNum(c, 'startAt', 1) };
      else if (n === 'buBlip') P.bu = { ch: '•' };
      else if (n === 'buFont') P.buFont = c.getAttribute('typeface');
      else if (n === 'buClr') P.buClr = c;
      else if (n === 'buClrTx') P.buClr = null;
      else if (n === 'buSzPct') P.buSz = pNum(c, 'val', 100000) / 100000;
      else if (n === 'buSzPts') P.buPts = pNum(c, 'val', 0) / 100;
      else if (n === 'defRPr') mergeR(P.r, c);
    });
  }
  function mergeR(R, e) {
    if (!e) return;
    ['sz', 'b', 'i', 'u', 'strike', 'baseline', 'cap', 'spc'].forEach(function (k) { if (e.getAttribute(k) != null) R[k] = e.getAttribute(k); });
    kids(e).forEach(function (c) {
      var n = c.localName;
      if (n === 'solidFill' || n === 'gradFill') R.fill = n === 'solidFill' ? c : desc(c, 'gs')[0];
      else if (n === 'noFill') R.fill = 'none';
      else if (n === 'latin') R.font = c.getAttribute('typeface');
      else if (n === 'highlight') R.hl = c;
    });
  }
  function fontCss(C, f) {
    if (!f || f === '+mn-lt' || f === '+mn-ea' || f === '+mn-cs') f = C.th.minor; else if (f === '+mj-lt' || f === '+mj-ea' || f === '+mj-cs') f = C.th.major;
    var l = ['"' + String(f).replace(/"/g, '') + '"'];
    if (/calibri/i.test(f)) l.push('Carlito'); if (/cambria/i.test(f)) l.push('Caladea'); if (/arial|helvetica/i.test(f)) l.push('"Liberation Sans"');
    return l.concat(['Calibri', 'Carlito', '"Segoe UI"', 'Arial', 'sans-serif']).join(', ');
  }
  /* stijlketen voor een vorm: van algemeen naar specifiek */
  function textChain(C, sp, kind) {
    var ph = phInfo(sp), m = C.mas, chain = [], ts = m && desc(m.x, 'txStyles')[0];
    var isTitle = ph && /^(title|ctrTitle)$/.test(ph.type), isOther = !ph || /^(dt|ftr|sldNum)$/.test(ph.type);
    chain.push({ lst: C.deck.defStyle });
    if (ts) chain.push({ lst: ch(ts, isTitle ? 'titleStyle' : isOther ? 'otherStyle' : 'bodyStyle'), tx: 1 });
    function sample(phSp) { if (ts) return null; var p0 = desc(ch(phSp, 'txBody'), 'p')[0]; if (!p0) return null; var r0 = desc(p0, 'r')[0]; return { pPr: ch(p0, 'pPr'), rPr: (r0 && ch(r0, 'rPr')) || ch(p0, 'endParaRPr') }; }
    if (ph && kind !== 'master') { var mph = phFind(C.mas, ph, true); if (mph) chain.push({ lst: desc(ch(mph, 'txBody'), 'lstStyle')[0], body: desc(mph, 'bodyPr')[0], sp: mph, sample: sample(mph) }); }
    if (ph && kind === 'slide') { var lph = phFind(C.lay, ph, false); if (lph) chain.push({ lst: desc(ch(lph, 'txBody'), 'lstStyle')[0], body: desc(lph, 'bodyPr')[0], sp: lph, sample: sample(lph) }); }
    var tb = ch(sp, 'txBody'); chain.push({ lst: tb && ch(tb, 'lstStyle'), body: tb && ch(tb, 'bodyPr'), sp: sp });
    return { chain: chain, ph: ph, isTitle: isTitle };
  }

  /* ---------- tekst tekenen */
  var NUMS = { alphaLc: function (n) { return String.fromCharCode(96 + ((n - 1) % 26) + 1); }, alphaUc: function (n) { return String.fromCharCode(64 + ((n - 1) % 26) + 1); }, romanLc: function (n) { return roman(n); }, romanUc: function (n) { return roman(n).toUpperCase(); }, arabic: function (n) { return String(n); } };
  function autoNum(t, n) { var m = /^(alphaLc|alphaUc|romanLc|romanUc|arabic)(.*)$/.exec(t) || [0, 'arabic', 'Period'], s = NUMS[m[1]](n), suf = m[2]; return suf === 'ParenR' ? s + ')' : suf === 'ParenBoth' ? '(' + s + ')' : suf === 'Plain' ? s : s + '.'; }
  function rClr(C, f) { return f && f.__c ? f.__c : pClr(C, f); }
  function pEl(tag, cls, css) { var e = D.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; }
  /* zet de tekst van een txBody in 'box'; geeft de gebruikte alinea-elementen terug */
  function pptText(C, box, tb, info, opt) {
    var chain = info.chain, scale = 1, lnRed = 0, body = {};
    chain.forEach(function (c) { if (!c.body) return; for (var i = 0; i < c.body.attributes.length; i++) body[c.body.attributes[i].localName] = c.body.attributes[i].value; var na = ch(c.body, 'normAutofit'); if (na) { body.fit = 'norm'; scale = pNum(na, 'fontScale', 100000) / 100000; lnRed = pNum(na, 'lnSpcReduction', 0) / 100000; } else if (ch(c.body, 'noAutofit') || ch(c.body, 'spAutoFit')) { body.fit = ''; scale = 1; lnRed = 0; } });
    var k = C.k, ins = opt.ins || 0;
    var pl = pNum({ getAttribute: function (n) { return body[n]; } }, 'lIns', 91440) * k, pt = pNum({ getAttribute: function (n) { return body[n]; } }, 'tIns', 45720) * k, pr = pNum({ getAttribute: function (n) { return body[n]; } }, 'rIns', 91440) * k, pb = pNum({ getAttribute: function (n) { return body[n]; } }, 'bIns', 45720) * k;
    var anc = body.anchor || (info.isTitle ? 'ctr' : 't');
    var tr = opt.tr || [ins * opt.w, ins * opt.h, opt.w - ins * opt.w, opt.h - ins * opt.h];
    if (opt.flow) box.style.cssText += ';position:relative;display:block;'; /* tabelcel: de cel regelt grootte en marges */
    else box.style.cssText += ';position:absolute;left:' + tr[0] + 'px;top:' + tr[1] + 'px;width:' + Math.max(0, tr[2] - tr[0]) + 'px;height:' + Math.max(0, tr[3] - tr[1]) + 'px;padding:' + pt + 'px ' + pr + 'px ' + pb + 'px ' + pl + 'px;display:flex;flex-direction:column;justify-content:' + (anc === 'ctr' ? 'center' : anc === 'b' ? 'flex-end' : 'flex-start') + ';box-sizing:border-box;' + (body.wrap === 'none' ? 'white-space:pre;' : 'overflow-wrap:break-word;') + (body.vert === 'vert270' ? 'writing-mode:vertical-rl;transform:rotate(180deg);' : body.vert === 'vert' || body.vert === 'eaVert' ? 'writing-mode:vertical-rl;' : '');
    var paras = tb ? chs(tb, 'p') : [], out = [], cnt = {}, first = true;
    paras.forEach(function (p, pi) {
      var pPr = ch(p, 'pPr'), lvl = pNum(pPr, 'lvl', 0), P = { r: {} };
      /* de stijl van de vorm (fontRef, bijvoorbeeld witte tekst in een gekleurde vorm) gaat boven de algemene tekststijl van de master */
      var fontRefAt = chain.reduce(function (a, c, ci) { return c.tx ? ci : a; }, 0);
      chain.forEach(function (c, ci) { if (c.sample) { if (lvl === 0) mergeP(P, c.sample.pPr); var keepFill = P.r.fill; mergeR(P.r, c.sample.rPr); P.r.fill = keepFill; } /* alleen grootte en lettertype, niet de kleur */ mergeP(P, lvlEl(c.lst, lvl)); if (ci === fontRefAt && opt.fontRef) { if (opt.fontRef.fill) P.r.fill = opt.fontRef.fill; if (opt.fontRef.font) P.r.font = opt.fontRef.font; } });
      if (opt.extraR) mergeR(P.r, opt.extraR);
      if (opt.color) P.r.fill = { __c: opt.color };
      mergeP(P, pPr);
      var runs = kids(p).filter(function (r) { return r.localName === 'r' || r.localName === 'br' || r.localName === 'fld'; });
      var hasText = runs.some(function (r) { return r.localName !== 'br' && (ch(r, 't') || {}).textContent; });
      var d = pEl('div', 'ppp'); d.dataset.k = pi;
      var baseR = Object.assign({}, P.r); mergeR(baseR, ch(p, 'endParaRPr'));
      var r0 = Object.assign({}, P.r), fr = runs.filter(function (r) { return r.localName !== 'br'; })[0]; if (fr) mergeR(r0, ch(fr, 'rPr'));
      var szPt = (+(hasText ? r0.sz : baseR.sz) || 1800) / 100 * scale, lh = P.lnSpc && P.lnSpc.pt ? P.lnSpc.pt * scale * 12700 * k + 'px' : String(+(1.2 * (P.lnSpc && P.lnSpc.pct != null ? P.lnSpc.pct : 1) * (1 - lnRed)).toFixed(3));
      var marL = pNum({ getAttribute: function () { return P.marL; } }, 'x', 0) * k, ind = pNum({ getAttribute: function () { return P.indent; } }, 'x', 0) * k;
      function spc(s) { if (!s) return 0; return s.pt != null ? s.pt * 12700 * k : s.pct * szPt * 1.2 * 12700 * k; }
      var css = 'margin:0;white-space:' + (body.wrap === 'none' ? 'pre' : 'pre-wrap') + ';padding-left:' + marL + 'px;text-align:' + ({ ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[P.algn] || 'left') + ';line-height:' + lh + ';font-size:' + (szPt * 12700 * k) + 'px;';
      if (!first) css += 'margin-top:' + spc(P.spcBef) + 'px;';
      css += 'margin-bottom:' + spc(P.spcAft) + 'px;';
      if (!P.bu || !hasText) css += 'text-indent:' + (ind < 0 && !P.bu ? 0 : ind) + 'px;';
      d.style.cssText = css;
      first = false;
      if (P.bu && hasText) {
        var lab;
        if (P.bu.num) { var key = lvl + ':' + P.bu.num; cnt[key] = (cnt[key] || P.bu.start - 1) + 1; Object.keys(cnt).forEach(function (q) { if (+q.split(':')[0] > lvl) delete cnt[q]; }); lab = autoNum(P.bu.num, cnt[key]); }
        else lab = P.bu.ch;
        var bc = P.buClr ? pClr(C, P.buClr) : null, rcol = r0.fill && r0.fill !== 'none' ? rClr(C, r0.fill) : null, bsz = P.buPts ? P.buPts * 12700 * k : szPt * (P.buSz || 1) * 12700 * k;
        var bf = P.buFont && !/wingdings|symbol/i.test(P.buFont) ? fontCss(C, P.buFont) : fontCss(C, r0.font);
        if (P.buFont && /wingdings/i.test(P.buFont)) lab = { '§': '▪', 'Ø': '➢', 'ü': '✓', 'q': '❑', 'v': '❖', 'n': '■', 'l': '●', 'Ÿ': '•' }[lab] || '•';
        if (P.buFont && /symbol/i.test(P.buFont)) lab = { '·': '•', '§': '♣', 'Þ': '⇒' }[lab] || '•';
        var w0 = Math.max(-ind, szPt * 12700 * k * 0.6);
        var bs = pEl('span', 'bu', 'display:inline-block;width:' + w0 + 'px;margin-left:' + (-w0) + 'px;font-size:' + bsz + 'px;font-family:' + bf + ';color:' + cssC(bc || rcol || opt.color || hex2c(C.th.clr[C.map.tx1] || '000000')) + ';text-indent:0;white-space:pre;user-select:none;');
        bs.textContent = lab; bs.contentEditable = 'false';
        if (ind >= 0) { bs.style.marginLeft = '0'; bs.style.width = 'auto'; bs.style.marginRight = '0.4em'; }
        d.appendChild(bs);
      }
      runs.forEach(function (r) {
        if (r.localName === 'br') { d.appendChild(D.createElement('br')); return; }
        var R = Object.assign({}, P.r); mergeR(R, ch(r, 'rPr'));
        var t = ch(r, 't'), txt = t ? t.textContent : '';
        if (r.localName === 'fld' && /slidenum/i.test(r.getAttribute('type') || '')) txt = String(C.n);
        if (!txt) return;
        if (R.cap === 'all') txt = txt.toUpperCase();
        var col = R.fill === 'none' ? null : R.fill ? rClr(C, R.fill) : hex2c(C.th.clr[C.map.tx1] || '000000');
        var fs = (+R.sz || 1800) / 100 * scale * 12700 * k, s = pEl('span', null, 'font-size:' + fs + 'px;font-family:' + fontCss(C, R.font) + ';color:' + cssC(col) + ';' + (pOn({ getAttribute: function () { return R.b; } }, 'x') ? 'font-weight:700;' : '') + (pOn({ getAttribute: function () { return R.i; } }, 'x') ? 'font-style:italic;' : '') +
          ((R.u && R.u !== 'none') || (R.strike && R.strike !== 'noStrike') ? 'text-decoration:' + (R.u && R.u !== 'none' ? 'underline ' : '') + (R.strike && R.strike !== 'noStrike' ? 'line-through' : '') + ';' : '') + (R.spc ? 'letter-spacing:' + (+R.spc / 100 * 12700 * k) + 'px;' : '') +
          (R.baseline && +R.baseline ? 'vertical-align:' + (+R.baseline > 0 ? 'super' : 'sub') + ';font-size:' + fs * 0.65 + 'px;' : '') + (R.hl ? 'background:' + cssC(pClr(C, R.hl)) + ';' : ''));
        s.textContent = txt; d.appendChild(s);
      });
      if (!d.childNodes.length) { d.appendChild(D.createElement('br')); }
      box.appendChild(d); out.push(d);
    });
    return out;
  }

  /* ---------- vormen tekenen */
  function svgE(n, at) { var e = D.createElementNS(SVGNS_P, n); for (var k in at) if (at[k] != null) e.setAttribute(k, at[k]); return e; }
  async function pptShape(C, host, sp, T, rels, kind, reg, grpFill) {
    var nv = ch(sp, 'nvSpPr') || ch(sp, 'nvCxnSpPr') || ch(sp, 'nvPicPr'), cNv = nv && ch(nv, 'cNvPr');
    if (cNv && pOn(cNv, 'hidden')) return;
    var info = sp.localName === 'sp' ? textChain(C, sp, kind) : { chain: [], ph: null };
    var xf = xfrmOf(sp);
    if (!xf && info.ph) { for (var i = info.chain.length - 2; i >= 0 && !xf; i--) if (info.chain[i].sp) xf = xfrmOf(info.chain[i].sp); }
    if (!xf) return;
    var k = C.k, x = (T.ox + (xf.x - T.cx) * T.sx) * k, y = (T.oy + (xf.y - T.cy) * T.sy) * k, w = Math.max(xf.w * T.sx * k, 0), h = Math.max(xf.h * T.sy * k, 0);
    var spPr = ch(sp, 'spPr'), style = ch(sp, 'style');
    var phSpPr = null; if (info.ph) for (i = info.chain.length - 2; i >= 0; i--) if (info.chain[i].sp && ch(info.chain[i].sp, 'spPr') && fillChild(ch(info.chain[i].sp, 'spPr'))) { phSpPr = ch(info.chain[i].sp, 'spPr'); break; }
    var geomEl = spPr && (ch(spPr, 'prstGeom') || ch(spPr, 'custGeom'));
    var G = pptGeom(geomEl, w || 1, h || 1);
    var fill = await pptFill(C, fillChild(spPr) ? spPr : phSpPr || spPr, style, rels, grpFill), line = pptLine(C, spPr, style);
    if (sp.localName === 'cxnSp' || G.line) fill = null;
    var wrap = pEl('div', 'psh', 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (xf.rot ? 'transform:rotate(' + xf.rot + 'deg);' : ''));
    if ((fill && !fill.none) || line) {
      var pad = line ? line.w * 2 + 6 : 0, svg = svgE('svg', { width: w + 2 * pad, height: h + 2 * pad, viewBox: (-pad) + ' ' + (-pad) + ' ' + (w + 2 * pad) + ' ' + (h + 2 * pad) });
      svg.style.cssText = 'position:absolute;left:' + (-pad) + 'px;top:' + (-pad) + 'px;overflow:visible;' + (xf.fh || xf.fv ? 'transform:scale(' + (xf.fh ? -1 : 1) + ',' + (xf.fv ? -1 : 1) + ');' : '');
      var defs = svgE('defs', {}), id = 'g' + Math.random().toString(36).slice(2, 9), fillAttr = 'none';
      if (fill && fill.img) { var pat = svgE('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: w, height: h }); pat.appendChild(svgE('image', { href: fill.img, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none' })); defs.appendChild(pat); fillAttr = 'url(#' + id + ')'; }
      else if (fill && fill.grad) {
        var gr = fill.radial ? svgE('radialGradient', { id: id }) : (function () { var an = fill.ang * Math.PI / 180, cx2 = Math.cos(an) / 2, cy2 = Math.sin(an) / 2; return svgE('linearGradient', { id: id, x1: 0.5 - cx2, y1: 0.5 - cy2, x2: 0.5 + cx2, y2: 0.5 + cy2 }); })();
        fill.grad.forEach(function (g) { gr.appendChild(svgE('stop', { offset: g.p + '%', 'stop-color': cssC(Object.assign({}, g.c, { a: 1 })), 'stop-opacity': g.c.a })); });
        defs.appendChild(gr); fillAttr = 'url(#' + id + ')';
      } else if (fill && fill.c) fillAttr = cssC(fill.c);
      svg.appendChild(defs);
      var path = svgE('path', { d: G.d, fill: fillAttr, 'fill-rule': G.evenodd ? 'evenodd' : null });
      if (line) {
        path.setAttribute('stroke', cssC(line.c)); path.setAttribute('stroke-width', line.w);
        var dl = { dash: [4, 3], sysDash: [3, 1], dot: [1, 1], sysDot: [1, 1], lgDash: [8, 3], dashDot: [4, 3, 1, 3], lgDashDot: [8, 3, 1, 3] }[line.dash];
        if (dl) path.setAttribute('stroke-dasharray', dl.map(function (v) { return v * line.w; }).join(' '));
        ['head', 'tail'].forEach(function (end) {
          var e = line[end]; if (!e || !e.getAttribute('type') || e.getAttribute('type') === 'none') return;
          var mid = id + end, sz = { sm: 2, med: 3, lg: 5 }, mw = sz[e.getAttribute('w') || 'med'] || 3, ml = sz[e.getAttribute('len') || 'med'] || 3;
          var mk = svgE('marker', { id: mid, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: ml, markerHeight: mw, orient: end === 'tail' ? 'auto' : 'auto-start-reverse', markerUnits: 'strokeWidth' });
          mk.appendChild(svgE('path', { d: e.getAttribute('type') === 'oval' ? 'M5,1 A4,4 0 1 1 5,9 A4,4 0 1 1 5,1 Z' : e.getAttribute('type') === 'diamond' ? 'M0,5 L5,0 L10,5 L5,10 Z' : 'M0,0 L10,5 L0,10 Z', fill: cssC(line.c) }));
          defs.appendChild(mk); path.setAttribute(end === 'tail' ? 'marker-end' : 'marker-start', 'url(#' + mid + ')');
        });
      }
      svg.appendChild(path); wrap.appendChild(svg);
    }
    var tb = ch(sp, 'txBody');
    if (tb && sp.localName === 'sp') {
      var fontRef = style && ch(style, 'fontRef'), fr = null;
      if (fontRef) { var fc = kids(fontRef).filter(function (c) { return CLRS.indexOf(c.localName) >= 0; })[0]; fr = { font: fontRef.getAttribute('idx') === 'major' ? '+mj-lt' : '+mn-lt', fill: fc ? { children: [fc], localName: 'solidFill' } : null }; }
      var box = pEl('div', 'ptx');
      var ps = pptText(C, box, tb, info, { w: w, h: h, tr: G.tr, fontRef: fr });
      if (ps.length) {
        wrap.appendChild(box);
        if (reg && kind === 'slide') { box.contentEditable = 'true'; box.spellcheck = true; box.style.outline = 'none'; box.classList.add('pptb'); reg.push({ tb: tb, box: box }); }
      }
    }
    host.appendChild(wrap);
  }
  async function pptPic(C, host, pic, T, rels, xfOver) {
    var nv = ch(pic, 'nvPicPr'), cNv = nv && ch(nv, 'cNvPr'); if (cNv && pOn(cNv, 'hidden')) return;
    var xf = xfOver || xfrmOf(pic); if (!xf) return;
    var k = C.k, x = (T.ox + (xf.x - T.cx) * T.sx) * k, y = (T.oy + (xf.y - T.cy) * T.sy) * k, w = xf.w * T.sx * k, h = xf.h * T.sy * k;
    var bf = ch(pic, 'blipFill'), bl = bf && ch(bf, 'blip'), url = bl ? await pptImg(C, rels, bl.getAttribute('r:embed')) : null;
    var sr = bf && ch(bf, 'srcRect'), l = pNum(sr, 'l', 0) / 100000, t = pNum(sr, 't', 0) / 100000, r = pNum(sr, 'r', 0) / 100000, b = pNum(sr, 'b', 0) / 100000;
    var geomEl = ch(ch(pic, 'spPr'), 'prstGeom'), prst = geomEl && geomEl.getAttribute('prst');
    var wrap = pEl('div', 'ppic', 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;overflow:hidden;' + (xf.rot ? 'transform:rotate(' + xf.rot + 'deg);' : '') + (prst === 'ellipse' ? 'border-radius:50%;' : prst === 'roundRect' ? 'border-radius:' + Math.min(w, h) * 0.16 + 'px;' : ''));
    if (url) {
      var iw = w / Math.max(0.01, 1 - l - r), ih = h / Math.max(0.01, 1 - t - b), im = pEl('img', null, 'position:absolute;left:' + (-l * iw) + 'px;top:' + (-t * ih) + 'px;width:' + iw + 'px;height:' + ih + 'px;max-width:none;' + (xf.fh || xf.fv ? 'transform:scale(' + (xf.fh ? -1 : 1) + ',' + (xf.fv ? -1 : 1) + ');' : ''));
      im.src = url; im.alt = ''; wrap.appendChild(im);
    }
    var line = pptLine(C, ch(pic, 'spPr'), ch(pic, 'style'));
    if (line) wrap.style.boxShadow = 'inset 0 0 0 ' + line.w + 'px ' + cssC(line.c);
    host.appendChild(wrap);
  }
  /* tabelstijlen: ingebouwde 'Medium Style 2' (standaard in PowerPoint) per accentkleur, of uit tableStyles.xml */
  var TBL_BUILTIN = { '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': 'accent1', '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}': 'accent2', '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}': 'accent3', '{00A15C55-8517-42AA-B614-E9B94910E393}': 'accent4', '{7DF18680-E054-41AD-8BC1-D1AEF772440D}': 'accent5', '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}': 'accent6', '{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}': 'dk1', '{2D5ABB26-0587-4C30-8999-92F81FD0307C}': 'none', '{5940675A-B579-460E-94D1-54222C63F5DA}': 'grid' };
  function tblStyle(C, id) {
    var st = C.deck.tblStyles && desc(C.deck.tblStyles, 'tblStyle').filter(function (s) { return s.getAttribute('styleId') === id; })[0];
    function part(n) {
      if (!st) return null; var p = ch(st, n); if (!p) return null;
      var tc = ch(p, 'tcStyle'), tx = ch(p, 'tcTxStyle'), f = tc && ch(tc, 'fill'), sf = f && ch(f, 'solidFill'), bd = tc && ch(tc, 'tcBdr');
      var bdr = {}; kids(bd).forEach(function (e) { var ln = ch(e, 'ln'), lf = ln && ch(ln, 'solidFill'); if (lf) bdr[e.localName] = { c: pClr(C, lf), w: pNum(ln, 'w', 12700) * C.k }; else if (ln && ch(ln, 'noFill')) bdr[e.localName] = null; });
      return { fill: sf ? pClr(C, sf) : null, b: tx && tx.getAttribute('b') === 'on', color: tx ? pClr(C, tx) : null, bdr: bdr };
    }
    if (st) return { whole: part('wholeTbl'), band1H: part('band1H'), band2H: part('band2H'), band1V: part('band1V'), firstRow: part('firstRow'), lastRow: part('lastRow'), firstCol: part('firstCol'), lastCol: part('lastCol') };
    var acc = TBL_BUILTIN[id] || (id ? 'grid' : 'accent1');
    if (acc === 'none') return {};
    var tx1 = hex2c(C.th.clr[C.map.tx1] || '000000'), lt = hex2c(C.th.clr.lt1 || 'FFFFFF');
    if (acc === 'grid') { var gb = { c: tx1, w: Math.max(0.6, 12700 * C.k) }; return { whole: { bdr: { left: gb, right: gb, top: gb, bottom: gb, insideH: gb, insideV: gb } }, firstRow: { b: true } }; }
    var base = hex2c(C.th.clr[acc] || C.th.clr.accent1 || '4472C4'), tint = function (v) { return { r: Math.round(base.r * v + 255 * (1 - v)), g: Math.round(base.g * v + 255 * (1 - v)), b: Math.round(base.b * v + 255 * (1 - v)), a: 1 }; };
    var wb = { c: lt, w: Math.max(0.6, 12700 * C.k) };
    return { whole: { fill: tint(0.2), color: tx1, bdr: { left: wb, right: wb, top: wb, bottom: wb, insideH: wb, insideV: wb } }, band1H: { fill: tint(0.4) }, band1V: { fill: tint(0.4) }, firstRow: { fill: base, b: true, color: lt, bdr: { bottom: { c: lt, w: Math.max(1, 38100 * C.k) } } }, lastRow: { fill: base, b: true, color: lt, bdr: { top: { c: lt, w: Math.max(1, 38100 * C.k) } } }, firstCol: { fill: base, b: true, color: lt }, lastCol: { fill: base, b: true, color: lt } };
  }
  async function pptTable(C, host, gf, tbl, box, rels) {
    var k = C.k, tp = ch(tbl, 'tblPr'), sid = tp && (ch(tp, 'tableStyleId') || {}).textContent, S = tblStyle(C, sid);
    var on = function (n) { return pOn(tp, n); }, cols = chs(ch(tbl, 'tblGrid'), 'gridCol').map(function (g) { return pNum(g, 'w', 0) * k; }), rows = chs(tbl, 'tr');
    var t = pEl('table', null, 'position:absolute;left:' + box.x + 'px;top:' + box.y + 'px;width:' + cols.reduce(function (a, b) { return a + b; }, 0) + 'px;border-collapse:collapse;table-layout:fixed;');
    var cg = pEl('colgroup'); cols.forEach(function (cw) { cg.appendChild(pEl('col', null, 'width:' + cw + 'px')); }); t.appendChild(cg);
    var info = { chain: [{ lst: C.deck.defStyle }, { lst: C.mas && desc(desc(C.mas.x, 'txStyles')[0], 'otherStyle')[0] }], ph: null };
    rows.forEach(function (tr, ri) {
      var row = pEl('tr', null, 'height:' + pNum(tr, 'h', 0) * k + 'px'), cells = chs(tr, 'tc');
      cells.forEach(function (tc, ci) {
        if (pOn(tc, 'hMerge') || pOn(tc, 'vMerge')) return;
        var parts = [S.whole];
        var isFirst = on('firstRow') && ri === 0, isLast = on('lastRow') && ri === rows.length - 1, bodyRow = ri - (on('firstRow') ? 1 : 0);
        if (on('bandRow') && !isFirst && !isLast) parts.push(bodyRow % 2 === 0 ? S.band1H : S.band2H);
        if (on('bandCol')) parts.push(ci % 2 === 0 ? S.band1V : null);
        if (on('firstCol') && ci === 0) parts.push(S.firstCol); if (on('lastCol') && ci === cells.length - 1) parts.push(S.lastCol);
        if (isFirst) parts.push(S.firstRow); if (isLast) parts.push(S.lastRow);
        var fillc = null, bold = false, color = null, bdr = {};
        parts.forEach(function (p) { if (!p) return; if (p.fill) fillc = p.fill; if (p.b) bold = true; if (p.color) color = p.color; for (var q in p.bdr) bdr[q] = p.bdr[q]; });
        var tcPr = ch(tc, 'tcPr'), own = tcPr && fillChild(tcPr);
        if (own) { if (own.localName === 'noFill') fillc = null; else if (own.localName === 'solidFill') fillc = pClr(C, own) || fillc; }
        ['lnL', 'lnR', 'lnT', 'lnB'].forEach(function (n) { var ln = tcPr && ch(tcPr, n); if (!ln) return; var sf = ch(ln, 'solidFill'); bdr[{ lnL: 'left', lnR: 'right', lnT: 'top', lnB: 'bottom' }[n]] = sf ? { c: pClr(C, sf), w: pNum(ln, 'w', 12700) * k } : null; });
        function bcss(side, inner) { var b = bdr[side] || bdr[inner]; return b ? b.w + 'px solid ' + cssC(b.c) : 'none'; }
        var td = pEl('td', null, 'vertical-align:' + ({ ctr: 'middle', b: 'bottom' }[pAt(tcPr, 'anchor', 't')] || 'top') + ';padding:' + pNum(tcPr, 'marT', 45720) * k + 'px ' + pNum(tcPr, 'marR', 91440) * k + 'px ' + pNum(tcPr, 'marB', 45720) * k + 'px ' + pNum(tcPr, 'marL', 91440) * k + 'px;background:' + (fillc ? cssC(fillc) : 'transparent') + ';' +
          'border-left:' + bcss('left', ci ? 'insideV' : 'left') + ';border-right:' + bcss('right', ci < cells.length - 1 ? 'insideV' : 'right') + ';border-top:' + bcss('top', ri ? 'insideH' : 'top') + ';border-bottom:' + bcss('bottom', ri < rows.length - 1 ? 'insideH' : 'bottom') + ';overflow:hidden;');
        if (pNum(tc, 'gridSpan', 1) > 1) td.colSpan = pNum(tc, 'gridSpan', 1); if (pNum(tc, 'rowSpan', 1) > 1) td.rowSpan = pNum(tc, 'rowSpan', 1);
        var inner = pEl('div', null, 'position:relative;'), tb = ch(tc, 'txBody');
        pptText(C, inner, tb, info, { flow: 1, w: 0, h: 0, color: color, extraR: bold ? { getAttribute: function (n) { return n === 'b' ? '1' : null; }, children: [] } : null });
        td.appendChild(inner); row.appendChild(td);
      });
      t.appendChild(row);
    });
    host.appendChild(t);
  }
  /* eenvoudige grafieken uit de opgeslagen gegevens */
  async function pptChart(C, host, path, box) {
    var p = await pptPart(C.deck, path); if (!p) return false;
    var x = p.x, pa = desc(x, 'plotArea')[0]; if (!pa) return false;
    var ct = kids(pa).filter(function (e) { return /Chart$/.test(e.localName); })[0]; if (!ct) return false;
    var type = ct.localName, k = C.k, W2 = box.w, H2 = box.h;
    function cache(e) { var pts = desc(e, 'pt'); var o = []; pts.forEach(function (pt) { o[pNum(pt, 'idx', 0)] = (ch(pt, 'v') || {}).textContent; }); return o; }
    var sers = desc(ct, 'ser').map(function (s, i) { var sp = ch(s, 'spPr'), sf = sp && ch(sp, 'solidFill'), lnf = sp && ch(ch(sp, 'ln'), 'solidFill'), tx = ch(s, 'tx'), cat = ch(s, 'cat') || ch(s, 'xVal'), val = ch(s, 'val') || ch(s, 'yVal'); return { name: (tx && cache(tx)[0]) || 'Reeks ' + (i + 1), cat: cat ? cache(cat) : [], val: val ? cache(val).map(Number) : [], col: sf ? pClr(C, sf) : lnf && /line/i.test(type) ? pClr(C, lnf) : hex2c(C.th.clr['accent' + ((i % 6) + 1)] || '4472C4'), pts: desc(s, 'dPt') }; });
    if (!sers.length) return false;
    var svg = svgE('svg', { width: W2, height: H2, viewBox: '0 0 ' + W2 + ' ' + H2 }); svg.style.cssText = 'position:absolute;left:' + box.x + 'px;top:' + box.y + 'px;overflow:visible;font-family:' + fontCss(C, '+mn-lt');
    var dsz = desc(ch(x.documentElement, 'txPr'), 'defRPr')[0], fs = Math.max(7, pNum(dsz, 'sz', 1800) / 100 * 12700 * k), tcol = cssC(hex2c(C.th.clr[C.map.tx1] || '000000')), gcol = '#d9d9d9';
    var titleEl = ch(desc(x, 'chart')[0], 'title'), auto = desc(x, 'autoTitleDeleted')[0], tt = titleEl ? desc(titleEl, 't').map(function (t) { return t.textContent; }).join('') : '';
    if (!tt && sers.length === 1 && (titleEl || !(auto && pOn(auto, 'val')))) tt = sers[0].name; /* PowerPoint toont dan de reeksnaam als titel */
    var top = 6; if (tt && !(auto && pOn(auto, 'val'))) { var te = svgE('text', { x: W2 / 2, y: fs * 1.5, 'text-anchor': 'middle', 'font-size': fs * 1.35, fill: tcol }); te.textContent = tt; svg.appendChild(te); top = fs * 2.4; }
    var leg = desc(x, 'legend')[0], lpos = leg ? pAt(ch(leg, 'legendPos'), 'val', 'r') : '', legH = leg && (lpos === 'b' || lpos === 't') ? fs * 2 : 0, legW = 0, cats = sers[0].cat.length ? sers[0].cat : sers[0].val.map(function (v, i) { return String(i + 1); });
    var pie = /^(pie|doughnut|pie3D)Chart$/.test(type);
    var legItems = pie ? cats.map(function (c, i) { return { t: c, c: hex2c(C.th.clr['accent' + ((i % 6) + 1)] || '4472C4') }; }) : sers.map(function (s2) { return { t: s2.name, c: s2.col }; });
    if (leg && (lpos === 'r' || lpos === 'l' || lpos === 'tr')) legW = Math.min(W2 * 0.35, fs * 1.6 + fs * 0.55 * Math.max.apply(null, legItems.map(function (it) { return String(it.t).length; }).concat([4])));
    if (lpos === 't') top += legH;
    function drawLegend() {
      if (!leg || !legItems.length) return;
      if (legW) { var lx0 = lpos === 'l' ? 4 : W2 - legW + fs * 0.4, ly0 = top + (H2 - top - legItems.length * fs * 1.5) / 2;
        legItems.forEach(function (it, i) { var ly = ly0 + i * fs * 1.5; svg.appendChild(svgE('rect', { x: lx0, y: ly, width: fs * 0.7, height: fs * 0.7, fill: cssC(it.c) })); var t = svgE('text', { x: lx0 + fs, y: ly + fs * 0.7, 'font-size': fs, fill: tcol }); t.textContent = it.t; svg.appendChild(t); }); return; }
      var tw = legItems.reduce(function (a, it) { return a + fs * 1.6 + String(it.t).length * fs * 0.55; }, 0), lx = Math.max(4, (W2 - tw) / 2), ly = lpos === 't' ? top - legH + fs * 1.3 : H2 - fs * 0.5;
      legItems.forEach(function (it) { svg.appendChild(svgE('rect', { x: lx, y: ly - fs * 0.7, width: fs * 0.7, height: fs * 0.7, fill: cssC(it.c) })); var t = svgE('text', { x: lx + fs, y: ly, 'font-size': fs, fill: tcol }); t.textContent = it.t; svg.appendChild(t); lx += fs * 1.6 + String(it.t).length * fs * 0.55; });
    }
    if (pie) {
      var s0 = sers[0], tot = s0.val.reduce(function (a, b) { return a + (b > 0 ? b : 0); }, 0) || 1, cx = (lpos === 'l' ? legW : 0) + (W2 - legW) / 2, cy = top + (H2 - top - legH) / 2, r = Math.min(W2 - legW, H2 - top - legH) / 2 * 0.9, a0 = -Math.PI / 2, hole = type === 'doughnutChart' ? r * 0.5 : 0;
      s0.val.forEach(function (v, i) {
        if (!(v > 0)) return; var a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, colr = hex2c(C.th.clr['accent' + ((i % 6) + 1)] || '4472C4');
        var dp = s0.pts.filter(function (d) { return pNum(ch(d, 'idx'), 'val', -1) === i; })[0], df = dp && desc(dp, 'solidFill')[0]; if (df) colr = pClr(C, df) || colr;
        var d = 'M' + (cx + r * Math.cos(a0)) + ',' + (cy + r * Math.sin(a0)) + ' A' + r + ',' + r + ' 0 ' + big + ' 1 ' + (cx + r * Math.cos(a1)) + ',' + (cy + r * Math.sin(a1)) + (hole ? ' L' + (cx + hole * Math.cos(a1)) + ',' + (cy + hole * Math.sin(a1)) + ' A' + hole + ',' + hole + ' 0 ' + big + ' 0 ' + (cx + hole * Math.cos(a0)) + ',' + (cy + hole * Math.sin(a0)) + ' Z' : ' L' + cx + ',' + cy + ' Z');
        svg.appendChild(svgE('path', { d: d, fill: cssC(colr), stroke: '#fff', 'stroke-width': 1 })); a0 = a1;
      });
      drawLegend(); host.appendChild(svg); return true;
    }
    var horiz = type === 'barChart' && pAt(ch(ct, 'barDir'), 'val', 'col') === 'bar', grouping = pAt(ch(ct, 'grouping'), 'val', 'clustered'), stacked = /stacked/i.test(grouping), pct = grouping === 'percentStacked';
    var n = cats.length, vals = [], mx = 0, mn = 0;
    for (var ci = 0; ci < n; ci++) { var pos = 0, neg = 0; sers.forEach(function (s) { var v = +s.val[ci] || 0; if (stacked) { if (v >= 0) pos += v; else neg += v; } else { mx = Math.max(mx, v); mn = Math.min(mn, v); } }); if (stacked) { mx = Math.max(mx, pct ? 1 : pos); mn = Math.min(mn, neg); } }
    if (pct) { mx = 1; mn = 0; }
    var step = Math.pow(10, Math.floor(Math.log10((mx - mn) || 1))), span = (mx - mn) || 1; if (span / step < 3) step /= 2; if (span / step > 8) step *= 2;
    var mx0 = mx; mx = Math.ceil(mx / step) * step; if (!pct && mx - mx0 < (mx - mn) * 0.05) mx += step; mn = Math.floor(mn / step) * step; if (mx === mn) mx = mn + step;
    var labW = fs * Math.max(2.5, String(Math.round(mx)).length * 0.6 + 1), L = horiz ? Math.min(W2 * 0.3, fs * 8) : labW, R = 10 + (lpos !== 'l' ? legW : 0), Tt = top + fs * 0.5, B = (lpos === 't' ? 0 : legH) + fs * 2.2, pw = W2 - L - R - (lpos === 'l' ? legW : 0), ph = H2 - Tt - B;
    if (lpos === 'l') L += legW;
    for (var tv = mn; tv <= mx + step / 2; tv += step) {
      var f = (tv - mn) / (mx - mn), lbl = pct ? Math.round(tv * 100) + '%' : (+tv.toFixed(6)).toLocaleString('nl-NL');
      if (horiz) { var gx = L + f * pw; svg.appendChild(svgE('line', { x1: gx, y1: Tt, x2: gx, y2: Tt + ph, stroke: gcol })); var tx = svgE('text', { x: gx, y: Tt + ph + fs * 1.2, 'text-anchor': 'middle', 'font-size': fs, fill: tcol }); tx.textContent = lbl; svg.appendChild(tx); }
      else { var gy = Tt + ph - f * ph; svg.appendChild(svgE('line', { x1: L, y1: gy, x2: L + pw, y2: gy, stroke: gcol })); var ty = svgE('text', { x: L - 4, y: gy + fs * 0.35, 'text-anchor': 'end', 'font-size': fs, fill: tcol }); ty.textContent = lbl; svg.appendChild(ty); }
    }
    var band = (horiz ? ph : pw) / Math.max(1, n), Y = function (v) { return (v - mn) / (mx - mn); };
    cats.forEach(function (c, i) { var t2 = svgE('text', horiz ? { x: L - 4, y: Tt + band * (i + 0.5) + fs * 0.35, 'text-anchor': 'end', 'font-size': fs, fill: tcol } : { x: L + band * (i + 0.5), y: Tt + ph + fs * 1.2, 'text-anchor': 'middle', 'font-size': fs, fill: tcol }); t2.textContent = c; svg.appendChild(t2); });
    if (type === 'barChart' || type === 'bar3DChart') {
      var gap = pNum(ch(ct, 'gapWidth'), 'val', 150) / 100, inner = band / (1 + gap), bw = stacked ? inner : inner / sers.length;
      for (var i = 0; i < n; i++) {
        var accP = 0, accN = 0, tot2 = pct ? sers.reduce(function (a, s) { return a + Math.abs(+s.val[i] || 0); }, 0) || 1 : 1;
        sers.forEach(function (s, si) {
          var v = (+s.val[i] || 0) / tot2, a, b2;
          if (stacked) { if (v >= 0) { a = accP; b2 = accP + v; accP = b2; } else { a = accN + v; b2 = accN; accN = a; } } else { a = Math.min(0, v); b2 = Math.max(0, v); }
          var o = band * i + (band - inner) / 2 + (stacked ? 0 : si * bw);
          var rect = horiz ? { x: L + Y(Math.max(a, mn)) * pw, y: Tt + o, width: Math.max(0, (Y(b2) - Y(Math.max(a, mn))) * pw), height: bw } : { x: L + o, y: Tt + ph - Y(b2) * ph, width: bw, height: Math.max(0, (Y(b2) - Y(Math.max(a, mn))) * ph) };
          rect.fill = cssC(s.col); svg.appendChild(svgE('rect', rect));
        });
      }
    } else {
      sers.forEach(function (s) {
        var pts = s.val.map(function (v, i) { return [L + band * (i + 0.5), Tt + ph - Y(+v || 0) * ph]; });
        if (/area/i.test(type)) svg.appendChild(svgE('path', { d: 'M' + pts[0][0] + ',' + (Tt + ph - Y(Math.max(0, mn)) * ph) + ' L' + pts.map(function (p) { return p.join(','); }).join(' L') + ' L' + pts[pts.length - 1][0] + ',' + (Tt + ph - Y(Math.max(0, mn)) * ph) + ' Z', fill: cssC(s.col), opacity: 0.85 }));
        else { svg.appendChild(svgE('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: cssC(s.col), 'stroke-width': Math.max(1.5, 28575 * k) })); pts.forEach(function (p) { svg.appendChild(svgE('circle', { cx: p[0], cy: p[1], r: Math.max(2, 3 * k * 12700 / 12700), fill: cssC(s.col) })); }); }
      });
    }
    svg.appendChild(svgE('line', horiz ? { x1: L, y1: Tt, x2: L, y2: Tt + ph, stroke: '#bfbfbf' } : { x1: L, y1: Tt + ph - Y(Math.max(0, mn)) * ph, x2: L + pw, y2: Tt + ph - Y(Math.max(0, mn)) * ph, stroke: '#bfbfbf' }));
    drawLegend(); host.appendChild(svg); return true;
  }
  async function pptGraphicFrame(C, host, gf, T, rels, kind, reg) {
    var xf = xfrmOf(gf); if (!xf) return;
    var k = C.k, box = { x: (T.ox + (xf.x - T.cx) * T.sx) * k, y: (T.oy + (xf.y - T.cy) * T.sy) * k, w: xf.w * T.sx * k, h: xf.h * T.sy * k };
    var gd = desc(gf, 'graphicData')[0], uri = gd ? gd.getAttribute('uri') || '' : '';
    var tbl = desc(gd, 'tbl')[0]; if (tbl) return pptTable(C, host, gf, tbl, box, rels);
    if (/chart$/.test(uri)) { var cref = desc(gd, 'chart')[0], cp = cref && rels[cref.getAttribute('r:id')]; if (cp && await pptChart(C, host, cp, box)) return; }
    if (/diagram$/.test(uri)) {
      var ri = desc(gd, 'relIds')[0], dm = ri && rels[ri.getAttribute('r:dm')], dp = dm && await pptPart(C.deck, dm), ext = dp && desc(dp.x, 'dataModelExt')[0], drw = ext && rels[ext.getAttribute('relId')];
      if (drw) { var dr = await pptPart(C.deck, drw); if (dr) { await pptTree(C, host, desc(dr.x, 'spTree')[0], { ox: xf.x, oy: xf.y, cx: 0, cy: 0, sx: 1, sy: 1 }, dr.rels, 'smartart', null); return; } }
    }
    var pic = desc(gd, 'pic')[0]; if (pic) { await pptPic(C, host, pic, T, rels, xfrmOf(pic) ? null : xf); return; } /* bijvoorbeeld een ingesloten object met voorbeeldafbeelding */
    if (/chart$|diagram$/.test(uri)) host.appendChild(pEl('div', null, 'position:absolute;left:' + box.x + 'px;top:' + box.y + 'px;width:' + box.w + 'px;height:' + box.h + 'px;border:1px dashed #bbb;background:#f7f7f7;'));
  }
  async function pptTree(C, host, tree, T, rels, kind, reg, grpFill) {
    var list = kids(tree);
    for (var i = 0; i < list.length; i++) {
      var el = list[i], l = el.localName;
      if (l === 'AlternateContent') { var fb = ch(el, 'Fallback') || ch(el, 'Choice'); if (fb) await pptTree(C, host, fb, T, rels, kind, reg, grpFill); continue; }
      if (kind !== 'slide' && kind !== 'smartart' && phInfo(el)) continue; /* tijdelijke aanduidingen van master en indeling zelf niet tekenen */
      try {
        if (l === 'sp' || l === 'cxnSp') await pptShape(C, host, el, T, rels, kind, reg, grpFill);
        else if (l === 'pic') await pptPic(C, host, el, T, rels);
        else if (l === 'graphicFrame') await pptGraphicFrame(C, host, el, T, rels, kind, reg);
        else if (l === 'grpSp') {
          var gx = ch(ch(el, 'grpSpPr'), 'xfrm'), o = ch(gx, 'off'), e = ch(gx, 'ext'), co = ch(gx, 'chOff'), ce = ch(gx, 'chExt');
          var cNv = desc(ch(el, 'nvGrpSpPr'), 'cNvPr')[0]; if (cNv && pOn(cNv, 'hidden')) continue;
          var gf = await pptFill(C, ch(el, 'grpSpPr'), null, rels, null);
          if (!o || !e) { await pptTree(C, host, el, T, rels, kind, reg, gf); continue; }
          var sx = pNum(ce, 'cx', 0) ? pNum(e, 'cx', 0) / pNum(ce, 'cx', 1) : 1, sy = pNum(ce, 'cy', 0) ? pNum(e, 'cy', 0) / pNum(ce, 'cy', 1) : 1;
          var T2 = { ox: T.ox + (pNum(o, 'x', 0) - T.cx) * T.sx, oy: T.oy + (pNum(o, 'y', 0) - T.cy) * T.sy, cx: pNum(co, 'x', 0), cy: pNum(co, 'y', 0), sx: T.sx * sx, sy: T.sy * sy };
          await pptTree(C, host, el, T2, rels, kind, reg, gf);
        }
      } catch (err) { console.warn('Dia-onderdeel niet getekend', err); }
    }
  }
  async function pptBg(C, el) {
    for (var p of [C.s, C.lay, C.mas]) {
      var bg = p && desc(desc(p.x, 'cSld')[0], 'bg')[0]; if (!bg) continue;
      var pr = ch(bg, 'bgPr'), ref = ch(bg, 'bgRef'), f = null;
      if (pr) f = await pptFillEl(C, fillChild(pr), null, p.rels);
      else if (ref) { var idx = pNum(ref, 'idx', 0), ph = pClr(C, ref), se = idx >= 1001 ? C.th.bg[idx - 1001] : C.th.fill[idx - 1]; f = se ? await pptFillEl(C, se, ph, p.rels) : ph ? { css: cssC(ph), c: ph } : null; }
      if (f && f.img) { el.style.backgroundImage = 'url("' + f.img + '")'; el.style.backgroundSize = f.tile ? 'auto' : '100% 100%'; return; }
      if (f && f.css) { el.style.background = f.css; return; }
      if (f && f.none) break;
    }
    el.style.background = cssC(hex2c(C.th.clr[C.map.bg1] || C.th.clr.lt1 || 'FFFFFF'));
  }
  /* Tekent dia i. opt.editable: tekstvakken van de dia zelf zijn bewerkbaar en worden in opt.reg vastgelegd. */
  async function pptxRenderSlide(deck, i, opt) {
    opt = opt || {};
    var C = await pptCtx(deck, i), Hpx = deck.SH * C.k;
    var el = pEl('div', 'pps', 'position:relative;width:' + PX_W + 'px;height:' + Hpx + 'px;overflow:hidden;font-kerning:normal;-webkit-font-smoothing:antialiased;');
    await pptBg(C, el);
    var T = { ox: 0, oy: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, cs = desc(C.s.x, 'cSld')[0], showM = pAt(C.s.x.documentElement, 'showMasterSp', '1') !== '0' && (!C.lay || pAt(C.lay.x.documentElement, 'showMasterSp', '1') !== '0');
    if (C.mas && showM) await pptTree(C, el, desc(C.mas.x, 'spTree')[0], T, C.mas.rels, 'master', null);
    if (C.lay) await pptTree(C, el, desc(C.lay.x, 'spTree')[0], T, C.lay.rels, 'layout', null);
    await pptTree(C, el, desc(cs, 'spTree')[0], T, C.s.rels, 'slide', opt.reg || null);
    el.dataset.w = PX_W; el.dataset.h = Hpx;
    return { el: el, w: PX_W, h: Hpx, hidden: C.s.x.documentElement.getAttribute('show') === '0', ctx: C };
  }

  /* ---------- PDF: elke dia als afbeelding, met onzichtbare tekst zodat zoeken en selecteren werkt */
  async function pptxToPdf(bytes) {
    var deck = await pptxLoad(bytes), ctx = await newDoc(), SWpt = deck.SW / 12700, SHpt = deck.SH / 12700;
    var stage = pEl('div', null, 'position:fixed;left:-20000px;top:0;width:' + PX_W + 'px;pointer-events:none;opacity:1;z-index:-1;');
    D.body.appendChild(stage);
    try {
      for (var i = 0; i < deck.slides.length; i++) {
        var r = await pptxRenderSlide(deck, i, {});
        if (r.hidden) continue;
        stage.textContent = ''; stage.appendChild(r.el);
        await pptImagesReady(r.el);
        var page = ctx.doc.addPage([SWpt, SHpt]), img = await pptRaster(r.el, r.w, r.h, 2);
        if (img) { var emb = await ctx.doc.embedJpg(img); page.drawImage(emb, { x: 0, y: 0, width: SWpt, height: SHpt }); }
        pptTextLayer(r.el, page, ctx.F.r, SWpt / r.w);
      }
      if (!ctx.doc.getPageCount()) { var pg = ctx.doc.addPage([SWpt, SHpt]); pg.drawText('Lege presentatie', { x: 30, y: SHpt / 2, size: 14, font: ctx.F.i }); }
    } finally { stage.remove(); }
    return ctx.doc.save();
  }
  function pptImagesReady(el) { return Promise.all(Array.prototype.map.call(el.querySelectorAll('img'), function (im) { return im.decode ? im.decode().catch(function () {}) : null; })); }
  async function pptRaster(el, w, h, scale) {
    var xml = new XMLSerializer().serializeToString(el);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w * scale + '" height="' + h * scale + '"><foreignObject x="0" y="0" width="' + w + '" height="' + h + '" transform="scale(' + scale + ')">' + xml + '</foreignObject></svg>';
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); /* een data-URL houdt het canvas exporteerbaar */
    try {
      var im = new Image(); im.src = url; await im.decode();
      var cv = D.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
      var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
      var b = await new Promise(function (res) { cv.toBlob(res, 'image/jpeg', 0.9); });
      return b ? new Uint8Array(await b.arrayBuffer()) : null;
    } catch (e) { console.warn('Dia niet als afbeelding getekend', e); return null; }
  }
  function pptTextLayer(el, page, font, f) {
    var base = el.getBoundingClientRect(), H = page.getHeight(), walker = D.createTreeWalker(el, NodeFilter.SHOW_TEXT), node, rng = D.createRange();
    while ((node = walker.nextNode())) {
      var par = node.parentElement; if (!par || par.classList.contains('bu')) continue;
      var txt = node.textContent, re = /\S+/g, m, size = parseFloat(getComputedStyle(par).fontSize) || 12;
      while ((m = re.exec(txt))) {
        rng.setStart(node, m.index); rng.setEnd(node, m.index + m[0].length);
        var rc = rng.getBoundingClientRect(); if (!rc.width) continue;
        var word = san(m[0]); if (!word.trim()) continue;
        var fs = size * f, tw = font.widthOfTextAtSize(word, fs) || 1, sx = (rc.width * f) / tw;
        try { page.drawText(word, { x: (rc.left - base.left) * f, y: H - (rc.bottom - base.top) * f + fs * 0.22, size: fs * Math.min(1.6, Math.max(0.5, sx)), font: font, opacity: 0 }); } catch (e) {}
      }
    }
  }
