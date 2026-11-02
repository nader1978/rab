/* ---------------------------------------------------------------- EMPLOYEES (Employees, EmployeesList, EmployeeSearchList, frmEmployeeDetail) */
const EXP_F = ['VisaExpiryDate', 'PassPortExpiryDate', 'EIDExpiryDate', 'LaborCardExpiryDate', 'HealthCardExpiryDate', 'DMHealthCardExpiryDate', 'DLExpiryDate', 'GatePassExpiryDate'];
const nextExpiry = e => EXP_F.filter(f => e[f]).map(f => ({ f, d: e[f], n: daysBetween(today(), e[f]) })).sort((a, b) => a.n - b.n)[0];
async function hashPw(rec) { if (rec.Pword && !String(rec.Pword).startsWith('sha256:')) rec.Pword = 'sha256:' + await sha256(rec.Pword); }
page('emp', 'HR', '👷', 'Employees', 'Staff records, document expiry, passport custody and vacations', async (v, param) => {
  await DB.all('emp');
  const lp = listPage(v, {
    k: 'emp', noun: 'employee', sortBy: 'Employee1ID', desc: false,
    search: ['FirstName', 'LastName', 'Department', 'Designation', 'Nationality', 'PPNumber', 'EmployeeNo', 'WorkMobileNr', 'Email'],
    filters: [{ f: 'Department', l: 'Department', opts: uniq(DB.peek('emp').map(e => e.Department)) }, { f: 'EmploymentStatus', l: 'Status', opts: OPT.empStatus }, { l: 'Documents', opts: ['Expiring ≤ 30 days', 'Expired'], get: e => { const x = nextExpiry(e); return !x ? '' : x.n < 0 ? 'Expired' : x.n <= 30 ? 'Expiring ≤ 30 days' : ''; } }],
    where: param === 'expiring' ? e => { const x = nextExpiry(e); return x && x.n <= 30; } : null,
    cols: [{ f: 'Employee1ID', l: 'ID', t: 'n' }, { l: 'Name', get: e => LISTS.emp.title(e) }, { f: 'Department', l: 'Department' }, { f: 'Designation', l: 'Designation' }, { f: 'Nationality', l: 'Nationality' }, { f: 'WorkMobileNr', l: 'Mobile' }, { f: 'EmploymentStatus', l: 'Status', html: e => badgeFor(e.EmploymentStatus === 'Active' ? 'Done' : e.EmploymentStatus).replace(/>Done</, '>Active<') },
      { l: 'Next expiry', html: e => { const x = nextExpiry(e); if (!x) return ''; return `<span class="badge ${x.n < 0 ? 'err' : x.n <= 30 ? 'warn' : 'ok'}">${esc(fieldOf('emp', x.f).l.replace(/ Expiry Date| Date/, ''))} · ${fdate(x.d)} (${x.n < 0 ? 'expired' : x.n + ' d'})</span>`; } }, { f: 'PPAvailability', l: 'PP in office', t: 'b' }, { f: 'DbUser', l: 'System user', t: 'b' }],
    tabs: [
      { title: 'Personal', sections: [{ fields: ['Employee1ID', 'EmployeeNo', 'EMPID', 'Title', 'FirstName', 'LastName', 'Gender', 'DateofBirth', 'PlaceofBirth', 'Nationality', 'SocialStatus', 'Nrofkinds', 'FamilySponsered', 'FamilyinUAE', 'StaffPic'] }] },
      { title: 'Job & contact', sections: [{ fields: ['Department', 'Designation', 'EmploymentStatus', 'DateofJoin', 'OfficeLocation', 'Email', 'PersonalEmail', 'WorkPhone', 'Extension', 'WorkMobileNr', 'PrivateMobileNr', 'HomeLandPhoneNr', 'HomePrivateMobileNr', 'LocalAddress'] }] },
      { title: 'Documents & expiry', sections: [{ fields: ['VisaExpiryDate', 'PassPortExpiryDate', 'EIDExpiryDate', 'LaborCardExpiryDate', 'HealthCardExpiryDate', 'DMHealthCardExpiryDate', 'DLExpiryDate', 'GatePassExpiryDate', 'VisaScan', 'PassPortScan', 'EIDScan', 'DLScan', 'LaborContractScan', 'HlthCard'] }] },
      { title: 'Passport custody', sections: [{ fields: ['PPNumber', 'PPAvailability', 'PPTknByStaff', 'DateofTknPP', 'ReasonOfTkPP', 'ReasonRemarksforTknPP', 'PromsingDateofReturnPP', 'DateOfRtrnPP', 'PPReceiveBy', 'PPReceiveTimeStamp', 'PPHandOverBy', 'PPHandOverTimeStamp', 'PPWithPRO', 'PPinPROQeue', 'PPinHRQeue', 'ReleaseReasonToPRO'] }] },
      { title: 'Vacation & salary', sections: [{ fields: ['DateLastVacation', 'LastVacationRe-joinedDate', 'DateofLeavingforCurntVacation', 'NrOfDaysForCurntVction', 'DateofReturningBkFromCurntVacation', 'VacationReplacementStaff', 'StaffVacationSysDate', 'LastSalaryDrawn', 'LastDateForPaidLS', 'CurrentDateForIllegibleLS', 'BankDetails', 'BankAccountNo'] }] },
      { title: 'Exit / transfer', sections: [{ fields: ['DeactiveDate', 'DeactiveReason', 'StaffTransferDate', 'StaffTransferReason'] }] },
      { title: 'Other', sections: [{ fields: ['AttendID', 'AttendLocation', 'AttendanceShiftLink', 'LastAttendcSyncDate', 'DepartmentLink', 'CompanyLink', 'CompanyRelated', 'StaffLink', 'DlvyStaff', 'SPStoreLocation', 'NAVSalesPrsnCode', 'NAVLink', 'JTCStampHolder', 'JTCSalesAdmin', 'EMPCounter', 'RecordDataType', 'VCLstNo', 'EAVRGDISTANCE', 'EAVRGDurtion', 'EAVRGMAXSPEED', 'EAvrgIdelTime', 'ActionsHistory'] }] },
    ],
    req: ['FirstName'], defaults: () => ({ EmploymentStatus: 'Active', DbUser: false, Hide: false }),
    before: async rec => { await hashPw(rec); if (rec.DeactiveDate && rec.EmploymentStatus === 'Active') rec.EmploymentStatus = 'Deactive'; },
  });
  lp.refresh();
}, 'Employees, Employees subform, EmployeesList, EmployeeSearchList, frmEmployeeDetail');

/* ---------------------------------------------------------------- LOGIN USERS WINDOW */
page('users', 'Administration', '🔑', 'Login Users', 'Who can sign in, their access level and login history (LoginUsersWindow)', async v => {
  await DB.all('emp');
  const lp = listPage(v, {
    k: 'emp', noun: 'user', where: e => e.DbUser || e.User_Name, sortBy: 'User_Name', desc: false,
    search: ['User_Name', 'FirstName', 'LastName', 'Access_Level'], filters: [{ f: 'Access_Level', l: 'Access level', opts: OPT.access }],
    cols: [{ f: 'User_Name', l: 'User name' }, { l: 'Staff', get: e => LISTS.emp.title(e) }, { f: 'Access_Level', l: 'Access level' }, { f: 'SuperAdmin', l: 'Super admin' }, { f: 'DbUser', l: 'Can log in', t: 'b' }, { f: 'Block', l: 'Blocked', t: 'b' }, { f: 'LoginStatus', l: 'Online', t: 'b' }, { f: 'LastTimeLoggedIn', l: 'Last login', t: 'dt' }, { f: 'NoOfSenstion', l: 'Sessions', t: 'n' }],
    sections: [{ title: 'Login', fields: ['FirstName', 'LastName', 'User_Name', 'Pword', 'Access_Level', 'SuperAdmin', 'DataBaseLoginRights', 'AccessNo', 'DbUser', 'Block', 'Hide', 'StaffSignature', 'Email'] }, { title: 'Login info', fields: ['LoginStatus', 'LastTimeLoggedIn', 'LastTimeLoggedOut', 'NoOfSenstion', 'StationLoggedInIfo'] }],
    ro: ['LoginStatus', 'LastTimeLoggedIn', 'LastTimeLoggedOut', 'NoOfSenstion', 'StationLoggedInIfo'], req: ['User_Name', 'Access_Level'],
    defaults: () => ({ DbUser: true, Access_Level: 'User', SuperAdmin: 'None', EmploymentStatus: 'Active' }),
    before: async (rec, isNew) => {
      if (DB.peek('emp').some(e => e._id !== rec._id && norm(e.User_Name) === norm(rec.User_Name))) { toast('That user name is already used.', 'warn'); return false; }
      if (isNew && !rec.Pword) { toast('Set a password for the new user.', 'warn'); return false; }
      await hashPw(rec);
    },
  });
  v.insertAdjacentHTML('afterbegin', `<div class="status-msg info" style="margin:0 0 14px">Users are rows of the <b>Employees</b> list with “Can log in” ticked — same as the Access <i>LoginUsersWindow</i>. Passwords are stored as SHA-256 hashes; old plain-text passwords from Access still work and are upgraded at the first login.</div>`);
  lp.refresh();
}, 'LoginUsersWindow, LoginUsersWindowPW, LoginUsersList, frmCredentials');

