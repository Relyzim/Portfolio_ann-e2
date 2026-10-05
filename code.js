/* =============================================
   AXEL ROYER — Portfolio BTS SIO SISR
   code.js — JavaScript pur, aucune dépendance
   ============================================= */

'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =============================================
   1. THÈME CLAIR / SOMBRE
   Suit le système par défaut, mémorise le choix manuel.
   ============================================= */
function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  const current = () => root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');

  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* stockage indisponible */ }
    };
    // Révélation circulaire depuis le bouton (navigateurs compatibles)
    if (document.startViewTransition && !reduceMotion) {
      const r = btn.getBoundingClientRect();
      root.style.setProperty('--vt-x', (r.left + r.width / 2) + 'px');
      root.style.setProperty('--vt-y', (r.top + r.height / 2) + 'px');
      document.startViewTransition(apply);
    } else {
      apply();
    }
  });
}

/* =============================================
   2. PANNEAU DE BRASSAGE — port actif
   La LED du port s'allume pour la section visible.
   ============================================= */
function initPorts() {
  const ports = [...document.querySelectorAll('.port')];
  const targets = ports
    .map(p => document.querySelector(p.getAttribute('href')))
    .filter(Boolean);

  const setActive = (id) => {
    ports.forEach(p => {
      const on = p.getAttribute('href') === '#' + id;
      p.classList.toggle('is-active', on);
      if (on) {
        p.setAttribute('aria-current', 'location');
        // Garde le port actif visible quand le panneau défile (mobile)
        const strip = p.closest('.ports');
        if (strip && strip.scrollWidth > strip.clientWidth) {
          const left = p.offsetLeft - strip.clientWidth / 2 + p.offsetWidth / 2;
          strip.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      } else {
        p.removeAttribute('aria-current');
      }
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  targets.forEach(t => observer.observe(t));

  // Dans le hero, aucun port n'est branché
  const hero = document.getElementById('top');
  if (hero) {
    new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(''); },
      { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  }
}

/* =============================================
   3. TOPOLOGIE RÉSEAU (hero)
   - Les liens se dessinent au chargement
   - Des paquets partent d'Internet vers chaque équipement
   - Survol d'un équipement : chemin mis en évidence + paquet
   - Clic : défilement vers le projet + surbrillance
   ============================================= */
const ROUTES = {
  exchange: ['internet-exchange'],
  cloudflare: ['internet-cloudflare'],
  pfsense: ['internet-pfsense'],
  debian: ['internet-pfsense', 'pfsense-switch', 'switch-debian'],
  winserver: ['internet-pfsense', 'pfsense-switch', 'switch-winserver'],
  nas: ['internet-pfsense', 'pfsense-switch', 'switch-nas'],
  postes: ['internet-pfsense', 'pfsense-switch', 'switch-postes'],
};

// Ordre d'apparition (en secondes)
const DRAW_ORDER = {
  'internet-pfsense': 0.35,
  'internet-exchange': 0.45,
  'internet-cloudflare': 0.45,
  'pfsense-switch': 0.75,
  'switch-debian': 1.05,
  'switch-winserver': 1.1,
  'switch-nas': 1.15,
  'switch-postes': 1.2,
};
const NODE_ORDER = {
  internet: 0.1, exchange: 0.75, cloudflare: 0.75, pfsense: 0.6, switch: 1.0,
  debian: 1.5, winserver: 1.55, nas: 1.6, postes: 1.65,
};

function initTopology() {
  const svg = document.getElementById('topoSvg');
  if (!svg) return;
  const packetLayer = document.getElementById('packets');
  const links = {};

  svg.querySelectorAll('.link').forEach(path => {
    const key = path.dataset.link;
    links[key] = path;
    const len = Math.ceil(path.getTotalLength());
    path.style.setProperty('--len', len);
    path.style.setProperty('--d', (DRAW_ORDER[key] || 0) + 's');
  });

  svg.querySelectorAll('.node').forEach(node => {
    node.style.setProperty('--d', (NODE_ORDER[node.dataset.node] || 0) + 's');
  });

  // Concatène les segments d'une route en une seule polyligne de points
  function routePoints(route) {
    const pts = [];
    route.forEach(key => {
      const path = links[key];
      if (!path) return;
      const len = path.getTotalLength();
      const steps = Math.max(8, Math.round(len / 6));
      for (let i = 0; i <= steps; i++) {
        const p = path.getPointAtLength((i / steps) * len);
        pts.push([p.x, p.y]);
      }
    });
    return pts;
  }

  function sendPacket(nodeKey, delay = 0) {
    if (reduceMotion || !ROUTES[nodeKey]) return;
    const pts = routePoints(ROUTES[nodeKey]);
    if (pts.length < 2) return;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'packet');
    dot.setAttribute('cx', pts[0][0]);
    dot.setAttribute('cy', pts[0][1]);
    packetLayer.appendChild(dot);

    const duration = 380 + pts.length * 9;
    const start = performance.now() + delay;

    function frame(now) {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const idx = Math.min(pts.length - 1, Math.floor(eased * (pts.length - 1)));
      dot.setAttribute('cx', pts[idx][0]);
      dot.setAttribute('cy', pts[idx][1]);
      dot.style.opacity = t > .9 ? String((1 - t) * 10) : '1';
      if (t < 1) requestAnimationFrame(frame);
      else dot.remove();
    }
    requestAnimationFrame(frame);
  }

  function highlight(nodeKey, on) {
    (ROUTES[nodeKey] || []).forEach(k => links[k] && links[k].classList.toggle('is-hot', on));
  }

  // Salve initiale, une seule fois
  if (!reduceMotion) {
    Object.keys(ROUTES).forEach((key, i) => sendPacket(key, 1900 + i * 140));
  }

  const readout = document.getElementById('topoReadout');
  const readoutDefault = readout ? readout.textContent : '';

  svg.querySelectorAll('a.node').forEach(node => {
    const key = node.dataset.node;
    const unit = document.getElementById(node.getAttribute('href').slice(1));
    const nodeName = node.querySelector('.node-name').textContent;
    let last = 0;
    const enter = () => {
      highlight(key, true);
      if (readout && unit) {
        const title = unit.querySelector('.unit-title').textContent.trim();
        const status = unit.querySelector('.unit-status span').textContent.trim().toLowerCase();
        readout.innerHTML = '';
        const b = document.createElement('b');
        b.textContent = nodeName;
        readout.append(b, ` : ${title}, ${status}`);
      }
      const now = Date.now();
      if (now - last > 700) { sendPacket(key); last = now; }
    };
    const leave = () => {
      highlight(key, false);
      if (readout) readout.textContent = readoutDefault;
    };
    node.addEventListener('mouseenter', enter);
    node.addEventListener('focus', enter);
    node.addEventListener('mouseleave', leave);
    node.addEventListener('blur', leave);
    node.addEventListener('click', (e) => {
      e.preventDefault();
      const id = node.getAttribute('href').slice(1);
      openSheet(id);
    });
  });
}

/* =============================================
   4. PROJETS — filtres + mise en évidence
   ============================================= */
function revealProject(id) {
  const unit = document.getElementById(id);
  if (!unit) return;
  // Si un filtre masque le projet, on revient sur « Tous »
  if (unit.hidden) applyFilter('all');
  unit.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  unit.classList.remove('is-pinged');
  void unit.offsetWidth; // relance la transition
  unit.classList.add('is-pinged');
  setTimeout(() => unit.classList.remove('is-pinged'), 2200);
  history.replaceState(null, '', '#' + id);
}

function applyFilter(value) {
  const units = document.querySelectorAll('#rack .unit');
  let visible = 0;
  units.forEach(u => {
    const show = value === 'all' || u.dataset.context === value;
    u.hidden = !show;
    if (show) visible++;
  });
  document.querySelectorAll('.filter').forEach(b => {
    const on = b.dataset.filter === value;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const empty = document.getElementById('rackEmpty');
  if (empty) empty.hidden = visible > 0;
}

function initFilters() {
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });
}

/* =============================================
   5. MATRICE DES COMPÉTENCES (bloc 1)
   Construite à partir des attributs data-comp :
   ajoutez un projet dans le HTML, il apparaît ici.
   ============================================= */
function initMatrix() {
  const tbody = document.querySelector('#matrix tbody');
  if (!tbody) return;
  const totals = [0, 0, 0, 0, 0, 0];
  const GROUPS = [
    ['ecole', 'Réalisations en formation'],
    ['entreprise', 'Réalisations en entreprise (Riou Glass)'],
    ['perso', 'Projets personnels'],
  ];

  const addRow = (src, label, period, clickable) => {
    const comps = src.dataset.comp.split(',').map(n => parseInt(n, 10));
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    const a = document.createElement('a');
    a.href = '#' + src.id;
    a.textContent = label;
    if (clickable) a.addEventListener('click', (e) => { e.preventDefault(); openSheet(src.id); });
    td.appendChild(a);
    tr.appendChild(td);
    const tp = document.createElement('td');
    tp.className = 'period';
    tp.textContent = period || '';
    tr.appendChild(tp);
    for (let i = 1; i <= 6; i++) {
      const c = document.createElement('td');
      const has = comps.includes(i);
      if (has) totals[i - 1]++;
      c.innerHTML = has
        ? '<span class="tick" aria-hidden="true"></span><span class="sr-only">Oui</span>'
        : '<span class="no-tick" aria-hidden="true"></span><span class="sr-only">Non</span>';
      tr.appendChild(c);
    }
    tbody.appendChild(tr);
  };

  const addGroup = (title) => {
    const tr = document.createElement('tr');
    tr.className = 'matrix-group';
    const th = document.createElement('th');
    th.colSpan = 8;
    th.scope = 'colgroup';
    th.textContent = title;
    tr.appendChild(th);
    tbody.appendChild(tr);
  };

  GROUPS.forEach(([ctx, title]) => {
    const units = document.querySelectorAll(`#rack .unit[data-context="${ctx}"][data-comp]`);
    if (!units.length) return;
    addGroup(title);
    units.forEach(u => addRow(u, u.querySelector('.unit-title').textContent.trim(), u.dataset.period, true));
  });

  const extras = document.querySelectorAll('[data-matrix-label][data-comp]');
  if (extras.length) {
    addGroup('Développement professionnel');
    extras.forEach(x => addRow(x, x.dataset.matrixLabel, 'Continu', false));
  }

  const tfoot = document.createElement('tfoot');
  tfoot.innerHTML = '<tr><td colspan="2">Nombre de réalisations</td>' + totals.map(t => `<td>${t}</td>`).join('') + '</tr>';
  tbody.parentElement.appendChild(tfoot);

  // Indicateurs de la section Projets
  const kpis = document.getElementById('kpis');
  if (kpis) {
    const units = document.querySelectorAll('#rack .unit');
    const pro = document.querySelectorAll('#rack .unit[data-context="entreprise"]').length;
    const covered = totals.filter(t => t > 0).length;
    const docs = document.querySelectorAll('#files .file').length;
    const data = [
      ['Réalisations', units.length],
      ['En entreprise', pro],
      ['Compétences B1 couvertes', covered + '/6'],
      ['Documents', docs],
    ];
    kpis.innerHTML = data.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }
}

/* =============================================
   5 bis. FICHE PROJET (panneau latéral)
   Contenu lu dans l'article : titre, statut, tags,
   bloc .unit-detail, compétences (data-comp) et liens.
   ============================================= */
const B1 = {
  1: 'Gérer le patrimoine informatique',
  2: 'Répondre aux incidents et aux demandes d\'assistance et d\'évolution',
  3: 'Développer la présence en ligne de l\'organisation',
  4: 'Travailler en mode projet',
  5: 'Mettre à disposition des utilisateurs un service informatique',
  6: 'Organiser son développement professionnel',
};

let sheetIndex = -1;
let sheetOpener = null;

function visibleUnits() {
  return [...document.querySelectorAll('#rack .unit')];
}

function openSheet(id, opener) {
  const sheet = document.getElementById('sheet');
  const unit = document.getElementById(id);
  if (!sheet || !unit || typeof sheet.showModal !== 'function') {
    revealProject(id);
    return;
  }
  const units = visibleUnits();
  sheetIndex = units.indexOf(unit);

  const statusText = unit.querySelector('.unit-status span').textContent.trim();
  const statusEl = document.getElementById('sheetStatus');
  statusEl.innerHTML = '';
  const led = document.createElement('i');
  led.className = 'led ' + (unit.dataset.status === 'done' ? 'led-done' : 'led-wip');
  statusEl.append(led, statusText);

  document.getElementById('sheetContext').innerHTML = unit.querySelector('.unit-context').innerHTML;
  document.getElementById('sheetTitle').textContent = unit.querySelector('.unit-title').textContent;
  document.getElementById('sheetLead').textContent = unit.querySelector('.unit-desc').textContent;
  document.getElementById('sheetTags').innerHTML = unit.querySelector('.tags').innerHTML;

  const body = document.getElementById('sheetBody');
  body.innerHTML = '';
  const detail = unit.querySelector('.unit-detail');
  if (detail) {
    const clone = detail.cloneNode(true);
    // Dans la fiche, le titre est un h2 : les sous-titres deviennent des h3
    clone.querySelectorAll('h4').forEach(h4 => {
      const h3 = document.createElement('h3');
      h3.innerHTML = h4.innerHTML;
      h4.replaceWith(h3);
    });
    body.append(...clone.children);
  }

  const comp = document.getElementById('sheetComp');
  comp.innerHTML = '';
  (unit.dataset.comp || '').split(',').filter(Boolean).forEach(n => {
    const li = document.createElement('li');
    li.innerHTML = `<b>B1.${n}</b><span></span>`;
    li.querySelector('span').textContent = B1[n] || '';
    comp.appendChild(li);
  });

  const docs = document.getElementById('sheetDocs');
  docs.innerHTML = '';
  unit.querySelectorAll('.unit-links a').forEach(a => docs.appendChild(a.cloneNode(true)));
  document.getElementById('sheetDocsWrap').hidden = docs.children.length === 0;

  document.getElementById('sheetPrev').disabled = sheetIndex <= 0;
  document.getElementById('sheetNext').disabled = sheetIndex >= units.length - 1;

  sheet.querySelector('.sheet-scroll').scrollTop = 0;
  if (!sheet.open) {
    sheetOpener = opener || document.activeElement;
    sheet.showModal();
    document.body.style.overflow = 'hidden';
  }
  history.replaceState(null, '', '#fiche-' + id);
}

function initSheet() {
  const sheet = document.getElementById('sheet');
  if (!sheet) return;

  const linkBtn = document.getElementById('sheetLink');
  if (linkBtn) {
    linkBtn.addEventListener('click', async () => {
      const url = location.href.split('#')[0] + location.hash;
      try {
        await navigator.clipboard.writeText(url);
        linkBtn.textContent = 'Lien copié';
      } catch (e) {
        linkBtn.textContent = 'Copie impossible';
      }
      setTimeout(() => { linkBtn.textContent = 'Copier le lien'; }, 1800);
    });
  }

  const close = () => sheet.close();
  document.getElementById('sheetClose').addEventListener('click', close);
  // Clic sur le fond = fermeture
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  sheet.addEventListener('close', () => {
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname + location.search);
    if (sheetOpener && document.contains(sheetOpener)) sheetOpener.focus();
  });

  const step = (d) => {
    const units = visibleUnits();
    const next = units[sheetIndex + d];
    if (next) openSheet(next.id);
  };
  document.getElementById('sheetPrev').addEventListener('click', () => step(-1));
  document.getElementById('sheetNext').addEventListener('click', () => step(1));
  sheet.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  document.querySelectorAll('.btn-sheet').forEach(btn => {
    btn.addEventListener('click', () => openSheet(btn.dataset.open, btn));
  });

  // Lien direct vers une fiche : code.html#fiche-p-nas
  if (location.hash.startsWith('#fiche-')) {
    const id = location.hash.slice(7);
    if (document.getElementById(id)) setTimeout(() => openSheet(id), 300);
  }
}

/* =============================================
   5 ter. RECHERCHE RAPIDE (Ctrl K ou /)
   Index construit à partir de la page : sections,
   projets, compétences, documents, veille.
   ============================================= */
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function buildIndex() {
  const items = [];
  document.querySelectorAll('.port').forEach(p => {
    items.push({ group: 'Sections', title: p.querySelector('.port-label').textContent, sub: '', hint: 'Aller', run: () => goTo(p.getAttribute('href')) });
  });
  document.querySelectorAll('#rack .unit').forEach(u => {
    const tags = [...u.querySelectorAll('.tags li')].map(li => li.textContent).join(', ');
    const detail = u.querySelector('.unit-detail')?.textContent || '';
    items.push({
      group: 'Projets',
      title: u.querySelector('.unit-title').textContent,
      sub: tags,
      hint: u.querySelector('.unit-status span').textContent,
      extra: u.querySelector('.unit-desc').textContent + ' ' + detail,
      run: () => openSheet(u.id),
    });
  });
  document.querySelectorAll('.skill-group').forEach(g => {
    const cat = g.querySelector('h3').textContent;
    g.querySelectorAll('li').forEach(li => {
      items.push({ group: 'Compétences', title: li.textContent, sub: cat, hint: 'Compétence', run: () => goTo('#competences') });
    });
  });
  document.querySelectorAll('#files .file').forEach(f => {
    items.push({
      group: 'Documents',
      title: f.querySelector('.file-name').textContent,
      sub: f.querySelector('.file-meta').textContent,
      hint: f.querySelector('.file-type').textContent,
      run: () => {
        if (f.hasAttribute('data-viewer') && !window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) openViewer(f);
        else if (f.hasAttribute('download')) f.click();
        else window.open(f.href, '_blank', 'noopener');
      },
    });
  });
  document.querySelectorAll('.source').forEach(sr => {
    items.push({ group: 'Veille', title: sr.querySelector('.source-name').textContent, sub: sr.querySelector('.source-desc').textContent, hint: 'Site', run: () => window.open(sr.href, '_blank', 'noopener') });
  });
  items.push({ group: 'Actions', title: 'Copier mon adresse email', sub: CONTACT_EMAIL, hint: 'Copier', run: () => navigator.clipboard?.writeText(CONTACT_EMAIL) });
  items.push({ group: 'Actions', title: 'Version PDF du portfolio', sub: 'Imprimer ou enregistrer en PDF, fiches projet incluses', hint: 'PDF', run: printPortfolio });
  items.push({ group: 'Actions', title: 'Changer de thème', sub: 'Clair ou sombre', hint: 'Thème', run: () => document.getElementById('themeToggle').click() });
  items.forEach(i => { i.haystack = norm([i.title, i.sub, i.group, i.extra || ''].join(' ')); });
  return items;
}

function goTo(hash) {
  const el = document.querySelector(hash);
  if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
}

function initPalette() {
  const dlg = document.getElementById('palette');
  const input = document.getElementById('paletteInput');
  const list = document.getElementById('paletteList');
  const empty = document.getElementById('paletteEmpty');
  const btn = document.getElementById('searchBtn');
  if (!dlg || typeof dlg.showModal !== 'function') { if (btn) btn.hidden = true; return; }

  const index = buildIndex();
  let results = [];
  let sel = 0;

  function render() {
    const words = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    results = words.length
      ? index.filter(i => words.every(w => i.haystack.includes(w))).slice(0, 30)
      : index.filter(i => i.group === 'Sections' || i.group === 'Projets');
    sel = Math.min(sel, Math.max(0, results.length - 1));
    list.innerHTML = '';
    let group = '';
    results.forEach((r, n) => {
      if (r.group !== group) {
        group = r.group;
        const g = document.createElement('li');
        g.className = 'palette-group';
        g.setAttribute('role', 'presentation');
        g.textContent = group;
        list.appendChild(g);
      }
      const li = document.createElement('li');
      li.className = 'palette-item';
      li.id = 'pal-' + n;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(n === sel));
      li.innerHTML = '<span><span class="palette-item-title"></span><span class="palette-item-sub"></span></span><small></small>';
      li.querySelector('.palette-item-title').textContent = r.title;
      li.querySelector('.palette-item-sub').textContent = r.sub;
      li.querySelector('small').textContent = r.hint;
      li.addEventListener('mousemove', () => { if (sel !== n) { sel = n; mark(); } });
      li.addEventListener('click', () => choose(n));
      list.appendChild(li);
    });
    empty.hidden = results.length > 0;
    mark();
  }

  function mark() {
    list.querySelectorAll('.palette-item').forEach(li => {
      const on = li.id === 'pal-' + sel;
      li.setAttribute('aria-selected', String(on));
      if (on) {
        input.setAttribute('aria-activedescendant', li.id);
        li.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function choose(n) {
    const r = results[n];
    if (!r) return;
    dlg.close();
    setTimeout(r.run, 60);
  }

  function open() {
    const sheet = document.getElementById('sheet');
    if (sheet && sheet.open) sheet.close();
    input.value = '';
    sel = 0;
    render();
    dlg.showModal();
    input.focus();
  }

  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, results.length); mark(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + results.length) % Math.max(1, results.length); mark(); }
    if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  btn.addEventListener('click', open);

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, textarea, [contenteditable]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? dlg.close() : open(); }
    else if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); open(); }
  });

  // Affiche ⌘ K sur Mac
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    const k = btn.querySelector('.search-kbd');
    if (k) k.textContent = '⌘ K';
  }
}

