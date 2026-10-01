# Groundbase MCP Server

[![smithery badge](https://smithery.ai/badge/adam-jsdb/Groundbase)](https://smithery.ai/servers/adam-jsdb/Groundbase)

Connect Claude, Cursor, or any MCP client to [Groundbase](https://groundbasecrm.com), a $9/month CRM for solo operators.

This is a **remote** MCP server. There is nothing to install and nothing to run locally. You point your client at a URL and authenticate.

## What makes it different

Most CRM MCP servers expose records. You can list contacts, create a deal, update a property, log that a call happened. Useful, but your AI can only look and file.

Groundbase exposes **actions**:

- `sms_send_now` and `sms_send_scheduled` dispatch real text messages through your own Twilio account
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
| Protocol version | `2025-06-18` |
| Auth | OAuth 2.1, or a Groundbase API key |
| Tools | 119 |

Health check: [`https://mcp.groundbasecrm.com/health`](https://mcp.groundbasecrm.com/health)

## Requirements

An active Groundbase account. $9/month flat, 14-day trial. SMS and voice require you to connect your own Twilio account, and email requires your own Resend account, so those costs are billed to you directly by those providers with no markup from us.

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

134 tools across:

**Records** — contacts, companies, deals, deal stages, tasks, notes, tags, custom fields, saved views

**Messaging** — SMS (send now, schedule, cancel, read threads, opt-out list), email (send, read threads, several mailboxes), voicemail drops

**Templates** — reusable email and SMS templates, full CRUD, plus merge tags for personalization

**Outreach** — email and SMS campaigns with audience preview and analytics; drips with per-step exit rules; ongoing campaigns that enrol new contacts as they arrive

**Invoicing** — draft, issue, send and void invoices; record and reverse payments; invoice settings, billing profiles and a price list

**Quotes** — draft, issue, send, accept, decline, void and convert quotes to invoices

**Time tracking** — log time, start and stop a timer, list and edit entries

**Automation** — workflows (create, run, pause, resume, run history), inbound and outbound webhooks

**Scheduling** — meeting types for booking links

**Context** — activity feed, dashboard summary, Twilio balance, Resend configuration

Call `tools/list` against the endpoint for the full schema. Each tool carries MCP annotations (read-only, destructive, reaches outside the account), so a client can ask before anything that deletes or sends. Arguments are checked against the schema before anything runs.

## Security

- Every tool call is scoped to the authenticated account. There is no cross-account access.
- Both API keys and OAuth authorizations are listed and revocable at **Settings → AI integrations**. Revoking takes effect on the next request.
- The server holds no CRM data of its own. It authenticates you and forwards each call to the Groundbase API.

## Docs and support

Full documentation: [groundbasecrm.com/mcp](https://groundbasecrm.com/mcp)

Questions, bugs, or a tool you wish existed: open an issue here, or email **mcp@groundbasecrm.com**. Groundbase is built and maintained by one person, so you will be talking to the person who wrote it.

## Note on this repository

This repo is documentation and issue tracking for a hosted service. The server source is not open source. If you are looking for the endpoint, it is at the top of this file.
