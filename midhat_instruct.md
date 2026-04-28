# Midhat Immediate Instructions

This file lists what should be done before moving into the broader `CHATWOOT_NEXT_STEPS.md` roadmap.

Mail is already integrated separately and should not be treated as pending here.

## Goal Before Chatwoot Next Steps

Before starting the larger Chatwoot-style feature roadmap, verify that the existing foundation is stable:

- Auth works.
- Core CRM pages fetch data.
- Channel settings can save credentials.
- Mail works as its own workspace.
- Facebook, WhatsApp, and Instagram setup values are understood.
- Current webhook placeholders are tested with real provider payloads or sample payloads.

## 1. Stabilize Local Development

- Confirm backend runs on `http://localhost:8000`.
- Confirm frontend runs on either:
  - `http://localhost:3000`
  - `http://localhost:3001`
  - the network URL shown by Next dev
- Confirm CORS works from the actual browser origin.
- Confirm frontend `.env.local` has:
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Confirm backend `.env` has:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_DB_URL`
  - `CHANNEL_CONFIG_SECRET` if using a separate encryption secret
  - `META_WEBHOOK_VERIFY_TOKEN`

## 2. Verify Auth And API Access

- Log out fully.
- Log in again with Supabase credentials.
- Visit:
  - `/dashboard`
  - `/customers`
  - `/leads`
  - `/orders`
  - `/dashboard/settings/channels`
- Confirm no page shows `Failed to fetch`.
- Confirm no API request returns `401 Invalid auth token`.
- If auth breaks, clear browser storage/cookies and log in again.

## 3. Verify Mail Is Complete Enough

Mail is already integrated, but it should be smoke-tested before moving on.

- Open `/dashboard/settings/channels`.
- Add an email channel with SMTP and IMAP details.
- Open `/dashboard/mail`.
- Click Sync.
- Confirm incoming email threads appear.
- Open one email thread.
- Send a reply.
- Compose a new email.
- Confirm the new email creates/opens a thread.
- Confirm Mail remains separate from Talk.

## 4. Prepare A Public Webhook URL

Meta cannot send webhooks to `localhost`.

Before testing Facebook, WhatsApp, or Instagram webhooks, create a public HTTPS tunnel to the backend.

Examples:

```bash
ngrok http 8000
```

or use Cloudflare Tunnel.

The public webhook base should point to the backend, for example:

```text
https://your-tunnel-url.ngrok-free.app/api/v1/inbox/webhooks/facebook
https://your-tunnel-url.ngrok-free.app/api/v1/inbox/webhooks/whatsapp
```

## 5. Verify Facebook Setup Values

Before full Facebook ingestion work:

- Create or open the Meta developer app.
- Add Messenger/Facebook messaging product if needed.
- Create or choose a Facebook Page you control.
- Generate a Page access token.
- Get the Page ID.
- Add the Facebook channel in OKI Settings with:
  - `page_access_token`
  - `page_id`
- Configure webhook callback URL:
  - `/api/v1/inbox/webhooks/facebook`
- Use `META_WEBHOOK_VERIFY_TOKEN` from backend `.env` as the verify token.
- Subscribe to message-related webhook fields.
- Send a test message to the Page.
- Confirm the backend receives the webhook.

Expected current behavior:

- The webhook should be acknowledged.
- Full message ingestion is not complete yet.

## 6. Verify WhatsApp Setup Values

Before full WhatsApp ingestion work:

- Use Meta WhatsApp Cloud API test resources.
- Collect:
  - temporary or permanent API token
  - phone number ID
  - WhatsApp Business Account ID
- Add the WhatsApp channel in OKI Settings with:
  - `api_token`
  - `phone_number_id`
  - `business_account_id`
- Configure webhook callback URL:
  - `/api/v1/inbox/webhooks/whatsapp`
- Subscribe to WhatsApp message webhook fields.
- Send a message to the test number from an approved recipient number.
- Confirm the backend receives the webhook.

Expected current behavior:

- The webhook should be acknowledged.
- Full message ingestion is not complete yet.

## 7. Verify Instagram Setup Values

Instagram is usually the hardest Meta channel to test.

Before full Instagram ingestion work:

- Use an Instagram Business account, not a personal account.
- Link the Instagram Business account to a Facebook Page.
- Ensure the Page and Instagram account are in the same Meta Business setup.
- Enable message access in Instagram settings if required.
- Confirm the Meta app has the needed Instagram messaging permissions or test-role access.
- Add the Instagram channel in OKI Settings.
- Confirm whether the current form fields are enough.

Likely needed form improvement:

- Instagram probably needs more explicit fields than the current simple Page token/Page ID setup.
- Add fields for Instagram business account ID and any provider-specific config discovered during testing.

Expected current behavior:

- The current backend has an Instagram adapter file.
- Full Instagram webhook ingestion is not complete yet.

## 8. Capture Real Webhook Payloads

Before implementing parser logic, save sample payloads from each provider.

Create local sample files later if needed:

- `backend/app/inbox/samples/facebook_message.json`
- `backend/app/inbox/samples/whatsapp_message.json`
- `backend/app/inbox/samples/instagram_message.json`

Each sample should include:

- sender ID / phone / provider user ID
- recipient page or phone ID
- message text
- provider message ID
- timestamp
- raw payload

These samples will make parser development much safer.

## 9. Add Minimal Provider Ingestion

Only after webhook payloads are known:

- Parse inbound Facebook messages.
- Parse inbound WhatsApp messages.
- Parse inbound Instagram messages.
- Upsert contact.
- Upsert conversation.
- Insert incoming message.
- Store provider IDs in `message_metadata`.
- Avoid duplicate messages by provider message ID.

This is the bridge between the current foundation and `CHATWOOT_NEXT_STEPS.md`.

## 10. Then Move To CHATWOOT_NEXT_STEPS.md

After the above is verified, continue with `CHATWOOT_NEXT_STEPS.md`.

That file is for larger product work such as:

- complete webhook ingestion
- delivery/read status
- retries
- background workers
- realtime updates
- labels
- assignees
- private notes
- attachments
- website live chat
- broader test coverage
