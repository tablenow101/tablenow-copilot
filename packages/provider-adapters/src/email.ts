import nodemailer, { type Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class SmtpEmailSender implements EmailSender {
  readonly #transporter: Transporter;

  public constructor(
    private readonly from: string,
    options: { host: string; port: number; secure: boolean; user?: string; password?: string },
  ) {
    this.#transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      ...(options.user && options.password
        ? { auth: { user: options.user, pass: options.password } }
        : {}),
    });
  }

  public async send(message: EmailMessage): Promise<void> {
    await this.#transporter.sendMail({ from: this.from, ...message });
  }
}

export class LogEmailSender implements EmailSender {
  public async send(message: EmailMessage): Promise<void> {
    // Deliberately excludes HTML and secrets from structured production logs.
    process.stdout.write(`${JSON.stringify({ event: "email.preview", to: message.to, subject: message.subject, text: message.text })}\n`);
  }
}

export function accessCodeEmail(code: string, expiresInMinutes: number): Omit<EmailMessage, "to"> {
  return {
    subject: `${code} — votre code TableNow`,
    text: `Votre code TableNow est ${code}. Il expire dans ${expiresInMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: `<!doctype html><html lang="fr"><body style="margin:0;background:#0b0c0c;color:#f4f5f2;font-family:Arial,sans-serif"><main style="max-width:560px;margin:auto;padding:48px 24px"><p style="color:#b8ef46;font-weight:700;letter-spacing:.12em">TABLENOW</p><h1 style="font-size:28px">Votre accès privé</h1><p style="color:#a8aaa5">Saisissez ce code dans TableNow. Il expire dans ${expiresInMinutes} minutes.</p><p style="font-size:42px;letter-spacing:.18em;font-weight:800;margin:32px 0">${code}</p><p style="color:#777b74;font-size:13px">Ne transmettez jamais ce code. TableNow ne vous le demandera pas par téléphone.</p></main></body></html>`,
  };
}

export function invitationEmail(organizationName: string): Omit<EmailMessage, "to"> {
  return {
    subject: "Votre accès privé à TableNow",
    text: `Vous êtes invité à découvrir l'espace TableNow de ${organizationName}. Ouvrez l'application avec cette adresse e-mail puis demandez votre code à six chiffres.`,
    html: `<!doctype html><html lang="fr"><body style="margin:0;background:#0b0c0c;color:#f4f5f2;font-family:Arial,sans-serif"><main style="max-width:560px;margin:auto;padding:48px 24px"><p style="color:#b8ef46;font-weight:700;letter-spacing:.12em">TABLENOW · ACCÈS PRIVÉ</p><h1 style="font-size:30px">Le copilote de ${organizationName} est prêt.</h1><p style="color:#a8aaa5;line-height:1.6">Connectez-vous avec cette adresse e-mail. TableNow vous enverra un code à six chiffres, sans mot de passe à retenir.</p><p style="margin-top:32px;color:#777b74;font-size:13px">Invitation personnelle. Ne la transférez pas.</p></main></body></html>`,
  };
}
