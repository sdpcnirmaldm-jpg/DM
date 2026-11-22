import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import {
  buildPendingRequestEmail,
  createPendingNotificationCooldown,
  notifyOwnerOfPendingRequest,
  resolveMailerConfig,
  resolvePortalUrl,
} from './notifyMailer';

test('resolveMailerConfig defaults to owner email and detects Gmail or custom SMTP settings', () => {
  const unconfigured = resolveMailerConfig({});
  assert.equal(unconfigured.configured, false);
  assert.equal(unconfigured.ownerEmail, 'bhumitdangodara1@gmail.com');

  const gmail = resolveMailerConfig({
    SMTP_USER: 'bhumitdangodara1@gmail.com',
    SMTP_PASS: 'app-password-here',
  });
  assert.equal(gmail.configured, true);
  assert.equal(gmail.transportOptions?.host, 'smtp.gmail.com');
  assert.equal(gmail.transportOptions?.port, 465);
  assert.equal(gmail.transportOptions?.secure, true);

  const custom = resolveMailerConfig({
    SMTP_HOST: 'smtp.resend.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'resend',
    SMTP_PASS: 're_secret',
    OWNER_NOTIFICATION_EMAIL: 'pi@desaiclinic.org',
  });
  assert.equal(custom.configured, true);
  assert.equal(custom.ownerEmail, 'pi@desaiclinic.org');
  assert.equal(custom.transportOptions?.host, 'smtp.resend.com');
  assert.equal(custom.transportOptions?.port, 587);
  assert.equal(custom.transportOptions?.secure, false);
});

test('buildPendingRequestEmail safely escapes HTML and includes requester identity & portal link', () => {
  const email = buildPendingRequestEmail({
    requester: {
      uid: 'normal-test',
      email: 'dr.test@clinic.org',
      displayName: 'Dr. <script>alert(1)</script> Patel',
      role: 'normal',
      status: 'pending',
    },
    portalUrl: 'https://ais-pre-example.run.app',
    requestedAt: '2026-11-17T10:00:00.000Z',
  });

  assert.match(email.subject, /Pending Login Approval Request/);
  assert.match(email.text, /dr\.test@clinic\.org/);
  assert.match(email.text, /https:\/\/ais-pre-example\.run\.app/);
  assert.ok(!email.html.includes('<script>alert(1)</script>'));
  assert.ok(email.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(email.html.includes('User Login (Participant)'));
});

test('notifyOwnerOfPendingRequest delivers via nodemailer transport and enforces cooldown deduplication', async () => {
  const sentMessages: Array<{
    from?: unknown;
    to?: unknown;
    subject?: unknown;
    text?: unknown;
  }> = [];

  const mockTransportFactory = () => {
    const jsonTransporter = nodemailer.createTransport({ jsonTransport: true });
    return {
      async sendMail(mailOptions: SendMailOptions) {
        sentMessages.push({
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
        });
        return jsonTransporter.sendMail(mailOptions);
      },
    };
  };

  const cooldown = createPendingNotificationCooldown(15 * 60 * 1000);
  const env = {
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'bhumitdangodara1@gmail.com',
    SMTP_PASS: 'test-app-pass',
  };

  const requester = {
    uid: 'normal-new-user',
    email: 'colleague@clinic.org',
    displayName: 'Dr. Colleague',
    role: 'normal' as const,
    status: 'pending' as const,
  };

  const first = await notifyOwnerOfPendingRequest({
    requester,
    portalUrl: resolvePortalUrl({ appUrlEnv: 'https://ais-pre-example.run.app' }),
    env,
    transportFactory: mockTransportFactory,
    cooldownTracker: cooldown,
  });

  assert.equal(first.sent, true);
  assert.equal(first.to, 'bhumitdangodara1@gmail.com');
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'bhumitdangodara1@gmail.com');

  // Repeated request within cooldown does not spam the owner
  const duplicate = await notifyOwnerOfPendingRequest({
    requester,
    portalUrl: 'https://ais-pre-example.run.app',
    env,
    transportFactory: mockTransportFactory,
    cooldownTracker: cooldown,
  });
  assert.equal(duplicate.sent, false);
  assert.equal(duplicate.reason, 'cooldown_active');
  assert.equal(sentMessages.length, 1);

  // Approved users never trigger pending email notifications
  const approvedSkip = await notifyOwnerOfPendingRequest({
    requester: { ...requester, status: 'approved' },
    portalUrl: 'https://ais-pre-example.run.app',
    env,
    transportFactory: mockTransportFactory,
    cooldownTracker: cooldown,
    force: true,
  });
  assert.equal(approvedSkip.sent, false);
  assert.equal(approvedSkip.reason, 'not_pending');
});

test('notifyOwnerOfPendingRequest degrades safely when SMTP is not configured or send fails', async () => {
  const unconfiguredResult = await notifyOwnerOfPendingRequest({
    requester: {
      uid: 'u1',
      email: 'user@example.com',
      displayName: 'User One',
      role: 'normal',
      status: 'pending',
    },
    portalUrl: 'http://localhost:3000',
    env: {},
    cooldownTracker: createPendingNotificationCooldown(),
  });
  assert.equal(unconfiguredResult.sent, false);
  assert.equal(unconfiguredResult.reason, 'smtp_not_configured');

  const failedResult = await notifyOwnerOfPendingRequest({
    requester: {
      uid: 'u2',
      email: 'user2@example.com',
      displayName: 'User Two',
      role: 'researcher',
      status: 'pending',
    },
    portalUrl: 'http://localhost:3000',
    env: {
      SMTP_USER: 'bhumitdangodara1@gmail.com',
      SMTP_PASS: 'bad-pass',
    },
    cooldownTracker: createPendingNotificationCooldown(),
    transportFactory: () => ({
      async sendMail() {
        throw new Error('535 Authentication failed');
      },
    }),
  });
  assert.equal(failedResult.sent, false);
  assert.equal(failedResult.reason, 'send_failed');
  assert.match(failedResult.error || '', /Authentication failed/);
});