/* ---------------------------------------------------------------- COMPANY INFO (single record) */
page('company', 'Administration', '🏢', 'Company Info', 'Company details, document number prefixes and shared mailboxes (CompanyInfo)', async v => {
  await DB.all('company');
  let rec = company(); rec = rec._id ? { ...rec } : { InfID: 1, Active: true, Country: 'UAE' };
  v.innerHTML = `<div class="card"><div class="btn-row" style="margin-bottom:12px"><span class="muted">${DB.peek('company').length} company record(s) · the <b>Active</b> one prints on all documents.</span><span class="spacer"></span><select id="cPick" style="width:auto">${DB.peek('company').map(c => `<option value="${c._id}" ${c._id === rec._id ? 'selected' : ''}>${esc(c.CompanyFullName || 'Company ' + c.InfID)}</option>`).join('')}</select><button class="ghost small" id="cNew">＋ New</button><button class="success" id="cSave">💾 Save</button></div>
    <div id="cForm"></div></div>`;
  const draw = () => { $('#cForm', v).innerHTML = renderSections('company', rec, [{ title: 'Main details', fields: ['InfID', 'Active', 'CompanyFullName', 'ArabicName', 'BusinessType', 'Address', 'Country', 'City', 'TelephoneNumber', 'FaxNumber', 'POBox', 'Email', 'Website', 'LocationMap', 'LocationDetails'] }, { title: 'Document numbering', fields: ['PrvInvAutoNrLetter', 'QTAutoNrLetter', 'POAutoNrLetter', 'PLAutoNrLetter', 'DNAutoNrLetter', 'SPAutoNrLetter', 'CompalintAutoNrLetter'] }, { title: 'Shared e-mails', fields: ['SharedEmailsA', 'SharedEmailsB', 'SharedEmailsC', 'SharedEmailsD', 'SharedEmailsOperationDept', 'SharedEmailsServiceDept', 'SharedEmailsAdminDept', 'SharedEmailsHRDept', 'SharedEmailsMngmntDept', 'SharedEmailsMarketingDept'] }, { title: 'Folders, logo & stamp (links)', fields: ['CompanyLogo', 'CompanyStamp', 'DocuemntsForderLink', 'ItemFolderLink', 'CustomersPOFolderLink', 'SuppliersQoutFolderLink', 'StaffFilesFolderLink', 'PDALink', 'LastDateForSyncPDA'] }, { title: 'Audit', fields: ['Createdby', 'TimeStampCreated', 'UpdatedBy', 'TimeStampModifieded'] }], { ro: ['InfID', 'Createdby', 'TimeStampCreated', 'UpdatedBy', 'TimeStampModifieded'], req: ['CompanyFullName'], wide: ['CompanyFullName', 'ArabicName'] }); };
  draw();
  $('#cPick', v).onchange = e => { rec = { ...DB.peek('company').find(c => c._id === e.target.value) }; draw(); };
  $('#cNew', v).onclick = () => { rec = { Active: false, Country: 'UAE' }; draw(); };
  $('#cSave', v).onclick = async () => { if (!validate(v, ['CompanyFullName'])) return; const x = readForm($('#cForm', v), 'company', rec); if (!x._id) { x.Createdby = me(); x.TimeStampCreated = nowIso(); } x.UpdatedBy = me(); x.TimeStampModifieded = nowIso();
    try { rec = await DB.save('company', x); if (rec.Active) await DB.bulk(DB.peek('company').filter(c => c._id !== rec._id && c.Active).map(c => () => DB.save('company', { ...c, Active: false }))); toast('Company saved ✔', 'success'); applyBranding(); route(); } catch (e) { toast(e.message, 'error'); } };
}, 'CompanyInfo');

