#!/usr/bin/env bash
# e13.sh — create all E13 Notifications issues
# Usage: sourced by run.sh — do not call directly

MILESTONE=$(get_milestone_number "E13 — Notifications")
if [[ -z "$MILESTONE" ]]; then
  echo "ERROR: Milestone 'E13 — Notifications' not found. Run setup.sh first."
  exit 1
fi
echo "→ Using milestone #$MILESTONE (E13 — Notifications)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# E13-01 — Backend: Notification data model + sendNotification() dispatcher
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-01] [Backend] Notification model + sendNotification() multi-channel dispatcher"
read -r -d '' body << 'BODY' || true
## Summary
Core notification infrastructure. `Notification` Prisma model stores every notification sent. `sendNotification()` dispatcher reads user preferences and fans out to the correct channels (push / email / SMS) without callers knowing channel details.

## Reference
- PRD §12.1 Notification Infrastructure

## Files to create
- `apps/web/src/lib/notifications/dispatcher.ts`
- `apps/web/src/lib/notifications/types.ts`

## Notification model
```prisma
model Notification {
  id         String             @id @default(cuid())
  userId     String
  type       NotificationType
  title      String
  body       String
  data       Json?              // deep-link payload
  channels   String[]           // which channels were attempted: ["push","email"]
  readAt     DateTime?
  createdAt  DateTime           @default(now())
  user       User               @relation(fields: [userId], references: [id])

  @@index([userId, createdAt(sort: Desc)])
}

enum NotificationType {
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  BOOKING_REMINDER
  NO_SHOW_MARKED
  PAYMENT_RECEIVED
  REVIEW_RECEIVED
  DISPUTE_OPENED
  DISPUTE_RESOLVED
  TRUST_TIER_CHANGED
  SYSTEM_ANNOUNCEMENT
}

model NotificationPreference {
  id        String  @id @default(cuid())
  userId    String  @unique
  pushEnabled  Boolean @default(true)
  emailEnabled Boolean @default(true)
  smsEnabled   Boolean @default(false)
  // per-type opt-outs (stored as JSON array of disabled types)
  disabledTypes String[] @default([])
  user      User    @relation(fields: [userId], references: [id])
}
```

## User model additions
```prisma
model User {
  // add:
  phone          String?
  fcmTokens      FcmToken[]
  notifications  Notification[]
  notifPrefs     NotificationPreference?
}

model FcmToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  platform  String   // "ios" | "android"
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

## NotificationPayload type
```typescript
// apps/web/src/lib/notifications/types.ts
export type NotificationPayload = {
  userId:  string;
  type:    NotificationType;
  title:   string;
  body:    string;
  data?:   Record<string, string>;  // deep-link params
};
```

## sendNotification() dispatcher
```typescript
// apps/web/src/lib/notifications/dispatcher.ts
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: payload.userId },
  });

  // type opt-out check
  if (prefs?.disabledTypes.includes(payload.type)) return;

  const channelsAttempted: string[] = [];

  // persist in DB regardless of channel success
  await prisma.notification.create({
    data: {
      userId:   payload.userId,
      type:     payload.type,
      title:    payload.title,
      body:     payload.body,
      data:     payload.data ?? null,
      channels: [],  // updated after sends
    },
  });

  const sends: Promise<void>[] = [];

  if (prefs?.pushEnabled ?? true) {
    sends.push(sendPushNotification(payload).then(() => { channelsAttempted.push('push'); }));
  }
  if (prefs?.emailEnabled ?? true) {
    sends.push(sendEmailNotification(payload).then(() => { channelsAttempted.push('email'); }));
  }
  if (prefs?.smsEnabled) {
    sends.push(sendSmsNotification(payload).then(() => { channelsAttempted.push('sms'); }));
  }

  await Promise.allSettled(sends);  // never throws — channel failures are logged, not fatal
}
```

## Acceptance Criteria
- [ ] `Notification` model with all fields created
- [ ] `NotificationPreference` model created
- [ ] `FcmToken` model created
- [ ] `sendNotification` persists DB row before sends
- [ ] `Promise.allSettled` — one channel failure doesn't block others
- [ ] Type opt-out respected: disabled type → function returns early
- [ ] Default prefs: push=true, email=true, sms=false

## Edge Cases
- User has no `NotificationPreference` row → use defaults (push+email on)
- All channels fail → DB row still exists, channels=[]
- Duplicate FCM token registration → `@unique` handles (upsert in E08-10)

## Definition of Done
- [ ] Prisma migration for all 4 new models/fields
- [ ] `dispatcher.ts` created
- [ ] `types.ts` created
- [ ] Unit test: disabled type → returns early without sending
BODY

create_issue "$title" "$body" '["backend","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-02 — Backend: FCM push channel implementation
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-02] [Backend] FCM push notification channel — sendPushNotification()"
read -r -d '' body << 'BODY' || true
## Summary
Implement `sendPushNotification()` using Firebase Admin SDK. Sends to all registered FCM tokens for a user. Handles token staleness (invalid/unregistered tokens are pruned automatically).

## Reference
- PRD §12.2 Push Notifications
- E08-10 (mobile FCM token registration — token stored in `FcmToken` table)

## Files to create
- `apps/web/src/lib/notifications/channels/push.ts`
- `apps/web/src/lib/firebase/admin.ts` — Firebase Admin SDK singleton

## Firebase Admin singleton
```typescript
// apps/web/src/lib/firebase/admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const firebaseAdminApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId:   process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      })
    : getApps()[0];

