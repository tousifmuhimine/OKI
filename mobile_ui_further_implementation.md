# Existing-Database Lead Platform Plan

Meta integration is paused for now. The product should focus on lead management, email-first customer follow-up, and order creation while using the existing database schema.

## Current Constraint

For this phase, do not add migrations or new tables.

Use the existing lead fields:

- Company name
- Contact person
- Source
- Status
- Assigned user
- Converted customer id
- Created and updated timestamps

Because the current lead table does not have dedicated fields for email, phone, notes, follow-up date, or status history, those features should be represented in the UI as planned workflow areas but not stored until a later schema phase.

## What Lead Management Does

Lead management is the workflow for handling a potential customer before they become a real customer.

A lead is someone who has shown interest but has not been qualified or converted yet. In this CRM, lead management should help the team answer:

- Who is interested?
- Where did they come from?
- What do they want?
- Who owns the follow-up?
- What is the next action?
- Did we reply by email?
- Should this become a customer?
- Did this lead produce an order or revenue?

The practical flow is:

1. Capture the lead from a manual form, website/API form, import, or inbound email.
2. Qualify the lead by status, source, notes, contact details, and owner.
3. Follow up by email from the CRM.
4. Track every email, note, status change, and next action.
5. Convert the lead into a customer when they are qualified.
6. Create orders or opportunities from the converted customer.
7. Measure which sources and follow-up actions produce customers and revenue.

## Current Channel Strategy

- Active channel: email.
- Paused channels: Facebook, Instagram, WhatsApp, and other Meta-related flows.
- Email should become the core communication layer for leads, customers, and inbox conversations.

## Priority 1: Lead Management

### Lead Detail

- Create a lead detail page.
- Show company name, contact person, source, status, owner, and created date.
- Show linked customer if the lead has been converted.
- Add quick actions: update status and convert to customer.
- Show email, notes, and follow-up areas as future-ready states until the schema supports them.

### Lead Status Workflow

Recommended statuses:

- New
- Contacted
- Qualified
- Proposal
- Won
- Lost

Core behavior:

- Status can be changed from the list, detail page, or pipeline board.
- Status changes should be timestamped.
- Lost leads can be marked by status only in this phase.
- Won leads should be created through the conversion action.

### Lead Pipeline Board

- Add board columns grouped by status.
- Lead cards should show company, contact, source, and updated date.
- Status changes happen through the lead detail panel in this phase.
- Clicking a card opens the lead detail.
- Add filters for source, owner, status, and stale follow-up.

### Lead Capture

- Add an internal create-lead form.
- Add a public/API lead capture endpoint for website forms.
- Capture source, company, and contact person using the existing lead table.
- Email, phone, message metadata, and duplicate checks require a later schema phase.

### Lead Conversion

- Add a convert action from lead detail.
- Conversion should create a customer or link to an existing customer.
- Preserve the lead source and contact information available in the existing schema.
- Store `converted_customer_id` on the lead.
- Change status to Won after successful conversion.
- Let the user create an order after conversion.

### Email Follow-Up

- Keep this planned but limited until leads have a dedicated email field or a lead-to-contact link.
- For now, show the email follow-up action as unavailable when no email is stored.
- Later, send email directly from the lead detail page.
- Later, store sent emails in the inbox conversation for that lead/contact.
- Later, show inbound email replies connected to the lead contact.
- Add saved reply templates for common follow-ups.
- Add email send states: pending, sent, failed, retry.

### Follow-Up Reminders

- Add `next_follow_up_at` on leads.
- Add dashboard/list filters for overdue follow-ups.
- Show follow-up reminders on lead cards and detail pages.
- Optional later: email or browser notifications for due follow-ups.

### Lead Analytics

- Track leads by source.
- Track conversion rate by source.
- Track average time from new lead to first email.
- Track average time from new lead to conversion.
- Track won/lost counts and value after orders are connected.

## Priority 2: Email Inbox Improvements

- Improve email thread grouping by message id and references.
- Add search across sender, subject, body, and contact.
- Add conversation status: open, pending, resolved, snoozed.
- Add conversation assignment to team members.
- Add internal notes on email conversations.
- Add saved replies.
- Add attachment display and download.
- Add near-realtime refresh through polling first, then SSE/WebSocket later if needed.

## Priority 3: Customers

- Add customer detail page.
- Show linked leads, inbox conversations, notes, orders, and activity timeline.
- Add filters by region, stage, owner, tags, and last contact date.
- Add duplicate detection and merge flow.
- Add bulk actions for stage, tags, owner, and export.

## Priority 4: Orders And Products

- Add product catalog CRUD.
- Add order detail page.
- Add order creation from customer or converted lead.
- Add editable line items, totals, payment status, and order status.
- Add printable/exportable order summary.
- Add product and order analytics.

## Priority 5: Dashboard And Reporting

- Show lead counts by status.
- Show overdue follow-ups.
- Show email response activity.
- Show lead conversion rate.
- Show customer growth and order revenue.
- Add date range filters.

## Backend Changes Needed

- Add lead detail, update, convert, and analytics endpoints using the existing lead and customer tables.
- Convert a lead by creating a customer and writing `converted_customer_id`.
- Use lead status for pipeline workflow.
- Add tests for lead creation, update, conversion, and analytics.
- Later schema phase: add notes, email, phone, lost reason, next follow-up date, and status history.

## Frontend Changes Needed

- Upgrade `frontend/app/leads/page.tsx` into list plus pipeline views.
- Add lead detail page or detail side panel.
- Add forms/actions for create, status update, and conversion.
- Add analytics widgets for lead source and conversion.
- Connect email actions to the existing inbox/email APIs.

## Suggested Build Order

1. Lead backend endpoints using the existing schema.
2. Lead list improvements and lead detail page.
3. Lead status workflow and pipeline board.
4. Lead conversion to customer.
5. Lead analytics.
6. Customer and order follow-through.
7. Later schema phase for email, notes, reminders, and history.