/* ---------------------------------------------------------------- SIMPLE MASTERS */
page('bank', 'Administration', '🏦', 'Banks', 'Bank and cash accounts used on payments (Bank Table)', async v => {
  await DB.all('bank');
  listPage(v, { k: 'bank', noun: 'bank account', sortBy: 'Bnk_ID', desc: false, cols: [{ f: 'Bnk_ID', l: 'ID', t: 'n' }, { f: 'Bank_Desc', l: 'Bank / account' }, { f: 'Account_Number', l: 'Account Nr' }, { f: 'IBAN', l: 'IBAN' }, { f: 'SWIFT_Number', l: 'SWIFT' }, { f: 'Currency', l: 'Cur.' }, { f: 'DefaultBankAccount', l: 'Default', t: 'b' }], sections: [{ fields: LISTS.bank.fields.map(f => f.n) }], req: ['Bank_Desc'],
    after: async rec => { if (rec.DefaultBankAccount) await DB.bulk(DB.peek('bank').filter(b => b._id !== rec._id && b.DefaultBankAccount).map(b => () => DB.save('bank', { ...b, DefaultBankAccount: false }))); } }).refresh();
}, 'Bank Table, Bank Account');
page('cust', 'Administration', '📇', 'Customer Master', 'Customer cards: contact, payment terms (used by the aged report)', async v => {
  await Promise.all([DB.all('cust'), DB.all('trans')]);
  const bal = c => sum(DB.peek('trans').filter(t => t.Company_Name === c.CustomerName && num(t.Transection_Type) === 1), 'Bal_Trans_Amount');
  listPage(v, { k: 'cust', noun: 'customer', sortBy: 'CustomerName', desc: false, search: ['CustomerName', 'PrimaryContactFirstName', 'PrimaryContactLastName', 'BusinessPhone', 'City', 'TRN'], filters: [{ f: 'Payment_Terms_Code', l: 'Terms', opts: OPT.terms }],
    cols: [{ f: 'CustomerID', l: 'ID', t: 'n' }, { f: 'CustomerName', l: 'Customer' }, { l: 'Contact', get: c => [c.PrimaryContactFirstName, c.PrimaryContactLastName].filter(Boolean).join(' ') }, { f: 'BusinessPhone', l: 'Phone' }, { f: 'City', l: 'City' }, { f: 'Payment_Terms_Code', l: 'Terms' }, { l: 'Open balance', t: 'c', get: bal }],
    sections: [{ title: 'Customer', fields: ['CustomerID', 'CustomerName', 'Payment_Terms_Code', 'TRN', 'BusinessPhone', 'Website'] }, { title: 'Primary contact', fields: ['PrimaryContactFirstName', 'PrimaryContactLastName', 'PrimaryContactJobTitle', 'PrimaryContactEmailAddress'] }, { title: 'Address & notes', fields: ['Address', 'City', 'State', 'Zip', 'Notes'] }, { title: 'Audit', fields: ['AddedBy', 'AddedOn', 'ModifiedBy', 'ModifiedOn'] }],
    ro: ['AddedBy', 'AddedOn', 'ModifiedBy', 'ModifiedOn'], req: ['CustomerName'], wide: ['CustomerName'], defaults: () => ({ Payment_Terms_Code: 'CASH' }),
    before: (r, isNew) => { if (isNew) { r.AddedBy = me(); r.AddedOn = nowIso(); } r.ModifiedBy = me(); r.ModifiedOn = nowIso(); },
    extra: (host, r) => { if (!r.CustomerName) return; const t = DB.peek('trans').filter(x => x.Company_Name === r.CustomerName); host.innerHTML = `<div class="sec-title">Transactions (${t.length}) · balance ${money(sum(t.filter(x => num(x.Transection_Type) === 1), 'Bal_Trans_Amount'))}</div><div class="btn-row"><button class="small secondary" onclick="Modal.close();go('customers','${esc(r.CustomerName).replace(/'/g, '')}')">Open overview</button><button class="small ghost" onclick="printSOA('${esc(r.CustomerName).replace(/'/g, "\\'")}')">📄 SOA</button></div>`; } }).refresh();
}, 'frmCustomerList, frmCustomerDetail, sfrmCustomerDetail_*');
page('prod', 'Administration', '📦', 'Services Price List', 'Default government fees and service charges — fill invoice lines automatically', async v => {
  await Promise.all([DB.all('prod'), DB.all('svcLines')]);
  const lp = listPage(v, { k: 'prod', noun: 'service', sortBy: 'ProductName', desc: false, search: ['ProductCode', 'ProductName', 'Service_Type', 'Delivery_Location'], filters: [{ f: 'Service_Type', l: 'Service type', opts: uniq(DB.peek('prod').map(p => p.Service_Type)) }],
    cols: [{ f: 'ProductCode', l: 'Code' }, { f: 'ProductName', l: 'Service' }, { f: 'Service_Type', l: 'Service type' }, { f: 'Delivery_Location', l: 'Location' }, { f: 'Goverment_Fee', l: 'Govt. fee', t: 'c' }, { f: 'Trnsction_Charges', l: 'Charges', t: 'c' }, { f: 'UnitPrice', l: 'Total', t: 'c' }, { l: 'Times sold', t: 'n', get: p => sum(DB.peek('svcLines').filter(l => norm(l.Type_Of_Transection) === norm(p.ProductName)), 'Trnsction_Qty') }],
    sections: [{ fields: ['ProductID', 'ProductCode', 'ProductName', 'Service_Type', 'Delivery_Location', 'Goverment_Fee', 'Trnsction_Charges', 'UnitPrice', 'ProductDescription'] }], calc: ['UnitPrice'], req: ['ProductName'], wide: ['ProductName'],
    before: r => { r.UnitPrice = r2(num(r.Goverment_Fee) + num(r.Trnsction_Charges)); if (!r.ProductCode) r.ProductCode = 'SRV' + String(DB.nextKey('prod')).padStart(3, '0'); },
    wire: body => { const f = () => setVal(body, 'UnitPrice', r2(num(getVal(body, 'Goverment_Fee')) + num(getVal(body, 'Trnsction_Charges')))); $$('[data-f="Goverment_Fee"],[data-f="Trnsction_Charges"]', body).forEach(e => e.oninput = f); } });
  v.querySelector('.toolbar').insertAdjacentHTML('beforeend', `<button class="ghost small" id="prLearn" title="Create price-list rows from services already invoiced">✨ Learn from invoices</button>`);
  $('#prLearn', v).onclick = async () => { const have = new Set(DB.peek('prod').map(p => norm(p.ProductName))); const g = [...groupBy(DB.peek('svcLines').filter(l => l.Type_Of_Transection && !have.has(norm(l.Type_Of_Transection))), l => l.Type_Of_Transection)]; if (!g.length) return toast('Every invoiced service is already in the price list.', ''); if (!(await confirmBox(`Add ${g.length} service(s) found in invoices, using their latest fees?`, 'Add'))) return; await DB.bulk(g.map(([n, a]) => () => { const l = a[a.length - 1]; return DB.save('prod', { ProductName: n, Delivery_Location: l.Delivery_Location, Goverment_Fee: l.Goverment_Fee, Trnsction_Charges: l.Trnsction_Charges, UnitPrice: r2(num(l.Goverment_Fee) + num(l.Trnsction_Charges)) }); })); toast('Price list updated', 'success'); lp.refresh(); };
  lp.refresh();
}, 'frmProductDetail, Products, sfrmMainMenu_ProductList');

/* ---------------------------------------------------------------- SETTINGS & SHAREPOINT */
const ACCENTS = [['rab', 'RAB green & gold', 'linear-gradient(120deg,#1f2321 0%,#0b4d27 45%,#0e7a3a 80%,#c9a227 100%)'], ['blue', 'Blue', 'linear-gradient(120deg,#12306b,#3b82f6)'], ['green', 'Green', 'linear-gradient(120deg,#14532d,#34b863)'], ['navy', 'Dark blue', 'linear-gradient(120deg,#071433,#1e40af)'], ['gray', 'Gray', 'linear-gradient(120deg,#1f2937,#8795a8)'], ['red', 'Dark red', 'linear-gradient(120deg,#5b0f1b,#d6455a)']];
const ACCENT_KEY = APP.ls + '_accent';   // RAB keeps its own colour theme (SC Mngt has no RAB theme)
const accentGet = () => { try { return localStorage.getItem(ACCENT_KEY) || 'rab'; } catch (e) { return 'rab'; } };
function accentApply(a) { if (!a || a === 'blue') document.documentElement.removeAttribute('data-accent'); else document.documentElement.setAttribute('data-accent', a); $$('#setAccent button').forEach(b => b.classList.toggle('on', b.dataset.a === a)); }
const BRAND_ORIG = { name: 'RAB Sales & Expenses System', tag: 'Invoices · Purchases · Payments · Inquiries', logoLogin: '🔐', logoSide: '💼', img: LOGO_FILES.icon, full: LOGO_FILES.full };
const brandGet = () => ({ ...BRAND_DEFAULT, ...Object.fromEntries(Object.entries(lsGet('brand', {})).filter(([, v]) => v)) });
function brandApply(b = brandGet()) {
  const name = b.name || BRAND_ORIG.name, img = b.img || (b.logo ? '' : BRAND_ORIG.img);
  $$('[data-brand="name"]').forEach(e => e.textContent = name);
  $$('[data-brand="tag"]').forEach(e => e.textContent = b.tag || BRAND_ORIG.tag);
  $$('[data-brand="logo"]').forEach(e => { if (img) { e.innerHTML = `<img alt="" src="${esc(img)}">`; e.classList.add('has-img'); } else { e.textContent = b.logo || (e.closest('.login-brand') ? BRAND_ORIG.logoLogin : BRAND_ORIG.logoSide); e.classList.remove('has-img'); } });
  $$('[data-brand="full"]').forEach(e => { const show = !b.img && !b.logo && BRAND_ORIG.full; e.style.display = show ? '' : 'none'; if (show) e.src = BRAND_ORIG.full; const lc = e.closest('.login-card'); if (lc) lc.classList.toggle('has-full', !!show); });
  document.title = name + ' — Secure';
}