export const fcmMessaging = getMessaging(firebaseAdminApp);
```

## sendPushNotification()
```typescript
// apps/web/src/lib/notifications/channels/push.ts
export async function sendPushNotification(payload: NotificationPayload): Promise<void> {
  const tokens = await prisma.fcmToken.findMany({
    where:  { userId: payload.userId },
    select: { id: true, token: true },
  });

  if (tokens.length === 0) return;

  const message = {
    notification: { title: payload.title, body: payload.body },
    data:         payload.data ?? {},
    tokens:       tokens.map((t) => t.token),
  };

  const response = await fcmMessaging.sendEachForMulticast(message);

  // prune stale tokens
  const staleTokenIds: string[] = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const code = resp.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        staleTokenIds.push(tokens[idx].id);
      } else {
        console.error('[push] send failed', tokens[idx].token, resp.error?.message);
      }
    }
  });

  if (staleTokenIds.length > 0) {
    await prisma.fcmToken.deleteMany({ where: { id: { in: staleTokenIds } } });
  }
}
```

## Environment variables required
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=   # multi-line PEM — store with \n escaped
```

## Deep-link data payload convention
```typescript
// data field maps to mobile deep-link params:
// BOOKING_CONFIRMED  → { screen: 'BookingDetail', bookingId: '...' }
// BOOKING_REMINDER   → { screen: 'BookingDetail', bookingId: '...' }
// NO_SHOW_MARKED     → { screen: 'TrustScore' }
// REVIEW_RECEIVED    → { screen: 'MyReviews' }
// DISPUTE_RESOLVED   → { screen: 'BookingDetail', bookingId: '...' }
```

## Acceptance Criteria
- [ ] Firebase Admin initialised as singleton (no duplicate apps)
- [ ] Sends to ALL tokens for user (multi-device)
- [ ] Stale/invalid tokens deleted after send
- [ ] Non-staleness failures logged but not thrown
- [ ] 0 tokens → returns early (no FCM call)
- [ ] `FIREBASE_PRIVATE_KEY` `\n` escape handled

## Edge Cases
- User has 3 tokens, 1 is stale → 2 receive push, 1 deleted
- FCM quota exceeded → logged, not thrown
- `FIREBASE_PRIVATE_KEY` missing → throw at startup (not per-request)

## Definition of Done
- [ ] `admin.ts` singleton created
- [ ] `push.ts` created with stale token pruning
- [ ] Env vars documented in `.env.example`
BODY

create_issue "$title" "$body" '["backend","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-03 — Backend: Resend email channel implementation
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-03] [Backend] Resend email channel — sendEmailNotification() with React Email templates"
read -r -d '' body << 'BODY' || true
## Summary
Implement `sendEmailNotification()` using the Resend SDK. Each `NotificationType` has a corresponding React Email template. Renders template server-side and sends via Resend API.

## Reference
- PRD §12.3 Email Notifications

## Files to create
- `apps/web/src/lib/notifications/channels/email.ts`
- `apps/web/src/emails/BookingConfirmed.tsx`
- `apps/web/src/emails/BookingCancelled.tsx`
- `apps/web/src/emails/BookingReminder.tsx`
- `apps/web/src/emails/NoShowMarked.tsx`
- `apps/web/src/emails/ReviewReceived.tsx`
- `apps/web/src/emails/DisputeResolved.tsx`
- `apps/web/src/emails/base/EmailLayout.tsx`

## Resend client singleton
```typescript
// apps/web/src/lib/resend.ts
import { Resend } from 'resend';
export const resend = new Resend(process.env.RESEND_API_KEY!);
```

