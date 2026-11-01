/* =====================================================================
   PRINT REPORTS (Rab_Invoice, Payment Voucher MSF, Customer_SOA, CustomerOSBAgedReport,
   Profit_Loss_Statment, Petty Cash Summary Report, overview reports)
   ===================================================================== */
function amountInWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const w = x => x < 20 ? a[x] : x < 100 ? b[Math.floor(x / 10)] + (x % 10 ? '-' + a[x % 10] : '') : x < 1000 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' and ' + w(x % 100) : '') : x < 1e6 ? w(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + w(x % 1000) : '') : w(Math.floor(x / 1e6)) + ' Million' + (x % 1e6 ? ' ' + w(x % 1e6) : '');
  const v = Math.abs(r2(n)), i = Math.floor(v), f = Math.round((v - i) * 100);
  return (i ? w(i) : 'Zero') + ' Dirhams' + (f ? ' and ' + w(f) + ' Fils' : '') + ' Only';
}
function printDoc(title, inner, o = {}) {
  const c = company(); const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print.', 'warn'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#222;margin:0;padding:28px 34px;font-size:12.5px}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0078d4;padding-bottom:12px;margin-bottom:18px}
    .co{font-size:20px;font-weight:800;color:#0b3d6b} .co2{font-size:15px;color:#555;direction:rtl} .meta{color:#555;font-size:11.5px;line-height:1.6}
    h1{font-size:19px;margin:0 0 4px;color:#0078d4;text-transform:uppercase;letter-spacing:1px;text-align:right} .sub{color:#666;text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:10px} th{background:#0078d4;color:#fff;padding:7px 8px;text-align:left;font-size:11px;text-transform:uppercase}
    td{padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums} tfoot td{font-weight:700;background:#f1f5f9;border-top:2px solid #0078d4}
    .box{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;margin:6px 0 10px} .box div{border-bottom:1px dotted #bbb;padding:3px 0} .box b{display:inline-block;min-width:130px;color:#555;font-weight:600}
    .tot{margin-left:auto;width:320px;margin-top:12px} .tot div{display:flex;justify-content:space-between;padding:5px 8px;border-bottom:1px solid #eee} .tot .g{background:#0078d4;color:#fff;font-weight:700;font-size:14px}
    .words{margin-top:10px;padding:8px 10px;background:#f5f9ff;border-left:3px solid #0078d4;font-style:italic}
    .sig{display:flex;justify-content:space-between;margin-top:60px;gap:30px} .sig div{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;color:#555}
    .ft{margin-top:30px;border-top:1px solid #ccc;padding-top:8px;color:#777;font-size:10.5px;display:flex;justify-content:space-between}
    .neg{color:#a80000} .grp td{background:#eef5fc;font-weight:700} .bar{position:fixed;bottom:12px;right:12px} .bar button{padding:8px 14px;background:#0078d4;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:600}
    @media print{.bar{display:none} body{padding:10px 14px}}</style></head><body>
    <div class="bar"><button onclick="print()">🖨 Print / Save PDF</button></div>
    <div class="hd"><div><div class="co">${esc(c.CompanyFullName || 'Company name')}</div>${c.ArabicName ? `<div class="co2">${esc(c.ArabicName)}</div>` : ''}<div class="meta">${esc([c.Address, c.City, c.Country].filter(Boolean).join(', '))}${c.POBox ? ' · P.O. Box ' + esc(c.POBox) : ''}<br>${c.TelephoneNumber ? 'Tel: ' + esc(c.TelephoneNumber) : ''} ${c.Email ? ' · ' + esc(c.Email) : ''} ${c.Website ? ' · ' + esc(c.Website) : ''}</div></div>
    <div><h1>${esc(title)}</h1><div class="sub">${o.sub || ''}</div></div></div>${inner}
    <div class="ft"><span>${o.foot || 'This is a computer generated document. E.O.E.'}</span><span>Printed ${fdt(nowIso())} by ${esc(me())}</span></div></body></html>`);
  w.document.close(); if (o.auto !== false) setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
}
function printInvoice(h) {
  const L = linesOf('svcLines', h.OUTSR_ID), S = linesOf('supLines', h.OUTSR_ID), cur = h.Transection_Currency || 'AED', bank = DB.peek('bank').find(b => b.DefaultBankAccount);
  const rows = L.length ? L.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.Type_Of_Transection || '')}${l.Remarks ? `<br><span style="color:#666">${esc(l.Remarks)}</span>` : ''}</td><td>${esc(l.Delivery_Location || '')}</td><td class="n">${intf(l.Trnsction_Qty)}</td><td class="n">${money(l.Goverment_Fee)}</td><td class="n">${money(l.Trnsction_Charges)}</td><td class="n">${money(l.Transection_Amount)}</td></tr>`).join('')
    : S.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.Item_Decs || '')}</td><td>${esc(l.Item_Ctgry || '')}</td><td class="n">${intf(l.Qty)}</td><td class="n">${money(l.Unit_Price)}</td><td class="n"></td><td class="n">${money(l.Line_Amount)}</td></tr>`).join('');
  printDoc(h.TransectionType === 'Quotation' ? 'Quotation' : 'Tax Invoice', `
    <div class="box"><div><b>Transaction No.</b>${esc(h.Transection_Nr)}</div><div><b>Date</b>${fdate(h.Transection_Date)}</div><div><b>Customer</b>${esc(h.Company_Name || '')}</div><div><b>Contact Name</b>${esc(h.Contact_Name || '')}</div><div><b>Contact Nr</b>${esc(h.Driver_Contact_Nr || '')}</div><div><b>Transaction Type</b>${esc(h.TransectionType || '')} · ${esc(h.Service_Type || '')}</div>${h.Beneficiary_Name ? `<div><b>Beneficiary</b>${esc(h.Beneficiary_Name)}</div>` : ''}</div>
    <table><thead><tr><th>No.</th><th>Type of transaction</th><th>Govt. location</th><th class="n">Qty</th><th class="n">Govt. fee</th><th class="n">Charges</th><th class="n">Amount ${cur}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot"><div><span>Invoice amount</span><b>${money(h.Transection_Amount)}</b></div><div><span>Paid amount</span><b>${money(h.Paid_Amount)}</b></div><div class="g"><span>Balance due</span><span>${cur} ${money(h.Bal_Trans_Amount)}</span></div></div>
    <div class="words">${amountInWords(h.Transection_Amount)}</div>${h.Remarks ? `<p><b>Remarks:</b> ${esc(h.Remarks).replace(/\n/g, '<br>')}</p>` : ''}
    ${bank ? `<p style="margin-top:14px;color:#555"><b>Bank details:</b> ${esc(bank.Bank_Desc)} · A/C ${esc(bank.Account_Number || '')} · IBAN ${esc(bank.IBAN || '')} · SWIFT ${esc(bank.SWIFT_Number || '')}</p>` : ''}
    <div class="sig"><div>Prepared by: ${esc(h.CreatedBy || me())}</div><div>Customer signature</div><div>Authorized signature &amp; stamp</div></div>`, { sub: `${esc(h.PaymentStatus || '')}` });
}
function printVoucher(list, receipt) {
  const h0 = list[0] || {}, tot = sum(list, r => r.Paid_Amount);
  printDoc(receipt ? 'Receipt Voucher' : 'Payment Voucher', `
    <div class="box"><div><b>Voucher Nr.</b>${esc(h0.PaymentVoucherNr || '')}</div><div><b>Date</b>${fdate(h0.PaymentDate || today())}</div><div><b>${receipt ? 'Received from' : 'Pay to'}</b>${esc(h0.Company_Name || '')}</div><div><b>Contact Number</b>${esc(h0.Driver_Contact_Nr || '')}</div><div><b>Payment method</b>${esc(h0.PaymentMethod || '')}</div><div><b>Bank / A/C</b>${esc(h0.Beneficiary_Bank_Details || '')} ${esc(h0.Bank_Trns_No ? '· Ref ' + h0.Bank_Trns_No : '')}</div></div>
    <table><thead><tr><th>Sr. No</th><th>Transaction date</th><th>Transaction number</th><th>Description</th><th class="n">Bill amount</th><th class="n">Amount paid</th><th class="n">Balance</th></tr></thead><tbody>${list.map((h, i) => `<tr><td>${i + 1}</td><td>${fdate(h.Transection_Date)}</td><td>${esc(h.Transection_Nr)}</td><td>${esc(h.Service_Type || h.TransectionType || '')}${h.Remarks ? ' — ' + esc(String(h.Remarks).split('\n').pop()) : ''}</td><td class="n">${money(h.Transection_Amount)}</td><td class="n">${money(h.Paid_Amount)}</td><td class="n">${money(h.Bal_Trans_Amount)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="5">Total</td><td class="n">${money(tot)}</td><td class="n">${money(sum(list, 'Bal_Trans_Amount'))}</td></tr></tfoot></table>
    <div class="words">${amountInWords(tot)}</div><div class="sig"><div>Prepared by: ${esc(me())}</div><div>Authorized by</div><div>Received by</div></div>`);
}
function printSOA(co, from, to) {
  if (!co) return toast('No company selected.', 'warn');
  const all = DB.peek('trans').filter(t => t.Company_Name === co && num(t.Transection_Type) !== 4).sort((a, b) => String(a.Transection_Date).localeCompare(String(b.Transection_Date)));
  const before = from ? all.filter(t => String(t.Transection_Date) < from) : [], rows = all.filter(t => inPeriod(t, from, to));
  const ob = { amt: sum(before, 'Transection_Amount'), paid: sum(before, 'Paid_Amount') }; let run = ob.amt - ob.paid;
  printDoc('Statement of Account', `<div class="box"><div><b>Customer / Supplier</b>${esc(co)}</div><div><b>Contact</b>${esc((all[all.length - 1] || {}).Contact_Name || '')}</div><div><b>Period</b>${from ? fdate(from) : fdate((all[0] || {}).Transection_Date)} → ${fdate(to || today())}</div><div><b>Open balance</b>${money(sum(all, 'Bal_Trans_Amount'))}</div></div>
    <table><thead><tr><th>Date</th><th>Rcrd ID</th><th>Trans. Nr</th><th>Type</th><th>P.V. Nr</th><th class="n">Invoices (Dr)</th><th class="n">Paid (Cr)</th><th class="n">Running balance</th></tr></thead><tbody>
    ${from ? `<tr class="grp"><td colspan="5">Opening balance</td><td class="n">${money(ob.amt)}</td><td class="n">${money(ob.paid)}</td><td class="n">${money(run)}</td></tr>` : ''}
    ${rows.map(t => { run += num(t.Transection_Amount) - num(t.Paid_Amount); return `<tr><td>${fdate(t.Transection_Date)}</td><td>${t.OUTSR_ID}</td><td>${esc(t.Transection_Nr)}</td><td>${esc(t.Service_Type || t.TransectionType || '')}</td><td>${esc(t.PaymentVoucherNr || '')}</td><td class="n">${money(t.Transection_Amount)}</td><td class="n">${money(t.Paid_Amount)}</td><td class="n ${run < 0 ? 'neg' : ''}">${money(run)}</td></tr>`; }).join('')}</tbody>
    <tfoot><tr><td colspan="5">Total</td><td class="n">${money(sum(rows, 'Transection_Amount') + ob.amt)}</td><td class="n">${money(sum(rows, 'Paid_Amount') + ob.paid)}</td><td class="n">${money(run)}</td></tr></tfoot></table>`, { sub: esc(co) });
}
function agedRows(asOf) {
  const terms = new Map(DB.peek('cust').map(c => [norm(c.CustomerName), c.Payment_Terms_Code]));
  return DB.peek('trans').filter(t => num(t.Transection_Type) === 1 && num(t.Bal_Trans_Amount) > 0.001 && String(t.Transection_Date) <= asOf).map(t => { const d = daysBetween(t.Transection_Date, asOf), tc = terms.get(norm(t.Company_Name)) || 'CASH', ptc = ({ CASH: 0, '30 DAYS': 30, '45 DAYS': 45, '60 DAYS': 60, '90 DAYS': 90 })[tc] ?? 0, a = num(t.Bal_Trans_Amount); return { ...t, days: d, terms: tc, overdue: d > ptc, b0: d <= 30 ? a : 0, b30: d > 30 && d <= 60 ? a : 0, b60: d > 60 && d <= 90 ? a : 0, b90: d > 90 ? a : 0 }; });
}
function printAged(asOf, onlyCo) {
  let rows = agedRows(asOf); if (onlyCo) rows = rows.filter(r => r.Company_Name === onlyCo);
  const g = [...groupBy(rows, 'Company_Name')].sort((a, b) => sum(b[1], 'Bal_Trans_Amount') - sum(a[1], 'Bal_Trans_Amount'));
  const B = ['b0', 'b30', 'b60', 'b90'];
  printDoc('Customer Outstanding Statement', `<table><thead><tr><th>Date</th><th>Document No</th><th>Contact</th><th class="n">Days</th><th class="n">0-30 Days</th><th class="n">31-60 Days</th><th class="n">61-90 Days</th><th class="n">Over 90 Days</th><th class="n">Balance</th></tr></thead><tbody>
    ${g.map(([co, a]) => `<tr class="grp"><td colspan="3">${esc(co)} <span style="font-weight:400;color:#666">· terms ${esc(a[0].terms)}</span></td><td></td>${B.map(b => `<td class="n">${money(sum(a, b))}</td>`).join('')}<td class="n">${money(sum(a, 'Bal_Trans_Amount'))}</td></tr>` + a.sort((x, y) => x.days - y.days).map(r => `<tr><td>${fdate(r.Transection_Date)}</td><td>${esc(r.Transection_Nr)}</td><td>${esc(r.Contact_Name || '')}</td><td class="n ${r.overdue ? 'neg' : ''}">${r.days}</td>${B.map(b => `<td class="n">${r[b] ? money(r[b]) : ''}</td>`).join('')}<td class="n">${money(r.Bal_Trans_Amount)}</td></tr>`).join('')).join('')}</tbody>
    <tfoot><tr><td colspan="4">Total (${g.length} customers)</td>${B.map(b => `<td class="n">${money(sum(rows, b))}</td>`).join('')}<td class="n">${money(sum(rows, 'Bal_Trans_Amount'))}</td></tr></tfoot></table>`, { sub: 'As of ' + fdate(asOf) });
}
function printPL(from, to, src) {
  const { rows, tot } = plStatement(from, to, src); const g = [...groupBy(rows, r => r.grp || '(other)')];
  printDoc('Profit & Loss Statement', `<table><thead><tr><th>Type of transaction</th><th class="n">Count</th><th class="n">Sales (+)</th><th class="n">COGS (−)</th><th class="n">Expenses (−)</th><th class="n">Profit (+/−)</th></tr></thead><tbody>
    ${g.map(([grp, a]) => `<tr class="grp"><td>${esc(grp)}</td><td class="n">${intf(sum(a, 'qty'))}</td><td class="n">${money(sum(a, 'sales'))}</td><td class="n">${money(sum(a, 'fee'))}</td><td class="n">${money(sum(a, 'exp'))}</td><td class="n">${money(sum(a, 'profit'))}</td></tr>` + a.map(r => `<tr><td style="padding-left:20px">${esc(r.type)}</td><td class="n">${intf(r.qty)}</td><td class="n">${money(r.sales)}</td><td class="n">${money(r.fee)}</td><td class="n">${money(r.exp)}</td><td class="n ${r.profit < 0 ? 'neg' : ''}">${money(r.profit)}</td></tr>`).join('')).join('')}</tbody>
    <tfoot><tr><td>Total</td><td class="n">${intf(sum(rows, 'qty'))}</td><td class="n">${money(tot.sales)}</td><td class="n">${money(tot.fee)}</td><td class="n">${money(tot.exp)}</td><td class="n ${tot.profit < 0 ? 'neg' : ''}">${money(tot.profit)}</td></tr></tfoot></table>`, { sub: `Report for the period from ${fdate(from)} to ${fdate(to)} · ${src === 'live' ? 'live data' : 'posted ledger'}` });
}
function printLedgerByContact(contact, from, to) {
  const rows = DB.peek('trans').filter(t => (!contact || t.Contact_Name === contact || t.Company_Name === contact) && inPeriod(t, from, to)).sort((a, b) => String(a.Transection_Date).localeCompare(String(b.Transection_Date)));
  printDoc('Customer Ledger Report', `<table><thead><tr><th>Date</th><th>Rcrd ID</th><th>Trans. Nr</th><th>Service provider</th><th>Receiver / contact</th><th>Type</th><th class="n">Bill amnt</th><th class="n">Paid amnt</th><th class="n">Balance</th></tr></thead><tbody>${rows.map(t => `<tr><td>${fdate(t.Transection_Date)}</td><td>${t.OUTSR_ID}</td><td>${esc(t.Transection_Nr)}</td><td>${esc(t.Company_Name || '')}</td><td>${esc(t.Contact_Name || '')}</td><td>${esc(t.Service_Type || t.TransectionType || '')}</td><td class="n">${money(t.Transection_Amount)}</td><td class="n">${money(t.Paid_Amount)}</td><td class="n">${money(t.Bal_Trans_Amount)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="6">Total</td><td class="n">${money(sum(rows, 'Transection_Amount'))}</td><td class="n">${money(sum(rows, 'Paid_Amount'))}</td><td class="n">${money(sum(rows, 'Bal_Trans_Amount'))}</td></tr></tfoot></table>`, { sub: esc(contact || 'All') + ' · ' + fdate(from) + ' → ' + fdate(to) });
}
function printTable(title, rows, cols) {
  printDoc(title, `<table><thead><tr>${cols.map(c => `<th class="${['c', 'n'].includes(c.t) ? 'n' : ''}">${esc(c.l)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${['c', 'n'].includes(c.t) ? 'n' : ''}">${fmtCell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${cols.map((c, i) => `<td class="n">${c.sum ? (c.t === 'c' ? money(sum(rows, r => typeof c.get === 'function' ? c.get(r) : r[c.f])) : intf(sum(rows, c.f))) : i === 0 ? rows.length + ' rows' : ''}</td>`).join('')}</tr></tfoot></table>`);
}

/* ---------------------------------------------------------------- REPORTS PAGE */
page('reports', 'Reports', '🖨', 'Reports', 'Invoices, vouchers, statements, aged receivables and P&L — print or save as PDF', async (v, param) => {
  await loadCore(); await DB.all('ledger').catch(() => {});
  const cos = uniq(DB.peek('trans').map(t => t.Company_Name)), contacts = uniq(DB.peek('trans').map(t => t.Contact_Name));
  const R = [
    ['inv', '🧾', 'Invoice / Quotation', 'Rab_Invoice', `<div class="form-group span2"><label>Transaction</label><input id="rpTr" list="rpTrL" placeholder="Type number or company…"><datalist id="rpTrL">${DB.peek('trans').filter(t => isSalesType(t.TransectionType)).sort((a, b) => num(b.OUTSR_ID) - num(a.OUTSR_ID)).map(t => `<option value="${esc(t.Transection_Nr)}">${esc(t.Company_Name)} · ${money(t.Transection_Amount)}</option>`).join('')}</datalist></div>`, () => { const t = DB.peek('trans').find(t => t.Transection_Nr === $('#rpTr', v).value.trim()); t ? printInvoice(t) : toast('Pick a transaction.', 'warn'); }],
    ['pv', '💵', 'Payment / Receipt Voucher', 'Payment Voucher MSF', `<div class="form-group span2"><label>Voucher Nr</label><input id="rpPv" list="rpPvL"><datalist id="rpPvL">${uniq(DB.peek('trans').map(t => t.PaymentVoucherNr)).reverse().map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>`, () => { const l = DB.peek('trans').filter(t => t.PaymentVoucherNr === $('#rpPv', v).value.trim()); l.length ? printVoucher(l, num(l[0].Transection_Type) === 1) : toast('No transactions with that voucher number.', 'warn'); }],
    ['soa', '📄', 'Statement of Account', 'Customer_SOA', `<div class="form-group span2"><label>Customer / supplier</label><input id="rpCo" list="rpCoL"><datalist id="rpCoL">${cos.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div><div class="form-group"><label>From</label><input type="date" id="rpF1"></div><div class="form-group"><label>To</label><input type="date" id="rpT1" value="${today()}"></div>`, () => printSOA($('#rpCo', v).value.trim(), $('#rpF1', v).value, $('#rpT1', v).value)],
    ['aged', '⏳', 'Customer Outstanding (aged)', 'CustomerOSBAgedReport · All · ConfirmationBal', `<div class="form-group"><label>As of</label><input type="date" id="rpAs" value="${today()}"></div><div class="form-group span2"><label>Only this customer <span class="hint">empty = all</span></label><input id="rpAc" list="rpCoL"></div>`, () => printAged($('#rpAs', v).value || today(), $('#rpAc', v).value.trim())],
    ['pl', '📊', 'Profit & Loss Statement', 'Profit_Loss_Statment', `<div class="form-group"><label>From</label><input type="date" id="rpF2" value="${today().slice(0, 5)}01-01"></div><div class="form-group"><label>To</label><input type="date" id="rpT2" value="${today()}"></div><div class="form-group"><label>Source</label><select id="rpS2"><option value="posted">Posted ledger</option><option value="live">Live transactions</option></select></div>`, () => printPL($('#rpF2', v).value, $('#rpT2', v).value, $('#rpS2', v).value)],
    ['led', '📒', 'Ledger by contact (petty cash)', 'Petty Cash Summary Report · _Receiver', `<div class="form-group span2"><label>Contact / company <span class="hint">empty = all</span></label><input id="rpCt" list="rpCtL"><datalist id="rpCtL">${contacts.concat(cos).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div><div class="form-group"><label>From</label><input type="date" id="rpF3" value="${addDays(today(), -30)}"></div><div class="form-group"><label>To</label><input type="date" id="rpT3" value="${today()}"></div>`, () => printLedgerByContact($('#rpCt', v).value.trim(), $('#rpF3', v).value, $('#rpT3', v).value)],
  ];
  v.innerHTML = `<div class="grid two">${R.map(([id, ic, t, acc, f]) => `<div class="card" id="rp_${id}"><div class="card-header"><div class="card-title">${ic} ${t}</div><span class="badge">${esc(acc)}</span></div><div class="grid">${f}</div><div class="btn-row" style="margin-top:12px"><span class="spacer"></span><button data-rp="${id}">🖨 Open report</button></div></div>`).join('')}
    <div class="card"><div class="card-header"><div class="card-title">📋 Overview lists</div><span class="badge">*_Overview_List_Full_Rpt</span></div><div class="btn-row">${[['customers', 'Customers'], ['suppliers', 'Suppliers'], ['expenses', 'Expenses'], ['services', 'Services']].map(([p, l]) => `<button class="secondary small" onclick="go('${p}')">${l} → Print</button>`).join('')}<button class="secondary small" onclick="go('sales')">All transactions → Excel</button></div></div></div>`;
  R.forEach(([id, , , , , fn]) => $(`[data-rp="${id}"]`, v).onclick = fn);
  if (param && $('#rp_' + param, v)) { $('#rp_' + param, v).scrollIntoView(); $('#rp_' + param, v).style.boxShadow = '0 0 0 3px var(--brand)'; }
}, 'sfrmMainMenu_Reports + all reports');
