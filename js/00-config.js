/* =====================================================================
   RAB Sales & Expenses System — SETTINGS FOR EVERY USER
   Fill these once to give every user the same connection and look.
   (Empty = each browser uses what is saved in Settings, or what
   NFPC SC Mngt already saved on the same web address.)
   ===================================================================== */
/* Microsoft sign-in + SharePoint site (Settings → Global Connection Settings) */
const MS_AUTH_DEFAULT = {
  tenantId: '',   // Directory (tenant) ID
  clientId: '',   // Application (client) ID of the app registration
  siteUrl:  ''    // e.g. 'https://yourtenant.sharepoint.com/sites/YourSite'
};
/* System name & logo override (Settings → System name & logo → Copy default) */
const BRAND_DEFAULT = { name: '', tag: '', logo: '', img: '' };
/* RAB logo pictures: icon = the R shield (side panel, top bar), full = shield + "RAB" (sign-in page, switchboard) */
const LOGO_FILES = { icon: 'img/rab-icon.png', full: 'img/rab-logo.png' };
