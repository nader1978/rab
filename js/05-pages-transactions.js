/* =====================================================================
   PAGES — one per Access form (see Help page for the mapping)
   ===================================================================== */
const PAGES = [];
const page = (id, sec, icon, label, sub, render, form) => PAGES.push({ id, sec, icon, label, sub, render, form });
const Nav = { cur: null, guard: null };
function go(id, param) { const h = '#' + id + (param !== undefined && param !== null && param !== '' ? '/' + encodeURIComponent(param) : ''); if (location.hash === h) route(); else location.hash = h; }
async function route() {
  if (!Auth.user) return;
  let [id, param] = location.hash.replace(/^#/, '').split('/'); param = param ? decodeURIComponent(param) : '';
  let P = PAGES.find(p => p.id === id); if (!P || !Auth.can(P.id)) { P = PAGES.find(p => Auth.can(p.id)); param = ''; }
  if (Nav.guard && Nav.cur && !(Nav.cur.id === P.id && Nav.cur.param === param)) { const g = Nav.guard; if (!(await g())) { history.replaceState(null, '', '#' + Nav.cur.id + (Nav.cur.param ? '/' + encodeURIComponent(Nav.cur.param) : '')); return; } }
  Nav.guard = null; Nav.cur = { id: P.id, param };
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.id === P.id));
  $('#pgTitle').textContent = P.label; $('#pgSub').textContent = P.sub || ''; $('#sidebar').classList.remove('open');
  const c = $('#content'); c.innerHTML = ''; const v = document.createElement('div'); v.className = 'view active'; v.id = 'view-' + P.id; c.appendChild(v); c.scrollTop = 0;
  try { v.innerHTML = '<div class="empty">Loading…</div>'; await P.render(v, param); } catch (e) { console.error(e); v.innerHTML = `<div class="card"><div class="status-msg error">⚠ ${esc(e.message)}</div><div class="muted" style="margin-top:8px">If this is a SharePoint error, check Settings → SharePoint lists.</div></div>`; }
}
function setDirtyGuard(isDirty) { Nav.guard = async () => !isDirty() || await confirmBox('You have unsaved changes on this page. Leave without saving?', 'Leave', true); }
window.addEventListener('beforeunload', e => { if (Nav.guard && document.querySelector('[data-dirty="1"]')) { e.preventDefault(); e.returnValue = ''; } });
const badgeFor = s => `<span class="badge ${({ Paid: 'ok', Done: 'ok', 'Invoiced Fully': 'ok', Settled: 'ok', Unpaid: 'err', Cancelled: 'err', Due: 'warn', Hold: 'warn', Processing: 'info', Open: 'info', New: 'purple' })[s] || ''}">${esc(s || '—')}</span>`;
const typeBadge = t => `<span class="badge ${({ 'Service Invoice': 'info', Payment: 'warn', Expenses: 'err', Quotation: 'purple' })[t] || ''}">${esc(t || '')}</span>`;

