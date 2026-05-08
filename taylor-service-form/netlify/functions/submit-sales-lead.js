// netlify/functions/submit-sales-lead.js
const { Resend } = require('resend');

// ── PRIORITY / TIMELINE ───────────────────────────────────────────────────────
function getTimelineProps(timeline) {
  const t = (timeline || '').toLowerCase();
  if (t.includes('ready to buy')) return {
    emoji: '🟢', color: '#27AE60', label: 'READY TO BUY — MOVE QUICKLY', bg: '#F0FDF4'
  };
  if (t.includes('actively evaluating')) return {
    emoji: '🟡', color: '#C47D0E', label: 'ACTIVELY EVALUATING — 1–3 MONTHS', bg: '#FFFBEB'
  };
  if (t.includes('planning ahead')) return {
    emoji: '🔵', color: '#1A5FA8', label: 'PLANNING AHEAD — 3–6 MONTHS', bg: '#EFF6FF'
  };
  return {
    emoji: '⚪', color: '#5A6876', label: 'EARLY RESEARCH — NO FIRM TIMELINE', bg: '#F7F8FA'
  };
}

// ── COUNTY → REP ROUTING ──────────────────────────────────────────────────────
const EASTERN = new Set([
  'Albany County','Clinton County','Columbia County','Delaware County',
  'Dutchess County','Essex County','Franklin County','Fulton County',
  'Greene County','Hamilton County','Herkimer County','Montgomery County',
  'Orange County','Otsego County','Putnam County','Rensselaer County',
  'Saint Lawrence County','Saratoga County','Schenectady County',
  'Schoharie County','Sullivan County','Ulster County','Warren County',
  'Washington County'
]);
const WESTERN = new Set([
  'Allegany County','Broome County','Cattaraugus County','Cayuga County',
  'Chautauqua County','Chemung County','Chenango County','Cortland County',
  'Erie County','Genesee County','Jefferson County','Lewis County',
  'Livingston County','Madison County','Monroe County','Niagara County',
  'Oneida County','Onondaga County','Ontario County','Orleans County',
  'Oswego County','Schuyler County','Seneca County','Steuben County',
  'Tioga County','Tompkins County','Wayne County','Wyoming County','Yates County'
]);

