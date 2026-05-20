const { Resend } = require('resend');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { name, email, phone, message } = body;

  if (!name || !email || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'Name, email, and message are required.' }),
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const subject = `Contact Form — ${name}`;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0B1829;">
      <div style="background:#0B1829;padding:24px 32px;border-radius:4px 4px 0 0;">
        <h2 style="color:#ffffff;margin:0;font-size:1.2rem;letter-spacing:0.05em;text-transform:uppercase;">
          New Contact Form Submission
        </h2>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:0.85rem;">taylor-upstate.com/contact-us</p>
      </div>
      <div style="background:#f7f6f3;padding:32px;border-radius:0 0 4px 4px;border:1px solid #D8DCE1;border-top:none;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #D8DCE1;width:120px;">
              <strong style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;color:#5A6876;">Name</strong>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #D8DCE1;font-size:0.95rem;">${name}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #D8DCE1;">
              <strong style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;color:#5A6876;">Email</strong>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #D8DCE1;font-size:0.95rem;">
              <a href="mailto:${email}" style="color:#1A5FA8;">${email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #D8DCE1;">
              <strong style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;color:#5A6876;">Phone</strong>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #D8DCE1;font-size:0.95rem;">
              ${phone ? `<a href="tel:${phone}" style="color:#1A5FA8;">${phone}</a>` : '<span style="color:#94A0AE;">Not provided</span>'}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;vertical-align:top;">
              <strong style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;color:#5A6876;">Message</strong>
            </td>
            <td style="padding:10px 0;font-size:0.95rem;line-height:1.6;white-space:pre-wrap;">${message}</td>
          </tr>
        </table>
        <div style="margin-top:24px;padding:16px;background:#ffffff;border-radius:3px;border-left:3px solid #0193cf;">
          <p style="margin:0;font-size:0.82rem;color:#5A6876;">
            Reply directly to this email to respond to ${name}.
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Taylor Upstate <sales@taylor-upstate.com>',
      to: [
        'sales@taylor-upstate.com',
        'estewart@taylorupstate.com',
      ],
      reply_to: email,
      subject: subject,
      html: htmlBody,
    });

    if (error) throw new Error(error.message);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('Resend error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to send message. Please call us at 1-800-678-2956.' }),
    };
  }
};
