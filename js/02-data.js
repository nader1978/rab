/* =====================================================================
   CONFIG + MICROSOFT SIGN-IN (MSAL) — same pattern as SC Mngt system
   ===================================================================== */
/* Connection settings are SHARED with "NFPC SC Mngt Support System" (same keys, same web address = same settings):
   Tenant ID / Client ID / Site URL / token / light-dark / colour theme are read from and written to SC Mngt's storage. */
const SC_LS = 'sp_dashboard_secure_v12';
const SC_KEY = { ms: SC_LS + '_ms_cfg', global: SC_LS + '_global', theme: SC_LS + '_theme', accent: SC_LS + '_accent', mini: SC_LS + '_navmini' };
const scGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch (e) { return {}; } };
const scSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
function cfg() {
  const c = lsGet('cfg', {}), ms = scGet(SC_KEY.ms), gl = scGet(SC_KEY.global);
  const tenantId = ms.tenantId || c.tenantId || MS_AUTH_DEFAULT.tenantId, clientId = ms.clientId || c.clientId || MS_AUTH_DEFAULT.clientId;
  const scSite = (gl.siteUrl || ms.siteUrl || MS_AUTH_DEFAULT.siteUrl || '').replace(/\/+$/, ''), rabSite = (c.rabSiteUrl || '').replace(/\/+$/, '');
  const siteUrl = rabSite || scSite || (c.siteUrl || '').replace(/\/+$/, '');
  return { mode: c.mode || (tenantId && clientId && siteUrl ? 'sp' : 'demo'), tenantId, clientId, siteUrl, scSite, rabSite, listNames: c.listNames || {} };
}
function saveCfg(p) {
  const { tenantId, clientId, siteUrl, ...rest } = p;
  if (tenantId !== undefined || clientId !== undefined) { const ms = scGet(SC_KEY.ms); scSet(SC_KEY.ms, { ...ms, ...(tenantId !== undefined ? { tenantId } : {}), ...(clientId !== undefined ? { clientId } : {}) }); }
  if (siteUrl !== undefined) { const gl = scGet(SC_KEY.global); scSet(SC_KEY.global, { ...gl, siteUrl, updatedAt: Date.now(), updatedBy: (window.Auth && Auth.user && Auth.user.name) || 'RAB' }); }
  lsSet('cfg', { ...lsGet('cfg', {}), ...rest });
}
const listName = k => cfg().listNames[k] || LISTS[k].name;

