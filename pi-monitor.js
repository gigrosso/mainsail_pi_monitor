/*!
 * Mainsail Pi Monitor — Raspberry Pi host stats for Mainsail (top bar + dashboard widget)
 * Copyright (C) 2026 Giovanni Grosso
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the
 * GNU General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 *
 * How it works: this script is injected into Mainsail's index.html by Nginx (sub_filter). It reads
 * everything through Mainsail's own Moonraker websocket (machine.proc_stats, machine.system_info,
 * server.files.get_directory), so it uses the same login/permissions as Mainsail itself and needs no
 * extra service. Tested with Mainsail v2.17 (Vue 2 / Vuetify 2).
 */
(() => {
  'use strict';

  // ------------------------------------------------------------------ settings
  const POLL_MS = 5000;                 // CPU / temperature / RAM
  const DISK_MS = 60000;                // storage
  const HISTORY_MIN = 10;               // length of the small charts (kept in the browser only)
  const TEMP_WARN = 70, TEMP_HOT = 80;  // °C (the Pi 4 starts throttling at ~80-85 °C)
  const TOPBAR_FULL_MIN_PX = 1400;      // below this width the top bar shows only CPU % and temperature
  const TOPBAR_MIN_PX = 900;            // below this width the top bar item is hidden
  const DB = { namespace: 'mainsail', key: 'pi_monitor_widget' };   // widget position (Moonraker database)
  const COLUMNS = { mobile: 1, tablet: 2, desktop: 2, widescreen: 3 };

  // ------------------------------------------------------------------ i18n (English / Português)
  const TXT = {
    en: {
      title: 'Raspberry Pi', cpu: 'CPU', cpuTemp: 'CPU temp.', ram: 'RAM', disk: 'Storage', up: 'up',
      hot: 'CPU is hot', throttled: 'throttling / under-voltage detected', min: 'min', now: 'now',
      widget: 'Widget “Raspberry Pi”', show: 'show', column: 'column', position: 'position', reset: 'default',
      top: 'top of the column', after: 'after', hidden: 'hidden', saving: 'saving...', saved: 'saved ✓',
      saveErr: 'could not save', loading: 'loading...', macroGroup: 'Macro group',
    },
    pt: {
      title: 'Raspberry Pi', cpu: 'CPU', cpuTemp: 'Temp. CPU', ram: 'RAM', disk: 'Armazenamento', up: 'ligado há',
      hot: 'CPU quente', throttled: 'throttling / subtensão detectado', min: 'min', now: 'agora',
      widget: 'Widget “Raspberry Pi”', show: 'mostrar', column: 'coluna', position: 'posição', reset: 'padrão',
      top: 'no topo da coluna', after: 'depois de', hidden: 'oculto', saving: 'salvando...', saved: 'salvo ✓',
      saveErr: 'não foi possível salvar', loading: 'carregando...', macroGroup: 'Grupo de macros',
    },
  };
  const lang = () => {
    const vm = vueRoot();
    const l = (vm && vm.$i18n && vm.$i18n.locale) || navigator.language || 'en';
    return l.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  };
  const t = (k) => TXT[lang()][k];

  // ------------------------------------------------------------------ styles
  const css = document.createElement('style');
  css.textContent = `
    #pim-bar{display:flex;align-items:center;margin-left:12px;font-size:13px;opacity:.9;white-space:nowrap}
    #pim-bar.err{opacity:.4}
    .pim-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:#4caf50}
    .pim-dot.warn{background:#ff9800}
    @media (max-width:${TOPBAR_FULL_MIN_PX}px){#pim-bar .pim-xl{display:none}}
    @media (max-width:${TOPBAR_MIN_PX}px){#pim-bar{display:none}}
    .pim-panel .pim-tb{display:flex;align-items:center;padding:0 12px 0 16px;cursor:pointer;user-select:none}
    .pim-panel .pim-tb svg{width:22px;height:22px;fill:currentColor;margin-right:8px}
    .pim-panel .pim-tb .pim-chev{margin-left:auto;margin-right:0;transition:transform .2s;opacity:.7}
    .pim-panel.closed .pim-chev{transform:rotate(90deg)}
    .pim-panel.closed .pim-body{display:none}
    .pim-panel .pim-body{padding:12px 16px 16px}
    .pim-panel .pim-head{display:flex;justify-content:space-between;font-size:12px;opacity:.7;margin-bottom:10px}
    .pim-panel .pim-bars{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;font-size:13px}
    .pim-panel .pim-bar{height:8px;border-radius:4px;background:rgba(128,128,128,.25);overflow:hidden}
    .pim-panel .pim-bar i{display:block;height:100%;width:0;border-radius:4px;background:#4caf50;transition:width .4s}
    .pim-panel .pim-num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
    .pim-panel .pim-cores{display:flex;gap:3px;margin-top:2px}
    .pim-panel .pim-cores i{flex:1;height:4px;border-radius:2px;background:rgba(128,128,128,.25);position:relative;overflow:hidden}
    .pim-panel .pim-cores i b{position:absolute;inset:0 auto 0 0}
    .pim-panel .pim-alert{margin-top:8px;font-size:12px;color:#ff9800}
    .pim-panel .pim-charts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
    .pim-panel .pim-charts svg{display:block;width:100%;height:40px}
    .pim-panel .pim-leg{display:flex;justify-content:space-between;font-size:11px;opacity:.6}
    .pim-cfg{margin:8px 12px 16px;padding:10px 12px;border:1px dashed rgba(128,128,128,.5);border-radius:6px;font-size:14px}
    .pim-cfg .pim-cfg-t{display:flex;align-items:center;gap:8px;margin-bottom:8px}
    .pim-cfg .pim-cfg-t svg{width:20px;height:20px;fill:currentColor;opacity:.8}
    .pim-cfg .pim-cfg-f{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
    .pim-cfg label{display:flex;align-items:center;gap:6px}
    .pim-cfg select,.pim-cfg button{font:inherit;color:inherit;background:transparent;
      border:1px solid rgba(128,128,128,.5);border-radius:4px;padding:3px 6px}
    .pim-cfg button{cursor:pointer;padding:3px 10px}
    .pim-cfg.dark{color-scheme:dark}
    .pim-cfg.dark option{background:#1e1e1e}
    .pim-cfg :disabled{opacity:.5;cursor:default}
    .pim-cfg .pim-msg{font-size:12px;opacity:.7}`;
  document.head.appendChild(css);

  // ------------------------------------------------------------------ Mainsail / Moonraker access
  function vueRoot() {
    for (const el of [document.getElementById('app'), document.querySelector('.v-application')]) {
      const vm = el && el.__vue__;
      if (vm && vm.$store) return vm;
    }
    return null;
  }
  const rpc = (method, params) => {
    const vm = vueRoot();
    if (vm && vm.$socket) return vm.$socket.emitAndWait(method, params);
    return Promise.reject(new Error('Mainsail is not connected'));
  };

  // ------------------------------------------------------------------ elements
  const ICON = '<svg viewBox="0 0 24 24"><path d="M17 17H7V7h10m4 4V9h-2V7a2 2 0 0 0-2-2h-2V3h-2v2h-2V3H9v2H7a2 2 0 0 0-2 2v2H3v2h2v2H3v2h2v2a2 2 0 0 0 2 2h2v2h2v-2h2v2h2v-2h2a2 2 0 0 0 2-2v-2h2v-2h-2v-2m-6 2h-2v-2h2m2-2H9v6h6z"/></svg>';
  const CHEV = '<svg viewBox="0 0 24 24" class="pim-chev"><path d="M7.41 8.58 12 13.17l4.59-4.59L18 10l-6 6-6-6z"/></svg>';

  const bar = document.createElement('div');
  bar.id = 'pim-bar';
  bar.className = 'err';
  bar.textContent = '🖥 --';

  const panel = document.createElement('div');
  const buildPanel = () => {
    panel.innerHTML = `
      <header class="pim-tb">${ICON}<span class="subheading" data-k="model">${t('title')}</span>${CHEV}</header>
      <div class="pim-body">
        <div class="pim-head"><span data-k="cpuinfo"></span><span data-k="uptime"></span></div>
        <div class="pim-bars">
          <span>${t('cpu')}</span><div><div class="pim-bar"><i data-k="cpu-b"></i></div><div class="pim-cores" data-k="cores"></div></div><span class="pim-num" data-k="cpu">--</span>
          <span>${t('cpuTemp')}</span><div class="pim-bar"><i data-k="temp-b"></i></div><span class="pim-num" data-k="temp">--</span>
          <span>${t('ram')}</span><div class="pim-bar"><i data-k="ram-b"></i></div><span class="pim-num" data-k="ram">--</span>
          <span>${t('disk')}</span><div class="pim-bar"><i data-k="disk-b"></i></div><span class="pim-num" data-k="disk">--</span>
        </div>
        <div class="pim-alert" data-k="alert" hidden></div>
        <div class="pim-charts"><div data-k="chart-cpu"></div><div data-k="chart-temp"></div></div>
      </div>`;
    panel.dataset.lang = lang();
  };
  buildPanel();
  const q = (k) => panel.querySelector(`[data-k="${k}"]`);

  let open = true;
  try { open = localStorage.getItem('pim-open') !== '0'; } catch (e) { /* private mode */ }
  panel.addEventListener('click', (ev) => {
    if (!ev.target.closest('.pim-tb')) return;
    open = !open;
    try { localStorage.setItem('pim-open', open ? '1' : '0'); } catch (e) { /* ignore */ }
    panel.classList.toggle('closed', !open);
  });

  // ------------------------------------------------------------------ widget position
  // Mainsail only accepts its built-in panels in its layout lists, so the widget's place is chosen in a
  // section injected under Settings > Dashboard (one per screen type) and saved in the Moonraker database:
  // {mobile|tablet|desktop|widescreen: {col, after, visible}}.
  let position = null;   // null = not loaded yet

  const viewport = (vm) => {
    const b = vm.$vuetify.breakpoint;
    return b.mobile ? 'mobile' : b.xl ? 'widescreen' : b.lgAndUp ? 'desktop' : 'tablet';
  };
  const columnLayout = (vm, vp, col) => {
    try { return vm.$store.getters['gui/getPanels'](vp, vp === 'mobile' ? 0 : col); } catch (e) { return []; }
  };
  const panelTitle = (vm, name) => {
    if (name === 'status') return 'Status';
    if (name.startsWith('macrogroup_')) return t('macroGroup');
    const pascal = name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const k = `Panels.${pascal}Panel.Headline`;
    const s = vm.$t ? vm.$t(k) : k;
    return s === k ? name : s;
  };
  // default: right after the Status panel (top of the first column)
  const configFor = (vp) => Object.assign({ col: 1, after: 'status', visible: true }, (position && position[vp]) || {});

  function loadPosition() {
    rpc('server.database.get_item', DB)
      .then((r) => { position = (r && r.value) || {}; schedule(); })
      .catch((e) => {
        if (e && (e.code === 404 || /not found/i.test(String(e.message || e)))) { position = {}; schedule(); }
      });
  }
  async function savePosition(vp, cfg, msg) {
    const next = Object.assign({}, position || {});
    if (cfg) next[vp] = cfg; else delete next[vp];
    msg.textContent = t('saving');
    try {
      await rpc('server.database.post_item', Object.assign({ value: next }, DB));
      position = next;
      msg.textContent = t('saved');
    } catch (e) {
      msg.textContent = t('saveErr') + (e && e.message ? `: ${e.message}` : '');
    }
    schedule();
  }

  // copy the classes of a native Mainsail panel so the widget follows the light/dark theme
  function copyStyle(ref) {
    panel.className = ref.className.replace(/\b[\w-]+-panel\b|\bexpanded\b|v-card--loading/g, '') +
      ' pim-panel' + (open ? '' : ' closed');
    const tb = ref.querySelector('.panel-toolbar');
    if (tb) {
      const h = panel.querySelector('.pim-tb');
      h.className = tb.className.replace(/\bv-toolbar\b|\bv-toolbar--\S+/g, '') + ' pim-tb';
      h.style.height = tb.offsetHeight ? tb.offsetHeight + 'px' : '40px';
    }
  }

  function placeOnDashboard(vm) {
    // the StatusPanel is wrapped in a <div> at the top of the first column (v-col inside v-row)
    const status = document.querySelector('.status-panel');
    const col1 = status && status.closest('.row > *');
    const row = col1 && col1.parentElement;
    if (!row) return;
    const statusEl = Array.from(col1.children).find((e) => e.contains(status));
    const vp = viewport(vm), c = configFor(vp);
    if (!c.visible) { if (panel.parentElement) panel.remove(); return; }
    const cols = Array.from(row.children).filter((e) => e !== panel);
    const col = cols[Math.min(Math.max(c.col, 1), cols.length) - 1];
    if (!col) return;
    let prev = null;   // element the widget goes after; null = top of the column
    if (c.after === 'status') prev = col === col1 ? statusEl : null;
    else if (c.after) {
      const names = columnLayout(vm, vp, c.col).map((p) => p.name);
      for (let j = names.indexOf(c.after); j >= 0 && !prev; j--) {   // hidden panel: use the nearest one above
        const sel = names[j].startsWith('macrogroup_') ? `[class*="${names[j]}"]` : `.${names[j]}-panel`;
        prev = Array.from(col.children).find((e) => e !== panel && (e.matches(sel) || e.querySelector(sel))) || null;
      }
      if (!prev && col === col1) prev = statusEl;
    }
    if (prev ? prev.nextElementSibling === panel : col.firstElementChild === panel) return;
    if (panel.dataset.lang !== lang()) buildPanel();
    copyStyle(status);
    if (prev) prev.after(panel); else col.prepend(panel);
    render();
  }

  const cfgBoxes = {};
  function placeInSettings(vm) {
    const groups = {};
    for (const el of document.querySelectorAll('.v-list-item-group.fill-height')) {
      let p = el.__vue__;
      for (let i = 0; p && !p.viewportName && i < 4; i++) p = p.$parent;
      if (p && p.viewportName) (groups[p.viewportName] = groups[p.viewportName] || []).push(el);
    }
    for (const vp of Object.keys(groups)) {
      let row = groups[vp][0].closest('.row');
      while (row && !groups[vp].every((e) => row.contains(e))) row = row.parentElement.closest('.row');
      if (!row) continue;
      let box = cfgBoxes[vp];
      if (!box) {
        box = cfgBoxes[vp] = document.createElement('div');
        box.className = 'pim-cfg';
        box.innerHTML = `<div class="pim-cfg-t">${ICON}<b></b></div>
          <div class="pim-cfg-f">
            <label><input type="checkbox" class="pim-vis"> <span></span></label>
            <label><span></span> <select class="pim-col"></select></label>
            <label><span></span> <select class="pim-after"></select></label>
            <button type="button" class="pim-reset"></button>
            <span class="pim-msg"></span>
          </div>`;
        const msg = box.querySelector('.pim-msg');
        const read = () => ({ col: Number(box.querySelector('.pim-col').value),
          after: box.querySelector('.pim-after').value, visible: box.querySelector('.pim-vis').checked });
        box.querySelector('.pim-col').addEventListener('change', (ev) => {
          const col = Number(ev.target.value);       // new column: go to its top (after Status in column 1)
          savePosition(vp, Object.assign(read(), { col, after: col === 1 ? 'status' : '' }), msg);
        });
        box.querySelector('.pim-after').addEventListener('change', () => savePosition(vp, read(), msg));
        box.querySelector('.pim-vis').addEventListener('change', () => savePosition(vp, read(), msg));
        box.querySelector('.pim-reset').addEventListener('click', () => savePosition(vp, null, msg));
      }
      if (row.nextElementSibling !== box) row.after(box);
      if (box.contains(document.activeElement)) continue;   // do not redraw while a select is open
      const c = configFor(vp);
      const layout = columnLayout(vm, vp, c.col);
      const options = [['', t('top')]].concat(c.col === 1 ? [['status', `${t('after')} Status`]] : [],
        layout.map((p) => [p.name, `${t('after')} ${panelTitle(vm, p.name)}${p.visible ? '' : ` (${t('hidden')})`}`]));
      const signature = JSON.stringify([c, options, position !== null, lang()]);
      if (box.dataset.signature === signature) continue;
      box.dataset.signature = signature;
      box.querySelector('.pim-cfg-t b').textContent = t('widget');
      const labels = box.querySelectorAll('label > span');
      labels[0].textContent = t('show'); labels[1].textContent = t('column'); labels[2].textContent = t('position');
      box.querySelector('.pim-reset').textContent = t('reset');
      const selCol = box.querySelector('.pim-col'), selAfter = box.querySelector('.pim-after');
      selCol.innerHTML = Array.from({ length: COLUMNS[vp] }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
      selCol.value = String(c.col);
      selAfter.innerHTML = options.map(([v, s]) => `<option value="${v}">${s}</option>`).join('');
      selAfter.value = options.some(([v]) => v === c.after) ? c.after : '';
      box.querySelector('.pim-vis').checked = c.visible;
      for (const el of box.querySelectorAll('select,input,button')) el.disabled = position === null;
      const msg = box.querySelector('.pim-msg');
      if (position === null) msg.textContent = t('loading');
      else if (msg.textContent === t('loading')) msg.textContent = '';
      box.classList.toggle('dark', !!document.querySelector('.v-application.theme--dark'));
    }
  }

  // Mainsail is a SPA: put the elements back whenever the page is re-rendered.
  // v2.17: the printer name is a VToolbarTitle inside header.topbar.
  function mount() {
    const title = document.querySelector('header.topbar .v-toolbar__title');
    if (title && title.nextElementSibling !== bar) title.after(bar);
    const vm = vueRoot();
    if (!vm) return;
    placeOnDashboard(vm);
    placeInSettings(vm);
  }
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; mount(); });
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);

  // ------------------------------------------------------------------ data
  const state = { proc: null, model: null, cpuInfo: null, disk: null, hist: [] };

  async function poll() {
    try {
      state.proc = await rpc('machine.proc_stats');
      const cpu = num(state.proc.system_cpu_usage && state.proc.system_cpu_usage.cpu);
      state.hist.push({ t: Date.now(), cpu, temp: num(state.proc.cpu_temp) });
      const limit = Date.now() - HISTORY_MIN * 60000;
      while (state.hist.length && state.hist[0].t < limit) state.hist.shift();
    } catch (e) { state.proc = null; }
    if (state.proc && !state.model) {
      try {
        const ci = (await rpc('machine.system_info')).system_info.cpu_info;
        state.model = ci.model || ci.cpu_desc || null;
        state.cpuInfo = [ci.cpu_count && `${ci.cpu_count} cores`, ci.processor, ci.bits].filter(Boolean).join(' · ');
      } catch (e) { /* retry next time */ }
    }
    if (state.proc && !state.disk) await pollDisk();
    if (state.proc && position === null) loadPosition();
    render();
  }
  async function pollDisk() {
    try {
      const d = await rpc('server.files.get_directory', { path: 'gcodes', extended: false });
      state.disk = d.disk_usage || null;
    } catch (e) { /* keep last value */ }
  }

  // ------------------------------------------------------------------ rendering
  const num = (v) => { const n = Number(v); return v === null || v === undefined || v === '' || isNaN(n) ? null : n; };
  const pct = (v) => v === null ? '--' : `${Math.round(v)}%`;
  const gb = (bytes) => `${(bytes / 1073741824).toFixed(1)} GB`;
  const color = (v, warn, bad) => v >= bad ? '#f44336' : v >= warn ? '#ff9800' : '#4caf50';
  const fill = (k, v, warn, bad) => {
    const el = q(k);
    el.style.width = v === null ? '0' : `${Math.max(0, Math.min(100, v))}%`;
    el.style.background = v === null ? '' : color(v, warn, bad);
  };
  const duration = (s) => {
    s = Math.floor(s);
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`;
  };

  function chart(k, key, unit, stroke) {
    const box = q(k);
    const pts = state.hist.filter((p) => p[key] !== null);
    if (pts.length < 2) { box.innerHTML = ''; return; }
    const v = pts.map((p) => p[key]);
    let min = Math.min(...v), max = Math.max(...v);
    if (max - min < 2) { max += 1; min -= 1; }
    const W = 200, H = 40, t0 = pts[0].t, span = Math.max(1, pts[pts.length - 1].t - t0);
    const line = pts.map((p) => `${((p.t - t0) / span * W).toFixed(1)},${(H - 2 - (p[key] - min) / (max - min) * (H - 4)).toFixed(1)}`).join(' ');
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${line}" fill="none"
      stroke="${stroke}" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
      <div class="pim-leg"><span>−${Math.max(1, Math.round(span / 60000))} ${t('min')}</span>
      <span>${Math.min(...v).toFixed(0)}–${Math.max(...v).toFixed(0)} ${unit}</span><span>${t('now')}</span></div>`;
  }

  function render() {
    const { proc, disk } = state;
    if (!proc) { bar.classList.add('err'); return; }
    const cpu = num(proc.system_cpu_usage && proc.system_cpu_usage.cpu);
    const temp = num(proc.cpu_temp);
    const mem = proc.system_memory;
    const ram = mem && mem.total ? (mem.total - mem.available) / mem.total * 100 : null;
    const dsk = disk && disk.total ? disk.used / disk.total * 100 : null;
    const bits = proc.throttled_state && proc.throttled_state.bits;
    const flags = ((proc.throttled_state && proc.throttled_state.flags) || []).filter((x) => x !== '?');
    const warn = (temp !== null && temp >= TEMP_WARN) || !!bits;
    const ramTxt = mem ? `${gb((mem.total - mem.available) * 1024)} / ${gb(mem.total * 1024)}` : '--';
    const diskTxt = disk ? `${gb(disk.used)} / ${gb(disk.total)}` : '--';

    // top bar
    bar.classList.remove('err');
    bar.innerHTML = `<span class="pim-dot ${warn ? 'warn' : ''}"></span>🖥 ${t('cpu')} ${pct(cpu)} · ${temp === null ? '--' : temp.toFixed(0)}°C` +
      `<span class="pim-xl"> · ${t('ram')} ${pct(ram)}${dsk === null ? '' : ` · SD ${pct(dsk)}`}</span>`;
    bar.title = [state.model || t('title'), `${t('cpu')} ${pct(cpu)} · ${temp === null ? '--' : temp.toFixed(1)} °C`,
      `${t('ram')} ${ramTxt}`, `${t('disk')} ${diskTxt}`,
      proc.system_uptime ? `${t('up')} ${duration(proc.system_uptime)}` : '',
      flags.length ? `⚠ ${flags.join(', ')}` : ''].filter(Boolean).join('\n');

    // widget
    q('model').textContent = state.model || t('title');
    q('cpuinfo').textContent = state.cpuInfo || '';
    q('uptime').textContent = proc.system_uptime ? `${t('up')} ${duration(proc.system_uptime)}` : '';
    q('cpu').textContent = pct(cpu); fill('cpu-b', cpu, 70, 90);
    if (proc.system_cpu_usage) {
      q('cores').innerHTML = Object.keys(proc.system_cpu_usage).filter((k) => k !== 'cpu').sort().map((k) => {
        const v = Number(proc.system_cpu_usage[k]);
        return `<i title="${k}: ${Math.round(v)}%"><b style="width:${v}%;background:${color(v, 70, 90)}"></b></i>`;
      }).join('');
    }
    q('temp').textContent = temp === null ? '--' : `${temp.toFixed(1)} °C`;
    fill('temp-b', temp === null ? null : temp / 85 * 100, TEMP_WARN / 85 * 100, TEMP_HOT / 85 * 100);
    q('ram').textContent = ramTxt; fill('ram-b', ram, 75, 90);
    q('disk').textContent = diskTxt; fill('disk-b', dsk, 80, 90);
    const al = q('alert');
    al.hidden = !warn;
    al.textContent = bits ? `⚠ ${flags.join(', ') || t('throttled')}` : `⚠ ${t('hot')} (≥ ${TEMP_WARN} °C)`;
    chart('chart-cpu', 'cpu', '%', '#42a5f5');
    chart('chart-temp', 'temp', '°C', '#ff7043');
  }

  mount();
  poll();
  setInterval(poll, POLL_MS);
  setInterval(pollDisk, DISK_MS);
})();