page('settings', 'Configuration', '⚙', 'Settings', 'Global + personal settings', async v => {
  const c = cfg(), b = brandGet(), adm = Auth.isAdmin();
  v.innerHTML = `
  ${adm ? `<div class="card"><div class="card-header"><div class="card-title">🏷 System name &amp; logo <span class="badge role-admin">ADMIN ONLY</span></div></div>
    <div class="card-desc">Change the name and logo shown on the sign-in page, the side panel and the browser tab. Logo = a short text / emoji, or an uploaded picture. Saved on this browser; use <b>Copy default</b> and paste the result over <code>BRAND_DEFAULT</code> in the config (<code>js/00-config.js</code> or the top of the HTML file) to give it to every user. Documents still print the company from <i>Company Info</i>.</div>
    <div class="grid three"><div class="form-group"><label>System name</label><input type="text" id="brName" maxlength="60" value="${esc(b.name)}" placeholder="${esc(BRAND_ORIG.name)}"></div><div class="form-group"><label>Tagline (sign-in page)</label><input type="text" id="brTag" maxlength="60" value="${esc(b.tag)}" placeholder="${esc(BRAND_ORIG.tag)}"></div><div class="form-group"><label>Logo text / emoji</label><input type="text" id="brLogo" maxlength="4" value="${esc(b.logo)}" placeholder="💼"></div></div>
    <div class="btn-row" style="margin-top:12px"><button class="secondary small" id="brFile">🖼 Upload logo picture…</button><button class="ghost small" id="brNoImg">✖ Remove picture</button><input type="file" id="brPick" accept="image/*" hidden><span class="spacer"></span><button id="brSave">💾 Save</button><button class="secondary" id="brCopy">📋 Copy default</button><button class="ghost" id="brReset">↺ Reset to original</button></div><div id="brMsg"></div></div>

  <div class="card"><div class="card-header"><div class="card-title">🌐 Global Connection Settings <span class="badge role-admin">ADMIN ONLY</span></div></div>
    <div class="card-desc">These values are <b>shared with NFPC SC Mngt Support System</b>: when both pages are opened from the same web address (e.g. <code>${esc(location.origin)}</code>), the Tenant ID, Client ID, Site URL, Microsoft sign-in and light/dark mode set in one are used by the other — configure once.</div>
    <div class="grid two"><div class="form-group"><label>Global SharePoint Site URL <span class="hint">— same as SC Mngt</span></label><input type="text" id="sSite" value="${esc(c.scSite)}" placeholder="https://tenant.sharepoint.com/sites/YourSite"></div>
      <div class="form-group"><label>RAB lists site <span class="hint">— only if the RAB lists live on a different site (blank = global site)</span></label><input type="text" id="sRabSite" value="${esc(c.rabSite)}" placeholder="(use the global site)"></div>
      <div class="form-group"><label>Data mode</label><select id="sMode2"><option value="sp" ${c.mode === 'sp' ? 'selected' : ''}>SharePoint (Microsoft 365)</option><option value="demo" ${c.mode === 'demo' ? 'selected' : ''}>Demo data (this browser only)</option></select></div></div>
    <hr style="border:none;border-top:1px solid var(--border);margin:14px 0">
    <div class="card-title" style="font-size:13px;margin-bottom:6px">🔐 Microsoft sign-in <span class="hint" style="font-weight:400">— no pasted token; each user signs in with their own account</span></div>
    <div class="card-desc">Register the app once in Microsoft Entra → App registrations → <em>Single-page application</em> redirect URI = the address this page is opened from: <code>${esc(location.origin + location.pathname)}</code> (add it next to the SC Mngt address in the <b>same</b> app registration). API permissions: Microsoft Graph <code>Sites.ReadWrite.All</code> + <code>User.Read</code> (+ <code>Sites.Manage.All</code> to create the lists), then grant admin consent.</div>
    <div class="grid two"><div class="form-group"><label>Tenant ID</label><input type="text" id="sTen" value="${esc(c.tenantId)}" placeholder="00000000-0000-0000-0000-000000000000"></div><div class="form-group"><label>Client (Application) ID</label><input type="text" id="sCli" value="${esc(c.clientId)}" placeholder="00000000-0000-0000-0000-000000000000"></div></div>
    <div class="btn-row" style="margin-top:12px"><button class="secondary" id="sSave">💾 Save IDs</button><button id="sSign">🔐 Sign in with Microsoft</button><button class="ghost" id="sOut">Sign out</button><span class="muted" id="sWho"></span></div><div id="sMsg"></div>
    <div class="muted" style="margin-top:8px">${(() => { const g = scGet(SC_KEY.global); return g.updatedAt ? `Last changed ${fdt(new Date(g.updatedAt).toISOString())} by ${esc(g.updatedBy || '')}` : ''; })()}</div></div>

  <div class="card"><div class="card-header"><div class="card-title">🗂 SharePoint lists <span class="hint" style="font-weight:400">— one per Access table</span> <span class="badge role-admin">ADMIN ONLY</span></div><div class="btn-row"><button class="secondary small" id="sChk">🔍 Check lists</button><button class="success small" id="sProv">🛠 Create / repair all lists</button></div></div>
    <div class="card-desc">Creates any missing list and column on the site above. Safe to run again — existing data is never touched.</div>
    <div class="tbl-wrap" style="max-height:none"><table class="dt"><thead><tr><th>Access table</th><th>SharePoint list name</th><th>Columns</th><th>Status</th></tr></thead><tbody>${Object.entries(LISTS).map(([k, L]) => `<tr><td>${esc(L.name)}<div class="muted">${esc(L.label)}</div></td><td><input type="text" data-ln="${k}" value="${esc(listName(k))}" style="max-width:280px"></td><td class="num">${L.fields.length}</td><td data-ls="${k}"><span class="muted">—</span></td></tr>`).join('')}</tbody></table></div>
    <div class="progress" id="sProg" style="display:none"><div></div></div></div>

  <div class="card"><div class="card-header"><div class="card-title">📥 Move your Access data <span class="badge role-admin">ADMIN ONLY</span></div></div><div class="card-desc">In Access: right-click each table → Export → Excel. Then import the files here (the file/sheet name picks the list; columns match by name). Import header tables (OutSources_Manpower_tbl, OfficeIncomingVMInquiry) before their line tables — the link numbers (OUTSR_ID, InquiryID) are kept.</div>
    <div class="btn-row"><button id="sImp">⬆ Import Excel / CSV files</button><button class="secondary" id="sBak">⬇ Backup everything to Excel</button>${c.mode === 'demo' ? '<button class="ghost" id="sReset">↺ Reset demo data</button>' : ''}</div></div>` : `<div class="status-msg info" style="margin:0 0 18px">Connection settings are managed by an administrator.</div>`}

  <div class="card"><div class="card-header"><div class="card-title">⚙ Personal Settings</div></div>
    <div class="grid"><div class="form-group spanall"><label>Colour theme <span class="hint">— headers, buttons and highlights across the whole system — RAB green &amp; gold comes from the logo</span></label><div id="setAccent">${ACCENTS.map(t => `<button type="button" data-a="${t[0]}"><i style="background:${t[2]}"></i>${t[1]}</button>`).join('')}</div></div>
      <div class="form-group"><label>Light / dark</label><div class="muted" style="padding-top:6px">Follows the 🌙 button in the top bar.</div></div></div>
    <div class="btn-row" style="margin-top:14px">${Auth.user && Auth.user._id ? '<button class="secondary" id="chgPw">🔑 Change My Password</button>' : ''}<button class="danger" id="clrMine">🗑 Clear My Saved Data</button></div></div>`;
  accentApply(accentGet());
  $('#setAccent', v).onclick = e => { const x = e.target.closest('[data-a]'); if (!x) return; try { localStorage.setItem(ACCENT_KEY, x.dataset.a); } catch (er) {} accentApply(x.dataset.a); };
  $('#chgPw', v) && ($('#chgPw', v).onclick = changeMyPassword);
  $('#clrMine', v).onclick = async () => { if (!(await confirmBox('Clear your saved filters, layout and activity log on this browser? Data in SharePoint is not touched.', 'Clear', true))) return; Object.keys(localStorage).filter(k => k.startsWith(APP.ls + '_') && !k.startsWith(APP.ls + '_demo_') && !k.endsWith('_cfg') && !k.endsWith('_brand')).forEach(k => localStorage.removeItem(k)); toast('Cleared', 'success'); };
  if (!adm) return;
  /* brand */
  let img = b.img || '';
  const bmsg = (t, cls = 'success') => $('#brMsg', v).innerHTML = `<div class="status-msg ${cls}">${t}</div>`;
  const draft = () => ({ name: $('#brName', v).value.trim(), tag: $('#brTag', v).value.trim(), logo: $('#brLogo', v).value.trim(), img });
  ['#brName', '#brTag', '#brLogo'].forEach(s => $(s, v).oninput = () => brandApply({ ...BRAND_DEFAULT, ...draft() }));
  $('#brFile', v).onclick = () => $('#brPick', v).click();
  $('#brPick', v).onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'), s = Math.min(1, 160 / Math.max(im.width, im.height)); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); img = cv.toDataURL('image/png'); brandApply({ ...BRAND_DEFAULT, ...draft() }); }; im.src = rd.result; }; rd.readAsDataURL(f); };
  $('#brNoImg', v).onclick = () => { img = ''; brandApply({ ...BRAND_DEFAULT, ...draft() }); };
  $('#brSave', v).onclick = () => { lsSet('brand', draft()); brandApply(); bmsg('✔ Saved on this browser.'); };
  $('#brCopy', v).onclick = async () => { const t = 'const BRAND_DEFAULT = ' + JSON.stringify(draft()) + ';'; try { await navigator.clipboard.writeText(t); bmsg('✔ Copied — paste it over the BRAND_DEFAULT line in the config (js/00-config.js, or the top of the HTML file).'); } catch (e) { prompt('Copy this line:', t); } };
  $('#brReset', v).onclick = () => { lsSet('brand', {}); img = ''; ['#brName', '#brTag', '#brLogo'].forEach(s => $(s, v).value = ''); brandApply(); bmsg('↺ Back to the original name and logo.'); };
  /* connection */
  const msg = (t, cls = 'info') => $('#sMsg', v).innerHTML = `<div class="status-msg ${cls}">${t}</div>`;
  const store = () => { const ln = {}; $$('[data-ln]', v).forEach(i => { if (i.value.trim() && i.value.trim() !== LISTS[i.dataset.ln].name) ln[i.dataset.ln] = i.value.trim(); }); saveCfg({ mode: $('#sMode2', v).value, siteUrl: $('#sSite', v).value.trim().replace(/\/+$/, ''), rabSiteUrl: $('#sRabSite', v).value.trim(), tenantId: $('#sTen', v).value.trim(), clientId: $('#sCli', v).value.trim(), listNames: ln }); MS.app = null; MS.token = null; DB.resetCache(); updateConn(); };
  $('#sSave', v).onclick = () => { store(); msg('✅ Saved on this browser (also used by SC Mngt here). To give the IDs to every user, also put them into MS_AUTH_DEFAULT in the config (js/00-config.js or the top of the HTML file).', 'success'); };
  $('#sSign', v).onclick = async () => { store(); if (cfg().mode !== 'sp') return msg('Switch Data mode to SharePoint first.', 'warn'); try { msg('Signing in…'); await MS.getToken(true); await SP.site(); $('#sWho', v).textContent = '✔ ' + MS.user(); msg(`✅ Signed in as ${esc(MS.user())} and connected to the site. The token renews automatically.`, 'success'); updateConn(); } catch (e) { msg('✘ ' + esc(e.message), 'error'); } };
  $('#sOut', v).onclick = async () => { await MS.signOut(); updateConn(); msg('Signed out.', 'warn'); };
  const status = (k, html) => { const td = $(`[data-ls="${k}"]`, v); if (td) td.innerHTML = html; };
  $('#sChk', v).onclick = async () => { store(); if (cfg().mode !== 'sp') return msg('Switch Data mode to SharePoint first.', 'warn'); try { await MS.getToken(true); for (const k of Object.keys(LISTS)) { status(k, '…'); try { const r = await SP.inspect(k); status(k, !r.exists ? '<span class="badge err">missing</span>' : r.missing.length ? `<span class="badge warn">${r.missing.length} column(s) missing</span>` : '<span class="badge ok">ready</span>'); } catch (e) { status(k, `<span class="badge err">${esc(e.message)}</span>`); } } } catch (e) { msg('✘ ' + esc(e.message), 'error'); } };
  $('#sProv', v).onclick = async () => { store(); if (cfg().mode !== 'sp') return msg('Switch Data mode to SharePoint first.', 'warn');
    try { await MS.getToken(true); await MS.getManageToken(true); } catch (e) { return msg('✘ ' + esc(e.message) + ' — the app needs the Sites.Manage.All permission.', 'error'); }
    MS.manage = true; const keys = Object.keys(LISTS); $('#sProg', v).style.display = '';
    try { for (let i = 0; i < keys.length; i++) { const k = keys[i]; status(k, 'working…'); try { const n = await SP.provision(k, s => status(k, esc(s))); status(k, `<span class="badge ok">ready${n ? ` (+${n})` : ''}</span>`); } catch (e) { status(k, `<span class="badge err">${esc(e.message)}</span>`); } $('#sProg div', v).style.width = ((i + 1) / keys.length * 100) + '%'; } msg('✔ Lists are ready. Import your Access data below.', 'success'); Activity.add('🛠', 'SharePoint lists created / repaired'); }
    finally { MS.manage = false; DB.resetCache(); } };
  $('#sImp', v).onclick = () => importDialog(null, () => { DB.resetCache(); Activity.add('⬆', 'Data imported from Excel'); });
  $('#sBak', v).onclick = async () => { try { const wb = XLSX.utils.book_new(); for (const k of Object.keys(LISTS)) { const rows = await DB.all(k); const ws = XLSX.utils.json_to_sheet(rows.map(r => Object.fromEntries(LISTS[k].fields.map(f => [f.n, r[f.n] ?? ''])))); XLSX.utils.book_append_sheet(wb, ws, LISTS[k].name.slice(0, 31)); } XLSX.writeFile(wb, `RAB_backup_${today()}.xlsx`); } catch (e) { toast(e.message, 'error'); } };
  $('#sReset', v) && ($('#sReset', v).onclick = async () => { if (!(await confirmBox('Reset all demo data in this browser?', 'Reset', true))) return; Object.keys(LISTS).forEach(k => { try { localStorage.removeItem(APP.ls + '_demo_' + k); } catch (e) {} }); DB.resetCache(); toast('Demo data reset', 'success'); go('home'); });
}, 'sfrmAdmin_SystemSettings, frmAdmin');
function changeMyPassword() {
  const body = Modal.open('Change my password', `<div class="grid two"><div class="form-group"><label>Current password</label><input type="password" id="pw0" autocomplete="current-password"></div><div></div><div class="form-group"><label>New password <span class="hint">min 6 characters</span></label><input type="password" id="pw1" autocomplete="new-password"></div><div class="form-group"><label>Repeat new password</label><input type="password" id="pw2" autocomplete="new-password"></div></div>`, [{ label: 'Cancel', cls: 'ghost' }, { label: '🔑 Change', onClick: async () => {
    const e = DB.peek('emp').find(x => x._id === Auth.user._id); if (!e) return toast('User record not found.', 'error');
    const old = $('#pw0', body).value, n1 = $('#pw1', body).value, h0 = await sha256(old);
    if (!(e.Pword === 'sha256:' + h0 || e.Pword === old)) return toast('Current password is wrong.', 'warn');
    if (n1.length < 6) return toast('New password: at least 6 characters.', 'warn'); if (n1 !== $('#pw2', body).value) return toast('The two new passwords differ.', 'warn');
    try { await DB.save('emp', { ...e, Pword: 'sha256:' + await sha256(n1) }); Modal.close(); toast('Password changed ✔', 'success'); Activity.add('🔑', 'Password changed'); } catch (x) { toast(x.message, 'error'); }
  } }], 'narrow');
}

