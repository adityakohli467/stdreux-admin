"use server"

import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

const getTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error('SMTP configuration is incomplete');
  }

  const transporterOptions: any = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  // For port 587, use STARTTLS if not secure
  if (!smtpSecure && smtpPort === 587) {
    transporterOptions.requireTLS = true;
  }

  return nodemailer.createTransport(transporterOptions);
};

export async function sendEmail(options: SendEmailOptions) {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
    const fromName = process.env.COMPANY_NAME || 'St Dreux Coffee Roasters';


    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOrderConfirmationEmail(orderId: number, customerEmail: string, customerName: string) {
  const companyName = process.env.COMPANY_NAME || 'St Dreux Coffee Roasters';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background-color: #1a1a1a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
    .button { display: inline-block; padding: 10px 20px; background-color: #1a1a1a; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Order Confirmation</h1>
    </div>
    <div class="content">
      <p>Dear ${customerName || 'Customer'},</p>
      
      <p>Thank you for your order with <strong>${companyName}</strong>.</p>
      
      <p>Your order <strong>#${orderId}</strong> has been successfully placed and is being processed.</p>
      
      <p>We appreciate your business!</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us at ${process.env.FROM_EMAIL || 'info@stdreux.com.au'}.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

  return sendEmail({
    to: customerEmail,
    subject: `Order Confirmation #${orderId} - ${companyName}`,
    html: html,
  });
}

export async function sendQuoteConfirmationEmail(quoteId: number, customerEmail: string, customerName: string) {
  const companyName = process.env.COMPANY_NAME || 'St Dreux Coffee Roasters';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background-color: #1a1a1a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 30px 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; }
    .button { display: inline-block; padding: 10px 20px; background-color: #1a1a1a; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Quote Confirmation</h1>
    </div>
    <div class="content">
      <p>Dear ${customerName || 'Customer'},</p>
      
      <p>Thank you for your inquiry with <strong>${companyName}</strong>.</p>
      
      <p>Your quote <strong>#${quoteId}</strong> has been successfully generated.</p>
      
      <p>We will be in touch shortly.</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us at ${process.env.FROM_EMAIL || 'info@stdreux.com.au'}.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

  return sendEmail({
    to: customerEmail,
    subject: `Quote Confirmation #${quoteId} - ${companyName}`,
    html: html,
  });
}
