// netlify/functions/submit-service.js
const PDFDocument = require('pdfkit');
const { Resend } = require('resend');

// ── BOT DETECTION ─────────────────────────────────────────────────────────────
function isBot(d) {
  // 1. Honeypot: hidden field bots fill, humans never see
  if (d.hp_website && d.hp_website.trim() !== '') {
    console.log('Bot blocked: honeypot filled');
    return true;
  }
  // 2. Speed check: submitted in under 3 seconds = bot
  const loadTime = parseInt(d.load_time || '0');
  if (loadTime > 0 && (Date.now() - loadTime) < 3000) {
    console.log('Bot blocked: submitted too fast');
    return true;
  }
  // 3. Gibberish check: long single-word strings in name or company fields
  function looksLikeGibberish(str) {
    return str && str.length > 20 && !str.includes(' ') && /^[a-zA-Z]+$/.test(str);
  }
  if (looksLikeGibberish(d.first_name) || looksLikeGibberish(d.company)) {
    console.log('Bot blocked: gibberish field content');
    return true;
  }
  return false;
}

// ── PRIORITY HELPERS ──────────────────────────────────────────────────────────
function getPriorityProps(priority) {
  const p = priority || '';
  if (p.includes('EMERGENCY')) return {
    emoji:   '🔴',
    color:   '#C0392B',
    label:   'EMERGENCY — EQUIPMENT DOWN',
    bgLight: '#FEF2F2',
    tag:     'Equipment Down'
  };
  if (p.includes('Urgent')) return {
    emoji:   '🟡',
    color:   '#C47D0E',
    label:   'URGENT — WITHIN 48 HOURS',
    bgLight: '#FFFBEB',
    tag:     'Within 48 Hours'
  };
  if (p.includes('Standard')) return {
    emoji:   '🟢',
    color:   '#27AE60',
    label:   'FLEXIBLE',
    bgLight: '#F0FDF4',
    tag:     'Flexible'
  };
  return {
    emoji:   '🔵',
    color:   '#1A5FA8',
    label:   'PREVENTIVE MAINTENANCE VISIT',
    bgLight: '#EFF6FF',
    tag:     'Scheduled PM'
  };
}