## sendEmailNotification()
```typescript
// apps/web/src/lib/notifications/channels/email.ts
import { render } from '@react-email/render';
import { resend } from '@/lib/resend';
import { getEmailTemplate } from './emailTemplates';

export async function sendEmailNotification(payload: NotificationPayload): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { email: true, displayName: true },
  });
  if (!user) return;

  const Template = getEmailTemplate(payload.type);
  if (!Template) return;  // no template for this type (e.g. SYSTEM_ANNOUNCEMENT)

  const html = render(<Template payload={payload} userName={user.displayName} />);

  await resend.emails.send({
    from:    'PitchUp <noreply@pitchup.app>',
    to:      user.email,
    subject: payload.title,
    html,
  });
}

// Template registry
function getEmailTemplate(type: NotificationType): React.FC<EmailTemplateProps> | null {
  const MAP: Partial<Record<NotificationType, React.FC<EmailTemplateProps>>> = {
    BOOKING_CONFIRMED: BookingConfirmedEmail,
    BOOKING_CANCELLED: BookingCancelledEmail,
    BOOKING_REMINDER:  BookingReminderEmail,
    NO_SHOW_MARKED:    NoShowMarkedEmail,
    REVIEW_RECEIVED:   ReviewReceivedEmail,
    DISPUTE_RESOLVED:  DisputeResolvedEmail,
  };
  return MAP[type] ?? null;
}
```

## EmailLayout base template
```tsx
// apps/web/src/emails/base/EmailLayout.tsx
export function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', backgroundColor: '#fff', borderRadius: 8, padding: 24 }}>
          {/* Header */}
          <Img src="https://pitchup.app/logo.png" width={120} height={40} alt="PitchUp" />
          <Hr />
          {children}
          <Hr />
          <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
            PitchUp · <Link href="https://pitchup.app/unsubscribe">Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## BookingConfirmedEmail template (example)
```tsx
// apps/web/src/emails/BookingConfirmed.tsx
export function BookingConfirmedEmail({ payload, userName }: EmailTemplateProps) {
  const { bookingId, pitchName, startTime, totalAmount } = payload.data ?? {};
  return (
    <EmailLayout>
      <Heading>Booking Confirmed ✅</Heading>
      <Text>Hi {userName},</Text>
      <Text>Your booking at <strong>{pitchName}</strong> is confirmed.</Text>
      <Section style={{ background: '#f0fdf4', borderRadius: 8, padding: 16 }}>
        <Text><strong>Date/Time:</strong> {formatEmailDate(startTime)}</Text>
        <Text><strong>Amount paid:</strong> £{(Number(totalAmount) / 100).toFixed(2)}</Text>
      </Section>
      <Button href={`https://pitchup.app/my-bookings/${bookingId}`}>
        View Booking
      </Button>
    </EmailLayout>
  );
}
```

## Environment variables
```
RESEND_API_KEY=re_xxxx
```

## Acceptance Criteria
- [ ] `sendEmailNotification` sends correct template per type
- [ ] 6 email templates created (confirmed, cancelled, reminder, no-show, review, dispute)
- [ ] `EmailLayout` provides consistent header/footer across all templates
- [ ] Types with no template (SYSTEM_ANNOUNCEMENT etc.) → skip silently
- [ ] User not found → return early
- [ ] Resend error → throws (caught by `Promise.allSettled` in dispatcher)

## Edge Cases
- `payload.data` missing fields → template renders gracefully (no crash, shows fallback text)
- Deleted user (anonymised email) → `user.email` is anonymised → Resend will bounce → acceptable

## Definition of Done
- [ ] `email.ts` channel created
- [ ] All 6 templates + base layout created
- [ ] `RESEND_API_KEY` in `.env.example`
- [ ] Storybook / React Email preview works for all templates
BODY

create_issue "$title" "$body" '["backend","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-04 — Backend: Twilio SMS channel + booking reminder cron
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-04] [Backend] Twilio SMS channel + 24h booking reminder cron"
read -r -d '' body << 'BODY' || true
## Summary
Implement `sendSmsNotification()` via Twilio REST SDK. SMS is opt-in only (disabled by default). Also add a Vercel Cron that fires every hour to send 24h pre-booking reminder notifications to players.

## Reference
- PRD §12.4 SMS Notifications

## Files to create
- `apps/web/src/lib/notifications/channels/sms.ts`
- `apps/web/src/app/api/v1/cron/booking-reminders/route.ts`

## sendSmsNotification()
```typescript
// apps/web/src/lib/notifications/channels/sms.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

