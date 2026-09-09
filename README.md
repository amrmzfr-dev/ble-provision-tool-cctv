# Perodua Charger CCTV — BLE Pairing Tool

Web app to pair **the Perodua EV charger's CCTV camera** (Dahua hardware) over Bluetooth (BLE) and
send it WiFi credentials, without needing the native Android app or any app store publishing. This
is scoped to that one specific camera/product, not a general BLE-device tool — the whole point is
replacing the one native Android flow this product already used.

Full plan, recovered protocol, and phase breakdown:
`C:\Users\ASUS\.claude\plans\vectorized-rolling-cascade.md`

Full backend API surface (all endpoints, not just the two this app calls): `API_REFERENCE.md`.
Typed client for all of it lives in `src/lib/api/` — `getDeviceStatus` and `postWifiConfigured`
are the only two actually wired into the app so far (Phase 5); everything else is there for later.

The camera's serial number is **required**, not optional — the backend API identifies devices by
serial (`/api/device/<serial>/...`), so the app requires scanning the QR sticker on the camera (or
typing the serial in) as step 1, before it will search for the device over Bluetooth at all.

## Status

- [x] Phase 1 — scaffold + discovery: scan the camera's serial QR code (required), then find it
      over Bluetooth via one of three scan-filter modes, with a match/mismatch check against the
      scanned serial once found
- [x] Phase 2 — GATT transport (`src/lib/ble/transport.ts`) + frame fragmentation/reassembly
      (`src/lib/ble/framing.ts`), unit-tested
- [x] Phase 3 — RSA/AES handshake (`src/lib/ble/crypto.ts`), read serial number + security code,
      unit-tested. **Unconfirmed against real hardware:** the SN/SC response parsing
      (`parseSnOrScResponse` in `payloads.ts`) guesses between two readings of an ambiguous note in
      the decompiled SDK — it'll self-correct once tested, but watch this first.
- [x] Phase 4 — send WiFi credentials, read join result (`PairingScreen.tsx` runs the whole
      handshake live with per-step progress)
- [x] Phase 5 — call the backend provisioning API, poll status (`BackendHandoffScreen.tsx`,
      `PairingScreen.tsx`). See "wifi-configured timing" below — this used to be called after the
      BLE join result, which turned out to trigger a real backend bug.
