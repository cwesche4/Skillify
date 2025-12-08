export async function sendEmail(to: string, subject: string, html: string) {
  console.log('Email sent:', { to, subject })
  // Wire-up later → Resend, AWS SES, Mailgun, etc.
}
