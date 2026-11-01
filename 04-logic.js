/* =====================================================================
   BUSINESS RULES — rebuilt from the Access forms & queries
   ===================================================================== */
const linesOf = (k, id) => DB.peek(k).filter(r => num(r[LISTS[k].parent]) === num(id)).sort((a, b) => num(a.LineNr ?? a.ItemsInqrsID ?? a._id) - num(b.LineNr ?? b.ItemsInqrsID ?? b._id));
const company = () => DB.peek('company').find(c => c.Active) || DB.peek('company')[0] || {};
const ttCode = t => TT[String(t || '').trim()] || 1;
const isSalesType = t => ttCode(t) === 1 || ttCode(t) === 4;

/* Service line: Sub Total = Govt. Fee + Service Charges; Line Amount = Sub Total × Qty; Line Cost = Govt. Fee × Qty */
function calcSvcLine(l) {
  const q = num(l.Trnsction_Qty ?? 1) || 0;
  l.Sub_Total = r2(num(l.Goverment_Fee) + num(l.Trnsction_Charges));
  l.Transection_Amount = r2(l.Sub_Total * q);
  l.Transection_Type_Cost = r2(num(l.Goverment_Fee) * q);
  return l;
}
function calcSupLine(l) { l.Line_Amount = r2(num(l.Qty ?? 1) * num(l.Unit_Price)); return l; }
/* Header totals: Amount from lines (or typed when there are no lines), COGS, Profit, Balance, Payment status */
function calcHeader(h, svc, sup) {
  h.Transection_Type = ttCode(h.TransectionType);
  if (svc.length || sup.length) {
    const sAmt = sum(svc, 'Transection_Amount'), pAmt = sum(sup, 'Line_Amount');
    h.Transection_Amount = r2(sAmt + pAmt);
    h.Transection_Qty = sum(svc, 'Trnsction_Qty') + sum(sup, 'Qty');
    h.Transection_COGS = r2(isSalesType(h.TransectionType) ? sum(svc, 'Transection_Type_Cost') + pAmt : h.Transection_Amount);
  } else { h.Transection_Amount = r2(h.Transection_Amount); h.Transection_COGS = r2(isSalesType(h.TransectionType) ? h.Transection_COGS : h.Transection_Amount); }
  h.Transection_Profit = isSalesType(h.TransectionType) ? r2(num(h.Transection_Amount) - num(h.Transection_COGS)) : 0;
  h.Paid_Amount = r2(h.Paid_Amount); h.Bal_Trans_Amount = r2(num(h.Transection_Amount) - num(h.Paid_Amount));
  if (h.PaymentStatus !== 'Hold') h.PaymentStatus = num(h.Transection_Amount) > 0 && h.Bal_Trans_Amount <= 0 ? 'Paid' : num(h.Paid_Amount) > 0 ? 'Due' : 'Unpaid';
  h.Paid = num(h.Transection_Amount) > 0 && h.Bal_Trans_Amount <= 0;
  return h;
}
function transPrefix(t) { const c = company(); return ({ 'Service Invoice': c.PrvInvAutoNrLetter || 'RAB', 'Quotation': c.QTAutoNrLetter || 'QT', 'Expenses': c.POAutoNrLetter || 'PUR', 'Payment': c.PLAutoNrLetter || 'PAY' })[t] || 'TRN'; }
function makeTransNr(h) { const d = String(h.Transection_Date || today()); return `${transPrefix(h.TransectionType)}-${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(2, 4)}-${h.OUTSR_ID}`; }
function nextPV() { const p = (company().PLAutoNrLetter || 'PV'); const y = today().slice(2, 7).replace('-', ''); const used = DB.peek('trans').map(t => String(t.PaymentVoucherNr || '')).filter(s => s.startsWith(`${p}-${y}-`)).map(s => num(s.split('-').pop())); return `${p}-${y}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`; }
/* Smart price: price list first, then the last time this service was invoiced */
function priceFor(type) {
  const t = norm(type); if (!t) return null;
  const p = DB.peek('prod').find(x => norm(x.ProductName) === t || norm(x.ProductCode) === t);
  if (p) return { Goverment_Fee: num(p.Goverment_Fee), Trnsction_Charges: num(p.Trnsction_Charges) || Math.max(0, num(p.UnitPrice) - num(p.Goverment_Fee)), Delivery_Location: p.Delivery_Location || null, src: 'price list' };
  const last = DB.peek('svcLines').filter(l => norm(l.Type_Of_Transection) === t).sort((a, b) => String(b.Transection_Date || '').localeCompare(String(a.Transection_Date || '')) || num(b._id) - num(a._id))[0];
  return last ? { Goverment_Fee: num(last.Goverment_Fee), Trnsction_Charges: num(last.Trnsction_Charges), Delivery_Location: last.Delivery_Location, src: 'last invoice' } : null;
}
/* Save header + lines in one go */
async function saveTransaction(h, svc, sup, removed) {
  const isNew = !h._id;
  h = calcHeader({ ...h }, svc.map(calcSvcLine), sup.map(calcSupLine));
  if (isNew) { h.CreatedBy = h.CreatedBy || me(); h.Creation_Timestamp = h.Creation_Timestamp || nowIso(); }
  if (!h.Posting_Date) h.Posting_Date = h.Transection_Date || today();
  h = await DB.save('trans', h);
  if (!h.Transection_Nr) { h.Transection_Nr = makeTransNr(h); h = await DB.save('trans', h); }
  const id = h.OUTSR_ID; const jobs = [];
  svc.forEach((l, i) => { l.Dlvery_Rcrd_Link = id; l.LineNr = i + 1; l.Transection_Type = h.Transection_Type; l.Transection_Date = l.Transection_Date || h.Posting_Date; jobs.push(() => DB.save('svcLines', l)); });
  sup.forEach(l => { l.Header_Link = id; l.Trans_Date = l.Trans_Date || h.Posting_Date; jobs.push(() => DB.save('supLines', l)); });
  (removed || []).forEach(r => jobs.push(() => DB.remove(r.k, r.rec)));
  const errs = await DB.bulk(jobs); if (errs.length) throw new Error(errs[0]);
  if (h.Posted_Timestamp) await postToLedger(h, true);   // keep P&L in step for already-posted records
  return h;
}
async function deleteTransaction(h) {
  const jobs = [...linesOf('svcLines', h.OUTSR_ID).map(l => () => DB.remove('svcLines', l)), ...linesOf('supLines', h.OUTSR_ID).map(l => () => DB.remove('supLines', l)), ...DB.peek('ledger').filter(x => num(x.OUTSR_ID) === num(h.OUTSR_ID)).map(x => () => DB.remove('ledger', x))];
  await DB.bulk(jobs); await DB.remove('trans', h);
}
/* Record_execut_save / Record_execut_save_2 : flatten header + lines into Transections_Table_records */
const HDR_COPY = 'OUTSR_ID,Transection_Date,Transection_Nr,Contact_Name,Driver_Contact_Nr,Transection_Amount,Remarks,GL_Link,Region,Company_Name,Service_Type,Posting_Date,Submit_Setteled_Status,Settled_Bank_Trans_Nr,Settled_Bank_Trans_Date,Suplr_Transection_Nr,Transection_Currency,Amount_Paid_Currency,PaymentStatus,PaymentDate,PaymentVoucherNr,PaymentMethod,Paid_Amount,Bal_Trans_Amount,Service_Type_ID,Paid,Beneficiary_Name,Beneficiary_Bank_Details,Beneficiary_Bank_Account_Nr,Beneficiary_Bank_Name,Transection_Type,Bank_Trns_No,Bank_Trns_Date,TransectionType,SaveAs_Defualt,Transection_COGS,Transection_Profit,Transection_Qty,CreatedBy,Creation_Timestamp,Pymnt_PostedBy,Pymnt_Posted_Timestamp'.split(',');
function ledgerRows(h) {
  if (ttCode(h.TransectionType) === 4) return [];
  const base = Object.fromEntries(HDR_COPY.map(n => [n, h[n] ?? null])); base.PostedBy = me(); base.Posted_Timestamp = nowIso();
  const svc = linesOf('svcLines', h.OUTSR_ID), sup = linesOf('supLines', h.OUTSR_ID), out = [];
  for (const l of svc) { const q = num(l.Trnsction_Qty); out.push({ ...base, ID_Sales: num(l._id) || null, Delivered_Invoice_Nr: l.Delivered_Invoice_Nr, Delivery_Location: l.Delivery_Location, Dlvery_Rcrd_Link: l.Dlvery_Rcrd_Link, Type_Of_Transection: l.Type_Of_Transection, Trnsction_Qty: q, Goverment_Fee: r2(num(l.Goverment_Fee) * q), Trnsction_Charges: r2(num(l.Trnsction_Charges) * q), Sub_Total: l.Sub_Total, Line_Sales_Trans_Amnt: ttCode(h.TransectionType) === 1 ? l.Transection_Amount : 0, Line_Pur_Line_Amount: ttCode(h.TransectionType) === 1 ? 0 : l.Transection_Amount, Sales_Remarks: l.Remarks, Transection_Type_Cost: l.Transection_Type_Cost, Sales_Transection_Date: l.Transection_Date, Sales_Transection_Type: l.Transection_Type, Line_Trans_Date: l.Transection_Date || h.Posting_Date || h.Transection_Date }); }
  for (const l of sup) out.push({ ...base, ID_Purchase: num(l._id) || null, Item_Decs: l.Item_Decs, Item_Ctgry: l.Item_Ctgry, Type_Of_Transection: l.Item_Ctgry || l.Item_Decs, Qty: l.Qty, Unit_Price: l.Unit_Price, Line_Pur_Line_Amount: ttCode(h.TransectionType) === 1 ? 0 : l.Line_Amount, Line_Sales_Trans_Amnt: ttCode(h.TransectionType) === 1 ? l.Line_Amount : 0, Pur_Remarks: l.Remarks, Header_Link: l.Header_Link, Pur_Paid_Amount: l.Paid_Amount, Line_Trans_Date: l.Trans_Date || h.Posting_Date || h.Transection_Date });
  if (!svc.length && !sup.length) out.push({ ...base, Type_Of_Transection: h.Service_Type || h.TransectionType, Line_Sales_Trans_Amnt: ttCode(h.TransectionType) === 1 ? h.Transection_Amount : 0, Line_Pur_Line_Amount: ttCode(h.TransectionType) === 1 ? 0 : h.Transection_Amount, Goverment_Fee: ttCode(h.TransectionType) === 1 ? h.Transection_COGS : 0, Line_Trans_Date: h.Posting_Date || h.Transection_Date });
  return out;
}
async function postToLedger(h, silent) {
  await DB.all('ledger');
  const old = DB.peek('ledger').filter(x => num(x.OUTSR_ID) === num(h.OUTSR_ID));
  await DB.bulk(old.map(x => () => DB.remove('ledger', x)));
  const rows = ledgerRows(h); const errs = await DB.bulk(rows.map(r => () => DB.save('ledger', r)));
  if (errs.length) throw new Error(errs[0]);
  if (!silent || !h.Posted_Timestamp) { h.PostedBy = me(); h.Posted_Timestamp = nowIso(); await DB.save('trans', h); }
  return rows.length;
}
/* Apply a payment (Pay Tran Window / Payment Window) */
async function applyPayment(h, amount, p) {
  h.Paid_Amount = r2(num(h.Paid_Amount) + num(amount));
  Object.assign(h, { PaymentMethod: p.PaymentMethod || h.PaymentMethod, PaymentDate: p.PaymentDate || today(), PaymentVoucherNr: p.PaymentVoucherNr || h.PaymentVoucherNr, Beneficiary_Bank_Details: p.Beneficiary_Bank_Details || h.Beneficiary_Bank_Details, Bank_Trns_No: p.Bank_Trns_No || h.Bank_Trns_No, Bank_Trns_Date: p.Bank_Trns_Date || h.Bank_Trns_Date, Amount_Paid_Currency: p.Amount_Paid_Currency || h.Transection_Currency || 'AED', Pymnt_PostedBy: me(), Pymnt_Posted_Timestamp: nowIso() });
  if (p.Remarks) h.Remarks = [h.Remarks, `[${fdate(p.PaymentDate || today())}] ${p.Remarks}`].filter(Boolean).join('\n');
  calcHeader(h, linesOf('svcLines', h.OUTSR_ID), linesOf('supLines', h.OUTSR_ID));
  h = await DB.save('trans', h); if (h.Posted_Timestamp) await postToLedger(h, true); return h;
}
/* Totals used by dashboard & main menu (same DSum logic as Access) */
function inPeriod(r, from, to, f = 'Transection_Date') { const d = String(r[f] || '').slice(0, 10); return (!from || d >= from) && (!to || d <= to); }
function money3(rows) { return { amt: sum(rows, 'Transection_Amount'), paid: sum(rows, 'Paid_Amount'), bal: sum(rows, 'Bal_Trans_Amount'), cogs: sum(rows, 'Transection_COGS'), n: rows.length }; }
function totals(from, to) {
  const t = DB.peek('trans').filter(r => inPeriod(r, from, to));
  const s = t.filter(r => num(r.Transection_Type) === 1), p2 = t.filter(r => num(r.Transection_Type) === 2), p3 = t.filter(r => num(r.Transection_Type) === 3);
  const S = money3(s), P2 = money3(p2), P3 = money3(p3);
  return { sales: S.amt, cogs: S.cogs, rcvd: S.paid, receivable: S.bal, purchases: P3.amt, payments: P2.amt, paidOut: P2.paid + P3.paid, payable: P2.bal + P3.bal, cash: S.paid - (P2.paid + P3.paid), gross: S.amt - S.cogs, net: S.amt - S.cogs - P2.amt - P3.amt, nSales: S.n };
}
function monthly(rows, dateF, fns, months = 12) {
  const end = new Date(); const keys = []; for (let i = months - 1; i >= 0; i--) { const d = new Date(end.getFullYear(), end.getMonth() - i, 1); keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
  const g = groupBy(rows, r => ym(r[dateF]));
  return { labels: keys.map(k => MON[+k.slice(5) - 1] + ' ' + k.slice(2, 4)), keys, values: fns.map(fn => keys.map(k => r2(sum(g.get(k) || [], fn)))) };
}
/* P&L rows: posted ledger (Access way) or live from all transactions */
function plRows(source) { return source === 'live' ? DB.peek('trans').flatMap(h => ledgerRows(h)) : DB.peek('ledger'); }
async function loadCore() { await Promise.all(['trans', 'svcLines', 'supLines', 'inq', 'company', 'prod', 'bank', 'emp', 'cust'].map(k => DB.all(k).catch(e => { console.warn(k, e); DB.cache[k] = DB.cache[k] || []; Bus.emit('loadError', k, e); }))); }

/* =====================================================================
   DEMO DATA (only used in Demo mode; SharePoint starts empty or with your import)
   ===================================================================== */
const SEED = (() => {
  let built = null;
  const services = [['NEW EMPLOYMENT VISA - TYPING', 'Immigration', 'AMER Centre', 1150, 150], ['VISA RENEWAL - TYPING', 'Immigration', 'AMER Centre', 870, 120], ['EMIRATES ID - NEW / RENEW', 'Immigration', 'ICP Centre', 370, 70], ['LABOUR CONTRACT TYPING', 'LABOUR', 'Tasheel', 210, 60], ['MEDICAL FITNESS TYPING', 'Medical', 'DHA Centre', 320, 50], ['ENTRY PERMIT - EMPLOYMENT', 'Immigration', 'AMER Centre', 1250, 175], ['TRADE LICENSE RENEWAL', 'Economic Dept', 'DED', 2600, 400], ['LEGAL TRANSLATION ENG/ARB', 'Translation', 'Office', 0, 120], [' INVESTOR OR PARTNER - ISSUE NEW VISA', 'Immigration', 'AMER Centre', 3350, 450], ['CANCELLATION - EMPLOYMENT VISA', 'Immigration', 'AMER Centre', 165, 85]];
  const clients = [['ESTIDAMA GENERAL CONTRACTING', 'Mr. Waheeb', '0501234567'], ['MOOD MAKERS DECOR WORKS LLC', 'Ms. Lina', '0559876543'], ['STOUFF BEIRUT RESTAURANT', 'Mr. Karim', '0524567890'], ['INCLUSIVE SPORTS', 'Mr. Omar', '0562223344'], ['CITY VILLA CLEANING', 'Mr. Ahmed', '0507778899'], ['BLUE OCEAN TRADING', 'Mr. Faisal', '0543332211'], ['Walk-in Customer', 'Cash Client', '']];
  const suppliers = [['AMER Centre - Al Qusais', 'Government'], ['DU Telecom', 'Telecom'], ['DEWA', 'Utilities'], ['Office Landlord', 'Rent'], ['Stationery World', 'Office Supplies']];
  function build() {
    if (built) return built;
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280, pick = a => a[Math.floor(rnd() * a.length)];
    const T = [], SL = [], PL = [], INQ = [], IT = [], BN = []; let id = 100;
    for (let i = 0; i < 46; i++) {
      const date = addDays(today(), -Math.floor(rnd() * 330)); const [co, ct, ph] = pick(clients); const oid = ++id;
      const h = { OUTSR_ID: oid, TransectionType: 'Service Invoice', Transection_Type: 1, Transection_Date: date, Posting_Date: date, Company_Name: co, Contact_Name: ct, Driver_Contact_Nr: ph, Service_Type: 'Immigration', Region: 'Dubai', Transection_Currency: 'AED', Amount_Paid_Currency: 'AED', Paid_Amount: 0, CreatedBy: 'Nader', Creation_Timestamp: date + 'T09:30:00Z' };
      const n = 1 + Math.floor(rnd() * 3), lines = [];
      for (let j = 0; j < n; j++) { const s = pick(services); lines.push(calcSvcLine({ Dlvery_Rcrd_Link: oid, LineNr: j + 1, Type_Of_Transection: s[0], Delivery_Location: s[2], Trnsction_Qty: 1 + Math.floor(rnd() * 2), Goverment_Fee: s[3], Trnsction_Charges: s[4], Transection_Type: 1, Transection_Date: date })); }
      h.Service_Type = services.find(s => s[0] === lines[0].Type_Of_Transection)[1];
      calcHeader(h, lines, []);
      const pr = rnd(); if (pr > 0.35) { h.Paid_Amount = pr > 0.6 ? h.Transection_Amount : r2(h.Transection_Amount * 0.5); h.PaymentMethod = pick(OPT.payMethod); h.PaymentDate = addDays(date, Math.floor(rnd() * 10)); h.PaymentVoucherNr = 'RV-' + oid; h.Pymnt_PostedBy = 'Nader'; }
      calcHeader(h, lines, []); h.Transection_Nr = `RAB-${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(2, 4)}-${oid}`;
      if (rnd() > 0.3) { h.PostedBy = 'Nader'; h.Posted_Timestamp = date + 'T18:00:00Z'; }
      if (rnd() > 0.85) h.Reminder_Date = addDays(today(), -Math.floor(rnd() * 5));
      T.push(h); SL.push(...lines);
    }
    for (let i = 0; i < 22; i++) {
      const date = addDays(today(), -Math.floor(rnd() * 330)); const [co, cat] = pick(suppliers); const oid = ++id; const isPay = cat !== 'Government' && cat !== 'Office Supplies';
      const h = { OUTSR_ID: oid, TransectionType: isPay ? 'Payment' : 'Expenses', Transection_Date: date, Posting_Date: date, Company_Name: co, Contact_Name: co, Service_Type: cat, Region: 'Dubai', Transection_Currency: 'AED', Paid_Amount: 0, CreatedBy: 'Nader', Creation_Timestamp: date + 'T10:00:00Z' };
      const lines = isPay ? [] : [calcSupLine({ Header_Link: oid, Item_Ctgry: cat, Item_Decs: cat === 'Government' ? 'Govt. fees top-up' : 'A4 paper & toner', Qty: 1 + Math.floor(rnd() * 4), Unit_Price: cat === 'Government' ? 1500 : 85, Trans_Date: date })];
      if (isPay) h.Transection_Amount = cat === 'Rent' ? 6500 : r2(300 + rnd() * 900);
      calcHeader(h, [], lines); if (rnd() > 0.25) { h.Paid_Amount = h.Transection_Amount; h.PaymentMethod = pick(OPT.payMethod); h.PaymentDate = date; h.PaymentVoucherNr = 'PV-' + oid; }
      calcHeader(h, [], lines); h.Transection_Nr = `${isPay ? 'PAY' : 'PUR'}-${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(2, 4)}-${oid}`;
      if (rnd() > 0.3) { h.PostedBy = 'Nader'; h.Posted_Timestamp = date + 'T18:00:00Z'; }
      T.push(h); PL.push(...lines);
    }
    const st = ['New', 'Open', 'Processing', 'Done', 'Done', 'Hold', 'Open', 'New'];
    for (let i = 1; i <= 18; i++) {
      const [co, ct, ph] = pick(clients); const s = pick(services); const date = addDays(today(), -Math.floor(rnd() * 60));
      INQ.push({ InquiryID: i, InquiryDate: date, InquiryTime: `${pad(9 + Math.floor(rnd() * 8))}:${pad(Math.floor(rnd() * 60))}`, InquiryType: s[1], InquiryStatus: pick(st), InvoicingStatus: 'Not Yet', InquiryCompanyName: co, InquiryContactName: ct, InquiryContactNumber: ph, InquiryIncomingSource: pick(OPT.inqSource), InquiryWasAbout: s[0], InquiryRegisteredBy: 'Mohammad Abudyak', InquiryReceivedBy: 'Mohammad Abudyak', TrnscBeneficiaryName: pick(['Ravi Kumar', 'John Mathew', 'Ali Hassan', 'Maria Santos', 'Ahmed Saeed']), Cuurent_Action: pick(['Waiting for documents', 'Typing in progress', 'Sent to AMER', 'Call customer back']), Passport: rnd() > 0.3, EIDA: rnd() > 0.5, Photo: rnd() > 0.4, VATPrcntg: 5, RecordCreatedBy: 'Mohammad Abudyak', RcrdTimeStamp: date + 'T11:00:00Z' });
      const q = 1 + Math.floor(rnd() * 2), up = s[3] + s[4]; IT.push({ ItemsInqrsID: i * 10, InqryLink: i, Type_Of_Transection: s[0], ItemDesc: s[0], Delivery_Location: s[2], Qty: q, UnitPrice: up, LineAmount: q * up, VATPrcntg: 5, VATAmount: r2(q * s[4] * 0.05), LineAmountVAT: r2(q * up + q * s[4] * 0.05), CreationTimeStamp: date + 'T11:05:00Z' });
      BN.push({ Link: i, Beneficiary_Name: INQ[i - 1].TrnscBeneficiaryName, Gender: 'Male', Nationality: pick(['India', 'Philippines', 'Pakistan', 'Egypt', 'Jordan']), Passport_Nr: 'P' + Math.floor(1e6 + rnd() * 8e6), Passport_Ending_dt: addDays(today(), Math.floor(rnd() * 900)), InquiryStatus: INQ[i - 1].InquiryStatus });
      const ii = INQ[i - 1]; ii.InquiryNrofItems = q; ii.InquiryAmount = q * up; ii.InquiryVAT = IT[i - 1].VATAmount; ii.InquiryAmountVAT = IT[i - 1].LineAmountVAT;
    }
    const EMP = [
      { Employee1ID: 1, FirstName: 'Nader', LastName: 'Alnajjar', Department: 'Management', Designation: 'General Manager', EmploymentStatus: 'Active', Email: 'nader@example.com', User_Name: 'admin', Pword: 'admin', Access_Level: 'Admin', SuperAdmin: 'ALL', DbUser: true, Nationality: 'Jordan', DateofJoin: '2019-01-01', VisaExpiryDate: addDays(today(), 210), PassPortExpiryDate: addDays(today(), 900), EIDExpiryDate: addDays(today(), 200) },
      { Employee1ID: 2, FirstName: 'Mohammad', LastName: 'Abudyak', Department: 'Operations', Designation: 'Typist', EmploymentStatus: 'Active', User_Name: 'mohammad', Pword: '1234', Access_Level: 'User', SuperAdmin: 'None', DbUser: true, Nationality: 'Jordan', DateofJoin: '2021-03-15', VisaExpiryDate: addDays(today(), 18), PassPortExpiryDate: addDays(today(), 400), EIDExpiryDate: addDays(today(), 18), LaborCardExpiryDate: addDays(today(), -3) },
      { Employee1ID: 3, FirstName: 'Sara', LastName: 'Khan', Department: 'Accounts', Designation: 'Accountant', EmploymentStatus: 'Active', User_Name: 'sara', Pword: '1234', Access_Level: 'Accounts', SuperAdmin: 'None', DbUser: true, Nationality: 'India', DateofJoin: '2022-06-01', VisaExpiryDate: addDays(today(), 500), PassPortExpiryDate: addDays(today(), 25), EIDExpiryDate: addDays(today(), 500) },
      { Employee1ID: 4, FirstName: 'Ravi', LastName: 'Menon', Department: 'Operations', Designation: 'PRO', EmploymentStatus: 'Active', DbUser: false, Nationality: 'India', DateofJoin: '2020-09-10', VisaExpiryDate: addDays(today(), 120), PassPortExpiryDate: addDays(today(), 1500), DLExpiryDate: addDays(today(), 9) },
    ];
    built = {
      trans: T, svcLines: SL, supLines: PL, inq: INQ, inqItems: IT, bnf: BN, emp: EMP,
      ledger: T.filter(h => h.Posted_Timestamp).flatMap(h => { const svc = SL.filter(l => l.Dlvery_Rcrd_Link === h.OUTSR_ID), sup = PL.filter(l => l.Header_Link === h.OUTSR_ID); const base = Object.fromEntries(HDR_COPY.map(n => [n, h[n] ?? null])); base.PostedBy = 'Nader'; base.Posted_Timestamp = h.Posted_Timestamp; if (svc.length) return svc.map(l => ({ ...base, Type_Of_Transection: l.Type_Of_Transection, Trnsction_Qty: l.Trnsction_Qty, Goverment_Fee: r2(l.Goverment_Fee * l.Trnsction_Qty), Trnsction_Charges: r2(l.Trnsction_Charges * l.Trnsction_Qty), Line_Sales_Trans_Amnt: l.Transection_Amount, Transection_Type_Cost: l.Transection_Type_Cost, Line_Trans_Date: l.Transection_Date, Dlvery_Rcrd_Link: h.OUTSR_ID })); if (sup.length) return sup.map(l => ({ ...base, Type_Of_Transection: l.Item_Ctgry, Item_Decs: l.Item_Decs, Item_Ctgry: l.Item_Ctgry, Qty: l.Qty, Unit_Price: l.Unit_Price, Line_Pur_Line_Amount: l.Line_Amount, Line_Trans_Date: l.Trans_Date, Header_Link: h.OUTSR_ID })); return [{ ...base, Type_Of_Transection: h.Service_Type, Line_Pur_Line_Amount: h.Transection_Amount, Line_Trans_Date: h.Transection_Date }]; }),
      company: [{ InfID: 1, Active: true, CompanyFullName: 'RAB Administration Business Center', ArabicName: 'مركز راب لخدمات رجال الأعمال', BusinessType: 'Typing & Business Services', Address: 'Al Qusais, Dubai', Country: 'UAE', City: 'Dubai', TelephoneNumber: '+971 4 000 0000', POBox: '12345', Email: 'rab.typingcenter@gmail.com', Website: 'rabbusinesscenter.ae', PrvInvAutoNrLetter: 'RAB', PLAutoNrLetter: 'PV', QTAutoNrLetter: 'QT', POAutoNrLetter: 'PUR' }],
      bank: [{ Bnk_ID: 1, Bank_Desc: 'Emirates NBD - Current', Account_Name: 'RAB Administration Business Center', Account_Number: '1012345678901', IBAN: 'AE070331234567890123456', SWIFT_Number: 'EBILAEAD', Currency: 'AED', DefaultBankAccount: true }, { Bnk_ID: 2, Bank_Desc: 'Cash Box', Currency: 'AED' }],
      prod: services.map((s, i) => ({ ProductID: i + 1, ProductCode: 'SRV' + String(i + 1).padStart(3, '0'), ProductName: s[0], Service_Type: s[1], Delivery_Location: s[2], Goverment_Fee: s[3], Trnsction_Charges: s[4], UnitPrice: s[3] + s[4] })),
      cust: clients.slice(0, 6).map((c, i) => ({ CustomerID: i + 1, CustomerName: c[0], PrimaryContactFirstName: c[1], BusinessPhone: c[2], City: 'Dubai', Payment_Terms_Code: pick(OPT.terms) })),
      settings: [{ SettingName: 'DefaultVAT', SettingValue: '5', Notes: 'VAT % used for inquiries' }],
    };
    return built;
  }
  return new Proxy({}, { get: (t, k) => () => (build()[k] || []).map(x => ({ ...x })), has: (t, k) => k in build() });
})();
