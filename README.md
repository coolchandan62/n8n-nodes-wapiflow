# n8n-nodes-wapiflow

[![npm version](https://img.shields.io/npm/v/n8n-nodes-wapiflow.svg)](https://www.npmjs.com/package/n8n-nodes-wapiflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Official n8n community node for [WapiFlow](https://wapiflow.com) — send WhatsApp messages and react to inbound events from your self-hosted WapiFlow installation without writing a line of code.

> **This repo is the scaffold.** V0.1 ships one credential, one action node (Send Text / Send Media / Get Status / Verify Credentials / List Instances) and one trigger node. Additional operations (buttons, lists, polls, contacts, groups, etc.) can be bolted on by following the pattern in `nodes/WapiFlow/WapiFlow.node.ts`.

---

## Installation

### A — n8n Cloud / Desktop UI

1. Open n8n → **Settings → Community Nodes** → **Install**
2. Paste `n8n-nodes-wapiflow` → tick **"I understand the risks"** → **Install**
3. Reload — the **WapiFlow** and **WapiFlow Trigger** nodes appear in the node palette

### B — self-hosted via CLI

```bash
cd ~/.n8n
npm install n8n-nodes-wapiflow
# restart your n8n process
```

---

## Credentials

1. In your WapiFlow dashboard: **Developer → API Keys** → **Generate new key** (bound to one WhatsApp instance)
2. Copy both `api_key` (prefix `wf_live_…`) and `api_secret` — the secret is shown only once
3. In n8n: **Credentials → New → WapiFlow API** and fill:

| Field | Value |
|---|---|
| **Base URL** | `https://wapiflow.yoursite.com` (no trailing `/api/v1`) |
| **API Key** | `wf_live_xxxxxxxxxxxx` |
| **API Secret** | the secret you copied |

4. Click **Test** — n8n hits `/api/v1/me.php`; a green ✓ confirms end-to-end auth.

---

## Nodes

### WapiFlow (action)

| Resource | Operation | What it does |
|---|---|---|
| Message | Send Text | POST a plain-text WhatsApp message |
| Message | Send Media | POST a media message from a public URL with optional caption |
| Message | Get Status | GET delivery status (`queued` / `sent` / `delivered` / `read` / `failed`) by message id |
| Instance | Verify Credentials | GET `/me.php` — confirms the key and returns the bound instance |
| Instance | List | GET `/instances.php` — lists all tenant instances with connection status |

Credentials are injected automatically via the `Authorization: Bearer KEY:SECRET` header. No manual header plumbing.

### WapiFlow Trigger (webhook)

Starts a workflow on inbound WhatsApp events. Node holds a public webhook URL — paste it into **WapiFlow dashboard → Instances → Webhook events**, tick the events you want and save.

Supported events (filtered in-node so you only see what you asked for):

- `MESSAGES_UPSERT` — new message arrived (inbound by default; outbound echoes dropped unless **Inbound Only** is off)
- `MESSAGES_UPDATE` — delivery status change
- `SEND_MESSAGE` — your account sent a message
- `CONNECTION_UPDATE` — WhatsApp connection state change
- `QRCODE_UPDATED` — new QR code available

---

## Local development

### Requirements

- Node.js ≥ 20.15
- npm ≥ 10
- A running local n8n (`npm install -g n8n` → `n8n start`)
- A WapiFlow dev instance reachable from your machine

### Setup

```bash
git clone https://github.com/wapiflow/n8n-nodes-wapiflow.git
cd n8n-nodes-wapiflow

npm install --ignore-scripts   # see note below
npm run build
npm run lint      # should pass clean
```

### Link into n8n

```bash
# In this repo
npm link

# In your local n8n install folder (default: %USERPROFILE%\.n8n on Windows)
cd ~/.n8n/custom      # create the folder if missing
npm init -y           # one-time
npm link n8n-nodes-wapiflow

# Restart n8n
n8n start
```

Open http://localhost:5678 → search the node palette for `WapiFlow` → done.

### Iterating

- `npm run dev` runs `tsc --watch` — edit a `.ts` file, save, restart n8n
- Icon changes need `npm run build` (gulp copies `.svg` into `dist/`)
- Lint before every commit: `npm run lintfix`

### Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails building `isolated-vm` (Windows / no C++ toolchain) | Use `npm install --ignore-scripts`. `isolated-vm` is pulled transitively by `n8n-workflow` but is only needed at n8n runtime, not for building a community node. |
| Credential **Test** returns 401 | Verify the key is not revoked (dashboard → API Keys), secret has no stray whitespace, and the Base URL has NO trailing `/api/v1` |
| Node not showing in palette | `npm run build` finished? `n8n` restarted after `npm link`? Check `~/.n8n/custom/package.json` lists the package |
| Webhook never fires | n8n workflow is **Active**, URL copied is the **Production** URL (not Test), WapiFlow Instance has events ticked AND Save button pressed |

---

## Publishing (maintainers)

### One-time

```bash
npm login
```

### Each release

```bash
# Bump version
npm version patch   # or minor / major

# Build + lint with strict prepublish ruleset
npm run build
npm run lint -c .eslintrc.prepublish.js nodes credentials package.json

# Dry-run to inspect the published tarball
npm pack --dry-run

# Publish
npm publish --access public

# Push tags
git push --follow-tags
```

### Verified badge (for the n8n node palette ✓)

After the first stable release:

1. Open an issue on https://github.com/n8n-io/n8n titled `Verify community node: n8n-nodes-wapiflow`
2. Fill the verification template (security contact, support URL, GitHub repo link, npm package link, screenshots)
3. n8n team reviews code quality + package metadata; approval typically takes 1–2 weeks
4. Once verified, the node is installable from n8n Cloud too (unverified community nodes are self-hosted only)

---

## Roadmap

- [ ] Buttons / List / Poll / Location / Contact send operations
- [ ] Contact resource (find, create, update)
- [ ] Trigger auto-registration via WapiFlow API (no manual webhook URL copy)
- [ ] Group operations (create, participants, info)
- [ ] HMAC signature verification on the trigger webhook (requires WapiFlow V2 webhook publisher)
- [ ] Native **Drip enroll** and **Campaign send** operations

---

## License

MIT — see [LICENSE](LICENSE).

---

## Links

- [WapiFlow](https://wapiflow.com) — the WhatsApp platform
- [WapiFlow docs](https://wapiflow.com/docs)
- [n8n](https://n8n.io) — the workflow automation tool
- [n8n community nodes guide](https://docs.n8n.io/integrations/community-nodes/)
