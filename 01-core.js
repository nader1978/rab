'use strict';
/* =====================================================================
   RAB Sales & Expenses System — HTML/SharePoint edition of
   Sales_Expenses_App.accdb. Each Access table = one SharePoint list,
   each Access form = one page in this file.
   ===================================================================== */
const APP = { name: 'RAB Sales & Expenses System', ver: '1.0', ls: 'rabsys' };

/* ---------------- small helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const r2 = v => Math.round(num(v) * 100) / 100;
const money = v => num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intf = v => num(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowIso = () => new Date().toISOString();
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fdate = iso => { if (!iso) return ''; const s = String(iso).slice(0, 10); const [y, m, d] = s.split('-'); return y && m ? `${d}-${MON[+m - 1]}-${y}` : s; };
const fdt = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? String(iso) : `${fdate(d.toISOString().slice(0, 10))} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ym = iso => String(iso || '').slice(0, 7);
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const uniq = a => [...new Set(a.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))].sort((x, y) => String(x).localeCompare(String(y)));
const sum = (a, f) => a.reduce((s, x) => s + num(typeof f === 'function' ? f(x) : x[f]), 0);
const groupBy = (a, f) => { const m = new Map(); for (const x of a) { const k = typeof f === 'function' ? f(x) : x[f]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const lsGet = (k, d) => { try { const v = localStorage.getItem(APP.ls + '_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(APP.ls + '_' + k, JSON.stringify(v)); } catch (e) {} };
async function sha256(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t))); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

function toast(msg, type = '', ms = 3200) { const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms); }
const Modal = {
  open(title, bodyHtml, buttons = [], cls = '') {
    $('#modal').className = 'modal ' + cls; $('#modalTitle').textContent = title; $('#modalBody').innerHTML = bodyHtml;
    const f = $('#modalFoot'); f.innerHTML = '';
    for (const b of buttons) { const el = document.createElement('button'); el.textContent = b.label; el.className = b.cls || ''; el.onclick = () => b.onClick ? b.onClick() : Modal.close(); f.appendChild(el); }
    f.style.display = buttons.length ? '' : 'none'; $('#modalBg').classList.add('open'); return $('#modalBody');
  },
  close() { $('#modalBg').classList.remove('open'); $('#modalBody').innerHTML = ''; }
};
function confirmBox(msg, okLabel = 'Yes', danger = false) {
  return new Promise(res => Modal.open('Please confirm', `<div style="font-size:14px;line-height:1.6">${msg}</div>`, [
    { label: 'Cancel', cls: 'ghost', onClick: () => { Modal.close(); res(false); } },
    { label: okLabel, cls: danger ? 'danger' : '', onClick: () => { Modal.close(); res(true); } }], 'narrow'));
}

/* =====================================================================
   SCHEMA — recovered from the Access front-end (forms, queries, reports).
   Field types: t text · m multi-line · n number · c money · p percent
                d date · dt date+time · b yes/no · ch choice (free text allowed)
   ===================================================================== */
const OPT = {
  transType: ['Service Invoice', 'Payment', 'Expenses', 'Quotation'],
  currency: ['AED', 'OMR', 'USD', 'EUR'],
  payStatus: ['Unpaid', 'Paid', 'Due', 'Hold'],
  payMethod: ['Bank Transfer', 'Cash', 'Cheque', 'Telegraphic Transfer'],
  settle: ['New', 'Applied', 'Confirm', 'Submit', 'Settled', 'Cancelled', 'Hold'],
  inqStatus: ['New', 'Open', 'Processing', 'Hold', 'Cancelled', 'Done'],
  invStatus: ['New', 'Not Yet', 'Invoiced Partially', 'Invoiced Fully', 'Cancelled'],
  inqSource: ['Phone Call', 'Email', 'WhatsApp', 'Sales Person', 'Oral from Colleague', 'Walk-in'],
  uaePass: ['EIDA', 'Mobile Nr', 'A/C (UserName+PW)', 'Mix', 'N/A'],
  gender: ['Male', 'Female', 'Entity', 'Other'],
  rcvCtrl: ['Approved', 'Hold', 'Not Yet Checked'],
  access: ['Admin', 'Manager', 'Accounts', 'User', 'Service', 'Technical', 'Logistics', 'HR'],
  superAdmin: ['None', 'ALL', 'VMOP', 'CRM'],
  empStatus: ['Active', 'Deactive', 'Transferred', 'On Vacation'],
  city: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'UMQ', 'RAK', 'FUJ'],
  terms: ['CASH', '30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS'],
  social: ['Single', 'Married', 'Divorced', 'Widowed'],
};
/* Transection_Type numbers used by every Access query: 1 = Sales, 2 = Payment/Expense, 3 = Purchase */
const TT = { 'Service Invoice': 1, 'Payment': 2, 'Expenses': 3, 'Quotation': 4 };
const TT_NAME = { 1: 'Sales', 2: 'Payment', 3: 'Purchase', 4: 'Quotation' };