/* ---------------------------------------------------------------- DASHBOARD (frmMainMenu) */
page('dash', 'Main', '🏠', 'Dashboard', 'Main board — sales, P&L, receivables, payables and alerts', async v => {
  await loadCore(); await DB.all('ledger').catch(() => {});
  const per = lsGet('dashPer', 'year');
  const range = p => { const t = today(); if (p === 'month') return [t.slice(0, 8) + '01', t]; if (p === 'year') return [t.slice(0, 5) + '01-01', t]; if (p === '90') return [addDays(t, -90), t]; return ['', '']; };
  const [from, to] = range(per); const T = totals(from, to);
  const trans = DB.peek('trans'), inq = DB.peek('inq');
  const openInq = inq.filter(i => ['New', 'Open', 'Processing'].includes(i.InquiryStatus));
  const reminders = trans.filter(t => t.Reminder_Date && t.Reminder_Date <= today() && num(t.Bal_Trans_Amount) > 0);
  const old30 = trans.filter(t => num(t.Transection_Type) === 1 && num(t.Bal_Trans_Amount) > 0 && daysBetween(t.Transection_Date || today(), today()) > 30);
  const unposted = trans.filter(t => !t.Posted_Timestamp && num(t.Transection_Type) !== 4);
  const expF = ['VisaExpiryDate', 'PassPortExpiryDate', 'EIDExpiryDate', 'LaborCardExpiryDate', 'HealthCardExpiryDate', 'DLExpiryDate'];
  const expiring = DB.peek('emp').filter(e => e.EmploymentStatus !== 'Deactive' && expF.some(f => e[f] && daysBetween(today(), e[f]) <= 30));
  const sales = trans.filter(t => num(t.Transection_Type) === 1), pur = trans.filter(t => [2, 3].includes(num(t.Transection_Type)));
  const mS = monthly(sales, 'Transection_Date', ['Transection_Amount', 'Transection_COGS', 'Transection_Profit']);
  const pl = DB.peek('ledger').length ? DB.peek('ledger') : plRows('live');
  const mP = monthly(pl, 'Line_Trans_Date', ['Line_Sales_Trans_Amnt', 'Goverment_Fee', 'Line_Pur_Line_Amount', r => num(r.Line_Sales_Trans_Amnt) - num(r.Goverment_Fee) - num(r.Line_Pur_Line_Amount)]);
  const mR = monthly(sales, 'Transection_Date', ['Transection_Amount', 'Bal_Trans_Amount']);
  const mA = monthly(pur, 'Transection_Date', ['Transection_Amount', 'Bal_Trans_Amount']);
  const C = [CSSV('--c1'), CSSV('--c2'), CSSV('--c3'), CSSV('--c4')];
  const k = (l, val, sub, col, link) => `<div class="kpi" style="--kc:${col}" ${link ? `onclick="go('${link}')" style="cursor:pointer"` : ''}><div class="k-label">${l}</div><div class="k-val">${val}</div><div class="k-sub">${sub || ''}</div></div>`;
  v.innerHTML = `
  <div class="btn-row" style="margin-bottom:14px"><select id="dPer" style="width:auto">${[['month', 'This month'], ['90', 'Last 90 days'], ['year', 'This year'], ['all', 'All time']].map(([a, b]) => `<option value="${a}" ${per === a ? 'selected' : ''}>${b}</option>`).join('')}</select>
    <span class="spacer"></span>
    ${Auth.can('trans') ? `<button onclick="go('trans','new')">＋ Service Invoice</button><button class="secondary" onclick="go('trans','new:Expenses')">＋ Purchase / Expense</button><button class="secondary" onclick="go('trans','new:Payment')">＋ Direct Payment</button>` : ''}
    ${Auth.can('inq') ? `<button class="secondary" onclick="go('inq','new')">＋ Inquiry</button>` : ''}</div>
  <div class="kpis">
    ${k('Sales', money(T.sales), T.nSales + ' invoices', C[0], 'customers')}${k('Purchases', money(T.purchases), 'supplier invoices', C[2], 'suppliers')}${k('Direct payments', money(T.payments), 'rent, utilities…', C[3], 'expenses')}
    ${k('Cash received', money(T.rcvd), 'from customers', C[1], 'sales')}${k('Cash paid', money(T.paidOut), 'to suppliers', C[2], 'payment')}${k('Cash balance', `<span class="${T.cash < 0 ? 'neg' : ''}">${money(T.cash)}</span>`, 'received − paid', C[0])}
    ${k('Receivable', money(T.receivable), 'customers owe you', C[3], 'customers')}${k('Payable', money(T.payable), 'you owe suppliers', C[2], 'suppliers')}${k('Gross profit', money(T.gross), T.sales ? (T.gross / T.sales * 100).toFixed(1) + '% margin' : '', C[1], 'pnl')}
  </div>
  <div class="charts">
    <div class="card"><div class="card-title" style="margin-bottom:8px">Sales per month</div>${barChart(mS.labels, [{ name: 'Sales', values: mS.values[0], color: C[0] }, { name: 'COGS (Govt. fees)', values: mS.values[1], color: C[2] }, { name: 'Profit', values: mS.values[2], color: C[1], line: true }])}</div>
    <div class="card"><div class="card-title" style="margin-bottom:8px">Profit &amp; loss per month <span class="muted">${DB.peek('ledger').length ? '(posted)' : '(live)'}</span></div>${barChart(mP.labels, [{ name: 'Sales', values: mP.values[0], color: C[0] }, { name: 'Govt. fees', values: mP.values[1], color: C[2] }, { name: 'Expenses', values: mP.values[2], color: C[3] }, { name: 'Profit', values: mP.values[3], color: C[1], line: true }])}</div>
    <div class="card"><div class="card-title" style="margin-bottom:8px">A/R — invoiced vs. still open</div>${barChart(mR.labels, [{ name: 'Invoiced', values: mR.values[0], color: C[0] }, { name: 'Open balance', values: mR.values[1], color: C[2] }])}</div>
    <div class="card"><div class="card-title" style="margin-bottom:8px">A/P — purchases &amp; payments vs. open</div>${barChart(mA.labels, [{ name: 'Purchases + payments', values: mA.values[0], color: C[3] }, { name: 'Open balance', values: mA.values[1], color: C[2] }])}</div>
  </div>
  <div class="grid two" style="margin-top:4px">
    <div class="card"><div class="card-title" style="margin-bottom:12px">🔔 Alerts</div><div class="alert-list">
      ${[[`📞 Open inquiries (New / Open / Processing)`, openInq.length, "go('alarms')"], [`⏰ Payment reminders due`, reminders.length, "go('sales','reminders')"], [`🧾 Customer invoices unpaid > 30 days`, old30.length, "go('reports','aged')"], [`📌 Transactions not posted to P&L`, unposted.length, "go('pnl')"], [`🪪 Staff documents expiring ≤ 30 days`, expiring.length, "go('emp','expiring')"]]
      .map(([t, n, a]) => `<div class="alert-item" onclick="${a}">${t}<span class="n ${n ? 'neg' : 'pos'}">${n}</span></div>`).join('')}</div></div>
    <div class="card"><div class="card-title" style="margin-bottom:12px">🏆 Top customers <span class="muted">(${per === 'all' ? 'all time' : 'period'})</span></div>
      ${(() => { const g = [...groupBy(sales.filter(r => inPeriod(r, from, to)), 'Company_Name')].map(([c, a]) => [c, sum(a, 'Transection_Amount'), sum(a, 'Bal_Trans_Amount')]).sort((a, b) => b[1] - a[1]).slice(0, 7); const mx = Math.max(1, ...g.map(x => x[1]));
        return g.length ? g.map(([c, a, b]) => `<div style="margin-bottom:9px;cursor:pointer" onclick="go('customers','${esc(String(c).replace(/'/g, ''))}')"><div style="display:flex;justify-content:space-between;font-size:12.5px"><span>${esc(c)}</span><b>${money(a)}</b></div><div class="progress" style="margin-top:3px"><div style="width:${a / mx * 100}%"></div></div>${b > 0 ? `<div class="muted">open ${money(b)}</div>` : ''}</div>`).join('') : '<div class="empty">No sales in this period.</div>'; })()}</div>
  </div>`;
  $('#dPer').onchange = e => { lsSet('dashPer', e.target.value); route(); };
}, 'frmMainMenu, Customers_Chart, sfrmMainMenu');

