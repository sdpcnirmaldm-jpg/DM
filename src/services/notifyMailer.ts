import nodemailer, { type Transporter } from 'nodemailer';
import { OWNER_EMAIL } from '../db/localFallbackStore.ts';
import type { InvestigatorUser } from '../types/clinical.ts';

export const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

export interface MailerConfig {
  configured: boolean;
  ownerEmail: string;
  from: string;
  transportOptions?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
}

export interface PendingRequestEmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface NotifyOwnerResult {
  sent: boolean;
  reason?:
    | 'not_pending'
    | 'cooldown_active'
    | 'smtp_not_configured'
    | 'send_failed';
  messageId?: string;
  to?: string;
  error?: string;
}

export interface PendingNotificationCooldown {
  canNotify: (key: string, nowMs?: number) => boolean;
  markNotified: (key: string, nowMs?: number) => void;
  clear: (key?: string) => void;
}

export function createPendingNotificationCooldown(
  cooldownMs = DEFAULT_COOLDOWN_MS
): PendingNotificationCooldown {
  const lastSentByKey = new Map<string, number>();

  return {
    canNotify(key: string, nowMs = Date.now()): boolean {
      const prev = lastSentByKey.get(key);
      if (prev === undefined) return true;
      return nowMs - prev >= cooldownMs;
    },
    markNotified(key: string, nowMs = Date.now()): void {
      lastSentByKey.set(key, nowMs);
    },
    clear(key?: string): void {
      if (key) {
        lastSentByKey.delete(key);
      } else {
        lastSentByKey.clear();
      }
    },
  };
}

const defaultCooldownTracker = createPendingNotificationCooldown();
let warnedMissingSmtp = false;

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveMailerConfig(
  env: Record<string, string | undefined> = process.env
): MailerConfig {
  const ownerEmail = (
    env.OWNER_NOTIFICATION_EMAIL ||
    env.OWNER_EMAIL ||
    OWNER_EMAIL
  )
    .trim()
    .toLowerCase();

  const user = (env.SMTP_USER || '').trim();
  const pass = (env.SMTP_PASS || '').trim();
  const explicitHost = (env.SMTP_HOST || '').trim();
  const isGmail =
    (env.SMTP_SERVICE || '').trim().toLowerCase() === 'gmail' ||
    (!explicitHost && user.toLowerCase().endsWith('@gmail.com'));

  const host = explicitHost || (isGmail ? 'smtp.gmail.com' : '');
  const parsedPort = Number(env.SMTP_PORT);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : isGmail ? 465 : 587;
  const secure = env.SMTP_SECURE
    ? env.SMTP_SECURE.trim().toLowerCase() === 'true'
    : port === 465;

  const from = (
    env.SMTP_FROM ||
    (user ? `"Desai T2DM Study Portal" <${user}>` : `"Desai T2DM Study Portal" <${ownerEmail}>`)
  ).trim();

  const hasValidAuth = Boolean(user && pass);
  const configured = Boolean(host && (explicitHost ? (!user || hasValidAuth) : hasValidAuth));

  if (!configured) {
    return {
      configured: false,
      ownerEmail,
      from,
    };
  }

  return {
    configured: true,
    ownerEmail,
    from,
    transportOptions: {
      host,
      port,
      secure,
      ...(hasValidAuth ? { auth: { user, pass } } : {}),
    },
  };
}