/* ---------------------------------------------------------------- HELP / ABOUT */
page('help', 'Administration', '❔', 'Help & Form Map', 'Which Access form became which page', async v => {
  v.innerHTML = `<div class="card"><div class="card-title" style="margin-bottom:10px">Access form → HTML page</div><div class="tbl-wrap" style="max-height:none"><table class="dt"><thead><tr><th>Page</th><th>Access forms / reports it replaces</th></tr></thead><tbody>${PAGES.filter(p => p.form).map(p => `<tr onclick="go('${p.id}')"><td>${p.icon} <b>${esc(p.label)}</b></td><td style="white-space:normal">${esc(p.form)}</td></tr>`).join('')}</tbody></table></div>
    <div class="muted" style="margin-top:10px">Not carried over (Northwind template or utility forms): frmNorthwindFeatures, sfrmOrders_*, frmOrderDetails, frmWelcome, frmStartup, frmHidden, Timer forms, Form1.</div></div>
    <div class="card"><div class="card-title" style="margin-bottom:10px">Smart features</div><ul style="font-size:13px;line-height:1.9;margin-left:18px">
      <li>Type-ahead suggestions on names, services and locations from your own history (like the Access “SELECT DISTINCT” combo boxes).</li>
      <li>Invoice lines fill government fee and charges from the price list or the last time that service was sold.</li>
      <li>Auto numbering (RAB-ddmmyy-Nr, PV numbers), automatic totals, balance, margin and payment status.</li>
      <li>“Save as default” per service type — new invoices offer to load those lines (Access AutoCallRecordData).</li>
      <li>Inquiry → service invoice in one click, then the inquiry status update pop-up (Inqrs_Alarms_Update).</li>
      <li>Posted records are re-posted automatically when you edit them, so the P&amp;L stays correct.</li>
      <li>Alerts for open inquiries, payment reminders, unpaid invoices &gt; 30 days, unposted records and staff document expiry.</li>
      <li>Shortcuts: <span class="kbd">Ctrl K</span> search everything · <span class="kbd">Ctrl S</span> save · <span class="kbd">Alt ←/→</span> previous/next record.</li>
      <li>Every list exports to Excel; every report prints or saves as PDF; WhatsApp and e-mail buttons on invoices and inquiries.</li></ul></div>`;
}, 'frmAbout');