export async function sendSmsNotification(payload: NotificationPayload): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { phone: true },
  });
  if (!user?.phone) return;  // no phone number → skip silently

  // SMS is short — 160 chars max
  const text = `PitchUp: ${payload.title}. ${payload.body}`.slice(0, 160);

  await client.messages.create({
    body: text,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to:   user.phone,
  });
}
```

## Booking reminder cron
```typescript
// apps/web/src/app/api/v1/cron/booking-reminders/route.ts
// Runs every hour — finds bookings starting in 23–25h window (deduplication via reminderSentAt)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now          = new Date();
  const windowStart  = addHours(now, 23);
  const windowEnd    = addHours(now, 25);

  const bookings = await prisma.booking.findMany({
    where: {
      status:          'CONFIRMED',
      startTime:       { gte: windowStart, lte: windowEnd },
      reminderSentAt:  null,  // not yet reminded
    },
    include: {
      player: { select: { id: true, displayName: true } },
      pitch:  { select: { name: true } },
    },
    take: 200,
  });

  let sent = 0;
  for (const booking of bookings) {
    try {
      await sendNotification({
        userId: booking.playerId,
        type:   'BOOKING_REMINDER',
        title:  'Reminder: booking tomorrow',
        body:   `Your booking at ${booking.pitch.name} starts at ${format(booking.startTime, 'HH:mm')}.`,
        data: {
          screen:    'BookingDetail',
          bookingId: booking.id,
          pitchName: booking.pitch.name,
          startTime: booking.startTime.toISOString(),
        },
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data:  { reminderSentAt: new Date() },
      });
      sent++;
    } catch (err) {
      console.error('[reminders] failed for booking', booking.id, err);
    }
  }

  return NextResponse.json({ sent, total: bookings.length });
}
```

## Schema addition
```prisma
model Booking {
  reminderSentAt DateTime?
}
```

## vercel.json addition
```json
{ "path": "/api/v1/cron/booking-reminders", "schedule": "0 * * * *" }
```

## Environment variables
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+44xxxxxxxxxx
```

## Acceptance Criteria
- [ ] `sendSmsNotification` sends only when `user.phone` set AND `smsEnabled = true`
- [ ] SMS text truncated at 160 chars
- [ ] Reminder cron uses 23–25h window to avoid double-sends across hourly runs
- [ ] `reminderSentAt` set after successful send — idempotent across cron runs
- [ ] Cron processes max 200 per run
- [ ] Cron rejects without `CRON_SECRET`

## Edge Cases
- Booking cancelled after reminder queued → still sends (acceptable, player notified of cancelled booking separately)
- `user.phone` is null → skip silently
- Twilio rate limit → throws → caught by `allSettled`

## Definition of Done
- [ ] `sms.ts` channel created
- [ ] Reminder cron created
- [ ] `Booking.reminderSentAt` migration
- [ ] `vercel.json` updated
- [ ] Env vars in `.env.example`
BODY

create_issue "$title" "$body" '["backend","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-05 — Backend: Wire sendNotification() into all booking lifecycle events
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-05] [Backend] Wire sendNotification() into all booking lifecycle events"
read -r -d '' body << 'BODY' || true
## Summary
Hook `sendNotification()` into every booking state transition. Fire-and-forget (never block the HTTP response). This is the integration ticket — not new infrastructure, just wiring.

## Reference
- PRD §12.5 Notification Triggers
- E13-01 (sendNotification dispatcher)

## Files to modify
| File | Event | Notification |
|------|-------|-------------|
| `apps/web/src/app/api/v1/bookings/route.ts` | POST (booking created, payment captured) | `BOOKING_CONFIRMED` → player |
| `apps/web/src/app/api/v1/bookings/[id]/cancel/route.ts` | POST (player cancel) | `BOOKING_CANCELLED` → player + manager |
| `apps/web/src/app/api/v1/manager/bookings/[id]/no-show/route.ts` | POST | `NO_SHOW_MARKED` → player |
| `apps/web/src/lib/stripe/webhook.ts` | payment_intent.payment_failed | `BOOKING_CANCELLED` → player |
| `apps/web/src/app/api/v1/reviews/route.ts` | POST (review created) | `REVIEW_RECEIVED` → manager |
| `apps/web/src/app/api/v1/admin/disputes/[id]/resolve/route.ts` | PUT | `DISPUTE_RESOLVED` → player + manager |

## Implementation pattern (fire-and-forget)
```typescript
// After successful DB operation, never await:
sendNotification({
  userId: booking.playerId,
  type:   'BOOKING_CONFIRMED',
  title:  'Booking confirmed!',
  body:   `Your slot at ${pitch.name} on ${formatDate(booking.startTime)} is confirmed.`,
  data: {
    screen:    'BookingDetail',
    bookingId: booking.id,
    pitchName: pitch.name,
    startTime: booking.startTime.toISOString(),
    totalAmount: String(booking.totalAmount),
  },
}).catch((err) => console.error('[notify] BOOKING_CONFIRMED failed', booking.id, err.message));
```

## Notification copy for each event
| Type | Title | Body |
|------|-------|------|
| `BOOKING_CONFIRMED` | "Booking confirmed!" | "Your slot at {pitchName} on {date} is confirmed." |
| `BOOKING_CANCELLED` (player) | "Booking cancelled" | "Your booking at {pitchName} has been cancelled. Refund: {refundAmount}." |
| `BOOKING_CANCELLED` (manager) | "Booking cancelled" | "{playerName} cancelled their booking at {pitchName} on {date}." |
| `NO_SHOW_MARKED` | "No-show recorded" | "You were marked as no-show for {pitchName} on {date}. Your trust score decreased." |
| `REVIEW_RECEIVED` | "New review" | "{playerName} left a {rating}★ review for {pitchName}." |
| `DISPUTE_RESOLVED` (player) | "Dispute resolved" | "Your dispute for {pitchName} on {date} has been resolved: {outcome}." |
| `DISPUTE_RESOLVED` (manager) | "Dispute resolved" | "A dispute for {pitchName} on {date} has been resolved: {outcome}." |

