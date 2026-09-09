# CCTV Backend API Reference

Full endpoint catalog for `cctv-api-prod` (`api_server_listen_mode.py`), extracted from
`cctv-api-prod/docs/*.md` and cross-checked against the Flask source where docs looked stale.
This app talks to it through its own nginx's `/api/*` proxy (see `nginx.conf`), so from the
frontend's point of view every path below is called relative (`/api/...`), never against
`cctv.czeros.tech` directly — that avoids CORS entirely.

**Domain note:** the real backend is only ever reachable at `cctv.czeros.tech` (56.68.52.66) — its
nginx is the one server actually proxying to the Flask app on `127.0.0.1:5000`. `api.czeros.tech`
looks like it should be the API domain (and is even hardcoded as the CORS default inside
`api_server_listen_mode.py` itself), but it resolves to the *EV installation VPS* (103.20.240.48),
not this one, and answers from something else there — not this backend. This app's `nginx.conf`
briefly proxied to `api.czeros.tech` by mistake; every status poll during that time returned a
plausible-looking but never-updating `waiting_for_connection`, since whatever answered there never
received the camera's real login. Fixed to proxy to `cctv.czeros.tech`.

Endpoints marked **✅source** were confirmed by reading the actual route in
`api_server_listen_mode.py`; **📄doc** means the shape comes from the docs only (internally
consistent across multiple docs, but not re-verified against code line-by-line).

Only the two endpoints under **Provisioning** are currently used by this app (`src/lib/api/client.ts`
implements the full catalog below regardless, since that was explicitly requested — everything
past Provisioning is dead code today, wired up for whenever a later phase needs it).

---

## Base URL & cross-cutting config

- **Base URL:** `https://cctv.czeros.tech` (no version prefix) — reached via this app's own nginx
  proxy. See the domain note above — `api.czeros.tech` does not reach this backend.
- **Ports:** Flask API on `127.0.0.1:5000` behind nginx; a separate TCP listen server on `20000`
  is where cameras register — unrelated to this HTTP API
- **CORS** (✅source, `api_server_listen_mode.py:104-155`): `CORS_MODE` env var — `restricted`
  (default, allow-list is hardcoded to `https://api.czeros.tech` — a stale placeholder in the
  backend source itself, unrelated to this app since it never calls the API directly from the
  browser — unless `ALLOWED_ORIGINS` is set),
  `discover` (logs + allows everything, for finding client origins), `permissive` (allows all —
  not for production)
- **Rate limits:** `admin_login` 5/60s · `admin_sync_device_time` 10/300s ·
  `admin_get_device`/`admin_list_cameras` 30/60s · `admin_get_storage` 20/60s ·
  `get_device_status` 120/60s · client token endpoints 100-200/60s · most admin endpoints 50/60s ·
  stream/consumer endpoints generally unlimited

## Auth types

| Header | Who uses it |
|---|---|
| *(none)* | Public endpoints |
| `X-Client-Key` | The client app |
| `X-Admin-Key` | Admin/supplier tooling |
| `X-Stream-Token` (header or `?token=`) | Per-user, per-camera streaming |

---

## Device Registration & Owner Approval (public)

**`POST /api/device/register_credentials`**
Body: `{ serial, user_id }` → `200` if auto-approved (first/existing owner) with
`{ token, username: "cctv_admin", password: "cctv@2025", success }`, or `202` if pending
approval with `{ request_id, status: "pending" }`. Max 5 owners per device.

**`GET /api/device/<serial>/request/status?user_id=`**
Primary owner gets `{ pending_requests_count }`; regular user gets
`{ request_id, status: "pending" | "approved" | "rejected" | "no_request" }`.

**`POST /api/device/request/<request_id>/approve`** — body `{ user_id }` (must be primary owner)
**`POST /api/device/request/<request_id>/reject`** — body `{ user_id }`

## Device Info & Status

**`GET /api/devices`** — no auth. Array of `{ ip, port, status, channels, serial, has_credentials, connected, stream_url }`.

**`GET /api/device/<serial>/status`** ✅source — auth is `X-Client-Key` **or** `X-Admin-Key`
(docs say client-key only — source uses `require_client_or_admin_key`). Rate limit 120/60s.

```json
{
  "serial": "BL08809RAG33B84",
  "status": "connected",
  "status_description": "Camera is online and successfully logged in.",
  "status_updated_at": "2026-03-05T09:00:19",
  "connected": true,
  "ip": "121.121.9.61",
  "port": 59662,
  "channels": 1,
  "stream_url": "/api/stream/BL08809RAG33B84?format=flv",
  "status_history": []
}
```

Status enum: `registered` `waiting_for_connection` `logging_in` `connected` `disconnected`
`login_failed` `password_error` `serial_mismatch` `waiting_for_credentials` `reset` `offline`
`connection_timeout` `unknown`. `404` with `{ error: "device_not_found" }` if the serial has never
called Provisioning and never registered.

**`POST /api/device/<serial>/reconnect`** ✅source — **no auth in current code** despite being
admin-shaped. Forces re-login.

**`GET /api/license-info`** ✅source — no auth, static SDK licensing info, no secrets.

