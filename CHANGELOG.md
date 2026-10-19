# Changelog

All notable changes to `n8n-nodes-wapiflow` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Message resource: buttons, lists, polls, contact card, location, reactions
- Instance resource: QR fetch, logout, restart
- New Contact and Group resources
- Drip resource: enroll contact
- Campaign resource: send
- Trigger: auto-register webhook with WapiFlow via REST API (currently manual URL paste)
- Trigger: HMAC signature verification on incoming webhooks

## [0.1.0] — 2026-10-20

Initial release.

### Added
- `WapiFlowApi` credential class with Base URL + API Key + API Secret and `/me.php` test endpoint
- `WapiFlow` action node (declarative routing API)
  - **Message** resource: Send Text, Send Media (URL-based), Get Status
  - **Instance** resource: Verify Credentials, List
- `WapiFlowTrigger` webhook node
  - Supported events: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `SEND_MESSAGE`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`
  - In-process event filter (user picks which event types trigger the workflow)
  - `inboundOnly` toggle to drop `fromMe=true` echoes
- Full documentation: install, credential setup, local development, publishing, verified-badge process
- MIT license