/* ---------------------------------------------------------------- TRANSACTION (OutSources_Manpower_tbl form) */
page('trans', 'Sales & Purchases', '🧾', 'Invoices, Purchases & Payment', 'One record per invoice / purchase / payment — with lines, payment and P&L posting', async (v, param) => {
  await loadCore(); await DB.all('ledger').catch(() => {});
  const all = () => DB.peek('trans').slice().sort((a, b) => num(a.OUTSR_ID) - num(b.OUTSR_ID));
  let h, svc, sup, removed = [], dirty = false;
  function load(p) {
    removed = []; dirty = false;
    if (!p || String(p).startsWith('new')) {
      const t = String(p || '').split(':')[1] || 'Service Invoice';
      h = { TransectionType: t, Transection_Type: ttCode(t), Transection_Date: today(), Posting_Date: today(), Transection_Currency: 'AED', Amount_Paid_Currency: 'AED', Paid_Amount: 0, Service_Type: t === 'Service Invoice' ? 'Immigration' : '', Submit_Setteled_Status: 'New', Region: 'Dubai' };
      svc = isSalesType(t) ? [calcSvcLine({ Trnsction_Qty: 1 })] : []; sup = isSalesType(t) ? [] : (t === 'Expenses' ? [calcSupLine({ Qty: 1 })] : []);
      try { const pf = JSON.parse(sessionStorage.getItem(APP.ls + '_prefill') || 'null'); sessionStorage.removeItem(APP.ls + '_prefill'); if (pf) { Object.assign(h, pf.h || pf); if (pf.svc && pf.svc.length) svc = pf.svc.map(calcSvcLine); dirty = true; } } catch (e) {}
    } else {
      const rec = DB.peek('trans').find(r => String(r.OUTSR_ID) === String(p)); if (!rec) { v.innerHTML = '<div class="card empty">Record not found.</div>'; return false; }
      h = { ...rec }; svc = linesOf('svcLines', h.OUTSR_ID).map(x => ({ ...x })); sup = linesOf('supLines', h.OUTSR_ID).map(x => ({ ...x }));
    }
    return true;
  }
  if (!load(param)) return;
  setDirtyGuard(() => dirty);
  const markDirty = () => { dirty = true; v.dataset.dirty = '1'; $('#tSave', v)?.classList.add('pulse'); };

  function render() {
    const isNew = !h._id, sales = isSalesType(h.TransectionType), posted = !!h.Posted_Timestamp, list = all(), idx = list.findIndex(r => r._id === h._id);
    const tmpl = isNew && sales ? DB.peek('trans').filter(t => t.SaveAs_Defualt && t.Service_Type === h.Service_Type).pop() : null;
    const inqOpts = DB.peek('inq').slice().sort((a, b) => num(b.InquiryID) - num(a.InquiryID));
    v.dataset.dirty = dirty ? '1' : '';
    v.innerHTML = `
    <div class="card" style="padding:12px 16px"><div class="btn-row">
      <button class="ghost small" id="tPrev" ${idx <= 0 && !isNew ? 'disabled' : ''} title="Previous record (Alt+←)">◀</button><button class="ghost small" id="tNext" ${idx < 0 || idx >= list.length - 1 ? 'disabled' : ''} title="Next record (Alt+→)">▶</button>
      <select id="tNew" style="width:auto"><option value="">＋ New…</option>${OPT.transType.map(t => `<option>${t}</option>`).join('')}</select>
      <button class="success" id="tSave" title="Ctrl+S">💾 Save</button>
      ${!isNew ? `<button class="ghost small" id="tDup">⧉ Duplicate</button><button class="ghost small" id="tDel">🗑 Delete</button>` : ''}
      <span class="spacer"></span>
      ${!isNew ? `<button class="secondary small" id="tPay" ${num(h.Bal_Trans_Amount) <= 0 ? 'disabled' : ''}>💳 ${sales ? 'Receive' : 'Pay'}</button>
      <button class="secondary small" id="tPost">${posted ? '↻ Re-post P&L' : '📌 Post to P&L'}</button>
      <button class="secondary small" id="tInv">🖨 ${h.TransectionType === 'Quotation' ? 'Quotation' : sales ? 'Invoice' : 'Voucher'}</button>
      ${sales ? `<button class="ghost small" id="tPV">🧾 Receipt</button>` : ''}
      <button class="ghost small" id="tMail">📧</button><button class="ghost small" id="tWA">🟢 WhatsApp</button><button class="ghost small" id="tSOA">SOA</button>` : ''}
      <button class="ghost small" onclick="go('sales')">☰ List</button>
    </div></div>
    <div class="rec-strip"><span class="big">${esc(h.Transection_Nr || 'New record')}</span>${typeBadge(h.TransectionType)}${badgeFor(h.PaymentStatus || 'Unpaid')}${posted ? `<span class="badge ok">Posted ${fdate(String(h.Posted_Timestamp).slice(0, 10))} by ${esc(h.PostedBy || '')}</span>` : !isNew ? '<span class="badge warn">Not posted to P&L</span>' : ''}
      <span class="spacer" style="flex:1"></span><span class="muted">${isNew ? 'Unsaved' : `Record ${idx + 1} of ${list.length} · created ${esc(h.CreatedBy || '')} ${fdt(h.Creation_Timestamp)}`}</span></div>
    ${tmpl && !svc.some(l => l.Type_Of_Transection) ? `<div class="status-msg info" style="margin:0 0 14px">💡 A default template exists for <b>${esc(h.Service_Type)}</b> (${esc(tmpl.Transection_Nr)}). <button class="small" id="tTmpl">Load its lines</button></div>` : ''}
    <div class="card">
      <div class="tabs"><button class="tab active" data-tab="m">Main</button><button class="tab" data-tab="p">Payment</button><button class="tab" data-tab="o">Inquiry, bank &amp; other</button></div>
      <div class="tab-pane active" data-pane="m">${renderSections('trans', h, [{ fields: ['TransectionType', 'Transection_Date', 'Posting_Date', 'Service_Type', 'Company_Name', 'Contact_Name', 'Driver_Contact_Nr', 'Client_Email', 'Region', 'Transection_Currency', 'Suplr_Transection_Nr', 'Reminder_Date', 'Remarks'] }], { req: ['TransectionType', 'Transection_Date', 'Company_Name'], wide: ['Company_Name'] })}</div>
      <div class="tab-pane" data-pane="p">${renderSections('trans', h, [{ fields: ['PaymentStatus', 'PaymentMethod', 'PaymentDate', 'PaymentVoucherNr', 'Amount_Paid_Currency', 'Beneficiary_Bank_Details', 'Bank_Trns_No', 'Bank_Trns_Date', 'Submit_Setteled_Status', 'Settled_Bank_Trans_Nr', 'Settled_Bank_Trans_Date', 'Paid_Amount'] }], { calc: ['Paid_Amount'] })}<div class="muted" style="margin-top:8px">Paid amount is changed with the 💳 button (or the Payment Window) so every payment is time-stamped.</div></div>
      <div class="tab-pane" data-pane="o"><div class="grid">
        <div class="form-group span2"><label>Inquiry link <span class="hint">matching this company first</span></label><select data-f="InquryLink"><option value=""></option>${inqOpts.sort((a, b) => (norm(b.InquiryCompanyName).includes(norm(h.Company_Name)) && h.Company_Name ? 1 : 0) - (norm(a.InquiryCompanyName).includes(norm(h.Company_Name)) && h.Company_Name ? 1 : 0)).map(i => `<option value="${i.InquiryID}" ${num(h.InquryLink) === num(i.InquiryID) ? 'selected' : ''}>[${i.InquiryID}] [${esc(i.InquiryType || '')}] [${esc(i.InquiryStatus || '')}] ${esc(i.InquiryCompanyName || '')}, ${fdate(i.InquiryDate)}, ${esc(i.TrnscBeneficiaryName || '')}</option>`).join('')}</select></div>
        ${['Beneficiary_Name', 'Beneficiary_Bank_Name', 'Beneficiary_Bank_Account_Nr', 'GL_Link', 'Service_Type_ID', 'SaveAs_Defualt', 'Attch_Docs'].map(n => fieldBox('trans', n, h, { wide: ['Attch_Docs'] })).join('')}
        <div class="sec-title">Audit</div>${['CreatedBy', 'Creation_Timestamp', 'PostedBy', 'Posted_Timestamp', 'Pymnt_PostedBy', 'Pymnt_Posted_Timestamp'].map(n => fieldBox('trans', n, h, { ro: [n] })).join('')}</div></div>
    </div>
    <div class="card"><div class="card-header"><div class="card-title">${sales ? '🧾 Service lines' : '📦 Purchase / expense items'}</div><div class="btn-row"><span class="muted">${sales ? 'Pick a service — fees fill in from the price list or the last invoice.' : h.TransectionType === 'Payment' ? 'Optional: add items, or type the amount below.' : ''}</span><button class="small secondary" id="tAdd">＋ Add line</button></div></div>
      <div class="tbl-wrap" style="max-height:none"><table class="dt lines" id="tLines"></table></div>
      ${!sales && !sup.length ? `<div class="grid" style="margin-top:12px">${fieldBox('trans', 'Transection_Amount', h, { labels: { Transection_Amount: 'Amount (no items)' } })}</div>` : ''}
      <div class="totals" id="tTot"></div>
    </div>`;
    drawLines(); drawTotals(); wire();
  }
  function drawLines() {
    const sales = isSalesType(h.TransectionType), t = $('#tLines', v), F_ = n => fieldOf(sales ? 'svcLines' : 'supLines', n);
    const dl = id => `<datalist id="${id}">${suggestions(sales ? 'svcLines' : 'supLines', F_(sales ? 'Type_Of_Transection' : 'Item_Decs')).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
    if (sales) {
      t.innerHTML = `<thead><tr><th style="width:34px">No.</th><th>Type of transaction</th><th>Govt. location</th><th class="num" style="width:70px">Qty</th><th class="num" style="width:110px">Govt. fee</th><th class="num" style="width:110px">Charges</th><th class="num" style="width:110px">Sub total</th><th class="num" style="width:120px">Amount</th><th>Remarks</th><th style="width:34px"></th></tr></thead><tbody>${svc.map((l, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input list="dlT" data-l="Type_Of_Transection" value="${esc(l.Type_Of_Transection || '')}"></td><td><input list="dlLoc" data-l="Delivery_Location" value="${esc(l.Delivery_Location || '')}"></td><td class="num"><input type="number" step="any" data-l="Trnsction_Qty" value="${l.Trnsction_Qty ?? 1}"></td><td class="num"><input type="number" step="0.01" data-l="Goverment_Fee" value="${l.Goverment_Fee ?? ''}"></td><td class="num"><input type="number" step="0.01" data-l="Trnsction_Charges" value="${l.Trnsction_Charges ?? ''}"></td><td class="num" data-o="Sub_Total">${money(l.Sub_Total)}</td><td class="num" data-o="Transection_Amount"><b>${money(l.Transection_Amount)}</b></td><td><input data-l="Remarks" value="${esc(l.Remarks || '')}"></td><td><button class="tiny ghost" data-rm="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">No lines — click ＋ Add line.</td></tr>'}</tbody>`;
      document.body.querySelector('#dlT')?.remove(); document.body.querySelector('#dlLoc')?.remove();
      document.body.insertAdjacentHTML('beforeend', dl('dlT') + `<datalist id="dlLoc">${suggestions('svcLines', F_('Delivery_Location')).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`);
    } else {
      t.innerHTML = `<thead><tr><th style="width:34px">No.</th><th>Item category</th><th>Item description</th><th class="num" style="width:80px">Qty</th><th class="num" style="width:120px">Unit price</th><th class="num" style="width:130px">Line amount</th><th>Remarks</th><th style="width:34px"></th></tr></thead><tbody>${sup.map((l, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input list="dlC" data-l="Item_Ctgry" value="${esc(l.Item_Ctgry || '')}"></td><td><input list="dlT" data-l="Item_Decs" value="${esc(l.Item_Decs || '')}"></td><td class="num"><input type="number" step="any" data-l="Qty" value="${l.Qty ?? 1}"></td><td class="num"><input type="number" step="0.01" data-l="Unit_Price" value="${l.Unit_Price ?? ''}"></td><td class="num" data-o="Line_Amount"><b>${money(l.Line_Amount)}</b></td><td><input data-l="Remarks" value="${esc(l.Remarks || '')}"></td><td><button class="tiny ghost" data-rm="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No items.</td></tr>'}</tbody>`;
      document.body.querySelector('#dlT')?.remove(); document.body.querySelector('#dlC')?.remove();
      document.body.insertAdjacentHTML('beforeend', dl('dlT') + `<datalist id="dlC">${suggestions('supLines', F_('Item_Ctgry')).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`);
    }
    $$('[data-l]', t).forEach(inp => {
      inp.oninput = () => { const arr = sales ? svc : sup, l = arr[+inp.closest('tr').dataset.i], f = inp.dataset.l; l[f] = inp.type === 'number' ? (inp.value === '' ? null : num(inp.value)) : inp.value; (sales ? calcSvcLine : calcSupLine)(l); const tr = inp.closest('tr'); $$('[data-o]', tr).forEach(td => td.innerHTML = td.dataset.o.endsWith('Amount') ? `<b>${money(l[td.dataset.o])}</b>` : money(l[td.dataset.o])); markDirty(); drawTotals(); };
      if (inp.dataset.l === 'Type_Of_Transection') inp.onchange = () => { const l = svc[+inp.closest('tr').dataset.i], p = priceFor(inp.value); if (p && !num(l.Goverment_Fee) && !num(l.Trnsction_Charges)) { Object.assign(l, { Goverment_Fee: p.Goverment_Fee, Trnsction_Charges: p.Trnsction_Charges, Delivery_Location: l.Delivery_Location || p.Delivery_Location }); calcSvcLine(l); drawLines(); drawTotals(); toast(`Fees filled from ${p.src}`, ''); } };
    });
    $$('[data-rm]', t).forEach(b => b.onclick = () => { const arr = sales ? svc : sup, i = +b.dataset.rm, l = arr[i]; if (l._id) removed.push({ k: sales ? 'svcLines' : 'supLines', rec: l }); arr.splice(i, 1); markDirty(); drawLines(); drawTotals(); });
  }
  function drawTotals() {
    const x = readForm(v, 'trans', h); calcHeader(x, svc, sup);
    const co = x.Company_Name ? money3(DB.peek('trans').filter(r => r.Company_Name === x.Company_Name && num(r.Transection_Type) === x.Transection_Type && r._id !== h._id).concat(h._id || x.Company_Name ? [x] : [])) : null;
    const mg = num(x.Transection_Amount) ? (num(x.Transection_Profit) / num(x.Transection_Amount) * 100) : 0;
    $('#tTot', v).innerHTML = [['Trans. amount', money(x.Transection_Amount)], ['Qty', intf(x.Transection_Qty)], ...(isSalesType(x.TransectionType) ? [['COGS (Govt. fees)', money(x.Transection_COGS)], ['Profit', money(x.Transection_Profit)], ['Margin', mg.toFixed(1) + '%']] : []), ['Paid', money(x.Paid_Amount)], ['Balance', `<span class="${num(x.Bal_Trans_Amount) > 0 ? 'neg' : 'pos'}">${money(x.Bal_Trans_Amount)}</span>`],
      ...(co ? [[`${esc(x.Company_Name).slice(0, 22)} — total`, money(co.amt)], ['…paid', money(co.paid)], ['…open balance', money(co.bal)]] : [])].map(([a, b]) => `<div class="t"><span>${a}</span><b>${b}</b></div>`).join('');
  }
  function wire() {
    $$('.tab', v).forEach(t => t.onclick = () => { $$('.tab', v).forEach(x => x.classList.toggle('active', x === t)); $$('.tab-pane', v).forEach(p => p.classList.toggle('active', p.dataset.pane === t.dataset.tab)); });
    $$('[data-f]', v).forEach(el => el.addEventListener('input', () => { markDirty(); drawTotals(); }));
    $('[data-f="TransectionType"]', v).onchange = e => { const was = isSalesType(h.TransectionType); h = readForm(v, 'trans', h); h.TransectionType = e.target.value; if (was !== isSalesType(h.TransectionType)) { if (svc.length || sup.length) toast('Lines kept — switch back to see them.', 'warn'); } if (!isSalesType(h.TransectionType) && !sup.length && h.TransectionType === 'Expenses') sup.push(calcSupLine({ Qty: 1 })); if (isSalesType(h.TransectionType) && !svc.length) svc.push(calcSvcLine({ Trnsction_Qty: 1 })); markDirty(); render(); };
    $('[data-f="Service_Type"]', v).onchange = () => { if (!h._id) { h = readForm(v, 'trans', h); render(); } };
    $('[data-f="Company_Name"]', v).onchange = e => { const last = DB.peek('trans').filter(t => t.Company_Name === e.target.value).sort((a, b) => num(b.OUTSR_ID) - num(a.OUTSR_ID))[0]; if (last) { if (!getVal(v, 'Contact_Name')) setVal(v, 'Contact_Name', last.Contact_Name); if (!getVal(v, 'Driver_Contact_Nr')) setVal(v, 'Driver_Contact_Nr', last.Driver_Contact_Nr); if (!getVal(v, 'Client_Email')) setVal(v, 'Client_Email', last.Client_Email); } else { const c = DB.peek('cust').find(c => c.CustomerName === e.target.value); if (c) { setVal(v, 'Contact_Name', [c.PrimaryContactFirstName, c.PrimaryContactLastName].filter(Boolean).join(' ')); setVal(v, 'Driver_Contact_Nr', c.BusinessPhone); setVal(v, 'Client_Email', c.PrimaryContactEmailAddress); } } drawTotals(); };
    $('#tAdd', v).onclick = () => { if (isSalesType(h.TransectionType)) svc.push(calcSvcLine({ Trnsction_Qty: 1 })); else sup.push(calcSupLine({ Qty: 1 })); h = readForm(v, 'trans', h); markDirty(); render(); setTimeout(() => { const ins = $$('#tLines tbody tr:last-child input', v); ins[0] && ins[0].focus(); }, 30); };
    $('#tSave', v).onclick = save;
    $('#tNew', v).onchange = e => e.target.value && go('trans', 'new:' + e.target.value);
    $('#tPrev', v).onclick = () => { const l = all(), i = l.findIndex(r => r._id === h._id); const t = i < 0 ? l[l.length - 1] : l[i - 1]; t && go('trans', t.OUTSR_ID); };
    $('#tNext', v).onclick = () => { const l = all(), i = l.findIndex(r => r._id === h._id); l[i + 1] && go('trans', l[i + 1].OUTSR_ID); };
    $('#tTmpl', v) && ($('#tTmpl', v).onclick = () => { const t = DB.peek('trans').filter(t => t.SaveAs_Defualt && t.Service_Type === getVal(v, 'Service_Type')).pop(); h = readForm(v, 'trans', h); svc = linesOf('svcLines', t.OUTSR_ID).map(l => { const c = { ...l }; delete c._id; delete c.Dlvery_Rcrd_Link; c.Transection_Date = null; return calcSvcLine(c); }); markDirty(); render(); toast('Default lines loaded', 'success'); });
    if (!h._id) return;
    $('#tDup', v).onclick = async () => { if (dirty && !(await confirmBox('Discard unsaved changes and duplicate the saved record?'))) return; const c = { ...h }; ['_id', 'OUTSR_ID', 'Transection_Nr', 'PostedBy', 'Posted_Timestamp', 'Pymnt_PostedBy', 'Pymnt_Posted_Timestamp', 'PaymentVoucherNr', 'PaymentDate', 'Bank_Trns_No', 'Bank_Trns_Date', 'SaveAs_Defualt'].forEach(k => delete c[k]); Object.assign(c, { Paid_Amount: 0, PaymentStatus: 'Unpaid', Transection_Date: today(), Posting_Date: today(), CreatedBy: null, Creation_Timestamp: null }); h = c; svc = svc.map(l => { const x = { ...l }; delete x._id; x.Transection_Date = null; return x; }); sup = sup.map(l => { const x = { ...l }; delete x._id; x.Trans_Date = null; return x; }); removed = []; markDirty(); render(); toast('Copy ready — review and Save.', ''); };
    $('#tDel', v).onclick = async () => { if (!(await confirmBox(`Delete <b>${esc(h.Transection_Nr)}</b> with its lines${h.Posted_Timestamp ? ' and its P&L records' : ''}?`, 'Delete', true))) return; try { await deleteTransaction(h); dirty = false; toast('Deleted', 'success'); go('sales'); } catch (e) { toast(e.message, 'error'); } };
    $('#tPay', v).onclick = () => payDialog(h, async nh => { h = nh; load(h.OUTSR_ID); render(); });
    $('#tPost', v).onclick = async () => { if (dirty) await save(true); try { const n = await postToLedger(h); h = DB.peek('trans').find(r => r._id === h._id) || h; toast(`Posted ${n} line(s) to P&L ✔`, 'success'); render(); } catch (e) { toast(e.message, 'error'); } };
    $('#tInv', v).onclick = () => (isSalesType(h.TransectionType) ? printInvoice(h) : printVoucher([h]));
    $('#tPV', v) && ($('#tPV', v).onclick = () => printVoucher([h], true));
    $('#tSOA', v).onclick = () => printSOA(h.Company_Name);
    $('#tMail', v).onclick = () => { const s = `${h.TransectionType} ${h.Transection_Nr} — ${company().CompanyFullName || ''}`; const b = `Dear ${h.Contact_Name || 'Customer'},\n\nPlease find the details of ${h.TransectionType} ${h.Transection_Nr} dated ${fdate(h.Transection_Date)}.\nAmount: ${h.Transection_Currency || 'AED'} ${money(h.Transection_Amount)}\nPaid: ${money(h.Paid_Amount)}\nBalance: ${money(h.Bal_Trans_Amount)}\n\nRegards,\n${me()}`; location.href = `mailto:${encodeURIComponent(h.Client_Email || '')}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(b)}`; };
    $('#tWA', v).onclick = () => { let p = String(h.Driver_Contact_Nr || '').replace(/\D/g, ''); if (p.startsWith('0')) p = '971' + p.slice(1); const msg = `${company().CompanyFullName || 'RAB'}: ${h.TransectionType} ${h.Transection_Nr} — ${h.Transection_Currency || 'AED'} ${money(h.Transection_Amount)}, balance ${money(h.Bal_Trans_Amount)}. Thank you.`; window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank'); };
  }
  async function save(quiet) {
    if (!validate(v, ['TransectionType', 'Transection_Date', 'Company_Name'])) return false;
    const x = readForm(v, 'trans', h); if (x.InquryLink) x.InquryLink = num(x.InquryLink);
    const keepSvc = isSalesType(x.TransectionType) ? svc.filter(l => l.Type_Of_Transection || num(l.Transection_Amount)) : [], keepSup = !isSalesType(x.TransectionType) ? sup.filter(l => l.Item_Decs || l.Item_Ctgry || num(l.Line_Amount)) : [];
    const drop = [...(isSalesType(x.TransectionType) ? sup : svc), ...(isSalesType(x.TransectionType) ? svc.filter(l => !keepSvc.includes(l)) : sup.filter(l => !keepSup.includes(l)))].filter(l => l._id).map(l => ({ k: ('Sub_Total' in l || 'Dlvery_Rcrd_Link' in l) ? 'svcLines' : 'supLines', rec: l }));
    if (!keepSvc.length && !keepSup.length && !num(x.Transection_Amount)) { toast('Add at least one line or an amount.', 'warn'); return false; }
    const b = $('#tSave', v); b.disabled = true; b.textContent = 'Saving…';
    try {
      const wasNew = !h._id, prevInq = num(h.InquryLink);
      h = await saveTransaction(x, keepSvc, keepSup, [...removed, ...drop]); dirty = false; v.dataset.dirty = '';
      if (!quiet) toast(`Saved ${h.Transection_Nr} ✔`, 'success');
      if (h.InquryLink && (wasNew || prevInq !== num(h.InquryLink)) && ttCode(h.TransectionType) === 1) inquiryStatusPopup(h);
      if (wasNew) { history.replaceState(null, '', '#trans/' + h.OUTSR_ID); Nav.cur.param = String(h.OUTSR_ID); }
      load(h.OUTSR_ID); render(); return true;
    } catch (e) { toast('Save failed: ' + e.message, 'error', 7000); b.disabled = false; b.textContent = '💾 Save'; return false; }
  }
  v.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } if (e.altKey && e.key === 'ArrowLeft') $('#tPrev', v)?.click(); if (e.altKey && e.key === 'ArrowRight') $('#tNext', v)?.click(); };
  render();
}, 'OutSources_Manpower_tbl, Supplier_Items_tbl subform, OutsourceDeliveredInvoices_DS, Attachments');

/* Pay Tran Window — pay / receive one transaction */
function payDialog(h, done) {
  const sales = isSalesType(h.TransectionType), bal = num(h.Bal_Trans_Amount), banks = DB.peek('bank');
  const body = Modal.open(`${sales ? 'Receive payment' : 'Pay'} — ${h.Transection_Nr}`, `
    <div class="rec-strip"><span>${esc(h.Company_Name)} · ${esc(h.Contact_Name || '')}</span><span class="spacer" style="flex:1"></span><span>Bill ${money(h.Transection_Amount)} · Paid ${money(h.Paid_Amount)} · <b>Balance ${money(bal)}</b></span></div>
    <div class="grid">
      <div class="form-group"><label>Amount <span class="req">*</span></label><input type="number" step="0.01" id="pAmt" value="${r2(bal)}"></div>
      ${fieldBox('trans', 'PaymentMethod', { PaymentMethod: h.PaymentMethod || 'Cash' })}${fieldBox('trans', 'PaymentDate', { PaymentDate: today() })}
      ${fieldBox('trans', 'PaymentVoucherNr', { PaymentVoucherNr: nextPV() })}
      <div class="form-group"><label>Bank / cash account</label><select data-f="Beneficiary_Bank_Details"><option value=""></option>${banks.map(b => `<option ${b.DefaultBankAccount ? 'selected' : ''}>${esc(b.Bank_Desc)}</option>`).join('')}</select></div>
      ${fieldBox('trans', 'Bank_Trns_No', {})}${fieldBox('trans', 'Bank_Trns_Date', {})}${fieldBox('trans', 'Amount_Paid_Currency', { Amount_Paid_Currency: h.Transection_Currency || 'AED' })}
      <div class="form-group span2"><label>Payment remarks</label><input type="text" id="pRem"></div>
    </div>`, [{ label: 'Cancel', cls: 'ghost' }, { label: sales ? '💰 Receive' : '💸 Pay now', cls: 'success', onClick: async () => {
      const amt = num($('#pAmt', body).value); if (amt <= 0) { toast('Enter an amount.', 'warn'); return; }
      if (amt > bal + 0.001 && !(await confirmBox(`Amount ${money(amt)} is more than the balance ${money(bal)}. Continue?`))) return;
      const p = readForm(body, 'trans', {}); p.Remarks = $('#pRem', body).value;
      try { const nh = await applyPayment({ ...h }, amt, p); Modal.close(); toast('Payment recorded ✔', 'success'); done && done(nh); if (await confirmBox('Print the payment voucher / receipt now?', 'Print')) printVoucher([nh], sales); } catch (e) { toast(e.message, 'error'); }
    } }], 'wide');
}
/* Inqrs_Alarms_Update — update the linked inquiry after invoicing */
function inquiryStatusPopup(h) {
  const i = DB.peek('inq').find(x => num(x.InquiryID) === num(h.InquryLink)); if (!i) return;
  const body = Modal.open('Update inquiry status', `<div class="card-desc">This invoice is linked to inquiry <b>[${i.InquiryID}] ${esc(i.InquiryCompanyName || '')}</b> — current status ${badgeFor(i.InquiryStatus)}, invoicing ${badgeFor(i.InvoicingStatus || 'Not Yet')}.</div>
    <div class="grid two">${fieldBox('inq', 'InquiryStatus', { InquiryStatus: 'Done' })}${fieldBox('inq', 'InvoicingStatus', { InvoicingStatus: 'Invoiced Fully' })}</div>`, [{ label: 'Skip', cls: 'ghost' }, { label: 'Update', onClick: async () => { const x = readForm(body, 'inq', i); x.NavInvoiceLink = h.Transection_Nr; x.NavInvoiceAmnt = h.Transection_Amount; x.NavInvoiceDate = h.Transection_Date; x.NavUserID = me(); try { await DB.save('inq', x); toast('Inquiry updated', 'success'); } catch (e) { toast(e.message, 'error'); } Modal.close(); } }], 'narrow');
}
