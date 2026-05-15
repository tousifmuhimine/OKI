# Client Updates & Feedback

Received on: 2026-05-14

## Raw Feedback
```text
conversation history. call inboud and outbound, followup message option on the profile, setting priority, if getting direct instruction edit directly, follow up lead due, untouched lead, categorizing lead for organizing lead, adding new conversation panel on individual platform.
```

## Breakdown & Analysis

1. **Conversation History**
   - **Requirement**: Display the full conversation history clearly, likely on the customer/lead profile page.
   - **Current Status**: Backend has `conversations` and `messages` tables, but the UI needs a dedicated view on the profile.

2. **Call Inbound and Outbound**
   - **Requirement**: Ability to log or initiate inbound and outbound calls directly from the CRM.
   - **Actionable**: Add a "Log a Call" feature (with notes/duration) or integrate a dialer.

3. **Follow-up Message Option on the Profile**
   - **Requirement**: A direct way to send a follow-up message to the customer from their profile page, without navigating to a separate inbox.

4. **Setting Priority**
   - **Requirement**: Explicit priority setting (e.g., High, Medium, Low / Hot, Warm, Cold) for leads.
   - **Actionable**: Add a `priority` column to the `leads` table and a selector in the UI.

5. **If Getting Direct Instruction Edit Directly**
   - **Requirement**: Inline editing capabilities or an easy way to apply direct instructions/updates to a lead or AI.
   - **Actionable**: Ensure all lead fields are editable inline on the profile/dashboard.

6. **Follow up Lead Due**
   - **Requirement**: Due dates or reminders for following up with specific leads.
   - **Actionable**: Connect leads to the task/calendar system with a "Next Follow-up" date field.

7. **Untouched Lead**
   - **Requirement**: A filter, view, or status indicating leads that have been created but have no recorded interactions.
   - **Actionable**: Add an `untouched` boolean or compute it based on the absence of messages/calls. Add a dashboard metric/filter.

8. **Categorizing Lead for Organizing Lead**
   - **Requirement**: Tags, categories, or folders to better organize leads beyond simple stages.
   - **Actionable**: Implement a tagging system or lead categories.

9. **Adding New Conversation Panel on Individual Platform**
   - **Requirement**: Platform-specific conversation panels (e.g., a specific view for Messenger chats, another for WhatsApp).
   - **Actionable**: Update the inbox UI to filter or separate conversations by their source platform.
