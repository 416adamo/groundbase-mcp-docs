# Groundbase MCP Server

Connect Claude, Cursor, or any MCP client to [Groundbase](https://groundbasecrm.com), a $19/month CRM for solo operators.

This is a **remote** MCP server. Most clients point at a URL and authenticate, with nothing to install or run. For a client that can only start a local process, this repo also holds a small local bridge to the same server: see [Run it locally](#run-it-locally-stdio).

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
| Tools | 59 |

Health check: [`https://mcp.groundbasecrm.com/health`](https://mcp.groundbasecrm.com/health)

## Requirements

An active Groundbase account. $19/month flat (or $199/year), 14-day free trial with no card needed. SMS and voice require you to connect your own Twilio account, and email requires your own Resend account, so those costs are billed to you directly by those providers with no markup from us.

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

### Run it locally (stdio)

Some MCP clients cannot connect to a remote server: they start a program on your computer and talk to it over stdin and stdout. For those, [`server.mjs`](server.mjs) in this repo is a local bridge. It speaks MCP on stdio and passes every tool call to the hosted server above with your API key. It has no dependencies (Node 18 or newer), stores nothing, and contacts nothing but `mcp.groundbasecrm.com`.

1. Create a key in Groundbase under **Settings → AI integrations**.
2. Clone this repo.
3. Add it to your client's configuration:

```json
{
  "mcpServers": {
    "groundbase": {
      "command": "node",
      "args": ["/path/to/groundbase-mcp-docs/server.mjs"],
      "env": { "GROUNDBASE_API_KEY": "gbm_your_key_here" }
    }
  }
}
```

Or with Docker:

```
docker build -t groundbase-mcp .
docker run -i --rm -e GROUNDBASE_API_KEY=gbm_your_key_here groundbase-mcp
```

With a key set, the tool list and every result come from the hosted server, so they are always current. With no key the bridge still starts and lists the tools from [`tools.json`](tools.json), a copy of what `tools/list` returns to a customer account, and every tool call answers that no key is set. That is what a directory's automated check sees; it is not a way to use Groundbase without an account.

`node test.mjs` runs the bridge's own checks.

## Tools

60 tools, as `tools/list` returns them to a customer account. Each area has a read tool and a `_manage` tool whose `action` says what to do; sending, booking, dropping a voicemail and running a workflow are tools of their own, so a client can tell them apart.

| Area | Tools |
|---|---|
| Contacts, companies, deals | `contacts_list` (filters: tag, company, unsubscribed, sort; `deleted`; `duplicates`), `contacts_manage` (create, update, delete, merge, restore, bulk_update), `companies_list`, `companies_manage` (create, update, delete, restore), `deals_list`, `deals_manage` (create, update, delete, restore), `deal_stages_list`, `deal_stages_manage` (create, update, delete) |
| Tasks, notes, addresses | `tasks_list`, `tasks_manage` (create, update, delete), `notes_list`, `notes_manage`, `addresses_manage` (list, create, update, delete) |
| Tags, custom fields, saved views | `tags_list`, `tags_manage` (create, update, delete, apply), `custom_fields_list` (and merge tags), `custom_fields_manage` (create, update, delete, set_value), `saved_views_list`, `saved_views_manage` (create, update, delete) |
| SMS | `sms_send`, `sms_list` (by phone or contact; scheduled), `sms_manage` (cancel_scheduled, delete_thread) |
| Email | `email_send`, `email_draft_save` (leaves an email in Drafts for the user to review and send; sends nothing), `email_read` (threads, thread, accounts), `email_thread_update` (read / unread, folder) |
| Do-not-contact lists | `suppressions_manage` (channel email or sms: list, add, remove) |
| Templates | `templates_list`, `templates_manage` |
| Campaigns and sending | `campaigns_manage`, `campaigns_analytics`, `sending_settings`, `resend_manage` |
| Invoicing | `invoices_list` (by customer, status, text; payments, credit notes, repeat schedule), `invoices_manage` (save_draft, issue, send, void, public_link, credit_note, send_credit_note, void_credit_note, recurring), `invoice_payments_manage` (record, reverse), `invoice_items_manage`, `billing_profiles_manage`, `invoice_settings` |
| Quotes | `quotes_list`, `quotes_manage` (save_draft, issue, send, record_outcome, convert, void, public_link) |
| Time tracking | `time_list`, `time_manage` (start, stop, log, update, delete, bill, unbill) |
| Documents | `documents_manage` (list, get, templates, send, remind, void) |
| Forms | `forms_manage` |
| Scheduling | `meeting_types_list`, `meeting_types_manage` (create, update, delete), `meetings_book` (slots, book) |
| Automation | `workflows_list`, `workflows_manage` (create, update, delete), `workflows_run_now`, `inbound_webhooks_manage`, `outbound_webhooks_manage` |
| Calls and voicemail drops | `calls_list`, `phone_status` (numbers and Twilio balance), `voicemail_drops_list`, `voicemail_drops_manage` (create, update, delete), `voicemail_drops_drop` |
| Context | `activity_list`, `dashboard_summary` (and the pipeline) |

**Voiding an invoice with money on it.** `invoices_void` will not void an issued invoice that has payments or credit notes recorded on it: the call fails with `409 INVOICE_HAS_PAYMENTS`. Ask the user, and only after they confirm, call again with `confirm_paid: true`. Voiding never refunds or notifies anyone; the payments stay recorded.

**What is not a tool.** Card refunds and importing are done in the Groundbase app, as are connecting Twilio, a mailbox, Resend or Google Calendar, changing the Resend connection (`resend_manage` reads its status and domains only), and the subscription. Credit notes, repeat invoices, merging contacts and putting logged time on an invoice are tools (see the table above).

**Activity feed.** Changes to contacts, companies, deals, tasks, notes, texts, invoices, quotes, payments and time entries write an activity row, as they do from the app; rows are not marked as coming from an AI client. Changes to tags, templates, campaigns, workflows and webhooks, and emails sent with `email_send`, write none.

Every older tool name (for example `contacts_create`, `invoices_send`, `time_timer_start`, `contacts_get`) still answers calls with the same arguments; it is no longer listed.

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

This repo is documentation and issue tracking for a hosted service, plus the local bridge described above (`server.mjs`, `tools.json`, `Dockerfile`). The files in this repo are under the [MIT License](LICENSE). The hosted server's own source is not open source and is not covered by it. If you are looking for the endpoint, it is at the top of this file.
