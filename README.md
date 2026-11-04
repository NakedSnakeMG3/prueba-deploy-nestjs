# Railway ingress experiment

Dependency audit results, the temporary multer fix and the signature verification procedure are documented in [SECURITY-MAINTENANCE.md](SECURITY-MAINTENANCE.md).

Temporary NestJS probe. No database, new dependencies, tenant resolution, automatic push or deployment. Controllers generated with the installed local CLI: `npm.cmd exec --offline -- nest generate controller diagnostics --no-spec` (also `health`).

## Configuration

Express trust proxy is exactly the number **1**. This is a hypothesis under evaluation, not validated security. Hop distance does not identify or authenticate Railway.

GET /diagnostics/ingress returns 404 unless INGRESS_PROBE_ENABLED is exactly `true`. It returns only Host, ordered raw occurrences of Host/X-Forwarded-Host/X-Forwarded-For/X-Forwarded-Proto preserving casing and duplicates, their Node-normalized values (null if absent), socket peer, Express hostname/ip/ips/protocol and effective trust proxy. Raw headers describe what reached Node, not necessarily the client wire data. `host` is received normalized Host; `hostname` is Express's interpretation. This code does not log request data. Do not add request logging or send credentials, cookies, tokens or bodies. Review platform logging settings independently.

## Local execution (PowerShell)

Run from the package.json directory (`prueba` in this workspace), with Node.js 22 LTS:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
$env:INGRESS_PROBE_ENABLED = 'true'
$env:PORT = '3000'
npm.cmd run start:prod
```

App binds to 0.0.0.0 and PORT (default 3000). GET /health/ready returns 200 without a database. Development: `npm.cmd run start:dev`.

In another terminal, test direct spoofing:

```powershell
curl.exe --http1.1 --silent --show-error --include --noproxy '*' 'http://127.0.0.1:3000/health/ready'
curl.exe --http1.1 --silent --show-error --include --noproxy '*' 'http://127.0.0.1:3000/diagnostics/ingress' -H 'X-Forwarded-Host: attacker.invalid' -H 'X-Forwarded-For: 198.51.100.23' -H 'X-Forwarded-Proto: https'
```

The attacker hostname, synthetic IP and https interpretation over plain HTTP demonstrate that trust proxy=1 alone does not authenticate Railway. Local tests provide no Railway evidence.

## Manual Railway deployment

Review, commit and manually publish to your own GitHub repository. Record `git rev-parse HEAD`. This workspace initially contained untracked app files: include the full reviewed application and lockfile.

1. Create a Railway service from that repository. Root directory is `/` if package.json is at repository root, or `/prueba` if the enclosing directory is included. Do not provision a database. Disable automatic deployments if only manual releases are desired.
2. Set build command `npm ci && npm run build` (include dev dependencies during build), start command `npm run start:prod`, healthcheck `/health/ready`, and INGRESS_PROBE_ENABLED=true. Let Railway supply PORT; match the public target port if prompted.
3. Manually deploy the reviewed commit and verify the source SHA in deployment details.
4. Settings > Networking > Public Networking > Generate Domain. Use this generated HTTPS domain without another proxy/CDN or custom domain. References: [Railway domains](https://docs.railway.com/networking/domains/working-with-domains), [healthchecks](https://docs.railway.com/deployments/healthchecks).
5. Run every case below; record response status and probe JSON. Deployment success does not demonstrate sanitization.

## Public requests (PowerShell)

Replace the placeholder. Do not use verbose/trace mode, credentials, cookies, bodies or redirect following. Record VPN/corporate proxies; --noproxy bypasses explicit local proxy settings only.

```powershell
$base = 'https://REPLACE.up.railway.app'
curl.exe --http1.1 --silent --show-error --include --noproxy '*' "$base/health/ready"
# A: baseline without client forwarding headers
curl.exe --http1.1 --silent --show-error --include --noproxy '*' "$base/diagnostics/ingress"
# B: forged hostname
curl.exe --http1.1 --silent --show-error --include --noproxy '*' "$base/diagnostics/ingress" -H 'X-Forwarded-Host: attacker.invalid'
# C: separate lines
curl.exe --http1.1 --silent --show-error --include --noproxy '*' "$base/diagnostics/ingress" -H 'X-Forwarded-Host: attacker.invalid' -H 'X-Forwarded-Host: second.invalid'
# D: comma-separated values
curl.exe --http1.1 --silent --show-error --include --noproxy '*' "$base/diagnostics/ingress" -H 'X-Forwarded-Host: attacker.invalid, second.invalid'
# E: forged address and scheme (synthetic documentation addresses)
curl.exe --http1.1 --silent --show-error --include --noproxy '*' "$base/diagnostics/ingress" -H 'X-Forwarded-For: 198.51.100.23, 203.0.113.42' -H 'X-Forwarded-Proto: http'
```

Repeat C/D with reversed values to detect order dependence. Repeat after region, deployment or networking changes. Upstream rejection is an observation, not proof Node received original lines.

## Evidence template (copy per request)

Keep originals private and outside version control. UTC: `(Get-Date).ToUniversalTime().ToString('o')`. Verify deployed SHA in Railway, not only locally.

```text
Status: NOT RUN / OBSERVED / BLOCKED
Generated public domain:
Service/environment/region/deployment ID:
Deployed commit SHA verified against deployment:
UTC start/end:
Case A/B/C/D/E/local-direct/disabled:
curl version; network/VPN/proxy context:
Exact method/URL and four allowed request headers (order/duplicates):
HTTP status:
Complete probe JSON (or relevant error status; exclude unrelated data):
Raw and normalized values vs supplied values:
Express hostname/ip/ips/protocol and socket peer:
Per-header result: overwritten/preserved/appended/absent/inconclusive
Configuration: trust proxy=1 (hypothesis), flag, port:
Observations demonstrated by this response:
Unproven conditions and required independent evidence:
Design decision: BLOCKED / pending independent validation
Redactions:
```

Classify each header separately against baseline. Appending forged values still preserves client input. Never count X-Forwarded-For entries to conclude exactly one proxy hop: intermediaries can omit, overwrite or combine entries. Express ips is filtered by the configured trust rule. Passing public tests does not prove direct access is blocked or all ingress paths have equal length. Obtain independent platform/networking guarantees and access controls covering all paths; this probe alone cannot establish those properties.

If Railway preserves forged values, omits X-Forwarded-Host, or required sanitization, topology and origin isolation cannot be demonstrated, record **BLOCKED for the proposed tenant design**. Do not silently switch resolution to Host or declare proxy trust validated. No Railway observations have been collected by this implementation; the design remains unvalidated pending manual evidence and independent guarantees.

Results may contain real IPv4/IPv6 addresses in remoteAddress, ip, ips and raw/normalized X-Forwarded-For. Before sharing replace each real address consistently with CLIENT_IP_1/PEER_IP_1 labels, preserving order, commas, duplicates and equality relationships, including mapped IPv6. Review every field and error response for addresses, secrets and unrelated data. Label synthetic addresses as synthetic. Never publish complete platform logs.

## Disable and retire

Unset INGRESS_PROBE_ENABLED or set it to false, redeploy/restart and verify /diagnostics/ingress returns 404 while /health/ready returns 200. Locally stop the process, run `Remove-Item Env:INGRESS_PROBE_ENABLED -ErrorAction SilentlyContinue`, restart and repeat. After saving private evidence, delete the temporary Railway service and generated domain, remove unused project resources and verify the public endpoint is unavailable. Remove the probe controller/module registration and experimental trust setting before reuse outside the experiment.