/* =============================================
   5 quater. VERSION PDF + DURÉE D'ALTERNANCE
   ============================================= */
function printPortfolio() {
  const sheet = document.getElementById('sheet');
  if (sheet && sheet.open) sheet.close();
  window.print();
}

function initExtras() {
  const printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', printPortfolio);

  // « Depuis sept. 2025 » → durée calculée à la date du jour
  document.querySelectorAll('[data-since]').forEach(el => {
    const start = new Date(el.dataset.since);
    const now = new Date();
    if (isNaN(start)) return;
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months--;
    if (months < 1) return;
    const y = Math.floor(months / 12);
    const m = months % 12;
    const parts = [];
    if (y) parts.push(y + (y > 1 ? ' ans' : ' an'));
    if (m) parts.push(m + ' mois');
    el.textContent = 'soit ' + parts.join(' et ');
  });
}

/* =============================================
   5 quinquies. VISIONNEUSE DE DOCUMENTS
   Les PDF s'ouvrent dans la page sur grand écran ;
   sur mobile (ou Ctrl/clic molette) ils s'ouvrent normalement.
   ============================================= */
function openViewer(link) {
  const dlg = document.getElementById('viewer');
  if (!dlg || typeof dlg.showModal !== 'function') return false;
  const href = link.getAttribute('href');
  const name = link.querySelector('.file-name')?.textContent
    || link.childNodes[0]?.textContent?.trim()
    || href.split('/').pop();
  document.getElementById('viewerTitle').textContent = name;
  document.getElementById('viewerOpen').href = href;
  const dl = document.getElementById('viewerDl');
  dl.href = href;
  dl.setAttribute('download', href.split('/').pop());
  document.getElementById('viewerFrame').src = href + '#view=FitH';
  dlg.showModal();
  return true;
}

