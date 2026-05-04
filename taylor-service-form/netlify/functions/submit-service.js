// netlify/functions/submit-service.js
// Receives form data → generates PDF → emails to dispatch

const PDFDocument = require('pdfkit');
const { Resend } = require('resend');

// ─── PDF GENERATION ────────────────────────────────────────────────────────
function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'letter' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#0B1829';
    const amber = '#D98C20';
    const blue = '#1A5FA8';
    const gray = '#5A6876';
    const lightGray = '#EEF0F2';
    const red = '#C0392B';
    const pageWidth = 612 - 100; // letter width minus margins

    // ── HEADER BAND ──
    doc.rect(0, 0, 612, 90).fill(navy);

    doc.fontSize(22).font('Helvetica-Bold')
       .fillColor('#FFFFFF')
       .text('TAYLOR UPSTATE', 50, 24, { characterSpacing: 2 });

    doc.fontSize(9).font('Helvetica')
       .fillColor(amber)
       .text('AUTHORIZED SERVICE REQUEST', 50, 52, { characterSpacing: 3 });

    // Priority badge on the right
    const priorityColor = data.priority && data.priority.includes('EMERGENCY') ? red
      : data.priority && data.priority.includes('Urgent') ? '#E67E22'
      : blue;

    doc.roundedRect(390, 20, 172, 50, 4).fill(priorityColor);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('PRIORITY', 403, 28, { characterSpacing: 2 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text(data.priority || 'Standard', 403, 42, { width: 150 });

    // ── REFERENCE & DATE ──
    const refNum = 'TU-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 90000 + 10000);
    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    doc.fillColor(gray).fontSize(9).font('Helvetica')
       .text(`Reference: ${refNum}   |   Submitted: ${submittedAt} EDT`, 50, 100);

    // ── DIVIDER ──
    doc.moveTo(50, 116).lineTo(562, 116).strokeColor(lightGray).lineWidth(1).stroke();

    let y = 128;

    // ─── HELPER: Section Header ──────────────────────────────────────────
    function sectionHeader(title) {
      doc.rect(50, y, pageWidth, 22).fill(navy);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
         .text(title, 58, y + 7, { characterSpacing: 2 });
      y += 30;
    }

    // ─── HELPER: Field Row (label + value) ───────────────────────────────
    function fieldRow(label, value, opts = {}) {
      const colWidth = opts.full ? pageWidth : pageWidth / 2;
      const x = opts.right ? 50 + pageWidth / 2 : 50;

      // Label
      doc.fontSize(7).font('Helvetica-Bold').fillColor(gray)
         .text(label.toUpperCase(), x, y, { characterSpacing: 0.5, width: colWidth - 10 });

      // Value
      const val = value && value.trim() ? value : '—';
      doc.fontSize(10).font('Helvetica').fillColor(navy)
         .text(val, x, y + 11, { width: colWidth - 10 });

      if (!opts.right) {
        const textHeight = doc.heightOfString(val, { width: colWidth - 10, fontSize: 10 });
        y += Math.max(textHeight + 20, 32);
      }
    }

    // ─── HELPER: Two-column row ───────────────────────────────────────────
    function fieldRowPair(label1, val1, label2, val2) {
      const half = pageWidth / 2;
      const startY = y;

      // Left
      doc.fontSize(7).font('Helvetica-Bold').fillColor(gray)
         .text(label1.toUpperCase(), 50, startY, { characterSpacing: 0.5, width: half - 10 });
      const v1 = val1 && val1.trim() ? val1 : '—';
      doc.fontSize(10).font('Helvetica').fillColor(navy)
         .text(v1, 50, startY + 11, { width: half - 10 });

      // Right
      doc.fontSize(7).font('Helvetica-Bold').fillColor(gray)
         .text(label2.toUpperCase(), 50 + half, startY, { characterSpacing: 0.5, width: half - 10 });
      const v2 = val2 && val2.trim() ? val2 : '—';
      doc.fontSize(10).font('Helvetica').fillColor(navy)
         .text(v2, 50 + half, startY + 11, { width: half - 10 });

      const h1 = doc.heightOfString(v1, { width: half - 10, fontSize: 10 });
      const h2 = doc.heightOfString(v2, { width: half - 10, fontSize: 10 });
      y += Math.max(h1, h2) + 20;
    }

    // ─── HELPER: Zebra divider ────────────────────────────────────────────
    function zebra() {
      doc.moveTo(50, y - 6).lineTo(562, y - 6).strokeColor(lightGray).lineWidth(0.5).stroke();
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 1: CONTACT INFORMATION
    // ════════════════════════════════════════════════════════════════
    sectionHeader('01  CONTACT INFORMATION');

    fieldRowPair('First Name', data.first_name, 'Last Name', data.last_name);
    zebra();
    fieldRowPair('Business / Company', data.company, 'Role', data.role);
    zebra();
    fieldRowPair('Phone', data.phone, 'Email', data.email);
    zebra();
    fieldRow('Service Address', data.service_address, { full: true });
    zebra();
    fieldRowPair('County', data.county, 'Best Time to Reach', data.best_time);
    y += 8;

    // ════════════════════════════════════════════════════════════════
    // SECTION 2: EQUIPMENT INFORMATION
    // ════════════════════════════════════════════════════════════════
    sectionHeader('02  EQUIPMENT INFORMATION');

    fieldRowPair('Equipment Brand', data.equipment_brand, 'Model Number', data.model_number);
    zebra();
    fieldRowPair('Serial Number', data.serial_number, 'Equipment Age', data.equipment_age);
    zebra();
    fieldRowPair('Warranty Status', data.warranty_status, 'Last Service Date', data.last_service_date);
    y += 8;

    // ════════════════════════════════════════════════════════════════
    // SECTION 3: SERVICE REQUEST DETAILS
    // ════════════════════════════════════════════════════════════════
    sectionHeader('03  SERVICE REQUEST DETAILS');

    // Priority highlight box
    doc.rect(50, y, pageWidth, 28).fill(priorityColor + '18');
    doc.rect(50, y, 4, 28).fill(priorityColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(priorityColor)
       .text((data.priority || 'Standard').toUpperCase(), 62, y + 9, { characterSpacing: 1 });
    y += 36;

    fieldRowPair('Issue Type', data.issue_type, 'Preferred Service Date', data.preferred_date);
    zebra();

    // Problem description — highlight box
    doc.fontSize(7).font('Helvetica-Bold').fillColor(gray)
       .text('PROBLEM DESCRIPTION', 50, y, { characterSpacing: 0.5 });
    y += 12;

    const descText = data.problem_description || '—';
    const descHeight = doc.heightOfString(descText, { width: pageWidth - 20, fontSize: 10 }) + 20;
    doc.rect(50, y, pageWidth, descHeight).fill('#F7F8FA');
    doc.rect(50, y, 3, descHeight).fill(blue);
    doc.fontSize(10).font('Helvetica').fillColor(navy)
       .text(descText, 62, y + 10, { width: pageWidth - 24 });
    y += descHeight + 12;

    // Access notes
    if (data.access_notes && data.access_notes.trim()) {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(gray)
         .text('SITE ACCESS NOTES', 50, y, { characterSpacing: 0.5 });
      y += 12;
      const accessHeight = doc.heightOfString(data.access_notes, { width: pageWidth - 20, fontSize: 10 }) + 20;
      doc.rect(50, y, pageWidth, accessHeight).fill('#FFFBF2');
      doc.rect(50, y, 3, accessHeight).fill(amber);
      doc.fontSize(10).font('Helvetica').fillColor(navy)
         .text(data.access_notes, 62, y + 10, { width: pageWidth - 24 });
      y += accessHeight + 12;
    }

    // ── FOOTER ──
    const footerY = 740;
    doc.rect(0, footerY, 612, 52).fill(navy);

    doc.fontSize(8).font('Helvetica-Bold').fillColor(amber)
       .text('TAYLOR UPSTATE', 50, footerY + 10, { characterSpacing: 2 });
    doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
       .text('800-678-2956  ·  dispatch@taylorupstate.com  ·  Marcellus & Troy, NY  ·  www.taylor-upstate.com', 50, footerY + 25);
    doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.4)')
       .text(`Ref: ${refNum}`, 430, footerY + 35);

    doc.end();
  });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Parse body
  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Validate required fields
  const required = ['first_name', 'last_name', 'company', 'phone', 'email',
                    'service_address', 'county', 'equipment_brand',
                    'priority', 'issue_type', 'problem_description'];
  const missing = required.filter(f => !data[f] || !data[f].trim());
  if (missing.length) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
    };
  }

  try {
    // Generate PDF
    const pdfBuffer = await generatePDF(data);

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const priorityEmoji = data.priority.includes('EMERGENCY') ? '🔴' 
      : data.priority.includes('Urgent') ? '🟡' : '🟢';

    await resend.emails.send({
      from: `${process.env.FROM_NAME || 'Taylor Upstate Service'} <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: [process.env.TO_EMAIL || 'estewart@taylorupstate.com'],
      reply_to: data.email,
      subject: `${priorityEmoji} Service Request — ${data.priority} — ${data.company} (${data.county})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0B1829;padding:24px 30px;border-radius:6px 6px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:2px;">TAYLOR UPSTATE</h1>
            <p style="color:#D98C20;margin:4px 0 0;font-size:11px;letter-spacing:3px;">NEW SERVICE REQUEST</p>
          </div>
          <div style="background:#f7f8fa;padding:24px 30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:6px 0;color:#5A6876;width:40%;">Priority</td><td style="padding:6px 0;font-weight:bold;color:#C0392B;">${data.priority}</td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Name</td><td style="padding:6px 0;">${data.first_name} ${data.last_name}</td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Business</td><td style="padding:6px 0;">${data.company}</td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Phone</td><td style="padding:6px 0;"><a href="tel:${data.phone}">${data.phone}</a></td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Email</td><td style="padding:6px 0;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Location</td><td style="padding:6px 0;">${data.service_address}, ${data.county}</td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Equipment</td><td style="padding:6px 0;font-weight:bold;">${data.equipment_brand}${data.model_number ? ' — ' + data.model_number : ''}</td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Issue Type</td><td style="padding:6px 0;">${data.issue_type}</td></tr>
              <tr><td style="padding:6px 0;color:#5A6876;">Best Time</td><td style="padding:6px 0;">${data.best_time || 'Any time'}</td></tr>
            </table>
            <div style="margin-top:16px;padding:14px;background:#fff;border-left:3px solid #1A5FA8;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 6px;font-size:11px;color:#5A6876;text-transform:uppercase;letter-spacing:1px;">Problem Description</p>
              <p style="margin:0;font-size:14px;color:#0B1829;line-height:1.6;">${data.problem_description}</p>
            </div>
            ${data.access_notes ? `<div style="margin-top:10px;padding:14px;background:#fff;border-left:3px solid #D98C20;border-radius:0 4px 4px 0;"><p style="margin:0 0 6px;font-size:11px;color:#5A6876;text-transform:uppercase;letter-spacing:1px;">Site Access Notes</p><p style="margin:0;font-size:14px;color:#0B1829;">${data.access_notes}</p></div>` : ''}
            <p style="margin-top:20px;font-size:12px;color:#94A0AE;">Full PDF attached · Reply-to: ${data.email}</p>
          </div>
        </div>
      `,
      attachments: [{
        filename: `TaylorUpstate-ServiceRequest-${data.company.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        content: pdfBuffer.toString('base64')
      }]
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to process request. Please call 800-678-2956.' })
    };
  }
};
