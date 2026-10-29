const fs = require("node:fs");
const path = require("node:path");
const translations = require("./email-locales.json");

const monlineLogo = fs.readFileSync(
  path.join(__dirname, "assets/monline-logo.png"),
);

function smtpTestMessage({ from, to, language = "en" }) {
  const base =
    typeof language === "string"
      ? language.toLowerCase().split(/[-_]/)[0]
      : "en";
  const candidate = { pt: "pt_BR", zh: "zh_CN" }[base] || base;
  const locale = Object.hasOwn(translations, candidate) ? candidate : "en";
  const copy = translations[locale];
  return brandedMessage({
    from,
    to,
    locale,
    subject: copy.subject,
    text: copy.body,
    bodyHtml: copy.body,
    logoAlt: copy.logoAlt,
  });
}

function brandedMessage({
  from,
  to,
  locale = "en",
  subject,
  text,
  bodyHtml,
  logoAlt = "Monline logo",
}) {
  return {
    from,
    to,
    subject,
    text,
    html: `<!doctype html>
<html lang="${locale.replace("_", "-")}">
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" align="center" width="480" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="width:100%;max-width:480px;border:1px solid #dfe3d9;border-radius:16px;background-color:#ffffff">
        <tr><td style="padding:28px">
          <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
            <tr>
              <td width="48" valign="middle" style="width:48px;padding:0 14px 0 0">
                <img src="cid:monline-logo" width="48" height="48" alt="${logoAlt}" style="display:block;width:48px;height:48px;border:0">
              </td>
              <td valign="middle" style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;font-weight:700;color:#42473e">Monline</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#42473e">
          ${bodyHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    attachments: [
      {
        filename: "monline-logo.png",
        content: monlineLogo,
        contentType: "image/png",
        contentDisposition: "inline",
        cid: "monline-logo",
      },
    ],
  };
}

module.exports = { smtpTestMessage, brandedMessage };