## Acceptance Criteria
- [ ] `BOOKING_CONFIRMED` fires after payment captured (not after booking row created)
- [ ] `BOOKING_CANCELLED` fires to both player and manager
- [ ] `NO_SHOW_MARKED` fires to player with trust score warning in body
- [ ] `REVIEW_RECEIVED` fires to manager (not player)
- [ ] `DISPUTE_RESOLVED` fires to both parties
- [ ] All sends are fire-and-forget — API responses never delayed by notification failures

## Edge Cases
- Manager has no account (external booking) → skip manager notification
- `sendNotification` throws → `.catch` logs error, response already sent
- Payment webhook fires multiple times (Stripe retry) → `Notification` table may have duplicate — acceptable (idempotency at Stripe level, E05-08 handles duplicate webhooks)

## Definition of Done
- [ ] All 6 files modified
- [ ] Integration test: booking confirm → Notification row created in DB
- [ ] No HTTP response time increase (confirmed with timing test)
BODY

create_issue "$title" "$body" '["backend","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-06 — Backend: GET/PUT /notifications — in-app notification list + read
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-06] [Backend] GET /notifications + PUT /notifications/read — in-app notification feed"
read -r -d '' body << 'BODY' || true
## Summary
REST endpoints for the in-app notification inbox. Fetch paginated notifications for the authenticated user, mark individual or all as read, and get unread count for badge display.

## Reference
- PRD §12.6 In-App Notification Feed

## Files to create
- `apps/web/src/app/api/v1/notifications/route.ts` — GET (list), PUT (mark all read)
- `apps/web/src/app/api/v1/notifications/[notificationId]/route.ts` — PUT (mark one read)
- `apps/web/src/app/api/v1/notifications/count/route.ts` — GET (unread count)

## GET /notifications
```typescript
// Query: cursor?, limit=20, unreadOnly=false
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  const { cursor, limit, unreadOnly } = NotifQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(unreadOnly && { readAt: null }),
      ...(cursor && { id: { lt: cursor } }),
    },
    orderBy: { createdAt: 'desc' },
    take:    Number(limit) + 1,
  });

  const hasMore = notifications.length > Number(limit);
  if (hasMore) notifications.pop();

  return NextResponse.json({
    data:       notifications,
    nextCursor: hasMore ? notifications.at(-1)!.id : null,
  });
}
```

## PUT /notifications/read (mark all)
```typescript
export async function PUT(req: NextRequest) {
  const user = await requireAuth(req);
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data:  { readAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
```

## PUT /notifications/:id (mark one)
```typescript
export async function PUT(req, { params }) {
  const user = await requireAuth(req);
  await prisma.notification.updateMany({
    where: { id: params.notificationId, userId: user.id },  // userId guard
    data:  { readAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
```

## GET /notifications/count
```typescript
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  const count = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return NextResponse.json({ unread: count });
}
```

## Acceptance Criteria
- [ ] GET returns notifications ordered by `createdAt DESC`
- [ ] `unreadOnly=true` filters to `readAt = null` only
- [ ] Cursor pagination works correctly
- [ ] Mark-one updates only user's own notification (userId guard)
- [ ] Mark-all sets `readAt` for all unread for that user only
- [ ] `/count` returns live unread count

## Edge Cases
- Notification belongs to different user → `updateMany` with `userId: user.id` silently ignores it (no 403 needed)
- 0 notifications → `{ data: [], nextCursor: null }`
- Already read notification marked read again → no-op (idempotent)

## Definition of Done
- [ ] 4 route files created
- [ ] Integration tests for all 4 endpoints
- [ ] Cross-user access prevented by userId guard
BODY

create_issue "$title" "$body" '["backend","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-07 — Backend: GET/PUT /notifications/preferences — notification preferences
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-07] [Backend] GET/PUT /notifications/preferences — per-user notification preferences"
read -r -d '' body << 'BODY' || true
## Summary
Endpoints to read and update a user's notification channel preferences and per-type opt-outs. Used by both mobile notification settings screen (E08-09) and web profile settings.

## Reference
- PRD §12.7 Notification Preferences

## Files to create
- `apps/web/src/app/api/v1/notifications/preferences/route.ts` — GET + PUT

## GET /notifications/preferences
```typescript
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  const prefs = await prisma.notificationPreference.upsert({
    where:  { userId: user.id },
    create: { userId: user.id },  // defaults: push=true, email=true, sms=false
    update: {},
  });
  return NextResponse.json(prefs);
}
```