const MS = {
  app: null, account: null, token: null, exp: 0,
  loadLib() {
    if (window.msal) return Promise.resolve();
    const urls = ['https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js', 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.3/lib/msal-browser.min.js'];
    return urls.reduce((p, u) => p.catch(() => new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = () => rej(new Error('Could not load the Microsoft sign-in library.')); document.head.appendChild(s); })), Promise.reject());
  },
  async init() {
    if (this.app) return this.app;
    const c = cfg(); if (!c.tenantId || !c.clientId) throw new Error('Enter the Tenant ID and Client ID in Settings first.');
    if (location.protocol === 'file:') throw new Error('Microsoft sign-in does not work from a local file. Open this page from https:// (e.g. a SharePoint document library) or http://localhost.');
    await this.loadLib();
    this.app = new msal.PublicClientApplication({ auth: { clientId: c.clientId, authority: 'https://login.microsoftonline.com/' + c.tenantId, redirectUri: location.origin + location.pathname }, cache: { cacheLocation: 'localStorage' } });
    if (this.app.initialize) await this.app.initialize();
    return this.app;
  },
  scopes: ['https://graph.microsoft.com/Sites.ReadWrite.All', 'https://graph.microsoft.com/User.Read'],
  manageScopes: ['https://graph.microsoft.com/Sites.Manage.All'], manage: false, mtoken: null, mexp: 0,
  async getManageToken(interactive = true) {   // only needed to create lists/columns (Settings page)
    if (this.mtoken && Date.now() < this.mexp - 120000) return this.mtoken;
    const app = await this.init(); const acct = this.account || app.getAllAccounts()[0]; let res;
    try { res = await app.acquireTokenSilent({ scopes: this.manageScopes, account: acct }); } catch (e) { if (!interactive) throw e; res = await app.acquireTokenPopup({ scopes: this.manageScopes, account: acct }); }
    this.mtoken = res.accessToken; this.mexp = +new Date(res.expiresOn || Date.now() + 3000000); return this.mtoken;
  },
  async getToken(interactive = false) {
    if (this.manage) return this.getManageToken(interactive);
    if (this.token && Date.now() < this.exp - 120000) return this.token;
    const app = await this.init(); let acct = this.account || app.getAllAccounts()[0]; let res;
    if (!acct) { if (!interactive) throw new Error('Not signed in to Microsoft.'); res = await app.loginPopup({ scopes: this.scopes }); acct = res.account; }
    try { res = await app.acquireTokenSilent({ scopes: this.scopes, account: acct }); }
    catch (e) { if (!interactive) throw e; res = await app.acquireTokenPopup({ scopes: this.scopes, account: acct }); }
    this.account = acct; this.token = res.accessToken; this.exp = +new Date(res.expiresOn || Date.now() + 3000000);
    try { const gl = scGet(SC_KEY.global); scSet(SC_KEY.global, { ...gl, siteUrl: gl.siteUrl || cfg().scSite || cfg().siteUrl, accessToken: res.accessToken, updatedAt: Date.now(), updatedBy: (acct && acct.username) || 'RAB' }); } catch (e) {}   // SC Mngt sees the same fresh token
    return this.token;
  },
  async signOut() { try { const app = await this.init(); const a = app.getAllAccounts()[0]; this.token = null; if (a) await app.logoutPopup({ account: a }); } catch (e) {} },
  user() { const a = this.account || (this.app && this.app.getAllAccounts()[0]); return a ? (a.name || a.username) : ''; }
};