// ── PDF GENERATION ────────────────────────────────────────────────────────────
function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'letter' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy='#0B1829', blue='#1A5FA8';
    const gray='#5A6876', lgray='#F2F4F6', white='#FFFFFF';
    const ML=36, W=540, COL2=W/2, COL3=W/3;

    const pri = getPriorityProps(data.priority);

    doc.rect(0,0,612,58).fill(navy);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(white)
       .text('TAYLOR UPSTATE',ML,12,{characterSpacing:2,lineBreak:false});
    doc.fontSize(7.5).font('Helvetica').fillColor('#0193cf')
       .text('AUTHORIZED SERVICE REQUEST',ML,34,{characterSpacing:2.5,lineBreak:false});
    doc.roundedRect(420,10,156,38,3).fill(pri.color);
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(white)
       .text('PRIORITY',428,16,{characterSpacing:1.5,lineBreak:false});
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(white)
       .text(pri.label,428,27,{width:140,lineBreak:false});

    const refNum='TU-'+new Date().getFullYear()+'-'+Math.floor(Math.random()*90000+10000);
    const submitted=new Date().toLocaleString('en-US',{timeZone:'America/New_York',
      month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
    doc.fontSize(7.5).font('Helvetica').fillColor(gray)
       .text(`Ref: ${refNum}   |   Submitted: ${submitted} EDT`,ML,64,{lineBreak:false});

    let y=76;

    function sectionBar(label){
      doc.rect(ML,y,W,16).fill(navy);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(white)
         .text(label,ML+6,y+5,{characterSpacing:1.5,lineBreak:false});
      y+=20;
    }
    function cell(label,value,x,cw){
      doc.fontSize(6).font('Helvetica-Bold').fillColor(gray)
         .text(label.toUpperCase(),x,y,{width:cw-4,lineBreak:false,characterSpacing:0.3});
      const val=value&&String(value).trim()?String(value):'—';
      doc.fontSize(8.5).font('Helvetica').fillColor(navy)
         .text(val,x,y+8,{width:cw-4,lineBreak:false,ellipsis:true});
    }
    function row2(l1,v1,l2,v2){cell(l1,v1,ML,COL2);cell(l2,v2,ML+COL2,COL2);y+=20;}
    function row3(l1,v1,l2,v2,l3,v3){cell(l1,v1,ML,COL3);cell(l2,v2,ML+COL3,COL3);cell(l3,v3,ML+COL3*2,COL3);y+=20;}
    function divider(){doc.moveTo(ML,y-2).lineTo(ML+W,y-2).strokeColor('#E8EAEC').lineWidth(0.4).stroke();}
    function gap(n=4){y+=n;}

    sectionBar('01  CONTACT INFORMATION');
    row3('First Name',data.first_name,'Last Name',data.last_name,'Role',data.role);
    divider();
    row3('Company / Business',data.company,'Phone',data.phone,'Email',data.email);
    divider();
    row2('Service Address',data.service_address,'County',data.county);
    divider();
    row2('Best Time to Reach',data.best_time||'Any time','Submitted',submitted);
    gap(6);

    sectionBar('02  EQUIPMENT INFORMATION');
    row3('Equipment Brand',data.equipment_brand,'Model Number',data.model_number||'—','Serial Number',data.serial_number||'—');
    divider();
    row3('Equipment Age',data.equipment_age||'—','Warranty Status',data.warranty_status||'—','Last Service Date',data.last_service_date||'—');
    gap(6);

    sectionBar('03  SERVICE REQUEST DETAILS');
    doc.rect(ML,y,W,16).fill(pri.bgLight);
    doc.rect(ML,y,3,16).fill(pri.color);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(pri.color)
       .text(pri.label,ML+8,y+4,{characterSpacing:0.5,lineBreak:false});
    y+=20;

    row2('Issue Type',data.issue_type,'Preferred Service Date',data.preferred_date||'—');
    divider();

    doc.fontSize(6).font('Helvetica-Bold').fillColor(gray)
       .text('PROBLEM DESCRIPTION',ML,y,{characterSpacing:0.3,lineBreak:false});
    y+=9;
    const descH=52;
    doc.rect(ML,y,W,descH).fill(lgray);
    doc.rect(ML,y,3,descH).fill(blue);
    doc.fontSize(8).font('Helvetica').fillColor(navy)
       .text(data.problem_description||'—',ML+8,y+5,{width:W-14,height:descH-10,ellipsis:true});
    y+=descH+5;

    if(data.access_notes&&data.access_notes.trim()){
      doc.fontSize(6).font('Helvetica-Bold').fillColor(gray)
         .text('SITE ACCESS NOTES',ML,y,{characterSpacing:0.3,lineBreak:false});
      y+=9;
      const accH=36;
      doc.rect(ML,y,W,accH).fill('#EFF8FD');
      doc.rect(ML,y,3,accH).fill('#0193cf');
      doc.fontSize(8).font('Helvetica').fillColor(navy)
         .text(data.access_notes,ML+8,y+5,{width:W-14,height:accH-8,ellipsis:true});
      y+=accH+5;
    }

    doc.rect(0,752,612,40).fill(navy);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0193cf')
       .text('TAYLOR UPSTATE',ML,760,{characterSpacing:1.5,lineBreak:false});
    doc.fontSize(6.5).font('Helvetica').fillColor('rgba(255,255,255,0.55)')
       .text('800-678-2956  ·  dispatch@taylorupstate.com  ·  Marcellus & Troy, NY  ·  taylor-upstate.com',ML,772,{lineBreak:false});
    doc.fontSize(6.5).font('Helvetica').fillColor('rgba(255,255,255,0.35)')
       .text(`Ref: ${refNum}`,520,772,{lineBreak:false});

    doc.end();
  });
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let data;
  try { data = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) }; }

  // ── Bot check: silently return success so bots stop retrying ──
  if (isBot(data)) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
  }

  const required = ['first_name','last_name','company','phone','email',
                    'service_address','county','equipment_brand','priority','issue_type','problem_description'];
  const missing = required.filter(f => !data[f] || !String(data[f]).trim());
  if (missing.length) return { statusCode: 400, body: JSON.stringify({ error: `Missing: ${missing.join(', ')}` }) };

  try {
    const pdfBuffer = await generatePDF(data);
    const resend    = new Resend(process.env.RESEND_API_KEY);
    const pri       = getPriorityProps(data.priority);

    await resend.emails.send({
      from: `${process.env.FROM_NAME||'Taylor Upstate Service'} <${process.env.FROM_EMAIL||'onboarding@resend.dev'}>`,
      to:   ['estewart@taylorupstate.com','dispatch@taylorupstate.com'],
      reply_to: data.email,
      subject:  `${pri.emoji} Service Request — ${pri.label} — ${data.company} (${data.county})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">
          <div style="background:#0B1829;padding:20px 28px;border-radius:6px 6px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:18px;letter-spacing:2px;">TAYLOR UPSTATE</h2>
            <p style="color:#0193cf;margin:4px 0 0;font-size:10px;letter-spacing:3px;">NEW SERVICE REQUEST</p>
          </div>
          <div style="background:#f7f8fa;padding:20px 28px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;">
            <div style="background:${pri.bgLight};border-left:4px solid ${pri.color};padding:10px 14px;border-radius:0 4px 4px 0;margin-bottom:16px;">
              <span style="font-weight:bold;color:${pri.color};font-size:13px;">${pri.emoji} ${pri.label}</span>
              <span style="color:#5A6876;font-size:12px;margin-left:10px;">${pri.tag}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><td style="padding:5px 0;color:#5A6876;width:38%;">Name</td><td style="padding:5px 0;">${data.first_name} ${data.last_name}</td></tr>
              <tr><td style="padding:5px 0;color:#5A6876;">Business</td><td style="padding:5px 0;">${data.company}</td></tr>
              <tr><td style="padding:5px 0;color:#5A6876;">Phone</td><td style="padding:5px 0;"><a href="tel:${data.phone}">${data.phone}</a></td></tr>
              <tr><td style="padding:5px 0;color:#5A6876;">Email</td><td style="padding:5px 0;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
              <tr><td style="padding:5px 0;color:#5A6876;">Location</td><td style="padding:5px 0;">${data.service_address}, ${data.county}</td></tr>
              <tr><td style="padding:5px 0;color:#5A6876;">Equipment</td><td style="padding:5px 0;font-weight:bold;">${data.equipment_brand}${data.model_number?' — '+data.model_number:''}</td></tr>
              <tr><td style="padding:5px 0;color:#5A6876;">Issue</td><td style="padding:5px 0;">${data.issue_type}</td></tr>
              <tr><td style="padding:5px 0;color:#5A6876;">Best Time</td><td style="padding:5px 0;">${data.best_time||'Any time'}</td></tr>
            </table>
            <div style="margin-top:14px;padding:12px;background:#fff;border-left:3px solid #1A5FA8;border-radius:0 4px 4px 0;">
              <p style="margin:0 0 5px;font-size:10px;color:#5A6876;text-transform:uppercase;letter-spacing:1px;">Problem Description</p>
              <p style="margin:0;font-size:13px;color:#0B1829;line-height:1.6;">${data.problem_description}</p>
            </div>
            ${data.access_notes?`<div style="margin-top:8px;padding:12px;background:#fff;border-left:3px solid #0193cf;border-radius:0 4px 4px 0;"><p style="margin:0 0 5px;font-size:10px;color:#5A6876;text-transform:uppercase;letter-spacing:1px;">Site Access Notes</p><p style="margin:0;font-size:13px;color:#0B1829;">${data.access_notes}</p></div>`:''}
            <p style="margin-top:16px;font-size:11px;color:#94A0AE;">Single-page PDF attached · Reply-to: ${data.email}</p>
          </div>
        </div>`,
      attachments: [{
        filename: `TaylorUpstate-${data.company.replace(/[^a-zA-Z0-9]/g,'-')}.pdf`,
        content:  pdfBuffer.toString('base64')
      }]
    });

    // ── LOG TO AIRTABLE ──────────────────────────────────────────────────────
    const atToken  = process.env.AIRTABLE_TOKEN;
    const atBaseId = process.env.AIRTABLE_BASE_ID;

    if (atToken && atBaseId) {
      const EASTERN_SVC = new Set([
        'Albany County','Clinton County','Columbia County','Delaware County',
        'Dutchess County','Essex County','Franklin County','Fulton County',
        'Greene County','Hamilton County','Herkimer County','Montgomery County',
        'Orange County','Otsego County','Putnam County','Rensselaer County',
        'Saint Lawrence County','Saratoga County','Schenectady County',
        'Schoharie County','Sullivan County','Ulster County','Warren County',
        'Washington County'
      ]);
      const territory = EASTERN_SVC.has(data.county) ? 'Eastern' : 'Western';

      const atRes = await fetch(`https://api.airtable.com/v0/${atBaseId}/tblV2Kc9oZ4UfcLwi`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${atToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'First Name':          data.first_name,
            'Last Name':           data.last_name,
            'Business Name':       data.company,
            'Role':                data.role               || '',
            'Phone':               data.phone,
            'Email':               data.email,
            'Address':             data.service_address,
            'County':              data.county,
            'Territory':           territory,
            'Best Time':           data.best_time          || '',
            'Equipment Brand':     data.equipment_brand,
            'Model Number':        data.model_number       || '',
            'Serial Number':       data.serial_number      || '',
            'Equipment Age':       data.equipment_age      || '',
            'Warranty Status':     data.warranty_status    || '',
            'Last Service Date':   data.last_service_date  || '',
            'Priority':            data.priority,
            'Nature of Problem':   data.issue_type,
            'Preferred Date':      data.preferred_date     || '',
            'Problem Description': data.problem_description,
            'Site Access Notes':   data.access_notes       || '',
            'Status':              'New',
            'Submitted At':        new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
          }
        })
      });
      if (!atRes.ok) {
        const atErr = await atRes.json();
        console.error('Airtable error:', JSON.stringify(atErr));
      }
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to process request. Please call 800-678-2956.' }) };
  }
};
