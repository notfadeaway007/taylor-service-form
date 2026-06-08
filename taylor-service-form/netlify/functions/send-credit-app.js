const { Resend } = require('resend');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ── BOT DETECTION ─────────────────────────────────────────────────────────────
function isBot(d) {
  if (d.hp_website && d.hp_website.trim() !== '') {
    console.log('Bot blocked: honeypot filled');
    return true;
  }
  const loadTime = parseInt(d.load_time || '0');
  if (loadTime > 0 && (Date.now() - loadTime) < 3000) {
    console.log('Bot blocked: submitted too fast');
    return true;
  }
  function looksLikeGibberish(str) {
    return str && str.length > 20 && !str.includes(' ') && /^[a-zA-Z]+$/.test(str);
  }
  if (looksLikeGibberish(d.legal_name) || looksLikeGibberish(d.contact_name)) {
    console.log('Bot blocked: gibberish field content');
    return true;
  }
  return false;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // ── Bot check: silently return success so bots stop retrying ──
    if (isBot(data)) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const subject = `Credit Application — Net 30 Terms — ${data.legal_name}`;
    const pdfFilename = `CreditApplication_${data.legal_name.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`;

    // Format owners for email body
    const ownersHtml = [1,2,3,4].map(n => {
      const name = data[`owner${n}_name`];
      if (!name) return '';
      return `<tr style="background:${n%2===0?'#f7fbff':'#fff'};">
        <td style="padding:6px 10px;color:#5a7a92;font-size:11px;">${n}. ${name}</td>
        <td style="padding:6px 10px;font-size:11px;color:#102033;">${data[`owner${n}_title`]||''} | ${data[`owner${n}_pct`]||''}% | ${data[`owner${n}_phone`]||''}</td>
      </tr>`;
    }).join('');

    const refsHtml = [1,2,3].map(n => {
      const co = data[`ref${n}_company`];
      if (!co) return '';
      return `<tr style="background:${n%2===0?'#f7fbff':'#fff'};">
        <td style="padding:6px 10px;color:#5a7a92;font-size:11px;">${co}</td>
        <td style="padding:6px 10px;font-size:11px;color:#102033;">${data[`ref${n}_contact`]||''} | ${data[`ref${n}_phone`]||''} | ${data[`ref${n}_terms`]||''}</td>
      </tr>`;
    }).join('');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#102033;padding:20px 24px;">
          <h2 style="color:#fff;margin:0;font-size:20px;letter-spacing:2px;">TAYLOR UPSTATE</h2>
          <p style="color:#29c3f0;margin:4px 0 0;font-size:12px;letter-spacing:3px;">CREDIT APPLICATION FOR NET 30 TERMS</p>
        </div>
        <div style="background:#fffde7;border-left:4px solid #deac5c;padding:10px 16px;">
          <p style="color:#6a5000;font-size:13px;font-weight:bold;margin:0;">New Net 30 credit application received. Signed PDF attached.</p>
        </div>
        <div style="padding:20px 24px;background:#f0f6fb;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
            <tr><td colspan="2" style="background:#102033;color:#29c3f0;font-weight:bold;padding:8px 10px;font-size:11px;text-transform:uppercase;">Business Information</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;width:40%;">Legal Business Name</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${data.legal_name}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">DBA</td><td style="padding:7px 10px;color:#102033;">${data.dba||'—'}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Federal Tax ID/EIN</td><td style="padding:7px 10px;color:#102033;">${data.ein}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Business Structure</td><td style="padding:7px 10px;color:#102033;">${data.biz_structure}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Physical Address</td><td style="padding:7px 10px;color:#102033;">${data.phys_address}, ${data.phys_city}, ${data.phys_state} ${data.phys_zip}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Billing Address</td><td style="padding:7px 10px;color:#102033;">${data.bill_address||'Same as physical'}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Years in Business</td><td style="padding:7px 10px;color:#102033;">${data.years_biz||'—'}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Employees</td><td style="padding:7px 10px;color:#102033;">${data.num_employees||'—'}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Phone / Email</td><td style="padding:7px 10px;color:#102033;">${data.biz_phone} / ${data.biz_email}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Website</td><td style="padding:7px 10px;color:#102033;">${data.website||'—'}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Key Contact</td><td style="padding:7px 10px;color:#102033;">${data.contact_name} — ${data.contact_title||''} | ${data.contact_phone||''} | ${data.contact_email||''}</td></tr>
          </table>
          ${ownersHtml ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
            <tr><td colspan="2" style="background:#102033;color:#29c3f0;font-weight:bold;padding:8px 10px;font-size:11px;text-transform:uppercase;">Ownership / Principals</td></tr>
            ${ownersHtml}
          </table>` : ''}
          ${refsHtml ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
            <tr><td colspan="2" style="background:#102033;color:#29c3f0;font-weight:bold;padding:8px 10px;font-size:11px;text-transform:uppercase;">Trade References</td></tr>
            ${refsHtml}
          </table>` : ''}
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td colspan="2" style="background:#102033;color:#29c3f0;font-weight:bold;padding:8px 10px;font-size:11px;text-transform:uppercase;">Bank Reference</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;width:40%;">Bank Name</td><td style="padding:7px 10px;color:#102033;">${data.bank_name||'—'}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Branch / Acct Last 4</td><td style="padding:7px 10px;color:#102033;">${data.bank_branch||'—'} / ****${data.bank_acct_last4||''}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;">Signed By</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${data.auth_printed_name} — ${data.auth_title||''} — ${data.auth_date}</td></tr>
          </table>
        </div>
        <div style="background:#102033;padding:12px 24px;text-align:center;">
          <p style="color:rgba(255,255,255,.4);font-size:11px;margin:0;">Taylor Upstate · 800-678-2956 · taylor-upstate.com</p>
        </div>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'Taylor Upstate <sales@taylor-upstate.com>',
      to: ['bboise@taylorupstate.com', 'estewart@taylorupstate.com'],
      cc: data.biz_email,
      reply_to: data.biz_email,
      subject,
      html: htmlBody,
      attachments: [{ filename: pdfFilename, content: data.pdfBase64 }]
    });
    if (emailError) throw new Error(`Resend error: ${emailError.message}`);

    const ownersText = [1,2,3,4].map(n => {
      const name = data[`owner${n}_name`];
      if (!name) return null;
      return `${n}. ${name} | ${data[`owner${n}_title`]||''} | ${data[`owner${n}_pct`]||''}% | ${data[`owner${n}_address`]||''} | ${data[`owner${n}_phone`]||''}`;
    }).filter(Boolean).join('\n');

    const refsText = [1,2,3].map(n => {
      const co = data[`ref${n}_company`];
      if (!co) return null;
      return `${n}. ${co} | Acct: ${data[`ref${n}_acct`]||'N/A'} | ${data[`ref${n}_contact`]||''} | ${data[`ref${n}_phone`]||''} | ${data[`ref${n}_email`]||''} | Terms: ${data[`ref${n}_terms`]||''}`;
    }).filter(Boolean).join('\n');

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent('Credit Applications')}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            'Legal Business Name': data.legal_name,
            'DBA': data.dba || '',
            'Federal Tax ID EIN': data.ein,
            'Business Structure': data.biz_structure,
            'Physical Address': data.phys_address,
            'Physical City': data.phys_city,
            'Physical State': data.phys_state,
            'Physical Zip': data.phys_zip,
            'Billing Address': data.bill_address || '',
            'Years in Business': data.years_biz || '',
            'Num Employees': data.num_employees || '',
            'Business Phone': data.biz_phone,
            'Business Email': data.biz_email,
            'Website': data.website || '',
            'Contact Name': data.contact_name,
            'Contact Title': data.contact_title || '',
            'Contact Phone': data.contact_phone || '',
            'Contact Email': data.contact_email || '',
            'Owners': ownersText,
            'Trade References': refsText,
            'Bank Name': data.bank_name || '',
            'Bank Branch': data.bank_branch || '',
            'Bank Acct Last 4': data.bank_acct_last4 || '',
            'Bank Contact': data.bank_contact || '',
            'Bank Phone': data.bank_phone || '',
            'Authorized Printed Name': data.auth_printed_name,
            'Authorized Title': data.auth_title || '',
            'Authorized Date': data.auth_date,
            'Submission Date': new Date().toLocaleDateString('en-US')
          }
        })
      }
    );

    if (!airtableRes.ok) {
      const err = await airtableRes.json();
      throw new Error(`Airtable error: ${JSON.stringify(err)}`);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };

  } catch(err) {
    console.error('send-credit-app error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