## PUT /notifications/preferences
```typescript
export const NotifPrefsSchema = z.object({
  pushEnabled:    z.boolean().optional(),
  emailEnabled:   z.boolean().optional(),
  smsEnabled:     z.boolean().optional(),
  disabledTypes:  z.array(z.enum([...NotificationTypeValues])).optional(),
});

export async function PUT(req: NextRequest) {
  const user  = await requireAuth(req);
  const body  = NotifPrefsSchema.parse(await req.json());

  const prefs = await prisma.notificationPreference.upsert({
    where:  { userId: user.id },
    create: { userId: user.id, ...body },
    update: body,
  });
  return NextResponse.json(prefs);
}
```

## Preference fields
| Field | Default | Description |
|-------|---------|-------------|
| `pushEnabled` | true | Master push toggle |
| `emailEnabled` | true | Master email toggle |
| `smsEnabled` | false | Master SMS toggle (opt-in) |
| `disabledTypes` | [] | Array of `NotificationType` values the user muted |

## Validation rules
- Cannot disable ALL channels (must keep at least one enabled) — soft warning on client, not server error
- `disabledTypes` can only contain valid `NotificationType` enum values
- `smsEnabled: true` requires `user.phone` set — if no phone, return 422

## Acceptance Criteria
- [ ] GET returns existing prefs or creates defaults on first call
- [ ] PUT updates only provided fields (partial update)
- [ ] `disabledTypes` replaces array entirely (not append)
- [ ] `smsEnabled: true` without phone → 422 `{ error: 'Phone number required for SMS' }`
- [ ] Upsert: first PUT for new user creates row with provided values + defaults for omitted

## Edge Cases
- Empty `disabledTypes: []` → clears all opt-outs
- Invalid enum value in `disabledTypes` → 400 Zod validation error
- Concurrent PUT requests → last-write-wins (upsert)

## Definition of Done
- [ ] Route file created with GET + PUT handlers
- [ ] `NotifPrefsSchema` in `packages/shared` (reused by mobile)
- [ ] Integration test: SMS enable without phone → 422
BODY

create_issue "$title" "$body" '["backend","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-08 — Mobile: In-app notification inbox screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-08] [Mobile] In-app notification inbox screen + unread badge"
read -r -d '' body << 'BODY' || true
## Summary
Full notification inbox on mobile. Shows paginated list of notifications, marks as read on open, handles deep-link tap navigation. Tab bar icon shows unread badge count.

## Reference
- PRD §12.6
- E08-09 (NotificationsScreen stub — replace with full implementation)
- E08-10 (FCM foreground/background handler — already routes to this screen)

## Files to modify / create
- `apps/mobile/src/screens/shared/NotificationsScreen.tsx` — full implementation
- `apps/mobile/src/components/notifications/NotificationRow.tsx`
- `apps/mobile/src/hooks/useNotifications.ts`
- `apps/mobile/src/hooks/useUnreadCount.ts`

## useNotifications hook
```typescript
export function useNotifications() {
  return useInfiniteQuery({
    queryKey:  ['notifications'],
    queryFn:   ({ pageParam }) => fetchNotifications({ cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}
```

## useUnreadCount hook
```typescript
export function useUnreadCount() {
  return useQuery({
    queryKey:  ['notifications', 'count'],
    queryFn:   fetchUnreadCount,
    refetchInterval: 60_000,  // poll every 60s
    staleTime: 30_000,
  });
}
```

## NotificationRow component
```typescript
const NOTIF_ICONS: Record<NotificationType, { icon: string; color: string }> = {
  BOOKING_CONFIRMED:   { icon: '✅', color: '#16A34A' },
  BOOKING_CANCELLED:   { icon: '✗',  color: '#EF4444' },
  BOOKING_REMINDER:    { icon: '⏰', color: '#F97316' },
  NO_SHOW_MARKED:      { icon: '🚫', color: '#EF4444' },
  PAYMENT_RECEIVED:    { icon: '💳', color: '#16A34A' },
  REVIEW_RECEIVED:     { icon: '⭐', color: '#EAB308' },
  DISPUTE_OPENED:      { icon: '⚖️', color: '#6366F1' },
  DISPUTE_RESOLVED:    { icon: '⚖️', color: '#16A34A' },
  TRUST_TIER_CHANGED:  { icon: '🏅', color: '#F97316' },
  SYSTEM_ANNOUNCEMENT: { icon: '📣', color: '#6366F1' },
};

export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const meta = NOTIF_ICONS[notification.type];
  const isUnread = !notification.readAt;
  return (
    <Pressable
      style={[styles.row, isUnread && styles.unread]}
      onPress={onPress}
    >
      <View style={[styles.iconBadge, { backgroundColor: meta.color + '20' }]}>
        <Text style={styles.iconText}>{meta.icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, isUnread && styles.boldTitle]}>{notification.title}</Text>
        <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        <Text style={styles.time}>{formatRelativeTime(notification.createdAt)}</Text>
      </View>
      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}
```

