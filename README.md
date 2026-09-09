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
- [x] Phase 5 — call the backend provisioning API, poll status (`BackendHandoffScreen.tsx`).
      **Judgment call, not confirmed by docs:** `wifi-configured` is called only after the camera's
      own BLE join-result (`05 02`) comes back success — not right after the credentials are sent —
      since there's no point starting the server's 5-minute window for a WiFi attempt that's
      already known to have failed.
- [ ] Phase 6 (not in the original plan, added per a later ask) — bind a user to the device
      (`register_credentials`) and actually play the live stream (needs a FLV-capable player like
      mpegts.js — browsers can't play raw FLV natively)

**First real-hardware result:** connects over Bluetooth fine, but the first write (sending the RSA
public key) failed with `GATT operation not permitted`. Fixed — `fff1` only accepts
write-without-response, not write-with-response like the code originally assumed
(`src/lib/ble/transport.ts`). Makes sense in hindsight: the protocol already has its own
application-level acks (`00 8C`, `01 8E`, ...), so it never needed the ATT layer's too. Added a
small pacing delay between fragments since write-without-response doesn't wait for the peripheral
to actually receive each one before resolving, unlike write-with-response.

Everything past that point (SN/SC parsing, the `wifi-configured` timing call) is still unconfirmed
against real hardware — this was only the very first BLE write in the sequence.

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
