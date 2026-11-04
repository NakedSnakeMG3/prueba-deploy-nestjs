# Dependency security maintenance

Reviewed on November 3, 2026 (America/Mexico_City; November 4 UTC).

## Changes and audit scope

The starting npm audit reported 36 affected dependency entries: 0 critical, 2 high, 31 moderate and 3 low. These are dependency entries, not 36 distinct advisories. The two high entries were multer and its parent @nestjs/platform-express, originating from [GHSA-q7qp-rjg7-q26m](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m).

Nest 11.2.8 pins multer 2.4.0. A narrowly scoped package.json override selects multer **2.5.0**, the fixed release, under @nestjs/platform-express. Keep this override until a compatible Nest release selects a patched multer itself. This app has no upload endpoints, but the vulnerable dependency has still been replaced. Compatible updates within existing dependency ranges are also recorded in package-lock.json. No direct dependencies or wrappers were added; the Nest major version and application behavior are unchanged.

After these changes npm audit reports 0 critical, 0 high, 31 moderate and 3 low (34 total). `npm audit --omit=dev` reports **zero** vulnerabilities. These are registry advisory results at review time, not a guarantee that all possible vulnerabilities are known.

The remaining entries are confined to development tooling and derive from these three advisories:

| Package | Advisory | Remaining limitation |
| --- | --- | --- |
| minimatch | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | npm marks versions below 11.0.1 affected; tooling still depends on earlier major versions. |
| glob | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Fixed in 14.0.2+, while current Nest/Jest tooling uses earlier majors. |
| deepmerge | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Latest published release checked was 4.3.1, which is affected; no published patch was available. |

Do not consider the development dependency tree fully remediated. Do not use `npm audit fix --force` blindly: the report proposed downgrades such as ESLint 4 and Jest 25. Do not override every minimatch/glob instance to a different major just to suppress alerts; their callers require compatibility review. Follow upstream fixes for Nest CLI, Jest/ts-jest and ESLint/typescript-eslint, and rerun the audit. ESLint 9 also emits an end-of-support warning; migrating the lint stack to a supported major remains follow-up work. Avoid running tools on untrusted repositories or attacker-controlled glob patterns.

## Verify signatures before applying future updates

Use the official registry `https://registry.npmjs.org/`. For this update, candidate package.json/package-lock.json were prepared in an ignored temporary directory. Packages were downloaded there with lifecycle scripts disabled, then verified **before copying either manifest into the app or replacing its node_modules**:

```powershell
# Run in a separate candidate directory containing copies of the manifests.
npm.cmd ci --ignore-scripts --no-audit
npm.cmd audit signatures
npm.cmd audit
npm.cmd audit --omit=dev
```

Only apply candidates if signature verification succeeds. This check verified 677 installed packages on Windows: all 677 had valid registry signatures, and 96 had verified provenance attestations (baseline: 677 signatures and 94 attestations). npm also checks downloaded archive integrity against the lockfile during installation. After verification, the app was installed offline from the verified cache using `npm ci --ignore-scripts --no-audit --offline`.

Registry ECDSA signatures authenticate npm registry metadata/content; they are not personal author signatures, a malware review, or proof that every package has provenance. The counts cover packages installed for the tested Windows platform; repeat verification on the deployment platform for its optional native dependencies. See [npm signature verification](https://docs.npmjs.com/verifying-registry-signatures/) and [npm audit](https://docs.npmjs.com/cli/commands/npm-audit/). Reject missing/invalid signatures; do not bypass TLS or signature checks.

Run build, unit and ingress E2E checks after installation, then launch the production entry point and check readiness plus enabled/disabled diagnostics. Keep security work separate from the Railway ingress hypothesis: dependency fixes do not validate proxy trust.

## Verification results

Validated locally on Windows with Node.js 24.22.1:

| Check | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm test -- --runInBand` | 1 test passed |
| `npm run test:e2e -- --runInBand` | 8 tests passed |
| `npm exec --offline -- eslint src test` | Passed, no errors or warnings |
| Production `dist/main.js`, flag=false | Actual listening process: readiness 200, diagnostics 404 |
| Production `dist/main.js`, flag=true | Actual listening process: readiness 200, diagnostics 200; synthetic forwarded values and trustProxy=1 asserted |
| Final installed production dependency audit | 0 vulnerabilities |

The production smoke checks used OS-assigned temporary ports and stopped their child processes afterwards. Minor pre-existing lint issues (line endings, test response types and the bootstrap promise marker) were also corrected. The SHA-256 hashes of the applied manifests were checked against the signature-verified candidate copies and matched. No push or Railway deployment was performed.