## Provisioning — used by this app

**`POST /api/device/<serial>/provisioning/wifi-configured`** ✅source — auth is `X-Client-Key`
**or** `X-Admin-Key` (`@require_client_or_admin_key` in `api_server_listen_mode.py`; the docs this
was originally extracted from said client-key-only, which was wrong). Body (optional):
`{ user_id?, note? }`. Call right after BLE WiFi config succeeds. Starts a 5-minute
`waiting_for_connection` window on the status endpoint.

```json
{ "success": true, "serial": "...", "status": "waiting_for_connection",
  "status_description": "...", "message": "..." }
```

`500` with `{ error: "provisioning_error", message }` on failure. Can be called again to restart
the window (e.g. after fixing WiFi credentials).

## Device Control ⚠️ no auth in current code

**`POST /api/device/<serial>/reset`** ✅source — **no auth decorator**, despite docs claiming a
stream token is required. Body `{ factory_reset?: boolean (default true), confirm: true }`.
Destructive.

**`POST /api/device/<serial>/restart`** ✅source — **no auth decorator**. Body `{ confirm: true }`.
Soft reboot only.

**`DELETE /api/device/<serial>/user/<user_id>`** 📄doc — stream-token gated per the function
index; cascades ownership if the primary owner is removed.

## Storage & Recordings (stream-token gated, 📄doc)

**`GET /api/device/<serial>/storage`** — SD card/storage info.
**`POST /api/device/<serial>/storage/format`** — primary-owner-only. Body
`{ storage_device?, file_system?, confirm: true }`. Destructive, irreversible.
**`GET /api/device/<serial>/recordings?channel=&start_time=&end_time=&type=`**
**`GET /api/device/<serial>/playback`** — binary video stream.

## WiFi Config ⚠️ no auth in current code

**`GET /api/device/<serial>/wifi`** ✅source — **no auth decorator at all.** Returns
`[{ ssid, enabled, connected, encryption_mode, key_type, password_set }]` — never the actual
password.

**`POST /api/device/<serial>/wifi`** ✅source — **no auth decorator at all.** Body
`{ ssid (≤35 chars), password (≤127 chars), encryption? }`.

## Streaming

**`GET /api/stream/<stream_id>?format=&channel=&stream_type=&device_id=&token=`** 📄doc —
`X-Stream-Token`. Binary FLV/TS/raw.
**`GET /api/stream/<stream_id>/diagnostics`** ✅source — stream token.
**`POST`/`DELETE /api/stream/<stream_id>/stop`** 📄doc — stream token.
**`POST /api/stream/token`** 📄doc — `X-Client-Key`. Body `{ user_id, device_serial, expires_days? }`.

## Client Token Management (`X-Client-Key`)

`GET /api/tokens?user_id=|device_serial=` · `GET /api/tokens/<user_id>` ·
`POST /api/tokens/<user_id>/regenerate` · `POST`/`DELETE /api/tokens/<token>/revoke`

## Admin — Auth ✅source

**`POST /api/admin/auth/login`** — no key needed (this is how you get one). Body
`{ username, password }` → `{ success, username, role, admin_key }`. **Returns the raw admin API
key in the response body** — treat this response as sensitive, don't log it. Brute-force lockout,
5 req/min, bcrypt with legacy SHA-256 migration.

**`POST /api/admin/auth/logout`** — client-side no-op.

## Admin — Users CRUD (`X-Admin-Key`) ✅source

`GET /api/admin/users` · `POST /api/admin/users` (`{ username, password, role: "admin"|"operator" }`) ·
`PUT /api/admin/users/<username>` (partial: password/role/is_active) ·
`DELETE /api/admin/users/<username>`

## Admin — Device Management (`X-Admin-Key`)

**`POST /api/admin/device/<serial>/reset`** 📄doc
**`POST /api/admin/device/<serial>/sync-time`** ✅source — pushes current Malaysia time via the
SDK's `SetDevConfig(TIMECFG)`. Rate limit 10/300s.
**`GET /api/admin/device/<serial>`** ✅source — status, IP/port, `admin_stream_url`, DB-sourced
`model`/`firmware_version`/`last_seen`, plus live WiFi SSID/connection state read straight off
the device over the SDK.
**`GET /api/admin/device/<serial>/storage`**, **`/recordings`**, **`/playback`** 📄doc — admin
mirrors of the client versions.
**`GET /api/admin/cameras`** ✅source — merged, deduped list from the `devices` table,
`device_credentials` table, and in-memory `registered_devices`; each entry carries an
`admin_stream_url` with a per-device UUID.
**`GET /api/admin/stream/<stream_uuid>`** 📄doc

## Admin — Tokens & Client Key (`X-Admin-Key`)

`GET /api/admin/tokens` (masked) · `GET /api/admin/tokens/<user_id>` ·
`GET /api/admin/tokens/device/<device_serial>` · `POST`/`DELETE /api/admin/tokens/<token_id>/revoke` ·
`POST /api/admin/client-key/initialize` · `GET /api/admin/client-key` (metadata only, never the key) ·
`POST /api/admin/client-key/rotate`
