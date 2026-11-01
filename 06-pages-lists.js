/* ---------------------------------------------------------------- SALES LIST WINDOW */
const TRANS_COLS = [
  { f: 'OUTSR_ID', l: 'Reg. Nr', t: 'n' }, { f: 'Transection_Date', l: 'Date', t: 'd' }, { f: 'Transection_Nr', l: 'Trans. Nr' },
  { f: 'TransectionType', l: 'Type', html: r => typeBadge(r.TransectionType) }, { f: 'Company_Name', l: 'Client / Supplier' }, { f: 'Contact_Name', l: 'Contact' },
  { f: 'Service_Type', l: 'Service type' }, { f: 'Transection_Amount', l: 'Amount', t: 'c', sum: 1 }, { f: 'Paid_Amount', l: 'Paid', t: 'c', sum: 1 }, { f: 'Bal_Trans_Amount', l: 'Balance', t: 'c', sum: 1 },
  { f: 'PaymentStatus', l: 'Status', html: r => badgeFor(r.PaymentStatus) }, { f: 'Posted_Timestamp', l: 'P&L', html: r => r.Posted_Timestamp ? '<span class="badge ok">Posted</span>' : '' }];
page('sales', 'Sales & Purchases', '📋', 'Transactions List', 'Search all invoices, purchases and payments (Sales Trns. List Window)', async (v, param) => {
  await loadCore();
  const S = lsGet('salesFlt', { mode: 'Date Range', from: addDays(today(), -90), to: today(), type: '', status: '', q: '' });
  if (param === 'reminders') Object.assign(S, { mode: 'Reminders', q: '' });
  if (param === 'open') Object.assign(S, { status: 'open' });
  v.innerHTML = `<div class="card"><div class="toolbar">
      <select id="sMode">${['Date Range', 'Invoice Nr', 'Customer Name', 'Contact Name', 'Reminders'].map(m => `<option ${S.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input type="search" id="sQ" placeholder="Search…" value="${esc(S.q)}" list="sDl"><datalist id="sDl"></datalist>
      <input type="date" id="sFrom" value="${S.from}"><input type="date" id="sTo" value="${S.to}">
      <select id="sType"><option value="">All types</option>${OPT.transType.map(t => `<option ${S.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select id="sStat"><option value="">Any status</option><option value="open" ${S.status === 'open' ? 'selected' : ''}>Open balance only</option>${OPT.payStatus.map(t => `<option ${S.status === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <span style="flex:1"></span><button class="ghost small" id="sSOA">📄 Send SOA</button><button class="ghost small" id="sExp">⬇ Excel</button><button class="small" onclick="go('trans','new')">＋ New</button></div><div id="sGrid"></div></div>`;
  let grid;
  const rows = () => {
    let r = DB.peek('trans'); const q = $('#sQ', v).value.trim().toLowerCase(), m = $('#sMode', v).value, from = $('#sFrom', v).value, to = $('#sTo', v).value;
    if (m === 'Reminders') r = r.filter(t => t.Reminder_Date && t.Reminder_Date <= today() && num(t.Bal_Trans_Amount) > 0);
    else if (m === 'Date Range' || !q) r = r.filter(t => inPeriod(t, from, to));
    if (q) { const f = { 'Invoice Nr': ['Transection_Nr', 'OUTSR_ID', 'Suplr_Transection_Nr', 'PaymentVoucherNr'], 'Customer Name': ['Company_Name'], 'Contact Name': ['Contact_Name', 'Driver_Contact_Nr'] }[m] || ['Transection_Nr', 'Company_Name', 'Contact_Name', 'Remarks', 'Service_Type']; r = textFilter(r, q, f); }
    const ty = $('#sType', v).value, st = $('#sStat', v).value; if (ty) r = r.filter(t => t.TransectionType === ty);
    if (st === 'open') r = r.filter(t => num(t.Bal_Trans_Amount) !== 0); else if (st) r = r.filter(t => t.PaymentStatus === st);
    return r;
  };
  const draw = () => {
    const m = $('#sMode', v).value; $('#sDl', v).innerHTML = (m === 'Customer Name' ? suggestions('trans', fieldOf('trans', 'Company_Name')) : m === 'Contact Name' ? suggestions('trans', fieldOf('trans', 'Contact_Name')) : []).map(x => `<option value="${esc(x)}">`).join('');
    lsSet('salesFlt', { mode: m === 'Reminders' ? 'Date Range' : m, q: $('#sQ', v).value, from: $('#sFrom', v).value, to: $('#sTo', v).value, type: $('#sType', v).value, status: $('#sStat', v).value });
    const r = rows(); if (!grid) grid = makeGrid($('#sGrid', v), { cols: TRANS_COLS, rows: r, onRow: x => go('trans', x.OUTSR_ID), sortBy: 'Transection_Date', desc: true, rowClass: x => x.Reminder_Date && x.Reminder_Date <= today() && num(x.Bal_Trans_Amount) > 0 ? 'sel' : '' }); else grid.redraw(r);
  };
  ['#sMode', '#sFrom', '#sTo', '#sType', '#sStat'].forEach(s => $(s, v).onchange = draw); $('#sQ', v).oninput = debounce(draw, 200);
  $('#sExp', v).onclick = () => exportXlsx('Transactions', grid.rows(), TRANS_COLS.map(c => ({ ...c, html: null })));
  $('#sSOA', v).onclick = () => { const cos = uniq(grid.rows().map(r => r.Company_Name)); if (cos.length === 1) printSOA(cos[0], $('#sFrom', v).value, $('#sTo', v).value); else toast(cos.length ? `${cos.length} companies in the list — search one Customer Name first.` : 'No rows.', 'warn'); };
  draw();
}, 'SalesList_Window, Petty_Cash_Payment_List_All');

/* ---------------------------------------------------------------- PAYMENT WINDOW (multi-transaction) */
page('payment', 'Sales & Purchases', '💳', 'Payment Window', 'Receive or pay several open transactions in one go (Payment Window)', async v => {
  await loadCore();
  const banks = DB.peek('bank');
  v.innerHTML = `<div class="card"><div class="card-title" style="margin-bottom:12px">1 · Find open transactions</div><div class="toolbar">
      <select id="pMode"><option value="in">Receive Payment (customers)</option><option value="out">Pay Expenses (suppliers)</option></select>
      <input type="search" id="pCo" placeholder="Client / Supplier…" list="pDl" style="max-width:340px"><datalist id="pDl"></datalist>
      <label class="muted">From</label><input type="date" id="pFrom"><label class="muted">To</label><input type="date" id="pTo" value="${today()}">
      <span style="flex:1"></span><span class="muted" id="pInfo"></span></div><div id="pGrid"></div></div>
    <div class="card"><div class="card-title" style="margin-bottom:12px">2 · Payment details</div><div class="grid" id="pForm">
      <div class="form-group"><label>Amount to apply <span class="hint">empty = full balance of selected</span></label><input type="number" step="0.01" id="pAmt"></div>
      ${fieldBox('trans', 'PaymentMethod', { PaymentMethod: 'Bank Transfer' })}${fieldBox('trans', 'PaymentDate', { PaymentDate: today() })}${fieldBox('trans', 'PaymentVoucherNr', { PaymentVoucherNr: nextPV() })}
      <div class="form-group"><label>Bank / cash account</label><select data-f="Beneficiary_Bank_Details"><option value=""></option>${banks.map(b => `<option ${b.DefaultBankAccount ? 'selected' : ''}>${esc(b.Bank_Desc)}</option>`).join('')}</select></div>
      ${fieldBox('trans', 'Bank_Trns_No', {})}${fieldBox('trans', 'Bank_Trns_Date', {})}
      <div class="form-group span2"><label>Payment remarks</label><input type="text" id="pRem"></div></div>
      <div class="btn-row" style="margin-top:14px"><span class="muted" id="pSel">Nothing selected.</span><span class="spacer"></span><button class="success" id="pGo" disabled>⚡ Execute payment</button></div><div id="pSt"></div></div>`;
  let grid, sel = [];
  const open = () => { const out = $('#pMode', v).value === 'out'; return DB.peek('trans').filter(t => (out ? [2, 3].includes(num(t.Transection_Type)) : num(t.Transection_Type) === 1) && num(t.Bal_Trans_Amount) > 0.001); };
  const draw = () => {
    $('#pDl', v).innerHTML = uniq(open().map(t => t.Company_Name)).map(x => `<option value="${esc(x)}">`).join('');
    let r = open(); const co = $('#pCo', v).value.trim(); if (co) r = r.filter(t => norm(t.Company_Name).includes(norm(co)));
    r = r.filter(t => inPeriod(t, $('#pFrom', v).value, $('#pTo', v).value));
    $('#pInfo', v).textContent = `${r.length} open · ${money(sum(r, 'Bal_Trans_Amount'))}`;
    sel = []; upd();
    const cols = [TRANS_COLS[0], TRANS_COLS[1], TRANS_COLS[2], TRANS_COLS[3], TRANS_COLS[4], TRANS_COLS[5], TRANS_COLS[7], TRANS_COLS[8], TRANS_COLS[9]];
    if (!grid) grid = makeGrid($('#pGrid', v), { cols, rows: r, selectable: true, sortBy: 'Transection_Date', desc: false, onSelect: s => { sel = s; upd(); }, maxH: '40vh' }); else { grid.redraw(r); grid.clearSel(); }
  };
  const upd = () => { const b = sum(sel, 'Bal_Trans_Amount'); $('#pSel', v).innerHTML = sel.length ? `<b>${sel.length}</b> selected · balance <b>${money(b)}</b>` : 'Nothing selected — tick the rows to pay.'; $('#pGo', v).disabled = !sel.length; $('#pAmt', v).placeholder = sel.length ? money(b) : ''; };
  ['#pMode', '#pFrom', '#pTo'].forEach(s => $(s, v).onchange = draw); $('#pCo', v).oninput = debounce(draw, 200);
  $('#pGo', v).onclick = async () => {
    const tot = sum(sel, 'Bal_Trans_Amount'); let amt = $('#pAmt', v).value === '' ? tot : num($('#pAmt', v).value);
    if (amt <= 0) return toast('Enter an amount.', 'warn');
    if (!(await confirmBox(`Apply <b>${money(amt)}</b> to ${sel.length} transaction(s)? Oldest first.`, 'Execute'))) return;
    const p = readForm($('#pForm', v), 'trans', {}); p.Remarks = $('#pRem', v).value; const done = [];
    $('#pGo', v).disabled = true;
    for (const t of sel.slice().sort((a, b) => String(a.Transection_Date).localeCompare(String(b.Transection_Date)))) { if (amt <= 0.001) break; const a = Math.min(amt, num(t.Bal_Trans_Amount)); try { done.push(await applyPayment({ ...t }, a, p)); amt = r2(amt - a); } catch (e) { toast(e.message, 'error'); } $('#pSt', v).innerHTML = `<div class="status-msg info">Applied ${done.length}/${sel.length}…</div>`; }
    $('#pSt', v).innerHTML = `<div class="status-msg success">✔ Payment ${esc(p.PaymentVoucherNr || '')} applied to ${done.length} transaction(s).${amt > 0.001 ? ' Unused amount: ' + money(amt) : ''} <button class="small" id="pPrint">🖨 Print voucher</button></div>`;
    $('#pPrint', v).onclick = () => printVoucher(done, $('#pMode', v).value === 'in');
    setVal($('#pForm', v), 'PaymentVoucherNr', nextPV()); $('#pAmt', v).value = ''; draw();
  };
  $('#pFrom', v).value = ''; draw();
}, 'Payment_Window, Petty_Cash_Payment_List, Pay Tran Window');

/* ---------------------------------------------------------------- P&L RUN WINDOW + STATEMENT + LEDGER */
page('pnl', 'Sales & Purchases', '📈', 'Profit & Loss', 'Post transactions to the P&L ledger and view the statement (P&L Run Window)', async (v, param) => {
  await loadCore(); await DB.all('ledger');
  v.innerHTML = `<div class="tabs"><button class="tab active" data-t="run">📌 Run posting</button><button class="tab" data-t="st">📊 P&amp;L statement</button><button class="tab" data-t="led">📚 Ledger records</button></div><div id="plBody"></div>`;
  const body = $('#plBody', v);
  const tabs = {
    run() {
      body.innerHTML = `<div class="card"><div class="toolbar"><label class="muted">From</label><input type="date" id="rFrom" value="${addDays(today(), -15)}"><label class="muted">To</label><input type="date" id="rTo" value="${today()}">
        <select id="rType"><option value="">All types</option>${OPT.transType.filter(t => t !== 'Quotation').map(t => `<option>${t}</option>`).join('')}</select>
        <select id="rState"><option value="un">Not posted</option><option value="all">All</option><option value="posted">Posted</option></select><span style="flex:1"></span>
        <button class="ghost small" id="rUn">↩ Un-post selected</button><button class="success" id="rGo">⚡ Execute posting</button></div><div id="rGrid"></div><div class="progress" style="display:none"><div></div></div><div id="rSt"></div></div>`;
      let grid;
      const rows = () => DB.peek('trans').filter(t => num(t.Transection_Type) !== 4 && inPeriod(t, $('#rFrom', body).value, $('#rTo', body).value) && (!$('#rType', body).value || t.TransectionType === $('#rType', body).value) && ({ un: !t.Posted_Timestamp, posted: !!t.Posted_Timestamp, all: true })[$('#rState', body).value]);
      const draw = () => { if (!grid) grid = makeGrid($('#rGrid', body), { cols: TRANS_COLS, rows: rows(), selectable: true, sortBy: 'Transection_Date', desc: false, maxH: '50vh' }); else { grid.redraw(rows()); grid.clearSel(); } };
      ['#rFrom', '#rTo', '#rType', '#rState'].forEach(s => $(s, body).onchange = draw); draw();
      const run = async (fn, label) => { const s = grid.selected().length ? grid.selected() : grid.rows(); if (!s.length) return toast('Nothing to process.', 'warn'); if (!(await confirmBox(`${label} ${s.length} transaction(s)?`, label))) return; const pb = $('.progress', body); pb.style.display = ''; let d = 0; for (const t of s) { try { await fn(t); } catch (e) { toast(e.message, 'error'); } d++; $('.progress div', body).style.width = (d / s.length * 100) + '%'; $('#rSt', body).innerHTML = `<div class="status-msg info">Task ${d} / ${s.length}</div>`; } $('#rSt', body).innerHTML = `<div class="status-msg success">✔ Task completed — ${s.length} transaction(s).</div>`; draw(); };
      $('#rGo', body).onclick = () => run(t => postToLedger(t), 'Post');
      $('#rUn', body).onclick = () => run(async t => { await DB.bulk(DB.peek('ledger').filter(x => num(x.OUTSR_ID) === num(t.OUTSR_ID)).map(x => () => DB.remove('ledger', x))); t.PostedBy = null; t.Posted_Timestamp = null; await DB.save('trans', t); }, 'Un-post');
    },
    st() {
      body.innerHTML = `<div class="card"><div class="toolbar"><label class="muted">From</label><input type="date" id="qFrom" value="${today().slice(0, 5)}01-01"><label class="muted">To</label><input type="date" id="qTo" value="${today()}">
        <select id="qSrc"><option value="posted">Posted ledger (as in Access)</option><option value="live">Live — all saved transactions</option></select><span style="flex:1"></span><button class="ghost small" id="qXls">⬇ Excel</button><button class="secondary small" id="qPrint">🖨 Print statement</button></div><div id="qOut"></div></div>`;
      const draw = () => { const { rows, tot } = plStatement($('#qFrom', body).value, $('#qTo', body).value, $('#qSrc', body).value);
        $('#qOut', body).innerHTML = `<div class="kpis">${[['Sales (+)', tot.sales, '--c1'], ['Govt. fees / COGS (−)', tot.fee, '--c3'], ['Expenses & purchases (−)', tot.exp, '--c4'], ['Profit (+/−)', tot.profit, '--c2']].map(([l, x, c]) => `<div class="kpi" style="--kc:var(${c})"><div class="k-label">${l}</div><div class="k-val ${x < 0 ? 'neg' : ''}">${money(x)}</div></div>`).join('')}</div><div id="qGrid"></div>`;
        makeGrid($('#qGrid', body), { cols: PL_COLS, rows, sortBy: 'sales', desc: true, maxH: '50vh' }); };
      ['#qFrom', '#qTo', '#qSrc'].forEach(s => $(s, body).onchange = draw); draw();
      $('#qXls', body).onclick = () => exportXlsx('Profit_Loss', plStatement($('#qFrom', body).value, $('#qTo', body).value, $('#qSrc', body).value).rows, PL_COLS);
      $('#qPrint', body).onclick = () => printPL($('#qFrom', body).value, $('#qTo', body).value, $('#qSrc', body).value);
    },
    led() { const lp = listPage(body, { k: 'ledger', noun: 'ledger record', sortBy: 'Line_Trans_Date', search: ['Transection_Nr', 'Company_Name', 'Type_Of_Transection', 'Item_Decs', 'Contact_Name'], cols: [{ f: 'OUTSR_ID', l: 'Reg', t: 'n' }, { f: 'Line_Trans_Date', l: 'Line date', t: 'd' }, { f: 'Transection_Nr', l: 'Trans. Nr' }, { f: 'TransectionType', l: 'Type' }, { f: 'Company_Name', l: 'Company' }, { f: 'Type_Of_Transection', l: 'Item / service' }, { f: 'Line_Sales_Trans_Amnt', l: 'Sales', t: 'c', sum: 1 }, { f: 'Goverment_Fee', l: 'Govt. fee', t: 'c', sum: 1 }, { f: 'Line_Pur_Line_Amount', l: 'Expense', t: 'c', sum: 1 }, { f: 'PostedBy', l: 'Posted by' }], sections: [{ title: 'Ledger record', fields: LISTS.ledger.fields.map(f => f.n) }] }); lp.refresh(); },
  };
  $$('.tab', v).forEach(t => t.onclick = () => { $$('.tab', v).forEach(x => x.classList.toggle('active', x === t)); tabs[t.dataset.t](); });
  tabs.run();
}, 'P&L Run_Window, Profit_Loss_Statment, Transections_Table_records');
const PL_COLS = [{ f: 'grp', l: 'Service type' }, { f: 'type', l: 'Item / type of transaction' }, { f: 'qty', l: 'Count', t: 'n', sum: 1 }, { f: 'sales', l: 'Sales (+)', t: 'c', sum: 1 }, { f: 'fee', l: 'COGS (−)', t: 'c', sum: 1 }, { f: 'exp', l: 'Expenses (−)', t: 'c', sum: 1 }, { f: 'profit', l: 'Profit (+/−)', t: 'c', sum: 1 }];
function plStatement(from, to, src) {
  const rows = plRows(src).filter(r => inPeriod(r, from, to, 'Line_Trans_Date'));
  const g = [...groupBy(rows, r => String(r.Type_Of_Transection || r.Item_Decs || r.Service_Type || '(none)').trim())].map(([type, a]) => { const s = sum(a, 'Line_Sales_Trans_Amnt'), f = sum(a, 'Goverment_Fee'), e = sum(a, 'Line_Pur_Line_Amount'); return { type, grp: a[0].Service_Type || '', qty: a.length, sales: r2(s), fee: r2(f), exp: r2(e), profit: r2(s - f - e) }; });
  const tot = { sales: sum(g, 'sales'), fee: sum(g, 'fee'), exp: sum(g, 'exp') }; tot.profit = tot.sales - tot.fee - tot.exp;
  return { rows: g, tot };
}

/* ---------------------------------------------------------------- OVERVIEWS (Customers / Suppliers / Expenses / Services) */
function overviewPage(id, icon, label, sub, typeNr, form) {
  page(id, 'Overviews', icon, label, sub, async (v, param) => {
    await loadCore();
    const base = () => DB.peek('trans').filter(t => num(t.Transection_Type) === typeNr);
    v.innerHTML = `<div class="card"><div class="toolbar"><input type="search" id="oQ" placeholder="Search company…"><label class="muted">From</label><input type="date" id="oFrom"><label class="muted">To</label><input type="date" id="oTo"><label class="chk" style="padding:0"><input type="checkbox" id="oOpen"> open balance only</label><span style="flex:1"></span><button class="ghost small" id="oXls">⬇ Excel</button><button class="secondary small" id="oPrint">🖨 Print</button></div><div id="oGrid"></div></div><div id="oDrill"></div>`;
    const cols = [{ f: 'Company_Name', l: typeNr === 1 ? 'Customer' : 'Supplier / payee', html: r => `<span class="drill">${esc(r.Company_Name || '(blank)')}</span>` }, { f: 'CountOfOUTSR_ID', l: 'Count', t: 'n', sum: 1 }, { f: 'SumOfTransection_Amount', l: 'Amount', t: 'c', sum: 1 }, { f: 'SumOfPaid_Amount', l: 'Paid', t: 'c', sum: 1 }, { f: 'SumOfBal_Trans_Amount', l: 'Balance', t: 'c', sum: 1 }, ...(typeNr === 1 ? [{ f: 'SumOfTransection_COGS', l: 'COGS', t: 'c', sum: 1 }, { f: 'profit', l: 'Profit', t: 'c', sum: 1 }] : []), { f: 'last', l: 'Last trans.', t: 'd' }];
    let grid;
    const rows = () => { let r = base().filter(t => inPeriod(t, $('#oFrom', v).value, $('#oTo', v).value)); const g = [...groupBy(r, 'Company_Name')].map(([c, a]) => ({ Company_Name: c, CountOfOUTSR_ID: a.length, SumOfTransection_Amount: sum(a, 'Transection_Amount'), SumOfPaid_Amount: sum(a, 'Paid_Amount'), SumOfBal_Trans_Amount: sum(a, 'Bal_Trans_Amount'), SumOfTransection_COGS: sum(a, 'Transection_COGS'), profit: sum(a, 'Transection_Profit'), last: a.map(x => x.Transection_Date).sort().pop() })); return textFilter(g, $('#oQ', v).value, ['Company_Name']).filter(x => !$('#oOpen', v).checked || Math.abs(x.SumOfBal_Trans_Amount) > 0.001); };
    const draw = () => { if (!grid) grid = makeGrid($('#oGrid', v), { cols, rows: rows(), sortBy: 'SumOfTransection_Amount', desc: true, onRow: r => drill(r.Company_Name), maxH: '45vh' }); else grid.redraw(rows()); };
    function drill(co) {
      const d = $('#oDrill', v), r = base().filter(t => t.Company_Name === co && inPeriod(t, $('#oFrom', v).value, $('#oTo', v).value));
      d.innerHTML = `<div class="card"><div class="card-header"><div class="card-title">${esc(co)} — ${r.length} transaction(s)</div><div class="btn-row"><button class="ghost small" id="dSOA">📄 Statement of account</button>${num(sum(r, 'Bal_Trans_Amount')) > 0 ? `<button class="secondary small" onclick="go('payment')">💳 Payment window</button>` : ''}<button class="small" id="dNew">＋ New for this ${typeNr === 1 ? 'customer' : 'supplier'}</button></div></div><div id="dGrid"></div></div>`;
      makeGrid($('#dGrid', d), { cols: TRANS_COLS, rows: r, onRow: x => go('trans', x.OUTSR_ID), sortBy: 'Transection_Date', desc: true, maxH: '45vh' });
      $('#dSOA', d).onclick = () => printSOA(co, $('#oFrom', v).value, $('#oTo', v).value);
      $('#dNew', d).onclick = () => { sessionStorage.setItem(APP.ls + '_prefill', JSON.stringify({ Company_Name: co })); go('trans', 'new:' + ({ 1: 'Service Invoice', 2: 'Payment', 3: 'Expenses' })[typeNr]); };
      d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    ['#oFrom', '#oTo', '#oOpen'].forEach(s => $(s, v).onchange = draw); $('#oQ', v).oninput = debounce(draw, 200);
    $('#oXls', v).onclick = () => exportXlsx(label, grid.rows(), cols.map(c => ({ ...c, html: null })));
    $('#oPrint', v).onclick = () => printTable(label, grid.rows(), cols.map(c => ({ ...c, html: null })));
    draw(); if (param) { $('#oQ', v).value = param; draw(); drill(param); }
  }, form);
}
overviewPage('customers', '👥', 'Customers Overview', 'Sales per customer — amount, paid, balance, profit', 1, 'Customers_Overview_List_Full, Customers_Overview_List subform');
overviewPage('suppliers', '🏭', 'Suppliers Overview', 'Purchases per supplier (Expenses with items)', 3, 'Suppliers_Overview_List_Full, frmSuppliersList');
overviewPage('expenses', '💸', 'Payments & Expenses Overview', 'Direct payments per payee', 2, 'Expenses_Overview_List_Full, frmExpensesList, Payments_Overview_List subform');
page('services', 'Overviews', '🧩', 'Services Overview', 'What you sell — quantity, government fees, charges and cost per service', async (v, param) => {
  await loadCore();
  v.innerHTML = `<div class="card"><div class="toolbar"><input type="search" id="vQ" placeholder="Search service…"><label class="muted">From</label><input type="date" id="vFrom"><label class="muted">To</label><input type="date" id="vTo"><span style="flex:1"></span><button class="ghost small" id="vXls">⬇ Excel</button><button class="secondary small" id="vPrint">🖨 Print</button></div><div id="vGrid"></div></div><div id="vDrill"></div>`;
  const hdr = new Map(DB.peek('trans').map(t => [num(t.OUTSR_ID), t]));
  const lines = () => DB.peek('svcLines').map(l => ({ ...l, _h: hdr.get(num(l.Dlvery_Rcrd_Link)) || {} })).filter(l => num(l._h.Transection_Type) === 1 && inPeriod(l._h, $('#vFrom', v).value, $('#vTo', v).value));
  const cols = [{ f: 'Type_Of_Transection', l: 'Type of transaction', html: r => `<span class="drill">${esc(r.Type_Of_Transection || '(blank)')}</span>` }, { f: 'SumOfTrnsction_Qty', l: 'Qty', t: 'n', sum: 1 }, { f: 'SumOfGoverment_Fee', l: 'Govt. fees', t: 'c', sum: 1 }, { f: 'SumOfTrnsction_Charges', l: 'Service charges', t: 'c', sum: 1 }, { f: 'SumOfTransection_Amount', l: 'Amount', t: 'c', sum: 1 }, { f: 'SumOfTransection_Type_Cost', l: 'Cost', t: 'c', sum: 1 }, { f: 'avg', l: 'Avg. charge', t: 'c' }];
  let grid;
  const rows = () => textFilter([...groupBy(lines(), l => l.Type_Of_Transection)].map(([t, a]) => { const q = sum(a, 'Trnsction_Qty'); return { Type_Of_Transection: t, SumOfTrnsction_Qty: q, SumOfGoverment_Fee: sum(a, l => num(l.Goverment_Fee) * num(l.Trnsction_Qty)), SumOfTrnsction_Charges: sum(a, l => num(l.Trnsction_Charges) * num(l.Trnsction_Qty)), SumOfTransection_Amount: sum(a, 'Transection_Amount'), SumOfTransection_Type_Cost: sum(a, 'Transection_Type_Cost'), avg: q ? sum(a, l => num(l.Trnsction_Charges) * num(l.Trnsction_Qty)) / q : 0 }; }), $('#vQ', v).value, ['Type_Of_Transection']);
  const draw = () => { if (!grid) grid = makeGrid($('#vGrid', v), { cols, rows: rows(), sortBy: 'SumOfTransection_Amount', desc: true, onRow: r => drill(r.Type_Of_Transection), maxH: '45vh' }); else grid.redraw(rows()); };
  function drill(t) { const d = $('#vDrill', v), r = lines().filter(l => l.Type_Of_Transection === t); d.innerHTML = `<div class="card"><div class="card-title" style="margin-bottom:12px">${esc(t)} — ${r.length} line(s)</div><div id="vdGrid"></div></div>`; makeGrid($('#vdGrid', d), { cols: [{ l: 'Date', t: 'd', get: x => x._h.Transection_Date }, { l: 'Trans. Nr', get: x => x._h.Transection_Nr }, { l: 'Company', get: x => x._h.Company_Name }, { l: 'Contact', get: x => x._h.Contact_Name }, { f: 'Delivery_Location', l: 'Location' }, { f: 'Trnsction_Qty', l: 'Qty', t: 'n', sum: 1 }, { f: 'Goverment_Fee', l: 'Govt. fee', t: 'c' }, { f: 'Trnsction_Charges', l: 'Charges', t: 'c' }, { f: 'Transection_Amount', l: 'Amount', t: 'c', sum: 1 }, { l: 'Posted by', get: x => x._h.PostedBy }], rows: r, onRow: x => go('trans', x._h.OUTSR_ID), maxH: '45vh' }); d.scrollIntoView({ behavior: 'smooth' }); }
  ['#vFrom', '#vTo'].forEach(s => $(s, v).onchange = draw); $('#vQ', v).oninput = debounce(draw, 200);
  $('#vXls', v).onclick = () => exportXlsx('Services_Overview', grid.rows(), cols.map(c => ({ ...c, html: null })));
  $('#vPrint', v).onclick = () => printTable('Services Overview', grid.rows(), cols.map(c => ({ ...c, html: null })));
  draw(); if (param) drill(param);
}, 'Prodcuts_Overview_List_Full, Prodcuts_Overview_List subform');