function initViewer() {
  const dlg = document.getElementById('viewer');
  if (!dlg) return;
  const frame = document.getElementById('viewerFrame');
  document.getElementById('viewerClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { frame.src = 'about:blank'; });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-viewer]');
    if (!link) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    if (window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) return;
    if (openViewer(link)) e.preventDefault();
  });
}

/* =============================================
   6. DOCUMENTATION — compteur
   ============================================= */
function initDocCount() {
  const count = document.getElementById('docCount');
  const n = document.querySelectorAll('#files .file').length;
  if (count) count.textContent = n + (n > 1 ? ' éléments' : ' élément');
}

/* =============================================
   7. CONTACT
   Le formulaire ouvre la messagerie du visiteur (mailto)
   avec le message prérempli : pas de faux « message envoyé ».
   ============================================= */
const CONTACT_EMAIL = 'axel.royer@gmail.com';

function initContact() {
  const form = document.getElementById('contactForm');
  const feedback = document.getElementById('formFeedback');
  const copyBtn = document.getElementById('copyMail');

  const show = (msg, type) => {
    feedback.textContent = msg;
    feedback.className = 'form-feedback ' + (type || '');
  };

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fName = document.getElementById('name');
      const fEmail = document.getElementById('email');
      const fMsg = document.getElementById('message');
      const name = fName.value.trim();
      const email = fEmail.value.trim();
      const message = fMsg.value.trim();

      [fName, fEmail, fMsg].forEach(f => f.removeAttribute('aria-invalid'));

      if (!name) { fName.setAttribute('aria-invalid', 'true'); fName.focus(); return show('Indiquez votre nom.', 'error'); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fEmail.setAttribute('aria-invalid', 'true'); fEmail.focus(); return show('Vérifiez votre adresse email, elle semble incomplète.', 'error'); }
      if (message.length < 10) { fMsg.setAttribute('aria-invalid', 'true'); fMsg.focus(); return show('Le message doit contenir au moins 10 caractères.', 'error'); }

      const subject = `Portfolio : message de ${name}`;
      const body = `${message}\n\n${name}\n${email}`;
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      show('Votre messagerie s\'ouvre avec le message prérempli. Si rien ne se passe, écrivez directement à ' + CONTACT_EMAIL + '.', 'success');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const original = copyBtn.textContent;
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        copyBtn.textContent = 'Adresse copiée';
      } catch (e) {
        copyBtn.textContent = 'Copie impossible, sélectionnez l\'adresse';
      }
      setTimeout(() => { copyBtn.textContent = original; }, 2000);
    });
  }
}

/* =============================================
   8. CONSOLE
   ============================================= */
function initConsole() {
  console.log('%c Axel Royer · Portfolio BTS SIO SISR ', 'background:#18222e;color:#3ddc6f;font-weight:bold;font-size:15px;padding:8px 14px;border-radius:4px;');
  console.log('%c Technicien systèmes et réseaux, en alternance chez Riou Glass', 'color:#566778;font-size:12px;');
  console.log('%c HTML, CSS et JavaScript pur, sans framework.', 'color:#1d5bd6;font-size:12px;');
}

/* =============================================
   INITIALISATION
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPorts();
  initTopology();
  initFilters();
  initMatrix();
  initSheet();
  initViewer();
  initDocCount();
  initContact();
  initPalette();
  initExtras();
  initConsole();
});
