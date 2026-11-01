/* ---------------------------------------------------------------- OFFICE INCOMING INQUIRY (record form) */
const DOC_FIELDS = LISTS.inq.fields.filter(f => f.doc);
page('inq', 'Inquiries', '📞', 'Incoming Inquiry', 'Register a customer inquiry, beneficiaries, required documents and requested services', async (v, param) => {
  await Promise.all([loadCore(), DB.all('inqItems'), DB.all('bnf')]);
  const list = () => DB.peek('inq').slice().sort((a, b) => num(a.InquiryID) - num(b.InquiryID));
  let r, items, bnf, removed = [], dirty = false;
  function load(p) {
    removed = []; dirty = false;
    if (!p || p === 'new') { const d = new Date(); r = { InquiryDate: today(), InquiryTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`, InquiryStatus: 'New', InvoicingStatus: 'Not Yet', InquiryRegisteredBy: me(), InquiryReceivedBy: me(), VATPrcntg: num((DB.peek('settings').find(s => s.SettingName === 'DefaultVAT') || {}).SettingValue) || 5, InquiryIncomingSource: 'Phone Call', UAEpass_Login_Type: 'N/A' }; items = []; bnf = []; return true; }
    const x = DB.peek('inq').find(i => String(i.InquiryID) === String(p)); if (!x) return false;
    r = { ...x }; items = linesOf('inqItems', r.InquiryID).map(i => ({ ...i })); bnf = linesOf('bnf', r.InquiryID).map(i => ({ ...i })); return true;
  }
  if (!load(param)) { v.innerHTML = '<div class="card empty">Inquiry not found.</div>'; return; }
  setDirtyGuard(() => dirty);
  const mark = () => { dirty = true; v.dataset.dirty = '1'; };
  const calcItem = it => { it.LineAmount = r2(num(it.Qty ?? 1) * num(it.UnitPrice)); it.VATAmount = r2(it.LineAmount * num(it.VATPrcntg ?? r.VATPrcntg) / 100); it.LineAmountVAT = r2(it.LineAmount + it.VATAmount); return it; };
  function render() {
    const isNew = !r._id, l = list(), idx = l.findIndex(x => x._id === r._id), inv = r.InquiryID ? DB.peek('trans').filter(t => num(t.InquryLink) === num(r.InquiryID)) : [];
    v.innerHTML = `<div class="card" style="padding:12px 16px"><div class="btn-row">
      <button class="ghost small" id="iPrev" ${idx <= 0 && !isNew ? 'disabled' : ''}>◀</button><button class="ghost small" id="iNext" ${idx < 0 || idx >= l.length - 1 ? 'disabled' : ''}>▶</button>
      <button class="small secondary" onclick="go('inq','new')">＋ New</button><button class="success" id="iSave">💾 Save &amp; Post</button>${!isNew ? '<button class="ghost small" id="iDel">🗑 Delete</button>' : ''}
      <span class="spacer"></span>${!isNew ? `<button class="secondary small" id="iInv">🧾 Create service invoice</button><button class="ghost small" id="iMail">📧 Email</button><button class="ghost small" id="iWA">🟢 WhatsApp</button>` : ''}<button class="ghost small" onclick="go('inqlist')">☰ List</button></div></div>
    <div class="rec-strip"><span class="big">${isNew ? 'New inquiry' : 'Inquiry ' + r.InquiryID}</span>${badgeFor(r.InquiryStatus)}${badgeFor(r.InvoicingStatus || 'Not Yet')}${inv.length ? inv.map(t => `<a class="badge info" href="#trans/${t.OUTSR_ID}">${esc(t.Transection_Nr)}</a>`).join('') : ''}<span style="flex:1"></span><span class="muted">${isNew ? '' : `Record ${idx + 1} of ${l.length} · by ${esc(r.RecordCreatedBy || '')} ${fdt(r.RcrdTimeStamp)}`}</span></div>
    <div class="card">${renderSections('inq', r, [{ title: 'Inquiry', fields: ['InquiryDate', 'InquiryTime', 'InquiryType', 'InquiryIncomingSource', 'InquiryStatus', 'Cuurent_Action', 'InquiryReceivedBy', 'InquiryRegisteredBy'] }, { title: 'Customer', fields: ['InquiryCompanyName', 'InquiryContactName', 'InquiryContactNumber', 'InquiryContactEmail', 'InquiryCompanyTelNr', 'TrnscBeneficiaryName', 'UAEpass_Login_Type', 'UAEpass_Login_Nr'] }, { title: 'Details', fields: ['InquiryWasAbout', 'InquiryRespond', 'InquiryRemarks'] }], { req: ['InquiryDate', 'InquiryType', 'InquiryCompanyName'], wide: ['InquiryCompanyName'] })}</div>
    <div class="card"><div class="tabs"><button class="tab active" data-t="b">👤 Beneficiaries (${bnf.length})</button><button class="tab" data-t="d">📎 Required docs (${DOC_FIELDS.filter(f => r[f.n]).length}/${DOC_FIELDS.length})</button><button class="tab" data-t="i">🧾 Requested services (${items.length})</button><button class="tab" data-t="n">💰 Invoicing &amp; control</button></div>
      <div class="tab-pane active" data-p="b"><div class="btn-row" style="margin-bottom:8px"><span class="spacer"></span><button class="small secondary" id="bAdd">＋ Add beneficiary</button></div><div class="tbl-wrap" style="max-height:none"><table class="dt lines" id="bT"></table></div></div>
      <div class="tab-pane" data-p="d"><div class="doc-grid">${DOC_FIELDS.map(f => `<label class="doc-chip ${r[f.n] ? 'on' : ''}"><input type="checkbox" data-doc="${f.n}" ${r[f.n] ? 'checked' : ''}> ${esc(f.l)}</label>`).join('')}</div><div class="grid" style="margin-top:12px">${fieldBox('inq', 'InquiryScanLink', r, { wide: ['InquiryScanLink'] })}${fieldBox('inq', 'InquiryEmailScreenShot', r)}</div><div class="muted" style="margin-top:6px">Tip: paste SharePoint / OneDrive links of the scanned documents (one per line).</div></div>
      <div class="tab-pane" data-p="i"><div class="btn-row" style="margin-bottom:8px"><span class="muted">Prices fill in from the price list / last invoice.</span><span class="spacer"></span><button class="small secondary" id="itAdd">＋ Add service</button></div><div class="tbl-wrap" style="max-height:none"><table class="dt lines" id="itT"></table></div><div class="totals" id="itTot"></div></div>
      <div class="tab-pane" data-p="n">${renderSections('inq', r, [{ fields: ['InvoicingStatus', 'VATPrcntg', 'MinimumAmntApplied', 'CustomerAgrdAboutMinimumChrg', 'NavInvoiceLink', 'NavInvoiceAmnt', 'NavInvoiceDate', 'NavUserID', 'ReceivableCtrlStatus', 'ReceivableCtrlStatusUpdtBy', 'ReceivableCtrlStatusTimeStmp', 'InquiryTransfferedTo', 'InquiryTrnsfrdby', 'InqryTrsfrd', 'NrofSendingEmail'] }], { ro: ['ReceivableCtrlStatusUpdtBy', 'ReceivableCtrlStatusTimeStmp'] })}</div>
    </div>`;
    drawB(); drawI(); wire();
  }
  function drawB() {
    $('#bT', v).innerHTML = `<thead><tr><th>No.</th><th>Beneficiary name</th><th>Gender</th><th>Nationality</th><th>Birth date</th><th>Passport Nr</th><th>Passport expiry</th><th>UID Nr</th><th>EIDA Nr</th><th>Status</th><th>Remarks</th><th></th></tr></thead><tbody>${bnf.map((b, i) => `<tr data-i="${i}"><td>${i + 1}</td>${['Beneficiary_Name', 'Gender', 'Nationality', 'Brith_Day', 'Passport_Nr', 'Passport_Ending_dt', 'UID_Nr', 'EIDA_Nr', 'InquiryStatus', 'Remarks'].map(n => `<td>${inputFor('bnf', fieldOf('bnf', n), b[n], { noSuggest: !['Beneficiary_Name', 'Nationality'].includes(n) }).replace('data-f=', 'data-b=')}</td>`).join('')}<td><button class="tiny ghost" data-rb="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="12" class="empty">No beneficiaries yet.</td></tr>'}</tbody>`;
    $$('[data-b]', v).forEach(el => el.oninput = el.onchange = () => { const b = bnf[+el.closest('tr').dataset.i]; b[el.dataset.b] = el.type === 'checkbox' ? el.checked : el.value || null; mark(); });
    $$('[data-rb]', v).forEach(x => x.onclick = () => { const b = bnf.splice(+x.dataset.rb, 1)[0]; if (b._id) removed.push({ k: 'bnf', rec: b }); mark(); drawB(); });
  }
  function drawI() {
    $('#itT', v).innerHTML = `<thead><tr><th>No.</th><th>Type of transaction</th><th>Govt. location</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th><th class="num">VAT %</th><th class="num">VAT</th><th class="num">Total</th><th>Remarks</th><th></th></tr></thead><tbody>${items.map((it, i) => `<tr data-i="${i}"><td>${i + 1}</td><td><input list="dlSvc" data-it="Type_Of_Transection" value="${esc(it.Type_Of_Transection || '')}"></td><td><input data-it="Delivery_Location" value="${esc(it.Delivery_Location || '')}"></td><td class="num"><input type="number" step="any" data-it="Qty" value="${it.Qty ?? 1}"></td><td class="num"><input type="number" step="0.01" data-it="UnitPrice" value="${it.UnitPrice ?? ''}"></td><td class="num" data-o="LineAmount">${money(it.LineAmount)}</td><td class="num"><input type="number" step="0.01" data-it="VATPrcntg" value="${it.VATPrcntg ?? r.VATPrcntg ?? ''}" style="width:64px"></td><td class="num" data-o="VATAmount">${money(it.VATAmount)}</td><td class="num" data-o="LineAmountVAT"><b>${money(it.LineAmountVAT)}</b></td><td><input data-it="Remarks" value="${esc(it.Remarks || '')}"></td><td><button class="tiny ghost" data-ri="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="11" class="empty">No services requested yet.</td></tr>'}</tbody>`;
    document.body.querySelector('#dlSvc')?.remove(); document.body.insertAdjacentHTML('beforeend', `<datalist id="dlSvc">${suggestions('svcLines', fieldOf('svcLines', 'Type_Of_Transection')).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`);
    $$('[data-it]', v).forEach(el => { el.oninput = () => { const it = items[+el.closest('tr').dataset.i]; it[el.dataset.it] = el.type === 'number' ? (el.value === '' ? null : num(el.value)) : el.value; calcItem(it); $$('[data-o]', el.closest('tr')).forEach(td => td.innerHTML = td.dataset.o === 'LineAmountVAT' ? `<b>${money(it[td.dataset.o])}</b>` : money(it[td.dataset.o])); mark(); totI(); };
      if (el.dataset.it === 'Type_Of_Transection') el.onchange = () => { const it = items[+el.closest('tr').dataset.i], p = priceFor(el.value); it.ItemDesc = el.value; if (p && !num(it.UnitPrice)) { it.UnitPrice = r2(p.Goverment_Fee + p.Trnsction_Charges); it.Delivery_Location = it.Delivery_Location || p.Delivery_Location; it._fee = p.Goverment_Fee; calcItem(it); drawI(); } }; });
    $$('[data-ri]', v).forEach(x => x.onclick = () => { const it = items.splice(+x.dataset.ri, 1)[0]; if (it._id) removed.push({ k: 'inqItems', rec: it }); mark(); drawI(); });
    totI();
  }
  function totI() { $('#itTot', v).innerHTML = [['Items', intf(sum(items, 'Qty'))], ['Amount', money(sum(items, 'LineAmount'))], ['VAT', money(sum(items, 'VATAmount'))], ['Total incl. VAT', money(sum(items, 'LineAmountVAT'))]].map(([a, b]) => `<div class="t"><span>${a}</span><b>${b}</b></div>`).join(''); }
  function wire() {
    $$('.tab', v).forEach(t => t.onclick = () => { $$('.tab', v).forEach(x => x.classList.toggle('active', x === t)); $$('.tab-pane', v).forEach(p => p.classList.toggle('active', p.dataset.p === t.dataset.t)); });
    $$('[data-f]', v).forEach(el => el.addEventListener('input', mark));
    $$('[data-doc]', v).forEach(c => c.onchange = () => { c.closest('.doc-chip').classList.toggle('on', c.checked); mark(); });
    $('[data-f="ReceivableCtrlStatus"]', v).onchange = () => { setVal(v, 'ReceivableCtrlStatusUpdtBy', me()); const el = $('[data-f="ReceivableCtrlStatusTimeStmp"]', v); const d = new Date(); el.value = `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    $('[data-f="InquiryCompanyName"]', v).onchange = e => { const last = DB.peek('inq').filter(i => i.InquiryCompanyName === e.target.value).pop() || {}; const t = DB.peek('trans').filter(x => x.Company_Name === e.target.value).pop() || {}; if (!getVal(v, 'InquiryContactName')) setVal(v, 'InquiryContactName', last.InquiryContactName || t.Contact_Name); if (!getVal(v, 'InquiryContactNumber')) setVal(v, 'InquiryContactNumber', last.InquiryContactNumber || t.Driver_Contact_Nr); if (!getVal(v, 'InquiryContactEmail')) setVal(v, 'InquiryContactEmail', last.InquiryContactEmail || t.Client_Email); };
    $('#bAdd', v).onclick = () => { bnf.push({ Gender: 'Male', InquiryStatus: getVal(v, 'InquiryStatus') }); mark(); drawB(); };
    $('#itAdd', v).onclick = () => { items.push(calcItem({ Qty: 1, VATPrcntg: num(getVal(v, 'VATPrcntg')) })); mark(); drawI(); $$('#itT tbody tr:last-child input', v)[0]?.focus(); };
    $('#iSave', v).onclick = save;
    $('#iPrev', v).onclick = () => { const l = list(), i = l.findIndex(x => x._id === r._id); const t = i < 0 ? l[l.length - 1] : l[i - 1]; t && go('inq', t.InquiryID); };
    $('#iNext', v).onclick = () => { const l = list(), i = l.findIndex(x => x._id === r._id); l[i + 1] && go('inq', l[i + 1].InquiryID); };
    if (r._id) {
      $('#iDel', v).onclick = async () => { if (!(await confirmBox('Delete this inquiry with its beneficiaries and items?', 'Delete', true))) return; await DB.bulk([...items, ...linesOf('inqItems', r.InquiryID)].filter((x, i, a) => x._id && a.findIndex(y => y._id === x._id) === i).map(x => () => DB.remove('inqItems', x)).concat(linesOf('bnf', r.InquiryID).map(x => () => DB.remove('bnf', x)))); await DB.remove('inq', r); dirty = false; toast('Deleted', 'success'); go('inqlist'); };
      $('#iInv', v).onclick = async () => { if (dirty && !(await save())) return; sessionStorage.setItem(APP.ls + '_prefill', JSON.stringify({ h: { Company_Name: r.InquiryCompanyName, Contact_Name: r.InquiryContactName, Driver_Contact_Nr: r.InquiryContactNumber, Client_Email: r.InquiryContactEmail, Service_Type: r.InquiryType, InquryLink: r.InquiryID, Beneficiary_Name: r.TrnscBeneficiaryName, Remarks: r.InquiryWasAbout }, svc: items.map(it => { const p = priceFor(it.Type_Of_Transection) || {}; const fee = Math.min(num(p.Goverment_Fee), num(it.UnitPrice)); return { Type_Of_Transection: it.Type_Of_Transection, Delivery_Location: it.Delivery_Location, Trnsction_Qty: num(it.Qty) || 1, Goverment_Fee: fee, Trnsction_Charges: r2(num(it.UnitPrice) - fee), Remarks: it.Remarks }; }) })); go('trans', 'new:Service Invoice'); };
      $('#iMail', v).onclick = () => { location.href = `mailto:${encodeURIComponent(r.InquiryContactEmail || '')}?subject=${encodeURIComponent('Your inquiry ' + r.InquiryID + ' — ' + (company().CompanyFullName || ''))}&body=${encodeURIComponent(`Dear ${r.InquiryContactName || 'Customer'},\n\nThank you for your inquiry about ${r.InquiryWasAbout || r.InquiryType || ''}.\nRequired documents: ${DOC_FIELDS.map(f => f.l).join(', ')}\nEstimated amount: AED ${money(sum(items, 'LineAmountVAT'))}\n\nRegards,\n${me()}`)}`; r.NrofSendingEmail = num(r.NrofSendingEmail) + 1; DB.save('inq', r).catch(() => {}); };
      $('#iWA', v).onclick = () => { let p = String(r.InquiryContactNumber || '').replace(/\D/g, ''); if (p.startsWith('0')) p = '971' + p.slice(1); window.open(`https://wa.me/${p}?text=${encodeURIComponent(`${company().CompanyFullName || 'RAB'} — inquiry ${r.InquiryID}: ${r.InquiryWasAbout || r.InquiryType || ''}. Status: ${r.InquiryStatus}. Estimated AED ${money(sum(items, 'LineAmountVAT'))}.`)}`, '_blank'); };
    }
  }
  async function save() {
    if (!validate(v, ['InquiryDate', 'InquiryType', 'InquiryCompanyName'])) return false;
    let x = readForm(v, 'inq', r); $$('[data-doc]', v).forEach(c => x[c.dataset.doc] = c.checked);
    const its = items.filter(i => i.Type_Of_Transection || num(i.LineAmount)); x.InquiryNrofItems = sum(its, 'Qty'); x.InquiryAmount = r2(sum(its, 'LineAmount')); x.InquiryVAT = r2(sum(its, 'VATAmount')); x.InquiryAmountVAT = r2(sum(its, 'LineAmountVAT'));
    if (!x._id) { x.RecordCreatedBy = me(); x.RcrdTimeStamp = nowIso(); }
    const b = $('#iSave', v); b.disabled = true;
    try {
      x = await DB.save('inq', x); const id = x.InquiryID;
      const errs = await DB.bulk([...its.map(i => () => { delete i._fee; i.InqryLink = id; i.ItemDesc = i.ItemDesc || i.Type_Of_Transection; i.CreationTimeStamp = i.CreationTimeStamp || nowIso(); return DB.save('inqItems', i); }), ...bnf.filter(b => b.Beneficiary_Name).map(b => () => { b.Link = id; return DB.save('bnf', b); }), ...removed.map(q => () => DB.remove(q.k, q.rec))]);
      if (errs.length) throw new Error(errs[0]);
      dirty = false; v.dataset.dirty = ''; toast('Inquiry saved ✔', 'success');
      if (!r._id) { history.replaceState(null, '', '#inq/' + id); Nav.cur.param = String(id); }
      load(id); render(); return true;
    } catch (e) { toast('Save failed: ' + e.message, 'error', 7000); b.disabled = false; return false; }
  }
  v.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
  render();
}, 'OfficeIncomingVMInquiry, Inquiry_Beneficiary_tbl subform, CoffeeInqryData subform');

/* ---------------------------------------------------------------- INQUIRY LIST */
page('inqlist', 'Inquiries', '📑', 'Inquiry List', 'All incoming inquiries with filters', async (v, param) => {
  await loadCore();
  const [fs, ft] = String(param || '').split('|');
  v.innerHTML = `<div class="card"><div class="toolbar"><input type="search" id="lQ" placeholder="Company, contact, beneficiary…"><select id="lS"><option value="">Any status</option><option value="active" ${fs === 'active' ? 'selected' : ''}>Active (New/Open/Processing)</option>${OPT.inqStatus.map(s => `<option ${fs === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select id="lT"><option value="">Any type</option>${uniq(DB.peek('inq').map(i => i.InquiryType)).map(s => `<option ${ft === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><select id="lI"><option value="">Any invoicing</option>${OPT.invStatus.map(s => `<option>${s}</option>`).join('')}</select>
    <input type="date" id="lFrom"><input type="date" id="lTo"><span style="flex:1"></span><button class="ghost small" id="lX">⬇ Excel</button><button class="small" onclick="go('inq','new')">＋ New inquiry</button></div><div id="lG"></div></div>`;
  const cols = [{ f: 'InquiryID', l: 'ID', t: 'n' }, { f: 'InquiryDate', l: 'Date', t: 'd' }, { f: 'InquiryType', l: 'Type' }, { f: 'InquiryStatus', l: 'Status', html: r => badgeFor(r.InquiryStatus) }, { f: 'InquiryCompanyName', l: 'Company' }, { f: 'InquiryContactName', l: 'Contact' }, { f: 'InquiryContactNumber', l: 'Contact Nr' }, { f: 'TrnscBeneficiaryName', l: 'Beneficiary' }, { f: 'Cuurent_Action', l: 'Current action' }, { f: 'InquiryAmountVAT', l: 'Amount', t: 'c', sum: 1 }, { f: 'InvoicingStatus', l: 'Invoicing', html: r => badgeFor(r.InvoicingStatus) }, { l: 'Age (days)', t: 'n', get: r => daysBetween(r.InquiryDate || today(), today()) }];
  let g;
  const rows = () => { let r = textFilter(DB.peek('inq'), $('#lQ', v).value, ['InquiryCompanyName', 'InquiryContactName', 'InquiryContactNumber', 'TrnscBeneficiaryName', 'InquiryWasAbout', 'Cuurent_Action', 'InquiryID']); const s = $('#lS', v).value, t = $('#lT', v).value, i = $('#lI', v).value; if (s === 'active') r = r.filter(x => ['New', 'Open', 'Processing'].includes(x.InquiryStatus)); else if (s) r = r.filter(x => x.InquiryStatus === s); if (t) r = r.filter(x => x.InquiryType === t); if (i) r = r.filter(x => (x.InvoicingStatus || 'Not Yet') === i); return r.filter(x => inPeriod(x, $('#lFrom', v).value, $('#lTo', v).value, 'InquiryDate')); };
  const draw = () => { if (!g) g = makeGrid($('#lG', v), { cols, rows: rows(), onRow: r => go('inq', r.InquiryID), sortBy: 'InquiryID', desc: true }); else g.redraw(rows()); };
  ['#lS', '#lT', '#lI', '#lFrom', '#lTo'].forEach(s => $(s, v).onchange = draw); $('#lQ', v).oninput = debounce(draw, 200);
  $('#lX', v).onclick = () => exportXlsx('Inquiries', g.rows(), cols.map(c => ({ ...c, html: null })));
  draw();
}, 'OfficeIncomingInquiryList, OfficeIncomingInquiryListN');

/* ---------------------------------------------------------------- INQUIRY ALARMS (InqueriesSummry) */
page('alarms', 'Inquiries', '🔔', 'Inquiry Alarms', 'Open inquiries by type — New / Open / Processing', async v => {
  await loadCore();
  const act = DB.peek('inq').filter(i => ['New', 'Open', 'Processing'].includes(i.InquiryStatus));
  const g = [...groupBy(act, i => i.InquiryType || '(no type)')].map(([t, a]) => ({ t, n: a.length, New: a.filter(x => x.InquiryStatus === 'New').length, Open: a.filter(x => x.InquiryStatus === 'Open').length, Processing: a.filter(x => x.InquiryStatus === 'Processing').length, oldest: Math.max(...a.map(x => daysBetween(x.InquiryDate || today(), today()))) })).sort((a, b) => b.n - a.n);
  v.innerHTML = `<div class="kpis">${['New', 'Open', 'Processing'].map((s, i) => `<div class="kpi" style="--kc:var(--c${i + 1});cursor:pointer" onclick="go('inqlist','${s}')"><div class="k-label">${s}</div><div class="k-val">${act.filter(x => x.InquiryStatus === s).length}</div></div>`).join('')}<div class="kpi" style="--kc:var(--c3)"><div class="k-label">Older than 7 days</div><div class="k-val">${act.filter(x => daysBetween(x.InquiryDate || today(), today()) > 7).length}</div></div></div>
    <div class="card"><div class="card-title" style="margin-bottom:12px">Inquiry alarm — by type</div>${g.length ? `<div class="alert-list">${g.map(x => `<div class="alert-item" data-t="${esc(x.t)}"><b>${esc(x.t)}</b><span class="muted">New :- ${x.New} &nbsp;|&nbsp; Open :- ${x.Open} &nbsp;|&nbsp; Processing :- ${x.Processing} &nbsp;·&nbsp; oldest ${x.oldest} d</span><span class="n">${x.n}</span></div>`).join('')}</div>` : '<div class="empty">🎉 No open inquiries.</div>'}</div>`;
  $$('[data-t]', v).forEach(e => e.onclick = () => go('inqlist', 'active|' + e.dataset.t));
}, 'Inqrs_Alarms, InqueriesSummry');