/* Graph fetch with retry on throttling (429/503) */
async function gfetch(url, opt = {}, tries = 5) {
  const token = await MS.getToken(false);
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url.startsWith('http') ? url : 'https://graph.microsoft.com/v1.0' + url, { ...opt, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly', ...(opt.headers || {}) } });
    if (r.status === 429 || r.status === 503 || r.status === 504) { const ra = +(r.headers.get('Retry-After') || 0); await new Promise(s => setTimeout(s, (ra || 2 ** i) * 1000)); continue; }
    if (!r.ok) { let m = r.status + ' ' + r.statusText; try { const j = await r.json(); m = (j.error && j.error.message) || m; } catch (e) {} const er = new Error(m); er.status = r.status; throw er; }
    return r.status === 204 ? null : r.json();
  }
  throw new Error('SharePoint is busy (throttled). Try again in a minute.');
}
const SP = {
  siteId: null, listIds: {},
  async site() {
    if (this.siteId) return this.siteId;
    const u = new URL(cfg().siteUrl); const path = u.pathname.replace(/\/+$/, '');
    const j = await gfetch(`/sites/${u.hostname}${path && path !== '/' ? ':' + path : ''}`);
    return (this.siteId = j.id);
  },
  async findList(k) {
    if (this.listIds[k]) return this.listIds[k];
    const sid = await this.site(), nm = listName(k);
    const j = await gfetch(`/sites/${sid}/lists?$select=id,displayName,name&$top=999`);
    const hit = (j.value || []).find(l => l.displayName === nm || l.name === nm || l.displayName.toLowerCase() === nm.toLowerCase());
    if (hit) this.listIds[k] = hit.id; return hit ? hit.id : null;
  },
  async listId(k) { const id = await this.findList(k); if (!id) throw new Error(`SharePoint list "${listName(k)}" does not exist yet — open Settings → SharePoint lists → Create.`); return id; },
  fromSP(k, it) {
    const L = LISTS[k], f = it.fields || {}, rec = { _id: String(it.id), _etag: f['@odata.etag'] };
    for (const d of L.fields) {
      let v = f[d.sp];
      if (v === undefined || v === null) { rec[d.n] = d.t === 'b' ? false : null; continue; }
      if (d.t === 'd') { const x = new Date(v); v = isNaN(x) ? String(v).slice(0, 10) : `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; }
      else if (d.t === 'n' || d.t === 'c' || d.t === 'p') v = num(v);
      else if (d.t === 'b') v = v === true || v === 'true' || v === 1;
      rec[d.n] = v;
    }
    return rec;
  },
  toSP(k, rec) {
    const L = LISTS[k], o = { Title: String(L.title(rec) || '').slice(0, 255) };
    for (const d of L.fields) {
      if (!(d.n in rec)) continue; let v = rec[d.n];
      if (v === '' || v === undefined) v = null;
      if (v !== null) {
        if (d.t === 'd') v = String(v).slice(0, 10) + 'T12:00:00Z';
        else if (d.t === 'dt') { const x = new Date(v); v = isNaN(x) ? null : x.toISOString(); }
        else if (d.t === 'n' || d.t === 'c' || d.t === 'p') v = num(v);
        else if (d.t === 'b') v = !!v;
        else v = String(v);
      } else if (d.t === 'b') v = false;
      o[d.sp] = v;
    }
    return o;
  },
  async all(k) {
    const sid = await this.site(), lid = await this.listId(k), out = [];
    let url = `/sites/${sid}/lists/${lid}/items?$expand=fields&$top=999`;
    while (url) { const j = await gfetch(url); for (const it of j.value || []) out.push(this.fromSP(k, it)); url = j['@odata.nextLink'] || null; }
    return out;
  },
  async create(k, rec) { const sid = await this.site(), lid = await this.listId(k); const j = await gfetch(`/sites/${sid}/lists/${lid}/items`, { method: 'POST', body: JSON.stringify({ fields: this.toSP(k, rec) }) }); return this.fromSP(k, j); },
  async update(k, rec) { const sid = await this.site(), lid = await this.listId(k); await gfetch(`/sites/${sid}/lists/${lid}/items/${rec._id}/fields`, { method: 'PATCH', body: JSON.stringify(this.toSP(k, rec)) }); return rec; },
  async remove(k, rec) { const sid = await this.site(), lid = await this.listId(k); await gfetch(`/sites/${sid}/lists/${lid}/items/${rec._id}`, { method: 'DELETE' }); },
  colDef(d) {
    const base = { name: d.sp, displayName: d.l.slice(0, 80), description: 'Access field: ' + d.n };
    switch (d.t) {
      case 'm': return { ...base, text: { allowMultipleLines: true, linesForEditing: 6, textType: 'plain' } };
      case 'n': return { ...base, number: { decimalPlaces: 'automatic' } };
      case 'c': return { ...base, number: { decimalPlaces: 'two' } };
      case 'p': return { ...base, number: { decimalPlaces: 'automatic' } };
      case 'd': return { ...base, dateTime: { format: 'dateOnly' } };
      case 'dt': return { ...base, dateTime: { format: 'dateTime' } };
      case 'b': return { ...base, boolean: {} };
      case 'ch': return { ...base, choice: { allowTextEntry: true, choices: d.opts || [], displayAs: 'dropDownMenu' } };
      default: return { ...base, text: { maxLength: 255 } };
    }
  },
  /* Check one list: returns {exists, missing:[fields]} */
  async inspect(k) {
    const lid = await this.findList(k); if (!lid) return { exists: false, missing: LISTS[k].fields.slice() };
    const sid = await this.site(); const j = await gfetch(`/sites/${sid}/lists/${lid}/columns?$select=name&$top=999`);
    const have = new Set((j.value || []).map(c => c.name.toLowerCase()));
    return { exists: true, missing: LISTS[k].fields.filter(d => !have.has(d.sp.toLowerCase())) };
  },
  /* Create list (if needed) and every missing column */
  async provision(k, onStep) {
    const sid = await this.site(); let lid = await this.findList(k);
    if (!lid) { const j = await gfetch(`/sites/${sid}/lists`, { method: 'POST', body: JSON.stringify({ displayName: listName(k), description: LISTS[k].label + ' — created by ' + APP.name, list: { template: 'genericList' } }) }); lid = this.listIds[k] = j.id; onStep && onStep('List created'); }
    const { missing } = await this.inspect(k); let n = 0;
    for (const d of missing) { try { await gfetch(`/sites/${sid}/lists/${lid}/columns`, { method: 'POST', body: JSON.stringify(this.colDef(d)) }); } catch (e) { if (!/already exists|duplicate/i.test(e.message)) throw new Error(d.n + ': ' + e.message); } n++; onStep && onStep(`${n}/${missing.length} columns`); }
    try { await gfetch(`/sites/${sid}/lists/${lid}/columns/Title`, { method: 'PATCH', body: JSON.stringify({ required: false }) }); } catch (e) {}
    return missing.length;
  }
};

/* Demo backend: this browser only (localStorage) — lets you try every page before SharePoint is ready */
const DEMO = {
  key: k => 'demo_' + k,
  all(k) { return lsGet(this.key(k), null); },
  put(k, a) { lsSet(this.key(k), a); },
  seqNext() { const s = lsGet('demo_seq', 1000) + 1; lsSet('demo_seq', s); return String(s); },
};

/* =====================================================================
   DB — one API for both backends, with an in-memory cache per list
   ===================================================================== */
const DB = {
  cache: {}, loading: {},
  isSP() { return cfg().mode === 'sp'; },
  async all(k, force = false) {
    if (this.cache[k] && !force) return this.cache[k];
    if (this.loading[k] && !force) return this.loading[k];
    const p = (async () => {
      let rows;
      if (this.isSP()) rows = await SP.all(k);
      else { rows = DEMO.all(k); if (!rows) { rows = (SEED[k] ? SEED[k]() : []).map(r => ({ _id: DEMO.seqNext(), ...r })); DEMO.put(k, rows); } }
      this.cache[k] = rows; return rows;
    })();
    this.loading[k] = p; try { return await p; } finally { delete this.loading[k]; }
  },
  peek(k) { return this.cache[k] || []; },
  nextKey(k) { const pk = LISTS[k].pk; if (!pk) return null; return Math.max(0, ...this.peek(k).map(r => num(r[pk]))) + 1; },
  async save(k, rec) {
    const L = LISTS[k]; await this.all(k);
    if (L.pk && !num(rec[L.pk])) { if (this.isSP()) await this.all(k, true); rec[L.pk] = this.nextKey(k); }
    let out;
    if (this.isSP()) out = rec._id ? await SP.update(k, rec) : await SP.create(k, rec);
    else { const a = DEMO.all(k) || []; if (rec._id) { const i = a.findIndex(x => x._id === rec._id); a[i >= 0 ? i : a.length] = { ...rec }; } else { rec._id = DEMO.seqNext(); a.push({ ...rec }); } DEMO.put(k, a); out = { ...rec }; }
    const c = this.cache[k] || (this.cache[k] = []); const i = c.findIndex(x => x._id === out._id);
    const merged = { ...rec, ...out }; if (i >= 0) c[i] = merged; else c.push(merged);
    Bus.emit('data', k); return merged;
  },
  async remove(k, rec) {
    if (!rec || !rec._id) return;
    if (this.isSP()) await SP.remove(k, rec); else DEMO.put(k, (DEMO.all(k) || []).filter(x => x._id !== rec._id));
    if (this.cache[k]) this.cache[k] = this.cache[k].filter(x => x._id !== rec._id);
    Bus.emit('data', k);
  },
  /* run many saves/deletes with limited parallelism + progress */
  async bulk(jobs, onProg, par = 4) { let done = 0, i = 0, errs = []; const run = async () => { while (i < jobs.length) { const j = jobs[i++]; try { await j(); } catch (e) { errs.push(e.message); } done++; onProg && onProg(done, jobs.length); } }; await Promise.all(Array.from({ length: Math.min(par, jobs.length || 1) }, run)); return errs; },
  resetCache() { this.cache = {}; SP.siteId = null; SP.listIds = {}; },
};
const Bus = { h: {}, on(e, f) { (this.h[e] = this.h[e] || []).push(f); }, emit(e, ...a) { (this.h[e] || []).forEach(f => { try { f(...a); } catch (x) { console.error(x); } }); } };

/* =====================================================================
   USERS & ROLES — Employees list, DbUser = Yes (like LoginUsersWindow)
   ===================================================================== */
const ROLE_PAGES = {
  Admin: '*', Manager: '*',
  Accounts: 'dash,trans,sales,payment,pnl,customers,suppliers,expenses,services,inq,inqlist,alarms,reports,bank,cust,prod,company,help',
  User: 'dash,trans,sales,customers,services,inq,inqlist,alarms,reports,cust,prod,help',
  Service: 'dash,trans,sales,customers,services,inq,inqlist,alarms,reports,cust,prod,help',
  Technical: 'dash,trans,sales,inq,inqlist,alarms,help', Logistics: 'dash,trans,sales,inq,inqlist,alarms,help',
  HR: 'dash,emp,help',
};
const Auth = {
  user: null,
  can(page) { const u = this.user; if (!u) return false; if (u.super || page === 'home' || page === 'settings') return true; const p = ROLE_PAGES[u.level] || ROLE_PAGES.User; return p === '*' || p.split(',').includes(page); },
  isAdmin() { const u = this.user; return !!u && (u.super || u.level === 'Admin'); },
  async login(name, pw) {
    const emps = await DB.all('emp', true);
    const users = emps.filter(e => e.DbUser && e.User_Name);
    if (!users.length && DB.isSP()) { this.user = { name: name || MS.user() || 'Administrator', level: 'Admin', super: true, bootstrap: true }; return this.user; }
    const u = users.find(e => String(e.User_Name).toLowerCase() === String(name).trim().toLowerCase());
    if (!u) throw new Error('Unknown user name.');
    if (u.Block) throw new Error('This user is blocked. Ask the administrator.');
    const h = await sha256(pw), stored = String(u.Pword || '');
    const ok = stored === 'sha256:' + h || stored === pw;
    if (!ok) throw new Error('Wrong password.');
    if (stored === pw && pw) { u.Pword = 'sha256:' + h; }   // upgrade plain-text password from Access
    u.LastTimeLoggedIn = nowIso(); u.LoginStatus = true; u.NoOfSenstion = num(u.NoOfSenstion) + 1; u.StationLoggedInIfo = navigator.userAgent.slice(0, 200);
    DB.save('emp', u).catch(() => {});
    this.user = { name: u.User_Name, full: LISTS.emp.title(u), level: u.Access_Level || 'User', super: u.SuperAdmin === 'ALL', empId: u.Employee1ID, _id: u._id };
    return this.user;
  },
  async logout() { const u = this.user; if (u && u._id) { const e = DB.peek('emp').find(x => x._id === u._id); if (e) { e.LoginStatus = false; e.LastTimeLoggedOut = nowIso(); DB.save('emp', e).catch(() => {}); } } this.user = null; sessionStorage.removeItem(APP.ls + '_user'); },
};
const me = () => (Auth.user && (Auth.user.full || Auth.user.name)) || 'System';