/* =====================================================================
   GLOBAL SEARCH (Ctrl+K)
   ===================================================================== */
function openSearch() {
  const body = Modal.open('Search everything', `<input type="search" id="gq" placeholder="Invoice nr, company, contact, inquiry, employee…" autofocus><div class="search-results" id="gr" style="margin-top:10px"></div>`, [], 'wide');
  const q = $('#gq', body); let hits = [], hl = 0;
  const run = () => {
    const s = q.value.trim(); if (s.length < 2) { $('#gr', body).innerHTML = '<div class="empty">Type at least 2 characters.</div>'; hits = []; return; }
    hits = [
      ...(Auth.can('trans') ? textFilter(DB.peek('trans'), s, ['Transection_Nr', 'Company_Name', 'Contact_Name', 'Driver_Contact_Nr', 'PaymentVoucherNr', 'OUTSR_ID', 'Beneficiary_Name']).slice(0, 25).map(t => ({ i: '🧾', t: `${t.Transection_Nr} — ${t.Company_Name || ''}`, s: `${t.TransectionType} · ${fdate(t.Transection_Date)} · ${money(t.Transection_Amount)} · bal ${money(t.Bal_Trans_Amount)}`, go: () => go('trans', t.OUTSR_ID) })) : []),
      ...(Auth.can('inq') ? textFilter(DB.peek('inq'), s, ['InquiryID', 'InquiryCompanyName', 'InquiryContactName', 'InquiryContactNumber', 'TrnscBeneficiaryName']).slice(0, 15).map(i => ({ i: '📞', t: `Inquiry ${i.InquiryID} — ${i.InquiryCompanyName || ''}`, s: `${i.InquiryType || ''} · ${i.InquiryStatus} · ${fdate(i.InquiryDate)}`, go: () => go('inq', i.InquiryID) })) : []),
      ...(Auth.can('emp') ? textFilter(DB.peek('emp'), s, ['FirstName', 'LastName', 'PPNumber', 'EmployeeNo', 'WorkMobileNr']).slice(0, 10).map(e => ({ i: '👷', t: LISTS.emp.title(e), s: `${e.Designation || ''} · ${e.Department || ''}`, go: () => go('emp') })) : []),
      ...(Auth.can('customers') ? uniq(DB.peek('trans').filter(t => num(t.Transection_Type) === 1).map(t => t.Company_Name)).filter(c => norm(c).includes(norm(s))).slice(0, 8).map(c => ({ i: '👥', t: c, s: 'Customer overview', go: () => go('customers', c) })) : []),
    ];
    hl = 0; $('#gr', body).innerHTML = hits.length ? hits.map((h, i) => `<div class="sr-item ${i === hl ? 'hl' : ''}" data-i="${i}"><span style="font-size:18px">${h.i}</span><div><div><b>${esc(h.t)}</b></div><div class="muted">${esc(h.s)}</div></div></div>`).join('') : '<div class="empty">Nothing found.</div>';
    $$('.sr-item', body).forEach(e => e.onclick = () => { Modal.close(); hits[+e.dataset.i].go(); });
  };
  q.oninput = debounce(run, 150); run();
  q.onkeydown = e => { const items = $$('.sr-item', body); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, Math.min(items.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1))); items.forEach((x, i) => x.classList.toggle('hl', i === hl)); items[hl]?.scrollIntoView({ block: 'nearest' }); } if (e.key === 'Enter' && hits[hl]) { Modal.close(); hits[hl].go(); } };
  setTimeout(() => q.focus(), 50);
}


/* ---------------------------------------------------------------- SWITCHBOARD (main page, as in SC Mngt) */
const VISITS_KEY = () => 'visits_' + ((Auth.user && Auth.user.name) || 'anon');
function trackVisit(id) { if (!id || id === 'home') return; const h = lsGet(VISITS_KEY(), {}), d = today(); (h[d] = h[d] || {})[id] = (h[d][id] || 0) + 1; Object.keys(h).sort().slice(0, -14).forEach(x => delete h[x]); lsSet(VISITS_KEY(), h); }
page('home', 'Main', '🏠', 'Switchboard', 'Main page — pick a group to open its pages', async v => {
  const days = [...Array(7)].map((_, i) => addDays(today(), i - 6)), h = lsGet(VISITS_KEY(), {});
  const secs = []; PAGES.forEach(p => { if (!p.hidden && Auth.can(p.id) && !secs.includes(p.sec)) secs.push(p.sec); });
  const groups = secs.map(s => { const items = PAGES.filter(p => p.sec === s && !p.hidden && Auth.can(p.id)); const per = days.map(d => items.reduce((a, p) => a + ((h[d] || {})[p.id] || 0), 0)); return { name: s, items, per, total: per.reduce((a, b) => a + b, 0) }; });
  const use = {}; days.forEach(d => Object.entries(h[d] || {}).forEach(([k, n]) => use[k] = (use[k] || 0) + n));
  const top = Object.entries(use).sort((a, b) => b[1] - a[1])[0], topP = top && PAGES.find(p => p.id === top[0]);
  const hr = new Date().getHours(), hello = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + ', ' + esc((Auth.user.full || Auth.user.name || '').split(' ')[0]);
  const COL = ['#2563eb', '#0e7490', '#7c3aed', '#b45309', '#047857', '#be185d', '#4338ca', '#0f766e'];
  const bars = (g, c) => { const mx = Math.max(1, ...g.per); return `<div class="hm-bars" style="height:44px" title="${g.total ? 'Your visits, last 7 days' : 'No visits recorded yet'}">${g.per.map(x => `<i style="height:${Math.max(3, Math.round(x / mx * 44))}px;background:${c};opacity:${x ? .9 : .25}"></i>`).join('')}</div>`; };
  const kpis = [['Pages you can open', groups.reduce((a, g) => a + g.items.length, 0), ''], ['Your visits today', ((h[today()] || {}) && Object.values(h[today()] || {}).reduce((a, b) => a + b, 0)), ''], ['Most used (7 days)', topP ? topP.label : '—', topP ? topP.id : '']];
  v.innerHTML = `<div class="hm-ban"><div class="hm-ban-l">${BRAND_ORIG.full && !brandGet().img && !brandGet().logo ? `<div class="hm-logo"><img alt="RAB" src="${esc(BRAND_ORIG.full)}"></div>` : ''}<div><div class="hm-eye">${esc(company().CompanyFullName || 'Sales & Expenses')}</div><h1>${hello}</h1><p>Pick a group to open its pages. The bars show your own activity over the last 7 days.</p></div></div>
    <label class="hm-search"><span>🔍</span><input id="hmQ" placeholder="Search any page…" aria-label="Search pages"></label></div>
    <div class="hm-wrap"><div class="hm-kpis" id="hmK">${kpis.map(k => `<div class="hm-kpi" ${k[2] ? `data-go="${k[2]}"` : ''}><span>${k[0]}</span><b>${esc(k[1])}</b></div>`).join('')}</div>
    <div class="hm-grid">${groups.map((g, i) => `<section class="hm-card" data-name="${esc((g.name + ' ' + g.items.map(p => p.label).join(' ')).toLowerCase())}"><header data-go="${g.items[0].id}"><span class="hm-ico" style="background:${COL[i % 8]}1f;color:${COL[i % 8]}">${g.items[0].icon}</span><b>${esc(g.name)}</b><em>${g.items.length}</em></header>${bars(g, COL[i % 8])}<div class="hm-chips">${g.items.map(p => `<a class="hm-chip" data-go="${p.id}" data-pn="${esc(p.label.toLowerCase())}"><span>${p.icon}</span>${esc(p.label)}</a>`).join('')}</div></section>`).join('')}</div></div>
    ${groups.some(g => g.total) ? '' : '<p class="hm-note">Charts fill in as you open pages — they show your own activity on this browser.</p>'}`;
  v.onclick = e => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); } };
  $('#hmQ', v).oninput = e => { const q = e.target.value.trim().toLowerCase(); $$('.hm-card', v).forEach(c => { c.style.display = !q || c.dataset.name.includes(q) ? '' : 'none'; $$('.hm-chip', c).forEach(x => x.style.outline = q && x.dataset.pn.includes(q) ? '2px solid var(--acc-2)' : ''); }); };
  $('#hmQ', v).onkeydown = e => { if (e.key === 'Enter') { const x = $$('.hm-chip', v).find(c => c.dataset.pn.includes(e.target.value.trim().toLowerCase()) && e.target.value.trim()); if (x) go(x.dataset.go); } };
  /* live business figures under the KPIs (load in the background) */
  loadCore().then(() => { if (!v.isConnected) return; const T = totals(today().slice(0, 8) + '01', today()), oi = DB.peek('inq').filter(i => ['New', 'Open', 'Processing'].includes(i.InquiryStatus)).length;
    const add = [[`Sales this month`, money(T.sales), 'dash'], ['Receivable', money(totals('', '').receivable), 'customers'], ['Open inquiries', oi, 'alarms']].filter(x => Auth.can(x[2]));
    $('#hmK', v)?.insertAdjacentHTML('afterbegin', add.map(k => `<div class="hm-kpi" data-go="${k[2]}"><span>${k[0]}</span><b>${esc(k[1])}</b></div>`).join('')); }).catch(() => {});
});
PAGES.unshift(PAGES.pop()); PAGES[0].hidden = true;
for (const p of PAGES) if (['users', 'settings', 'help'].includes(p.id)) p.sec = 'Configuration';
for (const id of ['users', 'settings', 'help']) { const i = PAGES.findIndex(p => p.id === id); PAGES.push(PAGES.splice(i, 1)[0]); }