function getRouting(county) {
  if (EASTERN.has(county)) return { region: 'Capital Region', territory: 'Eastern', toEmail: 'estewart@taylorupstate.com' };
  if (WESTERN.has(county)) return { region: 'Western NY',      territory: 'Western', toEmail: 'mjohnson@taylorupstate.com' };
  return                           { region: 'Unassigned',      territory: 'Central', toEmail: 'sales@taylorupstate.com' };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const row = (label, value) => value ? `
  <tr>
    <td style="padding:5px 0;color:#5A6876;font-size:13px;width:160px;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;color:#0A2540;font-size:14px;vertical-align:top;">${value}</td>
  </tr>` : '';

const section = (title, rows) => `
  <tr><td style="padding:20px 32px 4px;">
    <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0A2540;border-bottom:2px solid #E8EDF3;padding-bottom:8px;">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>`;

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: cors, body: 'Method not allowed' };

  try {
    const d = JSON.parse(event.body || '{}');

    // Destructure all form fields
    const {
      first_name       = '',
      last_name        = '',
      business_name    = '',
      your_role        = '',
      phone            = '',
      email            = '',
      address          = '',
      county           = '',
      best_time        = '',
      equipment        = '',   // comma-joined string from front-end
      condition        = '',
      business_type    = '',
      timeline         = '',
      current_equipment= '',
      financing        = '',
      message          = '',
      heard_from       = '',
      email_optin      = ''
    } = d;

    const fullName = `${first_name} ${last_name}`.trim();
    const tp       = getTimelineProps(timeline);
    const routing  = getRouting(county);
    const fromEmail = process.env.SALES_FROM_EMAIL || 'sales@taylorupstate.com';

    // ── BUILD SUBJECT (emoji lives in JS, never a template variable) ─────────
    const subject = `${tp.emoji} New Sales Lead — ${fullName || email} | ${routing.region}`;

    // ── BUILD HTML EMAIL ─────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F5F7;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.10);">

      <!-- HEADER -->
      <tr><td style="background:#0A2540;padding:20px 32px;">
        <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:.3px;">
          Taylor Upstate — New Sales Lead
        </p>
      </td></tr>

      <!-- PRIORITY BANNER -->
      <tr><td style="background:${tp.bg};border-left:5px solid ${tp.color};padding:14px 32px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:${tp.color};">
          ${tp.emoji}&nbsp;&nbsp;${tp.label}
        </p>
      </td></tr>

      <!-- ROUTING CALLOUT -->
      <tr><td style="background:#EFF6FF;padding:10px 32px;">
        <p style="margin:0;font-size:13px;color:#1A5FA8;font-weight:600;">
          📍 Routed to: ${routing.region} &bull; ${routing.toEmail}
        </p>
      </td></tr>

      ${section('Contact Information',
        row('Name',          fullName)       +
        row('Business',      business_name)  +
        row('Role/Title',    your_role)      +
        row('Email',         `<a href="mailto:${email}" style="color:#1A5FA8;">${email}</a>`) +
        row('Phone',         phone)          +
        row('Best Time',     best_time)      +
        row('Address',       address)        +
        row('County',        county)
      )}

      ${section('Equipment Interest',
        row('Equipment',         equipment)         +
        row('Condition',         condition)         +
        row('Business Type',     business_type)     +
        row('Current Equipment', current_equipment) +
        row('Financing',         financing)
      )}

      ${section('Purchase Timeline',
        row('Timeline', `<span style="color:${tp.color};font-weight:700;">${tp.emoji} ${timeline}</span>`)
      )}

      ${message ? section('Message / Notes', `
        <tr><td colspan="2" style="padding:4px 0;color:#333;font-size:14px;line-height:1.6;white-space:pre-line;">${message}</td></tr>
      `) : ''}

      ${section('Additional Info',
        row('How They Found Us', heard_from) +
        row('Email Opt-In',      email_optin)
      )}

      <!-- FOOTER -->
      <tr><td style="background:#F4F5F7;padding:14px 32px;border-top:1px solid #E8EDF3;">
        <p style="margin:0;font-size:11px;color:#8A96A3;">
          Submitted via Taylor-Upstate.com sales form &bull;
          ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    // ── SEND EMAIL VIA RESEND ────────────────────────────────────────────────
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from:    `Taylor Upstate Sales <${fromEmail}>`,
      to:      [routing.toEmail],
      subject,
      html
    });

    // ── LOG TO AIRTABLE ──────────────────────────────────────────────────────
    const token  = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (token && baseId) {
      // Use table ID directly (more reliable than table name)
      const atRes = await fetch(`https://api.airtable.com/v0/${baseId}/tblEZur8aCmDupauc`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'First Name':        first_name,
            'Last Name':         last_name,
            'Business Name':     business_name,
            'Role':              your_role,
            'Email':             email,
            'Phone':             phone,
            'Address':           address,
            'County':            county,
            'Territory':         routing.territory,
            'Best Time':         best_time,
            'Equipment Interest':equipment,
            'Condition':         condition,
            'Business Type':     business_type,
            'Timeline':          timeline,
            'Current Equipment': current_equipment,
            'Financing':         financing,
            'Message':           message,
            'How Heard':         heard_from,
            'Email Opt-In':      email_optin,
            'Status':            'New',
            'Submitted At':      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
          }
        })
      });
      if (!atRes.ok) {
        const atErr = await atRes.json();
        console.error('Airtable error:', JSON.stringify(atErr));
      }
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('submit-sales-lead error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
