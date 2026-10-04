# Groundbase MCP Server

[![smithery badge](https://smithery.ai/badge/adam-jsdb/Groundbase)](https://smithery.ai/servers/adam-jsdb/Groundbase)

Connect Claude, Cursor, or any MCP client to [Groundbase](https://groundbasecrm.com), a $19/month CRM for solo operators.

This is a **remote** MCP server. There is nothing to install and nothing to run locally. You point your client at a URL and authenticate.

## What makes it different

Most CRM MCP servers expose records. You can list contacts, create a deal, update a property, log that a call happened. Useful, but your AI can only look and file.

Groundbase exposes **actions**:

- `sms_send` dispatches real text messages (now or scheduled) through your own Twilio account
- `email_send` sends
- `campaigns_manage` starts a drip that stops for anyone who replies
- `workflows_run_now` fires an automation
- `invoices_send` emails an invoice
- `voicemail_drops_drop` leaves a voicemail

So "text the twelve people who went quiet after a demo" ends with twelve messages sent, not twelve drafts to copy somewhere else.

## Connection details

| | |
|---|---|
| Endpoint | `https://mcp.groundbasecrm.com/mcp` |
| Transport | Streamable HTTP |
| Protocol version | `2025-06-18` (also `2025-03-26`, `2024-11-05`) |
| Auth | OAuth 2.1, or a Groundbase API key |
| Tools | 104 |

Health check: [`https://mcp.groundbasecrm.com/health`](https://mcp.groundbasecrm.com/health)

## Requirements

An active Groundbase account. $19/month flat, 14-day trial. SMS and voice require you to connect your own Twilio account, and email requires your own Resend account, so those costs are billed to you directly by those providers with no markup from us.

## Setup

### Claude Desktop

Settings, then Connectors, then Add custom connector. Use:

```
https://mcp.groundbasecrm.com/mcp
```

You will be taken through an OAuth flow to authorize access to your Groundbase account.

### API key alternative

If your client does not support OAuth, generate a key in Groundbase under **Settings → AI integrations** and send it as a bearer token:

```
Authorization: Bearer gbm_your_key_here
```

### Other clients

Any client that speaks Streamable HTTP works. Configuration differs by client, so check your client's documentation for adding a remote MCP server by URL.

## Tools

104 tools, as `tools/list` returns them to a customer account:

| Area | Tools |
|---|---|
| Contacts, companies, deals | `contacts_list`, `contacts_create`, `contacts_update`, `contacts_delete`, `companies_list`, `companies_create`, `companies_update`, `companies_delete`, `deals_list`, `deals_create`, `deals_update`, `deals_delete`, `deal_stages_list`, `deal_stages_create`, `deal_stages_update` |
| Tasks, notes, addresses | `tasks_list`, `tasks_create`, `tasks_update`, `tasks_delete`, `notes_list`, `notes_create`, `notes_update`, `notes_delete`, `addresses_list`, `addresses_create`, `addresses_update`, `addresses_delete` |
| Tags, custom fields, saved views | `tags_list`, `tags_create`, `tags_update`, `tags_delete`, `tags_apply`, `custom_fields_list`, `custom_fields_create`, `custom_fields_update`, `custom_fields_delete`, `custom_fields_set_value`, `saved_views_list`, `saved_views_create`, `saved_views_delete` |
| SMS | `sms_send` (now or scheduled), `sms_list`, `sms_cancel_scheduled`, `sms_optouts` (list, add, remove) |
| Email | `email_send`, `email_accounts_list`, `email_list_threads`, `email_get_thread`, `email_suppressions_manage` (the do-not-email list: list, add, remove) |
| Templates and merge tags | `templates_list`, `templates_create`, `templates_update`, `templates_delete` (SMS and email), `merge_tags_list` |
| Campaigns and email sending | `campaigns_manage` (create, schedule, send, pause, resume, stop, preview audience, newsletters), `campaigns_analytics` (stats and per-recipient rows), `sending_settings` (daily email send cap), `resend_manage` (status, domains, tracking webhook, test send, disconnect) |
| Invoicing | `invoices_list`, `invoices_save_draft`, `invoices_issue`, `invoices_send`, `invoices_void`, `invoice_payments_record`, `invoice_payments_reverse`, `invoice_items_list`, `invoice_items_save`, `invoice_settings_get`, `invoice_settings_update`, `billing_profiles_list`, `billing_profiles_save` |
| Quotes | `quotes_list`, `quotes_save_draft`, `quotes_issue`, `quotes_send`, `quotes_record_outcome` (accepted or declined), `quotes_convert`, `quotes_void` |
| Time tracking | `time_log`, `time_timer_start`, `time_timer_stop`, `time_list`, `time_update` |
| Forms | `forms_manage` (lead-capture forms: list, templates, get, create, update, delete, submissions) |
| Automation | `workflows_list` (and run history), `workflows_create`, `workflows_update` (including pause and resume), `workflows_delete`, `workflows_run_now`, `inbound_webhooks_manage`, `outbound_webhooks_manage` |
| Scheduling | `meeting_types_list`, `meeting_types_create`, `meeting_types_update`, `meeting_types_delete` |
| Calls and voicemail drops | `calls_list`, `voicemail_drops_list`, `voicemail_drops_create`, `voicemail_drops_update`, `voicemail_drops_delete`, `voicemail_drops_drop` |
| Context | `activity_list`, `dashboard_summary`, `twilio_balance_get` |

**Voiding an invoice with money on it.** `invoices_void` will not void an issued invoice that has payments or credit notes recorded on it: the call fails with `409 INVOICE_HAS_PAYMENTS`. Ask the user, and only after they confirm, call again with `confirm_paid: true`. Voiding never refunds or notifies anyone; the payments stay recorded.

**What is not a tool.** Refunds, credit notes, repeat invoices, merging contacts, importing, and putting logged time on an invoice are done in the Groundbase app, as are connecting Twilio, a mailbox, Resend or Google Calendar, and the subscription.

**Activity feed.** Changes to contacts, companies, deals, tasks, notes, texts, invoices, quotes, payments and time entries write an activity row, as they do from the app; rows are not marked as coming from an AI client. Changes to tags, templates, campaigns, workflows and webhooks, and emails sent with `email_send`, write none.

Older tool names that clients may have saved (for example `contacts_get`, `sms_send_now`, `invoices_create_draft`) still answer calls but are not listed.

Call `tools/list` against the endpoint for the full schema. Each tool carries MCP annotations (read-only, destructive, reaches outside the account), so a client can ask before anything that deletes or sends. Arguments are checked against the schema before anything runs.

## Security

- Every tool call is scoped to the authenticated account. There is no cross-account access.
- Both API keys and OAuth authorizations are listed and revocable at **Settings → AI integrations**. Revoking takes effect on the next request.
- The server holds no CRM data of its own. It authenticates you and forwards each call to the Groundbase API.
- A client can revoke its own token at `https://mcp.groundbasecrm.com/revoke` (RFC 7009).
- Sends are limited per account per hour through an AI connection or API key: 100 texts and emails, 10 campaign launches or bulk sends, 30 manual workflow runs; at most 50 recipients per email and 500 contacts per tag change.

## Docs and support

Full documentation: [groundbasecrm.com/mcp](https://groundbasecrm.com/mcp)

Questions, bugs, or a tool you wish existed: open an issue here, or email **mcp@groundbasecrm.com**. Groundbase is built and maintained by one person, so you will be talking to the person who wrote it.

## Note on this repository

This repo is documentation and issue tracking for a hosted service. The server source is not open source. If you are looking for the endpoint, it is at the top of this file.
