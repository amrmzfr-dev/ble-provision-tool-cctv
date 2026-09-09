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
- [ ] Phase 2 — GATT transport + frame fragmentation
- [ ] Phase 3 — RSA/AES handshake, read serial number + security code
- [ ] Phase 4 — send WiFi credentials, read join result
- [ ] Phase 5 — call the backend provisioning API, poll status (note: `cctv-api-prod/docs/SDK_GUIDE_DOCUMENTATION.md`
      documents the camera's default login as `cctv_admin` / `cctv@2025` — check whether Phase 5
      needs to pass these to `register_credentials` or whether the backend already assumes them)

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

The container's own nginx (`nginx.conf`) proxies `/api/*` to `https://api.czeros.tech` server-side,
so the browser only ever talks to `cctv-provision.czeros.tech` — same-origin, no CORS config needed
on the camera backend.

**One-time setup this repo cannot do for you** (needs access to GitHub repo settings, DNS, and the
VPS):

1. Create the private GitHub repo `ble-provision-tool-cctv` and push this folder to it.
2. Add repo secrets (Settings → Secrets and variables → Actions): `VPS_HOST`, `VPS_USER`,
   `VPS_SSH_KEY`, `VPS_PORT`, `GHCR_TOKEN` — same values already used by the `fullstack-ev-installation`
   repo's secrets, since it's the same VPS.
3. DNS: add an A record for `cctv-provision.czeros.tech` pointing at the EV VPS's IP.
4. On the VPS: `mkdir -p /opt/ble-provision-tool-cctv-prod`, copy `docker-compose.prod.yml` there.
5. On the VPS, add a host-level nginx server block for `cctv-provision.czeros.tech` proxying to
   `127.0.0.1:3010` (check that port is actually free first — `ev-frontend-prod` already uses 3000),
   then get a cert: `sudo certbot --nginx -d cctv-provision.czeros.tech`.
6. Push to `main` (or run the workflow manually) to trigger the first deploy.