## Deep-link tap handler
```typescript
// On notification row press:
// 1. Mark as read: PUT /notifications/:id
// 2. Navigate based on notification.data.screen:
const handleNotifPress = async (notif: Notification) => {
  await markNotificationRead(notif.id);
  queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] });

  const { screen, bookingId } = notif.data ?? {};
  if (screen === 'BookingDetail' && bookingId) {
    navigation.navigate('BookingDetail', { bookingId });
  } else if (screen === 'TrustScore') {
    navigation.navigate('TrustScoreDetail');
  } else if (screen === 'MyReviews') {
    navigation.navigate('MyReviews');
  }
};
```

## Tab bar unread badge
```typescript
// In navigation/TabNavigator.tsx — add badge to Notifications tab:
<Tab.Screen
  name="Notifications"
  component={NotificationsScreen}
  options={{
    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
    tabBarBadgeStyle: { backgroundColor: '#EF4444' },
  }}
/>
```

## Screen header actions
- "Mark all read" button → PUT /notifications/read → invalidate queries
- Pull-to-refresh → refetch first page

## Acceptance Criteria
- [ ] Notification list with infinite scroll
- [ ] Unread rows have distinct background (`#F0FDF4` left border 3px primary-600)
- [ ] Tapping marks as read + navigates to correct screen
- [ ] "Mark all read" button works
- [ ] Tab bar badge shows unread count (hidden when 0)
- [ ] Badge updates within 60s via polling
- [ ] Pull-to-refresh works

## Edge Cases
- Empty inbox → "No notifications yet" illustration
- `notification.data` null → no navigation, just mark read
- Badge count > 99 → show "99+"

## Definition of Done
- [ ] Screen fully implemented (replaces E08-09 stub)
- [ ] All 10 notification types have icons
- [ ] Deep-link navigation tested for each screen target
- [ ] Badge count polling working on device
BODY

create_issue "$title" "$body" '["mobile","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-09 — Mobile: Notification preferences screen
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-09] [Mobile] Notification preferences screen"
read -r -d '' body << 'BODY' || true
## Summary
Settings screen where players control which notifications they receive and via which channels. Reads/writes `GET|PUT /notifications/preferences`. Linked from Profile screen settings section.

## Reference
- PRD §12.7
- E08-04 (Profile screen — link to this screen)

## Files to create
- `apps/mobile/src/screens/player/NotificationPreferencesScreen.tsx`
- `apps/mobile/src/hooks/useNotificationPreferences.ts`

## useNotificationPreferences hook
```typescript
export function useNotificationPreferences() {
  const query = useQuery({
    queryKey: ['notification-preferences'],
    queryFn:  fetchNotificationPreferences,
  });
  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });
  return { prefs: query.data, isLoading: query.isLoading, update: mutation.mutate };
}
```

## Screen layout
```
┌───────────────────────────────┐
│ ← Notification Settings       │
├───────────────────────────────┤
│ CHANNELS                      │
│ Push notifications     [●  ]  │
│ Email notifications    [●  ]  │
│ SMS notifications      [  ○]  │  ← disabled; requires phone number
├───────────────────────────────┤
│ NOTIFICATION TYPES            │
│ Booking confirmed      [●  ]  │
│ Booking reminders      [●  ]  │
│ Booking cancelled      [●  ]  │
│ No-show recorded       [●  ]  │
│ New review on pitch    [●  ]  │
│ Dispute updates        [●  ]  │
│ Trust tier changes     [●  ]  │
└───────────────────────────────┘
```

## Implementation
```typescript
// Each toggle calls update() immediately (optimistic)
const handleToggleType = (type: NotificationType) => {
  const current  = prefs?.disabledTypes ?? [];
  const isOff    = current.includes(type);
  const updated  = isOff
    ? current.filter((t) => t !== type)    // re-enable
    : [...current, type];                   // disable
  update({ disabledTypes: updated });
};

const handleToggleChannel = (channel: 'pushEnabled' | 'emailEnabled' | 'smsEnabled') => {
  // SMS requires phone
  if (channel === 'smsEnabled' && !prefs?.smsEnabled && !user.phone) {
    navigation.navigate('EditProfile', { focus: 'phone' });
    return;
  }
  update({ [channel]: !prefs?.[channel] });
};
```

## SMS toggle behaviour
- If `smsEnabled` is off and user has no phone → tapping SMS toggle navigates to Edit Profile with `focus: 'phone'`
- After phone added, user can return and enable SMS