- [x] Resume after closing the tab (`src/lib/sessionState.ts`) — once the flow is past Bluetooth
      (i.e. on the "connecting to the server" or stream screen, where everything left runs off the
      backend API, not a GATT handle that can't survive a reload anyway), the serial + step are kept
      in `localStorage`. Closing the app right after WiFi creds are sent — a real report from
      testing — used to dump you back at the QR scan with no way back to that camera's status;
      reopening now resumes straight into `BackendHandoffScreen`/`StreamScreen` for that serial.
- [x] Factory reset from the "Camera online" screen (`adminResetDevice` in `src/lib/api/client.ts`,
      wired into `BackendHandoffScreen.tsx`) — needed so a unit can go from "just tested" to
      "clean for redeployment" without physical access every time. **Only works while the camera
      is still actively connected** — the SDK reset command routes through the backend's live
      session for that device, not a fresh connection made on demand. If the camera's already
      dropped (or its registration got poisoned by the wifi-configured bug below), this fails with
      `device_info_incomplete`/`device_not_connected` and the physical reset is the only option.
- [x] Phase 6 (not in the original plan, added per a later ask) — confirm the camera is actually
      streaming after pairing (`StreamScreen.tsx`). Not video playback — see "Why there's no video
      preview" below. It follows the same UUID-freshness rule as `AndroidOpenDemo`'s
      `DeviceDetailActivity` → `AdminStreamActivity`: never cache or reconstruct a stream UUID, call
      `GET /api/admin/device/<serial>` fresh right before opening the stream and use whatever
      `admin_stream_url` comes back at that moment. Has Stop/Start controls and shows each chunk as
      its own log line (like the backend's own `[STREAM_DATA] Received frame N` logging), not a
      summary tile. User-binding (`register_credentials`, stream tokens) is the production client
      app's job, not this tool — left unwired on purpose.
- [x] Phase 7 (added per a later ask) — a mini backend (`backend/`, ASP.NET Core + PostgreSQL, see
      "The mini backend" below) that replaces the browser-held admin key with a real login, and adds
      a persistent "My Cameras" list so a tested camera can be revisited (status/stream/reset)
      without redoing the whole scan-and-pair flow.

## The mini backend

`backend/` (`BleProvisionApi`, ASP.NET Core + EF Core + PostgreSQL) sits between this frontend and
the real camera backend. Three jobs:

1. **Holds `cctv.czeros.tech`'s admin key server-side.** The browser used to hold it directly in
   `localStorage` (via `AdminKeyGate`, now deleted) and send it on every request — anyone who opened
   devtools could read it. Now the browser only ever holds a login (JWT) for *this* backend; every
   `/api/device/*`, `/api/admin/*`, etc. call gets forwarded by `ProxyController`/`CctvBackendProxy`
   with the real key attached, never exposed to the browser. The streamed admin video endpoint is
   forwarded the same way, with `HttpCompletionOption.ResponseHeadersRead` + direct stream copying
   so it doesn't buffer the (effectively infinite) live response — the same class of bug already hit
   once with nginx's default `proxy_buffering`, avoided one layer deeper here.
2. **Gates the whole app behind a real login** (`AuthController`, JWT via
   `Microsoft.AspNetCore.Authentication.JwtBearer`) — `LoginScreen.tsx` replaced the old
   admin-key-prompt gate. One account is seeded from env vars on first boot
   (`SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD`); anyone logged in can create more via
   `POST /api/auth/users` — no separate admin role, this is a small internal tool.
3. **"My Cameras"** (`MyCamerasController`, `MyCamerasScreen.tsx`) — a personal revisit list, not an
   event log: one row per serial, upserted automatically the moment `BackendHandoffScreen` sees
   `connected` during pairing. The real camera backend remains the source of truth for actual device
   state; this table just remembers which serials this tool has touched.

   `MyCamerasScreen.tsx` is deliberately just a plain tappable list — no per-row action buttons.
   Tapping a row opens `CameraDetailScreen.tsx`, which has everything: a status tab (with its own
   live re-check), a stream tab (`StreamTapPanel`, embedding the same logic `StreamScreen` uses —
   see `useStreamTap.ts`), and a reset tab with a real confirmation step and an explanation of when
   reset does and doesn't work. Polling for the embedded stream tap only runs while that tab is
   actually open on that one camera, so it doesn't add background load across the whole list.

   Refreshing status for the *list* is one bulk call, not one request per row: the real backend's
   `GET /admin/cameras` already returns every camera's live status in a single response, so
   `MyCamerasController.RefreshAll` (`POST /api/mycameras/refresh`) fetches that once
   (`CctvBackendProxy.GetJsonAsync`) and filters it down to just the serials in this list, updating
   all of them in one batch.

**Deployment:** `docker-compose.prod.yml` adds `ble-backend` (this API) and `ble-postgres` alongside
the existing `ble-provision` frontend container, all on the same `ble-provision-network`.
`nginx.conf`'s `/api/*` proxy now points at `http://ble-backend:8080/api/` instead of straight to
`cctv.czeros.tech` — the mini backend does that forwarding itself now. Needs a `.env` next to
`docker-compose.prod.yml` on the VPS (see `.env.example` — `POSTGRES_PASSWORD`, `JWT_SECRET`,
`CCTV_ADMIN_KEY`, `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD`; never committed). EF Core migrations
apply automatically on startup (`db.Database.Migrate()` in `Program.cs`) — no manual migration step.

### Why there's no video preview — the camera streams H.265

`StreamScreen.tsx` tried actual playback first (`mpegts.js`, an MSE-based player), first with
`format=flv` then `format=ts` (matching `AndroidOpenDemo`'s `openCameraStream()`, which builds its
URL with `format=ts`). Both sat in an infinite "buffering" state with no error. Captured a stream
with `curl` and inspected it with `ffprobe` directly: **both the main and sub streams
(`stream_type=0` and `1`) are HEVC (H.265)**, 2880×1620. Browsers' Media Source Extensions
essentially never support HEVC decoding (a handful of Safari builds aside) — the demuxer parses the
container fine, but the browser can never build a playable buffer from it, which is exactly why it
buffered forever instead of raising a decode error.

This is why the Android app can play it and a web page can't: **VLC does its own software
decoding** (bundled libvlc/FFmpeg), independent of whatever the browser natively supports. There's
no equivalent for a `<video>` tag — it's hard-limited to the host browser's codec support. Fixing
this for real means either reconfiguring the camera to encode H.264, or a server-side HEVC→H.264
transcode — both out of scope for this frontend.

What `StreamScreen.tsx` does instead, and the reason it's still useful for a *pairing* test tool:
it opens the raw HTTP stream with `fetch()` and tallies chunks/bytes live as they arrive, the same
proof-of-life the backend's own log shows via `[STREAM_DATA] Received frame N (size: X bytes)`.
That confirms the whole path — browser → this app's nginx → `cctv.czeros.tech` → the camera's live
NetSDK session — actually works, without needing to solve browser video decoding.

### Streaming crash chased down — was stale test state, not a code bug

Investigated a real report of "camera confirmed `connected` in the database, but
`/api/admin/stream/<uuid>` still 500s with `'NoneType' object has no attribute 'encode'`." Traced
the backend live (`api_server_listen_mode.py`): that endpoint keys everything off
`stream_manager.registered_devices`/`loginIDs`, both in-memory, keyed by serial, populated by the
same single long-running process (confirmed via `systemctl show` — one PID, not multiple gunicorn
workers, so it isn't a split-memory-across-processes issue). The UUID itself
(`get_admin_stream_uuid`) is a stable random `uuid4()` per serial, generated once and reused — not
snapshotted state, so an old UUID for the same serial doesn't go stale on its own.

Confirmed directly against the live camera (`BL08809RAGF5610`): a fresh `GET
/api/admin/device/<serial>` call returned `connected: true` and a working `admin_stream_url`, and
curling that URL immediately returned `200` with real FLV bytes. The endpoint and the camera were
both fine — the difference was **when** the UUID/URL was obtained relative to when it was used. The
Android reference app never separates those two steps: it re-fetches `admin_stream_url` from
`getDeviceInfo()` immediately before every `openCameraStream()` call. `StreamScreen.tsx` now does
the same — poll `/admin/device/<serial>` until `connected`, then re-fetch it *again* right before
constructing the player URL, rather than reusing whatever was seen a poll cycle (or a whole prior
test session) earlier.

**First real-hardware result:** connects over Bluetooth fine, but the first write (sending the RSA
public key) failed with `GATT operation not permitted`. Fixed — `fff1` only accepts
write-without-response, not write-with-response like the code originally assumed
(`src/lib/ble/transport.ts`). Makes sense in hindsight: the protocol already has its own
application-level acks (`00 8C`, `01 8E`, ...), so it never needed the ATT layer's too. Added a
small pacing delay between fragments since write-without-response doesn't wait for the peripheral
to actually receive each one before resolving, unlike write-with-response.

**Second real-hardware result:** the full handshake ran clean end to end — key exchange, serial
(`BL08809RAGF5610`), security code, WiFi credentials, join result 0 (success). But the camera never
showed as `connected` on the backend, and streaming failed outright.

### wifi-configured timing — a real backend bug, triggered by this app's own design

Root cause, traced directly in `api_server_listen_mode.py`: `record_wifi_provisioning` (what
`wifi-configured` calls) does `register_device(serial, ip=None, port=None, ...)` unconditionally,
every time. That function's SQL upsert is `ON DUPLICATE KEY UPDATE ip = VALUES(ip)` — no
`COALESCE`, unlike `model`/`firmware_version` two lines below it in the same query, which correctly
use `COALESCE(VALUES(x), x)`. So any call nulls out the camera's IP/port in the database — but it's
only *destructive* if the camera already connected with real values by the time the call lands.

This app was calling `wifi-configured` only after the BLE join result (`05 02`) confirmed success —
a deliberate choice, reasoned as "no point starting a 5-minute wait for a WiFi attempt already known
to have failed." But that wait gives the camera time to dial the backend on its own in the
background, and by the time our HTTP call arrived, the camera had *already* registered with correct
data (confirmed by comparing timestamps: DB `registration_time` was over two minutes *before* our
app's `wifi-configured` call). The null-write then stomped the correct data. The original Android
app almost certainly notifies the backend immediately after sending credentials, well before the
camera could realistically already be connected — which is why this bug likely never surfaces there,
and why nobody had hit it before.

**Fix applied (app-side, no backend changes):** `wifi-configured` is now sent from inside
`runProvisioning` right after the camera acks the WiFi credentials (`05 81`), not after waiting for
the join result. This restores the safe ordering — null-write first (harmless, nothing real to
overwrite yet), camera's own registration second (overwrites it with correct data). If the WiFi
turns out wrong, the backend's own 5-minute timeout handles that gracefully regardless.
`PairingScreen` fires it via a fire-and-forget callback (`onWifiSent`) and threads whether it
succeeded through to `BackendHandoffScreen` (`alreadyNotified` prop) so the notification is never
sent twice.

The backend bug itself is still live and unpatched (that's a production Python service, out of
scope for this frontend to fix) — any device that already got poisoned by the old flow (recorded
serials: `BL08809RAGDA981`, `BL08809RAGF5610`) needs a physical reset before it can be tested again.

## Running it

```
npm install
npm run dev
```

Web Bluetooth requires a secure context (HTTPS) except on `localhost`, so `npm run dev` works fine
on the same machine. To test from a phone on the same network, this needs to be served over HTTPS —
see the plan's "Server-side changes" section for the production subdomain setup.

**iPhone:** Safari has no Web Bluetooth. Open this app's URL inside the **Bluefy** app instead
(free on the App Store) — no other change needed.

## Testing

```
npm test
```

Framing and crypto (Phases 2–3) are pure functions over `Uint8Array` and are unit-tested without
any hardware. Everything from Phase 2 onward beyond that also needs a real camera and phone —
see the plan's Verification section for the pass/fail signal at each phase.

## Deployment

Lives at **https://cctv-provision.czeros.tech**, deployed as its own Docker container on the same
VPS as the EV installation site (not the camera backend's VPS). `.github/workflows/deploy.yml`
builds and pushes an image to `ghcr.io/amrmzfr-dev/ble-provision-tool-cctv`, then SSHes in and runs
`docker compose -f docker-compose.prod.yml up -d`.

The container's own nginx (`nginx.conf`) proxies `/api/*` to the mini backend
(`http://ble-backend:8080/api/`, see "The mini backend" above) — not straight to
`https://cctv.czeros.tech` anymore, though that's still where it ends up: browser → this nginx →
`ble-backend` → `cctv.czeros.tech`. The browser only ever talks to `cctv-provision.czeros.tech` —
same-origin the whole way, no CORS config needed anywhere in the chain.

### A real DNS mix-up — `api.czeros.tech` vs `cctv.czeros.tech`

This proxy originally pointed at `https://api.czeros.tech`, which reads like the obvious API
domain — it's even hardcoded as the CORS default inside `api_server_listen_mode.py` itself. But it
resolves to the **EV installation VPS** (103.20.240.48, this app's own host), not the camera
backend, and answers from something else there entirely (that VPS also happens to run
`app.czeros.tech`, an unrelated internal admin dashboard product — neither one is the CCTV API).
The real backend is only ever reachable at `cctv.czeros.tech` → 56.68.52.66, confirmed by checking
that host's own nginx (`sites-enabled` serves `cctv.czeros.tech` proxying to `127.0.0.1:5000` —
there's an old, disabled `cctv-api.backup` config for `api.czeros.tech` that was never wired up).

Symptom this caused: every WiFi-configured notification and status poll silently succeeded against
the wrong host, so `BackendHandoffScreen` sat at "waiting for the camera to come online" forever —
not because of the wifi-configured timing bug (already fixed, see below), but because the app
wasn't even asking the real backend. Fixed at the time by pointing `nginx.conf`'s proxy at
`cctv.czeros.tech` directly; now it points at `ble-backend`, which does that forwarding itself (see
"The mini backend" above) — same end destination, one more hop.

**One-time setup this repo cannot do for you** (needs access to GitHub repo settings, DNS, and the
VPS):

1. Create the private GitHub repo `ble-provision-tool-cctv` and push this folder to it.
2. Add repo secrets (Settings → Secrets and variables → Actions): `VPS_HOST`, `VPS_USER`,
   `VPS_SSH_KEY`, `VPS_PORT`, `GHCR_TOKEN` — same values already used by the `fullstack-ev-installation`
   repo's secrets, since it's the same VPS.
3. DNS: add an A record for `cctv-provision.czeros.tech` pointing at the EV VPS's IP.
4. On the VPS: `mkdir -p /opt/ble-provision-tool-cctv-prod`, copy `docker-compose.prod.yml` there,
   then copy `.env.example` to `.env` in that same directory and fill in real values
   (`POSTGRES_PASSWORD`, `JWT_SECRET`, `CCTV_ADMIN_KEY`, `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD`)
   — never commit this file.
5. On the VPS, add a host-level nginx server block for `cctv-provision.czeros.tech` proxying to
   `127.0.0.1:3010` (check that port is actually free first — `ev-frontend-prod` already uses 3000),
   then get a cert: `sudo certbot --nginx -d cctv-provision.czeros.tech`.
6. Push to `main` (or run the workflow manually) to trigger the first deploy — this builds and
   pushes both `ble-provision-tool-cctv` and `ble-provision-tool-cctv-backend` images, then brings
   up all three services (`ble-provision`, `ble-backend`, `ble-postgres`) via `docker compose up -d`.
   The backend applies its own EF Core migrations and seeds the first login on startup.