const F = (n, t = 't', l, x = {}) => ({ n, t, l: l || n.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'), ...x });
function autoType(n) {
  if (/(Scan|Pic|Signature|Link|Folder|Logo|Stamp|Map)$/i.test(n) && !/DepartmentLink|AttendanceShiftLink|CompanyLink|StaffLink|NAVLink/.test(n)) return 't';
  if (/TimeStamp|Timestamp|LastTime|TimeStmp/i.test(n)) return 'dt';
  if (/Date|Expiry|_dt$|Brith|Birth/i.test(n)) return 'd';
  if (/^(Hide|Block|DbUser|DlvyStaff|Active|FamilySponsered|FamilyinUAE|CompanyRelated|JTCStampHolder|JTCSalesAdmin|PPAvailability|PPWithPRO|PPinPROQeue|PPinHRQeue|LoginStatus|PPTknByStaff)$/.test(n)) return 'b';
  if (/^(Nrof|NrOf|NoOf|EMPCounter|AccessNo|LastSalaryDrawn|EAVRG|EAvrg|VCLstNo|InfID)/.test(n)) return 'n';
  if (/Address|Remarks|Reason|History|Details$/i.test(n)) return 'm';
  return 't';
}
const A = (names, over = {}) => names.split(',').map(s => s.trim()).filter(Boolean).map(n => over[n] ? F(n, over[n].t || autoType(n), over[n].l, over[n]) : F(n, autoType(n)));

const LISTS = {
  trans: {
    name: 'OutSources_Manpower_tbl', label: 'Transactions (Invoices, Purchases & Payments)', pk: 'OUTSR_ID',
    title: r => r.Transection_Nr || ('TRN-' + r.OUTSR_ID),
    fields: [
      F('OUTSR_ID', 'n', 'Record Nr'), F('Transection_Nr', 't', 'System Trans. Nr'), F('Transection_Date', 'd', 'Trans. Date'), F('Posting_Date', 'd', 'Posting Date'),
      F('TransectionType', 'ch', 'Trans. Type', { opts: OPT.transType }), F('Transection_Type', 'n', 'Trans. Type Code'),
      F('Service_Type', 't', 'Service Type'), F('Service_Type_ID', 'n', 'Service Type ID'), F('Region', 't', 'Region / Govt. Group'),
      F('Company_Name', 't', 'Client / Supplier'), F('Contact_Name', 't', 'Contact Name'), F('Driver_Contact_Nr', 't', 'Contact Nr'), F('Client_Email', 't', 'Client / Supplier Email'),
      F('Beneficiary_Name', 't', 'Beneficiary Name'), F('Beneficiary_Bank_Name', 't', 'Beneficiary Bank Name'), F('Beneficiary_Bank_Account_Nr', 't', 'Beneficiary Bank A/C Nr'), F('Beneficiary_Bank_Details', 't', 'Bank Details'),
      F('Suplr_Transection_Nr', 't', 'Supplier Trans. Nr'), F('InquryLink', 'n', 'Inquiry Link'),
      F('Transection_Currency', 'ch', 'Currency', { opts: OPT.currency }), F('Amount_Paid_Currency', 'ch', 'Paid Currency', { opts: OPT.currency }),
      F('Transection_Amount', 'c', 'Trans. Amount'), F('Transection_Qty', 'n', 'Trans. Qty'), F('Transection_COGS', 'c', 'COGS'), F('Transection_Profit', 'c', 'Profit'),
      F('Paid_Amount', 'c', 'Paid Amount'), F('Bal_Trans_Amount', 'c', 'Balance Amount'), F('Paid', 'b', 'Paid'),
      F('PaymentStatus', 'ch', 'Payment Status', { opts: OPT.payStatus }), F('PaymentMethod', 'ch', 'Payment Method', { opts: OPT.payMethod }), F('PaymentDate', 'd', 'Payment Date'),
      F('PaymentVoucherNr', 't', 'P V Nr'), F('Bank_Trns_No', 't', 'Bank Trns Nr'), F('Bank_Trns_Date', 'd', 'Bank Trns Date'),
      F('Submit_Setteled_Status', 'ch', 'Submit / Settled Status', { opts: OPT.settle }), F('Settled_Bank_Trans_Nr', 't', 'Settled Bank Trans Nr'), F('Settled_Bank_Trans_Date', 'd', 'Settled Bank Trans Date'),
      F('GL_Link', 't', 'GL Link'), F('SaveAs_Defualt', 'b', 'Save as default template for this Service Type'), F('Reminder_Date', 'd', 'Reminder Date'),
      F('Attch_Docs', 'm', 'Attached Docs (links)'), F('Remarks', 'm', 'Remarks'),
      F('CreatedBy', 't', 'Created By'), F('Creation_Timestamp', 'dt', 'Created On'), F('PostedBy', 't', 'Posted By'), F('Posted_Timestamp', 'dt', 'Posted On'),
      F('Pymnt_PostedBy', 't', 'Payment Posted By'), F('Pymnt_Posted_Timestamp', 'dt', 'Payment Posted On'),
    ]
  },
  svcLines: {
    name: 'OutsourceDeliveredInvoices_tbl', label: 'Service invoice lines', pk: null, parent: 'Dlvery_Rcrd_Link',
    title: r => (r.Type_Of_Transection || 'Line') + ' #' + (r.LineNr || ''),
    fields: [F('AccessID', 'n', 'Access ID'), F('Dlvery_Rcrd_Link', 'n', 'Transaction Link'), F('LineNr', 'n', 'Line Nr'), F('Type_Of_Transection', 't', 'Type Of Transaction'),
      F('Delivered_Invoice_Nr', 't', 'Delivered Invoice Nr'), F('Delivery_Location', 't', 'Govt. Location'), F('Trnsction_Qty', 'n', 'Qty'), F('Goverment_Fee', 'c', 'Govt. Fee'),
      F('Trnsction_Charges', 'c', 'Service Charges'), F('Sub_Total', 'c', 'Sub Total'), F('Transection_Amount', 'c', 'Line Amount'), F('Transection_Type_Cost', 'c', 'Line Cost'),
      F('Transection_Type', 'n', 'Trans. Type Code'), F('Transection_Date', 'd', 'Line Date'), F('Reminder_Date', 'd', 'Reminder Date'), F('Remarks', 'm', 'Remarks')]
  },
  supLines: {
    name: 'Supplier_Items_tbl', label: 'Purchase / expense lines', pk: null, parent: 'Header_Link',
    title: r => r.Item_Decs || 'Item',
    fields: [F('AccessID', 'n', 'Access ID'), F('Header_Link', 'n', 'Transaction Link'), F('Item_Ctgry', 't', 'Item Category'), F('Item_Decs', 't', 'Item Description'),
      F('Qty', 'n', 'Qty'), F('Unit_Price', 'c', 'Unit Price'), F('Line_Amount', 'c', 'Line Amount'), F('Paid_Amount', 'c', 'Paid Amount'), F('Trans_Date', 'd', 'Trans Date'), F('Remarks', 'm', 'Remarks')]
  },
  ledger: {
    name: 'Transections_Table_records', label: 'P&L posted records (ledger)', pk: null,
    title: r => (r.Transection_Nr || '') + ' ' + (r.Type_Of_Transection || r.Item_Decs || ''),
    fields: A('OUTSR_ID,Transection_Date,Transection_Nr,Contact_Name,Driver_Contact_Nr,Transection_Amount,Remarks,GL_Link,Region,Company_Name,Service_Type,Posting_Date,Submit_Setteled_Status,Settled_Bank_Trans_Nr,Settled_Bank_Trans_Date,Suplr_Transection_Nr,Transection_Currency,Amount_Paid_Currency,PaymentStatus,PaymentDate,PaymentVoucherNr,PaymentMethod,Paid_Amount,Bal_Trans_Amount,Service_Type_ID,Paid,Beneficiary_Name,Beneficiary_Bank_Details,Beneficiary_Bank_Account_Nr,Beneficiary_Bank_Name,Transection_Type,Bank_Trns_No,Bank_Trns_Date,TransectionType,SaveAs_Defualt,Transection_COGS,Transection_Profit,Transection_Qty,CreatedBy,Creation_Timestamp,PostedBy,Posted_Timestamp,Pymnt_PostedBy,Pymnt_Posted_Timestamp,ID_Sales,Delivered_Invoice_Nr,Delivery_Location,Dlvery_Rcrd_Link,Type_Of_Transection,Trnsction_Qty,Goverment_Fee,Trnsction_Charges,Sub_Total,Line_Sales_Trans_Amnt,Sales_Remarks,Transection_Type_Cost,Sales_Transection_Date,Sales_Transection_Type,Line_Trans_Date,ID_Purchase,Item_Decs,Item_Ctgry,Qty,Unit_Price,Line_Pur_Line_Amount,Pur_Remarks,Header_Link,Pur_Paid_Amount',
      Object.fromEntries('OUTSR_ID,Service_Type_ID,Transection_Type,Transection_Qty,ID_Sales,Dlvery_Rcrd_Link,Trnsction_Qty,Sales_Transection_Type,ID_Purchase,Qty,Header_Link'.split(',').map(k => [k, { t: 'n' }])
        .concat('Transection_Amount,Paid_Amount,Bal_Trans_Amount,Transection_COGS,Transection_Profit,Goverment_Fee,Trnsction_Charges,Sub_Total,Line_Sales_Trans_Amnt,Transection_Type_Cost,Unit_Price,Line_Pur_Line_Amount,Pur_Paid_Amount'.split(',').map(k => [k, { t: 'c' }]))
        .concat([['Paid', { t: 'b' }], ['SaveAs_Defualt', { t: 'b' }], ['Sales_Remarks', { t: 'm' }], ['Pur_Remarks', { t: 'm' }], ['Remarks', { t: 'm' }], ['Beneficiary_Bank_Details', { t: 't' }]])))
  },
  inq: {
    name: 'OfficeIncomingVMInquiry', label: 'Office incoming inquiries', pk: 'InquiryID',
    title: r => `INQ-${r.InquiryID} ${r.InquiryCompanyName || ''}`.trim(),
    fields: [F('InquiryID', 'n', 'Inquiry ID'), F('InquiryDate', 'd', 'Record Date'), F('InquiryTime', 't', 'Record Time'), F('InquiryType', 't', 'Inquiry Type'),
      F('InquiryStatus', 'ch', 'Inquiry Status', { opts: OPT.inqStatus }), F('Cuurent_Action', 't', 'Current Action'), F('InvoicingStatus', 'ch', 'Invoicing Status', { opts: OPT.invStatus }),
      F('InquiryCompanyName', 't', 'Company Name'), F('CompanyNameRegstrd', 't', 'Registered Company Name'), F('InquiryCompanyTelNr', 't', 'Company Tel. Nr'),
      F('InquiryCompanyDistrict', 't', 'District'), F('InquiryCompanyLocation', 't', 'Location'), F('InquiryContactName', 't', 'Contact Name'), F('InquiryContactNumber', 't', 'Contact Nr'),
      F('InquiryContactEmail', 't', 'Contact Email'), F('TrnscBeneficiaryName', 't', 'Beneficiary Name'), F('InquiryIncomingSource', 'ch', 'Inquiry Source', { opts: OPT.inqSource }),
      F('InquiryRegisteredBy', 't', 'Registered By'), F('InquiryReceivedBy', 't', 'Received By'), F('InquiryWasAbout', 'm', 'Inquiry Was About'), F('InquiryRespond', 'm', 'Inquiry Respond'),
      F('InquiryRemarks', 'm', 'Inquiry Remarks'), F('InquiryVMType', 't', 'VM Type'), F('InquiryTransfferedTo', 't', 'Transferred To'), F('InquiryTrnsfrdby', 't', 'Transferred By'),
      F('InquiryTrnsfrdTimeStamp', 'dt', 'Transferred On'), F('InquiryRe_TransfferedTo', 't', 'Re-Transferred To'), F('InqryTrsfrd', 'b', 'Transferred'), F('InquiryEmailScreenShot', 't', 'Email Screenshot Link'),
      F('InquiryScanLink', 'm', 'Scanned Docs (links)'), F('NrofSendingEmail', 'n', 'Nr of Emails Sent'), F('UAEpass_Login_Type', 'ch', 'UAE Pass Login Type', { opts: OPT.uaePass }), F('UAEpass_Login_Nr', 't', 'UAE Pass Login Nr'),
      F('MinimumAmntApplied', 'b', 'Minimum Amount Applied'), F('CustomerAgrdAboutMinimumChrg', 'b', 'Customer Agreed Minimum Charge'), F('InquiryAmount', 'c', 'Inquiry Amount'), F('InquiryNrofItems', 'n', 'Nr of Items'),
      F('VATPrcntg', 'p', 'VAT %'), F('InquiryVAT', 'c', 'VAT'), F('InquiryAmountVAT', 'c', 'Amount incl. VAT'), F('NavInvoiceLink', 't', 'Invoice Link'), F('NavInvoiceAmnt', 'c', 'Invoice Amount'),
      F('NavInvoiceDate', 'd', 'Invoice Date'), F('NavUserID', 't', 'Invoiced By'), F('NavPOLink', 't', 'PO Link'), F('ReceivableCtrlStatus', 'ch', 'Receivable Ctrl Status', { opts: OPT.rcvCtrl }),
      F('ReceivableCtrlStatusUpdtBy', 't', 'Rcvbl Ctrl Updated By'), F('ReceivableCtrlStatusTimeStmp', 'dt', 'Rcvbl Ctrl Updated On'),
      ...'Passport,EIDA,Photo,LbrContract,Tenancy_Cont,NOC,SalaryLtr,BankStmnt,AttstdCertificate,VisaCopy,SponserPP,SponserVisa,SponserEIDA,TradeLicense'.split(',').map(n => F(n, 'b', n.replace(/_/g, ' '), { doc: true })),
      F('RecordCreatedBy', 't', 'Record Created By'), F('RcrdTimeStamp', 'dt', 'Record Created On')]
  },
  inqItems: {
    name: 'CoffeeInqryData', label: 'Inquiry requested items', pk: 'ItemsInqrsID', parent: 'InqryLink',
    title: r => r.Type_Of_Transection || r.ItemDesc || 'Item',
    fields: [F('ItemsInqrsID', 'n', 'Item ID'), F('InqryLink', 'n', 'Inquiry Link'), F('Type_Of_Transection', 't', 'Transaction Type'), F('ItemDesc', 't', 'Item Description'),
      F('ItemDetails', 'm', 'Item Details'), F('Delivery_Location', 't', 'Govt. Location'), F('Qty', 'n', 'Qty'), F('UnitPrice', 'c', 'Unit Price'), F('LineAmount', 'c', 'Line Amount'),
      F('VATPrcntg', 'p', 'VAT %'), F('VATAmount', 'c', 'VAT Amount'), F('LineAmountVAT', 'c', 'Line incl. VAT'), F('Remarks', 'm', 'Remarks'), F('CreationTimeStamp', 'dt', 'Created On')]
  },
  bnf: {
    name: 'Inquiry_Beneficiary_tbl', label: 'Inquiry beneficiaries', pk: null, parent: 'Link',
    title: r => r.Beneficiary_Name || 'Beneficiary',
    fields: [F('AccessID', 'n', 'Access ID'), F('Link', 'n', 'Inquiry Link'), F('Beneficiary_Name', 't', 'Beneficiary Name'), F('Gender', 'ch', 'Gender', { opts: OPT.gender }),
      F('Nationality', 't', 'Nationality'), F('Brith_Day', 'd', 'Birth Date'), F('Passport_Nr', 't', 'Passport Nr'), F('Passport_Starting_dt', 'd', 'Passport Issue'), F('Passport_Ending_dt', 'd', 'Passport Expiry'),
      F('UID_Nr', 't', 'UID Nr'), F('EIDA_Nr', 't', 'EIDA Nr'), F('Docs_Link', 'm', 'Docs Link'), F('InquiryStatus', 'ch', 'Status', { opts: OPT.inqStatus }), F('Remarks', 'm', 'Remarks')]
  },
  emp: {
    name: 'Employees', label: 'Employees & system users', pk: 'Employee1ID',
    title: r => [r.FirstName, r.LastName].filter(Boolean).join(' ') || r.User_Name || ('EMP-' + r.Employee1ID),
    fields: A('Employee1ID,EmployeeNo,EMPID,FirstName,LastName,Title,Department,Designation,EmploymentStatus,OfficeLocation,Email,PersonalEmail,WorkPhone,Extension,WorkMobileNr,PrivateMobileNr,HomeLandPhoneNr,HomePrivateMobileNr,LocalAddress,Gender,DateofBirth,PlaceofBirth,Nationality,SocialStatus,Nrofkinds,FamilySponsered,FamilyinUAE,DateofJoin,VisaExpiryDate,PassPortExpiryDate,EIDExpiryDate,DLExpiryDate,HealthCardExpiryDate,DMHealthCardExpiryDate,LaborCardExpiryDate,GatePassExpiryDate,PPNumber,PPAvailability,PPTknByStaff,DateofTknPP,ReasonOfTkPP,ReasonRemarksforTknPP,PromsingDateofReturnPP,DateOfRtrnPP,PPReceiveBy,PPReceiveTimeStamp,PPHandOverBy,PPHandOverTimeStamp,PPWithPRO,PPinPROQeue,PPinHRQeue,ReleaseReasonToPRO,DateLastVacation,LastVacationRe-joinedDate,DateofLeavingforCurntVacation,NrOfDaysForCurntVction,DateofReturningBkFromCurntVacation,VacationReplacementStaff,StaffVacationSysDate,LastSalaryDrawn,LastDateForPaidLS,CurrentDateForIllegibleLS,BankDetails,BankAccountNo,DeactiveDate,DeactiveReason,StaffTransferDate,StaffTransferReason,VisaScan,PassPortScan,EIDScan,DLScan,LaborContractScan,HlthCard,StaffPic,StaffSignature,StaffSignatureAUT,User_Name,Pword,Access_Level,SuperAdmin,DataBaseLoginRights,AccessNo,DbUser,Hide,Block,LoginStatus,LastTimeLoggedIn,LastTimeLoggedOut,NoOfSenstion,StationLoggedInIfo,WindowsUserName,PCUserProfile,CompanyLink,CompanyRelated,StaffLink,DepartmentLink,AttendID,AttendLocation,AttendanceShiftLink,LastAttendcSyncDate,DlvyStaff,EAVRGDISTANCE,EAVRGDurtion,EAVRGMAXSPEED,EAvrgIdelTime,SPStoreLocation,NAVSalesPrsnCode,NAVLink,JTCStampHolder,JTCSalesAdmin,EMPCounter,RecordDataType,VCLstNo,ActionsHistory',
      { Employee1ID: { t: 'n', l: 'Employee ID' }, Title: { t: 't', l: 'Title (Mr/Ms)' }, Access_Level: { t: 'ch', opts: OPT.access, l: 'Access Level' }, SuperAdmin: { t: 'ch', opts: OPT.superAdmin, l: 'Super Admin' },
        Gender: { t: 'ch', opts: ['Male', 'Female'] }, EmploymentStatus: { t: 'ch', opts: OPT.empStatus, l: 'Employment Status' }, SocialStatus: { t: 'ch', opts: OPT.social, l: 'Social Status' },
        Pword: { t: 't', l: 'Password (stored as SHA-256)' }, DbUser: { t: 'b', l: 'Can log in to the system' }, User_Name: { t: 't', l: 'User Name' }, CompanyLink: { t: 'n' }, DepartmentLink: { t: 'n' }, StaffLink: { t: 'n' }, AttendanceShiftLink: { t: 'n' } })
  },
  company: {
    name: 'CompanyInfoNN', label: 'Company information', pk: 'InfID',
    title: r => r.CompanyFullName || 'Company',
    fields: A('InfID,Active,CompanyFullName,ArabicName,BusinessType,Address,Country,City,TelephoneNumber,FaxNumber,POBox,Email,Website,LocationMap,LocationDetails,CompanyLogo,CompanyStamp,PrvInvAutoNrLetter,PLAutoNrLetter,POAutoNrLetter,DNAutoNrLetter,QTAutoNrLetter,SPAutoNrLetter,CompalintAutoNrLetter,SharedEmailsA,SharedEmailsB,SharedEmailsC,SharedEmailsD,SharedEmailsOperationDept,SharedEmailsServiceDept,SharedEmailsAdminDept,SharedEmailsHRDept,SharedEmailsMngmntDept,SharedEmailsMarketingDept,DocuemntsForderLink,ItemFolderLink,CustomersPOFolderLink,SuppliersQoutFolderLink,StaffFilesFolderLink,PDALink,LastDateForSyncPDA,Createdby,TimeStampCreated,UpdatedBy,TimeStampModifieded',
      { City: { t: 'ch', opts: OPT.city }, PrvInvAutoNrLetter: { t: 't', l: 'Invoice Nr Prefix' }, PLAutoNrLetter: { t: 't', l: 'Payment Voucher Prefix' }, QTAutoNrLetter: { t: 't', l: 'Quotation Prefix' }, POAutoNrLetter: { t: 't', l: 'Purchase Prefix' }, LocationDetails: { t: 'm' } })
  },
  bank: {
    name: 'Bank Table', label: 'Banks', pk: 'Bnk_ID', title: r => r.Bank_Desc || 'Bank',
    fields: [F('Bnk_ID', 'n', 'Bank ID', { alias: 'Bnk ID' }), F('Bank_Desc', 't', 'Bank Description', { alias: 'Bank Desc' }), F('Account_Name', 't', 'Account Name'), F('Account_Number', 't', 'Account Number', { alias: 'Account Number' }),
      F('IBAN', 't', 'IBAN'), F('SWIFT_Number', 't', 'SWIFT Code', { alias: 'SWIFT Number' }), F('Branch', 't', 'Branch'), F('Currency', 'ch', 'Currency', { opts: OPT.currency }), F('DefaultBankAccount', 'b', 'Default bank account'), F('Remarks', 'm', 'Remarks')]
  },
  cust: {
    name: 'Customers', label: 'Customer master', pk: 'CustomerID', title: r => r.CustomerName || 'Customer',
    fields: [F('CustomerID', 'n', 'Customer ID'), F('CustomerName', 't', 'Customer Name'), F('Payment_Terms_Code', 'ch', 'Payment Terms', { opts: OPT.terms, alias: 'Payment Terms Code' }), F('BusinessPhone', 't', 'Business Phone'),
      F('PrimaryContactFirstName', 't', 'Contact First Name'), F('PrimaryContactLastName', 't', 'Contact Last Name'), F('PrimaryContactJobTitle', 't', 'Contact Job Title'), F('PrimaryContactEmailAddress', 't', 'Contact Email'),
      F('Address', 'm', 'Address'), F('City', 't', 'City'), F('State', 't', 'Emirate / State'), F('Zip', 't', 'PO Box / Zip'), F('Website', 't', 'Website'), F('TRN', 't', 'Tax Reg. Nr (TRN)'), F('Notes', 'm', 'Notes'),
      F('AddedBy', 't', 'Added By'), F('AddedOn', 'dt', 'Added On'), F('ModifiedBy', 't', 'Modified By'), F('ModifiedOn', 'dt', 'Modified On')]
  },
  prod: {
    name: 'Products', label: 'Services / price list', pk: 'ProductID', title: r => r.ProductName || r.ProductCode || 'Service',
    fields: [F('ProductID', 'n', 'Service ID'), F('ProductCode', 't', 'Code'), F('ProductName', 't', 'Service Name (Type Of Transaction)'), F('Service_Type', 't', 'Service Type'),
      F('Delivery_Location', 't', 'Default Govt. Location'), F('Goverment_Fee', 'c', 'Default Govt. Fee'), F('Trnsction_Charges', 'c', 'Default Service Charges'), F('UnitPrice', 'c', 'Unit Price (total)'), F('ProductDescription', 'm', 'Description')]
  },
  settings: {
    name: 'SystemSettings', label: 'System settings', pk: null, title: r => r.SettingName,
    fields: [F('SettingName', 't', 'Setting Name'), F('SettingValue', 't', 'Value'), F('Notes', 'm', 'Notes')]
  },
};
/* SharePoint-safe internal column names */
const SP_RESERVED = new Set('title,id,created,modified,author,editor,attachments,contenttype,order,guid,fileref,fsobjtype,path,linktitle,edit,docicon,_uiversionstring'.split(','));
for (const [k, L] of Object.entries(LISTS)) {
  L.key = k;
  for (const f of L.fields) { let s = f.n.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, ''); if (/^\d/.test(s)) s = 'F' + s; if (SP_RESERVED.has(s.toLowerCase())) s = s + '_f'; f.sp = s.slice(0, 32); }
  L.byName = Object.fromEntries(L.fields.map(f => [f.n, f]));
}
const fieldOf = (k, n) => LISTS[k].byName[n] || F(n);