## Acceptance Criteria
- [ ] All 3 channel toggles read from prefs and update correctly
- [ ] Per-type toggles map to `disabledTypes` array
- [ ] SMS toggle without phone → navigates to Edit Profile (does not enable)
- [ ] Toggling updates immediately (optimistic UI)
- [ ] Server error on update → revert to previous state + show toast

## Edge Cases
- No prefs row yet → GET returns defaults (all on except SMS)
- Turning off all types → allowed (server warning only, no hard block)
- Slow network → loading state shows on screen init, toggles disabled during in-flight

## Definition of Done
- [ ] Screen created with all toggles
- [ ] Linked from Profile screen (E08-04)
- [ ] SMS phone-required flow tested
- [ ] Optimistic update + rollback tested
BODY

create_issue "$title" "$body" '["mobile","epic:e13","type:feature"]' "$MILESTONE"

# ─────────────────────────────────────────────────────────────────────────────
# E13-10 — Web: Notification bell + preferences page
# ─────────────────────────────────────────────────────────────────────────────
title="[E13-10] [Web] Notification bell dropdown + /profile/notifications preferences page"
read -r -d '' body << 'BODY' || true
## Summary
Two web notification features:
1. Notification bell in the TopBar (E09-10 layout) — dropdown showing last 5 unread notifications with "Mark all read" and "See all" link
2. `/profile/notifications` page — full notification preferences (channels + per-type toggles)

## Reference
- PRD §12.6–12.7

## Files to create / modify
- `apps/web/src/components/layout/NotificationBell.tsx`
- `apps/web/src/app/(player)/profile/notifications/page.tsx`
- `apps/web/src/app/(manager)/manager/layout.tsx` — add `<NotificationBell>` to TopBar

## NotificationBell component
```tsx
export function NotificationBell() {
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn:  fetchUnreadCount,
    refetchInterval: 30_000,
  });

  const [open, setOpen] = useState(false);
  const unread = countData?.unread ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100"
        aria-label={`Notifications — ${unread} unread`}
      >
        <BellIcon className="h-6 w-6 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          <NotificationDropdown onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
```

## NotificationDropdown (inside bell)
```tsx
// Fetches GET /notifications?limit=5&unreadOnly=false
// Shows last 5 notifications (read + unread)
// Each row: icon, title (bold if unread), relative time
// Footer: [Mark all read] ···· [See all notifications →]
// Clicking a notification: mark read + navigate to /my-bookings/:id or relevant page
// Clicking outside (FocusTrap / useClickOutside) closes dropdown
```

## /profile/notifications page
```tsx
// Same layout as E08-08 profile subpages
// Sections:
// 1. Channels — 3 toggles (push / email / SMS)
//    Note under push: "Manage push on your mobile device via app settings"
//    SMS requires phone — shows link to /profile/edit if missing
// 2. Notification Types — list of 7 toggleable types with descriptions
// 3. Full history link → /profile/notifications/history (future, out of scope)

// Uses <Switch> component (Headless UI) for toggles
// Saves on each toggle change (no Save button needed — immediate PUT)
```

## Notification type rows (web)
| Type | Label | Description |
|------|-------|-------------|
| `BOOKING_CONFIRMED` | Booking confirmed | When your booking is successfully paid |
| `BOOKING_REMINDER` | Booking reminders | 24h before your booking starts |
| `BOOKING_CANCELLED` | Booking cancelled | When a booking is cancelled |
| `NO_SHOW_MARKED` | No-show recorded | When a manager marks you as no-show |
| `REVIEW_RECEIVED` | New reviews | When someone reviews your pitch (managers) |
| `DISPUTE_RESOLVED` | Dispute updates | Resolution of any disputes |
| `TRUST_TIER_CHANGED` | Trust tier changes | When your tier goes up or down |

## Acceptance Criteria
- [ ] Bell shows red badge with unread count (hidden when 0)
- [ ] Dropdown shows last 5 notifications (not unread-only)
- [ ] "Mark all read" in dropdown resets badge to 0
- [ ] "See all" links to `/profile/notifications/history` (stub page for E15+)
- [ ] `/profile/notifications` page has all 3 channel toggles + 7 type toggles
- [ ] Each toggle saves immediately on change
- [ ] SMS without phone → shows inline warning + link to `/profile/edit`
- [ ] Badge polls every 30s

## Edge Cases
- No notifications yet → dropdown shows "You're all caught up 🎉"
- Bell unread count > 99 → "99+"
- Dropdown open on mobile viewport → full-width, positioned below bell

## Definition of Done
- [ ] `NotificationBell` added to manager TopBar and player header
- [ ] Dropdown keyboard navigable (arrow keys, Enter, Escape closes)
- [ ] Preferences page created with all toggles functional
- [ ] Badge polling verified in browser
BODY

create_issue "$title" "$body" '["frontend","web","epic:e13","type:feature"]' "$MILESTONE"

echo ""
echo "✓ E13 — Notifications (10 issues created)"
