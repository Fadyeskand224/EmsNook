// Sends the password-reset email. In production this uses Resend (https://resend.com) over HTTPS;
// without an API key (local development) the message is printed to the console instead, so you can click the link.
export function createMailer({ apiKey = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM || 'EmsNook <onboarding@resend.dev>', fetchImpl = fetch, log = console } = {}) {
  return {
    configured: !!apiKey,
    async send({ to, subject, text, html }) {
      if (!apiKey) {
        log.log(`\n[mail not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
        return false;
      }
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Mail provider answered ${res.status}`);
      return true;
    },
  };
}
