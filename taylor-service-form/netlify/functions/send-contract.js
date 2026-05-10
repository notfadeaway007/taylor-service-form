const { Resend } = require('resend');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      business_name, contact_name, address, phone, email,
      model_number, serial_number, install_date,
      contract_term, applicant_printed_name, applicant_date,
      pdfBase64
    } = data;

    const resend = new Resend(process.env.RESEND_API_KEY);

    const subject = `Taylor Service Contract — ${business_name} — Model ${model_number}`;
    const pdfFilename = `ServiceContract_${business_name.replace(/[^a-zA-Z0-9]/g,'_')}_${model_number}.pdf`;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#102033;padding:20px 24px;">
          <h2 style="color:#fff;margin:0;font-size:20px;letter-spacing:2px;">TAYLOR UPSTATE</h2>
          <p style="color:#29c3f0;margin:4px 0 0;font-size:12px;letter-spacing:3px;">SERVICE CONTRACT APPLICATION</p>
        </div>
        <div style="background:#fffde7;border-left:4px solid #deac5c;padding:10px 16px;margin:0;">
          <p style="color:#6a5000;font-size:13px;font-weight:bold;margin:0;">
            ⚠ New service contract application received. PDF attached — please sign and submit to Taylor Company for factory approval.
          </p>
        </div>
        <div style="padding:20px 24px;background:#f0f6fb;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td colspan="2" style="background:#102033;color:#29c3f0;font-weight:bold;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Applicant</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;width:40%;">Business Name</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${business_name}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Contact</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${contact_name}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Address</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${address}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Phone</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${phone}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Email</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${email}</td></tr>
            <tr><td colspan="2" style="background:#102033;color:#29c3f0;font-weight:bold;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Equipment</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Model No.</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${model_number}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Serial No.</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${serial_number}</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Install Date</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${install_date}</td></tr>
            <tr style="background:#f7fbff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Contract Term</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${contract_term} Year(s)</td></tr>
            <tr style="background:#fff;"><td style="padding:7px 10px;color:#5a7a92;font-size:11px;text-transform:uppercase;">Signed By</td><td style="padding:7px 10px;font-weight:bold;color:#102033;">${applicant_printed_name} — ${applicant_date}</td></tr>
          </table>
        </div>
        <div style="background:#102033;padding:12px 24px;text-align:center;">
          <p style="color:rgba(255,255,255,.4);font-size:11px;margin:0;">Taylor Upstate · 800-678-2956 · taylor-upstate.com</p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: 'Taylor Upstate <sales@taylor-upstate.com>',
      to: [
        'jwhitbread@taylorupstate.com',
        'bboise@taylorupstate.com',
        'estewart@taylorupstate.com'
      ],
      cc: email,
      reply_to: email,
      subject: subject,
      html: htmlBody,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBase64,
        }
      ]
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('send-contract error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Email failed' })
    };
  }
};