export function resolvePortalUrl(params: {
  appUrlEnv?: string;
  requestOrigin?: string;
}): string {
  const rawEnv = (params.appUrlEnv || '').trim();
  if (rawEnv && rawEnv !== 'MY_APP_URL' && /^https?:\/\//i.test(rawEnv)) {
    return rawEnv.replace(/\/+$/, '');
  }
  const rawOrigin = (params.requestOrigin || '').trim();
  if (rawOrigin && /^https?:\/\//i.test(rawOrigin)) {
    return rawOrigin.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function buildPendingRequestEmail(params: {
  requester: Pick<InvestigatorUser, 'uid' | 'email' | 'displayName' | 'role' | 'status'>;
  portalUrl: string;
  requestedAt?: string;
}): PendingRequestEmailContent {
  const { requester, portalUrl } = params;
  const displayName = (requester.displayName || '').trim() || requester.email;
  const email = (requester.email || '').trim();
  const roleLabel =
    requester.role === 'normal' ? 'User Login (Participant)' : 'Investigator Login';
  const requestedAt = params.requestedAt || new Date().toISOString();

  const safeName = escapeHtml(displayName);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(roleLabel);
  const safeUrl = escapeHtml(portalUrl);
  const safeTime = escapeHtml(requestedAt);

  const subject = `[Desai T2DM Study] Pending Login Approval Request: ${displayName}`;

  const text = [
    'Desai Diabetes & Endocrine Clinic — T2DM Phenotype Study Portal',
    '',
    'A new user has signed in and requires your approval before entering the study portal.',
    '',
    `Name: ${displayName}`,
    `Email: ${email}`,
    `Requested Access: ${roleLabel}`,
    `Status: Pending Investigator Approval`,
    `Requested At: ${requestedAt}`,
    '',
    `Open the portal to Approve or Reject this request in Team Access:`,
    portalUrl,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background-color:#EEF5F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#14201B;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #D4E2DA;border-radius:16px;overflow:hidden;">
    <div style="background:#053B2B;padding:20px 24px;color:#FFFFFF;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#A7F3D0;font-weight:700;">
        Desai T2DM Phenotype Study
      </div>
      <h1 style="margin:6px 0 0;font-size:18px;line-height:1.35;font-weight:700;color:#FFFFFF;">
        New Login Approval Request
      </h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4B6157;">
        A new person attempted to sign in and is blocked on the approval screen waiting for investigator permission.
      </p>
      <table style="width:100%;border-collapse:collapse;background:#F6F9F7;border:1px solid #DDE8E2;border-radius:12px;">
        <tr>
          <td style="padding:10px 14px;font-size:12px;color:#4B6157;font-weight:600;width:36%;">Name</td>
          <td style="padding:10px 14px;font-size:13px;color:#14201B;font-weight:600;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;color:#4B6157;font-weight:600;border-top:1px solid #E5EEE9;">Email</td>
          <td style="padding:10px 14px;font-size:13px;color:#14201B;font-family:monospace;border-top:1px solid #E5EEE9;">${safeEmail}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;color:#4B6157;font-weight:600;border-top:1px solid #E5EEE9;">Access Level</td>
          <td style="padding:10px 14px;font-size:13px;color:#14201B;border-top:1px solid #E5EEE9;">${safeRole}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;color:#4B6157;font-weight:600;border-top:1px solid #E5EEE9;">Status</td>
          <td style="padding:10px 14px;font-size:12px;color:#92400E;font-weight:700;border-top:1px solid #E5EEE9;">Pending Approval</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;color:#4B6157;font-weight:600;border-top:1px solid #E5EEE9;">Requested At</td>
          <td style="padding:10px 14px;font-size:12px;color:#4B6157;font-family:monospace;border-top:1px solid #E5EEE9;">${safeTime}</td>
        </tr>
      </table>
      <div style="margin-top:22px;">
        <a href="${safeUrl}" style="display:inline-block;padding:11px 20px;background:#047857;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;border-radius:10px;">
          Open Study Portal &amp; Review Request
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#6B8076;">
        Open <strong>Team Access</strong> in the portal to Approve or Reject this login request.
      </p>
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

export type MailTransportFactory = (
  options: NonNullable<MailerConfig['transportOptions']>
) => Pick<Transporter, 'sendMail'>;

export async function notifyOwnerOfPendingRequest(params: {
  requester: Pick<InvestigatorUser, 'uid' | 'email' | 'displayName' | 'role' | 'status'>;
  portalUrl: string;
  env?: Record<string, string | undefined>;
  transportFactory?: MailTransportFactory;
  cooldownTracker?: PendingNotificationCooldown;
  force?: boolean;
}): Promise<NotifyOwnerResult> {
  const { requester, portalUrl, env, transportFactory, force = false } = params;
  const tracker = params.cooldownTracker ?? defaultCooldownTracker;

  if (requester.status !== 'pending' || requester.role === 'owner') {
    return { sent: false, reason: 'not_pending' };
  }

  const dedupKey = `${requester.email.trim().toLowerCase()}:${requester.role}`;
  if (!force && !tracker.canNotify(dedupKey)) {
    return { sent: false, reason: 'cooldown_active' };
  }

  const config = resolveMailerConfig(env);
  if (!config.configured || !config.transportOptions) {
    if (!warnedMissingSmtp) {
      warnedMissingSmtp = true;
      console.warn(
        `[notifyMailer] Pending login request for ${requester.email} recorded in Team Access, but email notification was skipped because SMTP_USER/SMTP_PASS (or SMTP_HOST) are not configured.`
      );
    }
    return { sent: false, reason: 'smtp_not_configured', to: config.ownerEmail };
  }

  try {
    const transporter = (transportFactory ?? nodemailer.createTransport)(
      config.transportOptions
    );
    const content = buildPendingRequestEmail({
      requester,
      portalUrl,
    });
    const info = await transporter.sendMail({
      from: config.from,
      to: config.ownerEmail,
      replyTo: requester.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    tracker.markNotified(dedupKey);
    return {
      sent: true,
      messageId: info?.messageId,
      to: config.ownerEmail,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown SMTP error';
    console.error(`[notifyMailer] Failed to send pending request email to ${config.ownerEmail}:`, msg);
    return {
      sent: false,
      reason: 'send_failed',
      to: config.ownerEmail,
      error: msg,
    };
  }
}