/* ---------------------------------------------------------------- RECENT ACTIVITY (drawer, as in SC Mngt) */
const Activity = {
  list() { return lsGet('activity', []); },
  add(icon, text) { const a = this.list(); a.unshift({ t: nowIso(), i: icon, x: text, u: me() }); lsSet('activity', a.slice(0, 200)); lsSet('activityUnseen', lsGet('activityUnseen', 0) + 1); this.badge(); if ($('#activityDrawer').classList.contains('open')) this.render(); },
  badge() { const n = lsGet('activityUnseen', 0), b = $('#activityToggle'); b.dataset.count = n > 99 ? '99+' : n; b.classList.toggle('has-badge', n > 0); },
  render() { const a = this.list(); $('#activityBody').innerHTML = a.length ? a.map(x => `<div class="activity-item"><span class="ai">${x.i}</span><div>${esc(x.x)}<small>${fdt(x.t)} · ${esc(x.u || '')}</small></div></div>`).join('') : '<div class="activity-empty">No activity yet.</div>'; },
  open(on) { $('#activityDrawer').classList.toggle('open', on); $('#activityBackdrop').classList.toggle('open', on); if (on) { lsSet('activityUnseen', 0); this.badge(); this.render(); } },
};
const LOGGED = { trans: ['🧾', r => `${r.TransectionType || 'Transaction'} ${r.Transection_Nr || r.OUTSR_ID} — ${r.Company_Name || ''} (${money(r.Transection_Amount)})`], inq: ['📞', r => `Inquiry ${r.InquiryID} — ${r.InquiryCompanyName || ''} [${r.InquiryStatus || ''}]`], emp: ['👷', r => `Employee ${LISTS.emp.title(r)}`], company: ['🏢', r => `Company info ${r.CompanyFullName || ''}`], bank: ['🏦', r => `Bank ${r.Bank_Desc || ''}`], cust: ['📇', r => `Customer ${r.CustomerName || ''}`], prod: ['📦', r => `Service ${r.ProductName || ''}`] };
{ const _save = DB.save.bind(DB), _rm = DB.remove.bind(DB);
  DB.save = async (k, rec) => { const isNew = !rec._id, out = await _save(k, rec); if (LOGGED[k] && !Activity.quiet) Activity.add(LOGGED[k][0], (isNew ? 'Added: ' : 'Saved: ') + LOGGED[k][1](out)); return out; };
  DB.remove = async (k, rec) => { await _rm(k, rec); if (LOGGED[k]) Activity.add('🗑', 'Deleted: ' + LOGGED[k][1](rec)); }; }

/* =====================================================================
   BOOT
   ===================================================================== */
function updateConn() {
  const c = cfg(), p = $('#connPill'), t = $('#connText');
  if (c.mode !== 'sp') { p.className = 'token-pill throttled'; t.textContent = 'Demo data'; $('#sbMode').textContent = 'Demo data (this browser)'; return; }
  if (!c.siteUrl) { p.className = 'token-pill throttled'; t.textContent = MS.token ? 'Token ready — Site URL missing' : 'No token — Admin required'; return; }
  p.className = 'token-pill' + (MS.token ? ' ok' : ''); t.textContent = MS.token ? 'Token ready' : 'No token — sign in'; $('#sbMode').textContent = 'SharePoint · ' + (c.siteUrl.split('/').pop() || '');
}
function applyBranding() { brandApply(); const c = company(); if (c.CompanyFullName) $('[data-brand="tag2"]').textContent = c.CompanyFullName; }
function buildNav() {
  const secs = []; for (const p of PAGES) if (!p.hidden && Auth.can(p.id) && !secs.includes(p.sec)) secs.push(p.sec);
  const col = lsGet('navCollapsed', {});
  $('#nav').innerHTML = secs.map(s => { const ps = PAGES.filter(p => p.sec === s && !p.hidden && Auth.can(p.id)); return `<div class="nav-group ${col[s] ? 'collapsed' : ''}" data-g="${esc(s)}"><div class="nav-group-head"><span class="caret">▾</span><span class="gname">${esc(s)}</span><span class="gcount">${ps.length}</span></div><div class="nav-group-body">` + ps.map(p => `<div class="nav-item" data-id="${p.id}" title="${esc(p.label)}"><span class="icon">${p.icon}</span><span>${esc(p.label)}</span><span class="badge alert" data-badge="${p.id}" style="display:none"></span></div>`).join('') + '</div></div>'; }).join('');
  $$('.nav-item').forEach(n => n.onclick = () => { document.body.classList.remove('m-nav-open'); go(n.dataset.id); });
  const save = () => { const c = {}; $$('.nav-group').forEach(g => { if (g.classList.contains('collapsed')) c[g.dataset.g] = 1; }); lsSet('navCollapsed', c); };
  $$('.nav-group-head').forEach(h => h.onclick = () => { h.parentElement.classList.toggle('collapsed'); save(); });
  $('#navCollapseAll').onclick = () => { $$('.nav-group').forEach(g => g.classList.add('collapsed')); save(); };
  $('#navExpandAll').onclick = () => { $$('.nav-group').forEach(g => g.classList.remove('collapsed')); save(); };
}
function navMini(on) { document.body.classList.toggle('sb-mini', on); $('#sbToggle').textContent = on ? '»' : '«'; $('#sbToggle').title = on ? 'Expand the side panel' : 'Collapse the side panel'; lsSet('navMini', on ? 1 : 0); }
function updateBadges() { const b = (id, n) => { const e = $(`[data-badge="${id}"]`); if (e) { e.textContent = n; e.style.display = n ? '' : 'none'; } }; b('alarms', DB.peek('inq').filter(i => ['New', 'Open', 'Processing'].includes(i.InquiryStatus)).length); b('pnl', DB.peek('trans').filter(t => !t.Posted_Timestamp && num(t.Transection_Type) !== 4).length); }
Bus.on('data', debounce(updateBadges, 300));
Bus.on('loadError', debounce((k, e) => toast(`Could not load ${listName(k)}: ${e.message}`, 'error', 6000), 300));
/* page history for the ← Back button */
const Hist = { stack: [], last: null };
window.addEventListener('hashchange', () => { if (Hist.last !== null && Hist.last !== location.hash && !Hist.goingBack) Hist.stack.push(Hist.last); Hist.goingBack = false; Hist.last = location.hash; $('#backBtn').disabled = !Hist.stack.length; });
function applyTheme(t) { document.body.classList.toggle('dark', t === 'dark'); $('#themeBtn').textContent = t === 'dark' ? '☀' : '🌙'; try { localStorage.setItem(SC_KEY.theme, t); } catch (e) {} }
async function enterApp() {
  $('#loginScreen').style.display = 'none'; $('#appShell').classList.add('visible');
  const u = Auth.user; $('#uName').textContent = u.full || u.name; $('#uRole').textContent = (u.super ? 'Super admin · ' : '') + u.level; $('#uAvatar').textContent = String(u.full || u.name).trim().charAt(0).toUpperCase();
  sessionStorage.setItem(APP.ls + '_user', JSON.stringify(u));
  buildNav(); updateConn(); Activity.badge(); Hist.last = location.hash;
  loadCore().then(() => { applyBranding(); updateBadges(); });
  if (u.bootstrap) setTimeout(() => toast('No system users exist yet — you are signed in as administrator. Create users in Login Users.', 'warn', 9000), 800);
  route();
}
const _route = route; route = async function () { await _route(); const id = Nav.cur && Nav.cur.id; document.body.classList.toggle('on-home', id === 'home'); trackVisit(id); };
async function initLogin() {
  const c = cfg(), sp = c.mode === 'sp';
  $('#msBox').style.display = sp ? '' : 'none';
  $('#loginHint').style.display = sp ? 'none' : '';
  $('#loginHint').innerHTML = '<b>Demo mode</b> — data stays in this browser. Sign in with <code>admin</code> / <code>admin</code> (or <code>mohammad</code> / <code>1234</code> as a normal user, <code>sara</code> / <code>1234</code> for Accounts). Connect SharePoint in Settings.';
  if (sp && location.protocol === 'file:') {
    $('#msLoginState').innerHTML = '⚠ This page was opened as a <b>local file</b>. Microsoft (SharePoint) sign-in only works from an <b>https://</b> address or <b>http://localhost</b>.';
    $('#msLoginBtn').textContent = 'Use demo data on this computer'; $('#msLoginBtn').onclick = () => { saveCfg({ mode: 'demo' }); location.reload(); };
    setTimeout(() => $('#loginUser').focus(), 50); return;
  }
  if (sp) { try { await MS.getToken(false); $('#msLoginState').innerHTML = '✔ Connected to Microsoft 365 as <b>' + esc(MS.user()) + '</b>.'; $('#msLoginBtn').textContent = 'Renew Microsoft session'; } catch (e) { if (!/Not signed/.test(e.message)) $('#msLoginState').textContent = '⚠ ' + e.message; } }
  const saved = JSON.parse(sessionStorage.getItem(APP.ls + '_user') || 'null');
  if (saved && (!sp || MS.token)) { Auth.user = saved; return enterApp(); }
  setTimeout(() => $('#loginUser').focus(), 50);
}
async function doLogin(e) {
  if (e) e.preventDefault();
  const err = $('#loginError'); err.classList.remove('visible'); const b = $('#loginBtn');
  if (!$('#loginUser').value.trim() || !$('#loginPw').value) { err.textContent = 'Enter both username and password.'; err.classList.add('visible'); return; }
  b.disabled = true; b.textContent = DB.isSP() ? 'Checking SharePoint…' : 'Signing in…';
  try { if (DB.isSP() && location.protocol === 'file:') throw new Error('Opened as a local file — SharePoint sign-in is not possible here. Click “Use demo data on this computer”, or open the page from https:// or http://localhost.'); if (DB.isSP()) await MS.getToken(true); await Auth.login($('#loginUser').value, $('#loginPw').value); Activity.quiet = true; enterApp(); setTimeout(() => { Activity.quiet = false; Activity.add('🔓', 'Signed in'); }, 1500); }
  catch (x) { err.textContent = x.message; err.classList.add('visible'); } finally { b.disabled = false; b.textContent = 'Sign in'; }
}
document.addEventListener('DOMContentLoaded', () => {
  let th = null; try { th = localStorage.getItem(SC_KEY.theme); } catch (e) {}
  applyTheme(th || (lsGet('theme', '') === 'dark' ? 'dark' : 'light')); accentApply(accentGet()); brandApply(); if (lsGet('navMini', 0)) navMini(true);
  $('#loginForm').addEventListener('submit', doLogin);
  $('#msLoginBtn').onclick = async () => { try { await MS.getToken(true); $('#msLoginState').innerHTML = '✔ Connected to Microsoft 365 as <b>' + esc(MS.user()) + '</b>.'; } catch (e) { $('#msLoginState').textContent = '✘ ' + e.message; } };
  $('#logoutBtn').onclick = async () => { Activity.add('🔒', 'Signed out'); await Auth.logout(); location.hash = ''; location.reload(); };
  $('#myInfoBtn').onclick = () => { const u = Auth.user || {}, e = DB.peek('emp').find(x => x._id === u._id) || {}; Modal.open('My account', `<div class="grid two"><div class="form-group"><label>User name</label><input readonly value="${esc(u.name || '')}"></div><div class="form-group"><label>Access level</label><input readonly value="${esc((u.super ? 'Super admin · ' : '') + (u.level || ''))}"></div><div class="form-group"><label>E-mail</label><input readonly value="${esc(e.Email || '')}"></div><div class="form-group"><label>Microsoft account</label><input readonly value="${esc(MS.user() || '—')}"></div></div>`, [...(u._id ? [{ label: '🔑 Change my password', cls: 'secondary', onClick: () => { Modal.close(); changeMyPassword(); } }] : []), { label: 'Close' }], 'narrow'); };
  $('#themeBtn').onclick = () => { applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'); if (Nav.cur && Nav.cur.id === 'dash') route(); };
  $('#menuBtn').onclick = () => document.body.classList.toggle('m-nav-open'); $('#mBackdrop').onclick = () => document.body.classList.remove('m-nav-open');
  $('#sbToggle').onclick = () => navMini(!document.body.classList.contains('sb-mini'));
  $('#sbBrand').onclick = () => go('home');
  $('#backBtn').onclick = () => { if (!Hist.stack.length) return; Hist.goingBack = true; location.hash = Hist.stack.pop(); $('#backBtn').disabled = !Hist.stack.length; };
  $('#refreshBtn').onclick = async () => { DB.resetCache(); try { await loadCore(); toast('Data reloaded', 'success'); } catch (e) { toast(e.message, 'error'); } route(); };
  $('#msReloginBtn').onclick = async () => { if (!DB.isSP()) return toast('Demo data — no Microsoft sign-in needed. Connect SharePoint in Settings.', ''); try { MS.token = null; await MS.getToken(true); updateConn(); toast('Microsoft session renewed ✔', 'success'); } catch (e) { toast(e.message, 'error', 6000); } };
  $('#connPill').onclick = () => Auth.isAdmin() ? go('settings') : null;
  $('#searchPill').onclick = openSearch;
  $('#activityToggle').onclick = () => Activity.open(true); $('#activityCloseBtn').onclick = $('#activityBackdrop').onclick = () => Activity.open(false);
  $('#activityClearBtn').onclick = () => { lsSet('activity', []); Activity.render(); };
  $('#activityExportBtn').onclick = () => exportXlsx('Activity', Activity.list(), [{ f: 't', l: 'Time', get: r => fdt(r.t) }, { f: 'u', l: 'User' }, { f: 'x', l: 'Activity' }]);
  $('#modalX').onclick = Modal.close; $('#modalBg').addEventListener('mousedown', e => { if (e.target.id === 'modalBg') Modal.close(); });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && Auth.user) { e.preventDefault(); openSearch(); } if (e.key === 'Escape') { if ($('#modalBg').classList.contains('open')) Modal.close(); else Activity.open(false); } if (e.altKey && e.key === 'ArrowLeft' && !(Nav.cur && ['trans', 'inq'].includes(Nav.cur.id))) $('#backBtn').click(); });
  window.addEventListener('hashchange', route);
  setInterval(() => { if (DB.isSP() && Auth.user) MS.getToken(false).then(updateConn).catch(() => updateConn()); }, 40 * 60 * 1000);
  initLogin();
});
