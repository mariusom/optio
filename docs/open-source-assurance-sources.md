# Open-source assurance: primary-source notes

Research snapshot: 2026-09-17. This combines a repository baseline and sourced
guidance, not legal advice or a guarantee of compliance or security.

## Implementation status

The following controls are prepared locally. Workflows are not live until
merged; no push, deployment, release or attestation was performed in this work.

| Work area                           | Status                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License inventory and notices       | Implemented: generated full license/notice texts and hashes for 112 conservatively inventoried packages, including Snabbdom and Shadcn's `cn`; copied-source attribution retained. This is not byte-complete copyright clearance.                                             |
| Apache modification notices         | Implemented in both patched LiveStore files; patch lock hash refreshed.                                                                                                                                                                                                       |
| Branch protection                   | Blocked: GitHub ruleset write returned 403. `main` still needs protection.                                                                                                                                                                                                    |
| Private vulnerability reporting     | Blocked: enable request returned 403. Policy now forbids public exploit reports and gives a contact-request fallback.                                                                                                                                                         |
| Security scanning and Dependabot    | CodeQL workflow prepared and Monday 09:00 Europe/London updates configured. Security-setting API changes returned 403. Dependabot fetched pnpm 12.4.0 but subsequently reported 11.17.0; app dependencies were checked, but successful lockfile rewriting remains unverified. |
| Scheduled checks and inventory gate | Implemented: weekly audit without deployment, license tests/drift gate in CI and build, offline distribution of notices and inventory.                                                                                                                                        |
| Contributor guidance                | Implemented: contribution policy, conduct policy and PR checklist. No invented private inbox, CLA, DCO mandate or response SLA.                                                                                                                                               |
| Release assurance                   | Prepared: manual main-only validation, archive/checksum, and isolated attestation job. No release/tag is created; existing deployment cadence is unchanged. Real-device testing remains manual.                                                                               |
| SEO                                 | Implemented and browser-tested: useful no-JavaScript content, existing metadata retained, metadata checks included in production E2E. Search Console remains an account-owner task.                                                                                           |

The remaining hosting/header, historical ownership/legal, and personal signing
decisions are not closed. Maintainer procedures and verification commands live
in [development](development.md#maintainer-security-and-releases).

## Original repository baseline and action checklist

The following separate inspection was performed on 2026-09-17 using local
source, installed package licenses, read-only GitHub API calls and the live
Pages response. No GitHub settings or deployment were changed. This is a
baseline assessment, not a penetration test or a complete copyright clearance.

### Before the next public release

- [ ] Complete distribution notices. `public/THIRD_PARTY_NOTICES.txt` expressly
      covers only selected packages. Imported Lucide includes ISC and Feather MIT
      notices; FoldKit includes a Snabbdom MIT notice; imported `cn`, `tw-animate-css`
      and Hugeicons are absent from the central notices. Hugeicons declares MIT in
      its installed manifest but supplies no top-level license file: verify the
      authoritative license and copyright text for that exact version. Inventory
      bundled transitive code, CSS, workers, WASM and assets, not just direct npm
      dependencies. Check any notices already retained in generated bundles before
      concluding that a distribution lacks attribution. Ship Optio's own MIT text
      too, and make notices available with downloaded/offline distributions.
- [ ] Review Apache-2.0 modification notices for the LiveStore patch. The patch
      changes upstream source and compiled JS without adding a changed-file notice;
      section 4(b) of the included license requires prominent modification notices.
- [ ] Record provenance for copied components, generated assets, screenshots and
      the earlier Swift app. Existing Foldcn provenance explicitly lacks an exact
      pinned source revision. Preserve authorship, avoid implying upstream
      endorsement, and get legal advice for unclear ownership or trademark rights.
- [ ] Protect `main`: GitHub returned `protected: false` and an empty ruleset
      list. Require pull requests, the actual `validate` status check, resolved
      conversations, and block force pushes/deletion. Restrict bypasses. Require an
      independent approval only when a second maintainer can actually supply it;
      a solo maintainer cannot approve their own PR. Test contributor and bot flows.
- [ ] Enable private vulnerability reporting and then change `SECURITY.md` to
      use it for sensitive reports. GitHub returned `enabled: false`; the current
      policy directs all reports to public issues. Set realistic response targets.
- [ ] Verify Dependabot alerts/security updates, secret scanning/push protection
      and code scanning in GitHub settings. Their enabled state was not established;
      the automated-security-fixes API returned 403, not a disabled result.

### Weekly maintenance and quality

- [x] Weekly npm and GitHub Actions Dependabot configuration exists. Recent
      successful jobs exist for both ecosystems. This does not establish complete
      pnpm 12 lockfile parsing; confirm a representative dependency update PR.
- [x] `pnpm audit --audit-level high` returned `No known vulnerabilities found`.
      This is advisory-database coverage, not proof of security or license compliance.
- [x] CI uses SHA-pinned actions, frozen installation, a release-age guard,
      type/lint/tests/build/OPFS E2E checks and a separate least-privilege Pages job.
      The latest inspected push workflow succeeded; the full suite was not rerun
      for this documentation-only assessment.
- [ ] Add scheduled auditing/scanning so an idle repository still discovers new
      advisories. Triage ordinary updates weekly, but handle critical security fixes
      immediately. Exact dependency pins/overrides still need coordinated updates.
- [ ] Add a license inventory/SBOM and a CI gate for new or changed licenses,
      missing notices and unknown provenance. An SBOM records components; it does
      not itself grant permission or establish compliance.
- [ ] Add contributor guidance, a PR checklist and a code of conduct with a real
      reporting contact. State that contributors must have rights to submissions;
      consider DCO sign-off, but do not confuse it with cryptographic signing.
- [ ] Define releases with version/tag, changelog, tested commit and recovery
      instructions. Deployment currently happens on every validated `main` push,
      not weekly. If weekly publication is desired, separate release approval from
      continuous integration rather than delaying critical fixes.
- [ ] Before releases, exercise Safari/mobile, accessibility, offline update and
      data recovery/migration scenarios. Existing docs explicitly limit current
      browser/agent coverage and warn that pre-release storage revisions can reset
      data. Do not promise backups or migration guarantees that do not exist.

### Hosting, signing and public presence

- [x] GitHub Pages reports HTTPS enforcement. Live HTML contains description,
      canonical URL, Open Graph/X metadata and WebApplication structured data.
- [ ] Plan a tested CSP and appropriate referrer, MIME-sniffing, framing and
      permissions policies. The sampled live response had no CSP, HSTS,
      X-Content-Type-Options, X-Frame-Options, Referrer-Policy or Permissions-Policy
      header. Account for WASM, workers, inline structured data and optional agent
      access before enforcement. Use a header-capable host if required; a custom
      domain alone does not give Pages arbitrary-header support.
- [ ] Document privacy accurately: browser storage is not automatic encryption,
      hosting still receives requests, and optional assistants may send data to
      providers. Avoid blanket claims that no data ever leaves the device.
- [ ] Optionally sign release tags and attest downloadable build artifacts with
      verification instructions. Browsers do not verify these as PWA signatures.
- [ ] For SEO, add useful public/static explanatory content (the current HTML
      body is an empty app root without JavaScript), verify the site in Search
      Console, submit the sitemap and check indexing. Do not index private study
      routes. Origin-root robots control needs the root site or suitable hosting;
      `llms.txt` is not a replacement for conventional SEO.

## Copyright and licenses

### Requirements

- Optio's repository `LICENSE` is MIT and names Marius Matei (2026). A recipient
  may use, modify, publish, and distribute the software, but a distributor must
  include the copyright and permission notices in every copy or substantial
  portion. This condition still matters when JavaScript is bundled or minified;
  minification is not an exception in the license. The MIT text also disclaims
  warranties. [Optio LICENSE](https://github.com/mariusom/optio/blob/main/LICENSE)
  · [OSI MIT text](https://opensource.org/license/mit)
- The project license is not evidence that every third-party dependency, font,
  image, icon, or other asset may be redistributed under MIT. Determine the
  owner and applicable license for each distributed third-party work and meet
  that license's conditions (for example, attribution, notice, source, or
  copyleft conditions where applicable). The U.S. Copyright Office says absence
  of a notice does not mean a work is free to use and, unless a limitation
  applies, permission/license is needed. [Copyright Office Circular 16A](https://copyright.gov/circs/circ16a.pdf)
- Preserve license material in a form shipped with or readily accompanying the
  production distribution. Whether a separate notices file, bundle comments,
  source maps, or another mechanism is sufficient depends on each license's
  wording; the MIT text itself requires the notices in copies or substantial
  portions and does not prescribe a filename. Obtain legal advice for ambiguous
  dependencies/assets.

### Optional best practices

- Keep the root license easy to find, and produce a release-time third-party
  notices/license inventory for the exact JS and assets shipped. GitHub calls a
  root license file a best practice and cautions that its license information is
  provided without warranty. [GitHub: Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- Retain provenance and license metadata for assets; record the source URL,
  author, license/version, and any modification. This reduces uncertainty when
  an asset is replaced or optimized.

## GitHub repository controls and vulnerability intake

These are optional governance/security controls, not open-source license
requirements.

- Use an **active** branch ruleset targeting the default branch. A reasonable
  baseline is: changes through pull requests, at least one independent approval,
  required CI checks, resolved review conversations, blocked force pushes, and
  restricted deletion. Add signed commits only if maintainers can support the
  contributor and bot workflow. GitHub documents each of these controls; active
  rulesets are enforced, disabled rulesets are not, and overlapping rulesets and
  branch protection are aggregated with the most restrictive rule winning.
  [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
  · [Available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- Enable **private vulnerability reporting** for the public repository and keep
  `SECURITY.md` as the public policy. They are separate mechanisms. Enabling the
  GitHub feature adds a private, structured **Report a vulnerability** path;
  ensure administrators/security managers subscribe to security-alert
  notifications because notification delivery depends on their settings.
  [Configure private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
  · [Report privately](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately)

## Weekly Dependabot and pnpm compatibility

Dependabot is optional, but update review remains necessary even when enabled.

- For version updates, GitHub's required configuration uses
  `package-ecosystem: "npm"` for pnpm, the directory containing the manifest and
  lockfile, and `schedule.interval: "weekly"`. Weekly means once a week, Monday
  by default; `day`, `time`, and `timezone` can make execution predictable.
  Configure GitHub Actions as a separate ecosystem if workflow actions should
  also receive version updates. Security updates are distinct: they react to a
  vulnerable dependency represented in a supported manifest/lockfile.
  [Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
  · [Dependabot security updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates)
- **pnpm v12 compatibility is unknown, not presumed.** At this snapshot,
  GitHub's official support table lists pnpm **v7, v8, v9, and v10** under the
  `npm` ecosystem; it does not list v11 or v12. This proves neither that every
  v10 release works nor that v12 necessarily fails, but there is no documented
  v12 support on which to rely. Keep the lockfile on a documented version or
  test Dependabot on an expendable branch/PR and retain a manual update process.
  Recheck the support table before adopting a newer lockfile format.
  [Supported ecosystems and repositories](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories)

## GitHub Pages and browser security headers

- GitHub Pages supports and can enforce HTTPS, but GitHub warns that Pages
  should not be used for sensitive transactions such as passwords or credit
  cards. Enforce HTTPS; it protects transport but is not a substitute for CSP,
  framing, MIME-sniffing, referrer, or permissions policies.
  [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- **Custom response-header support is a platform limitation/uncertainty.** The
  official Pages documentation describes no repository setting or file for
  arbitrary response headers. A GitHub staff response in GitHub Community says
  custom headers are not supported and suggests CSP via `<meta>`; that response
  is operational guidance, not a durable product contract. Verify actual
  deployed responses and current docs rather than assuming the statement is
  permanent. [GitHub Community staff answer](https://github.com/orgs/community/discussions/54257#discussioncomment-5783121)
- A meta-delivered CSP can constrain many resource loads, but it cannot create
  other HTTP headers. If requirements include header-only controls or reliable
  header reporting/enforcement, place a configurable CDN/proxy/host in front of
  or instead of Pages. MDN documents CSP as a response header and the narrower
  `<meta http-equiv>` alternative. [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)

## Artifact attestations are not PWA signing

- GitHub artifact attestations are optional signed provenance claims linking a
  build artifact to source and build instructions. Attestations alone provide
  no benefit until consumers verify them, provide SLSA v1.0 Build Level 2 by
  themselves, and explicitly do **not** guarantee that an artifact is secure.
  [GitHub: Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- Attesting a downloadable archive or a manifest containing hashes can let a
  user verify that artifact with `gh attestation verify`; workflow generation
  requires `id-token: write`, `contents: read`, and `attestations: write`.
  Attestation does not automatically prove that the files served by Pages equal
  that artifact unless deployment identity/digests and a verification policy
  establish that link. [Using artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- A browser-installed PWA is a website installed by the browser. The web
  installability model requires HTTPS (outside local development) and a web app
  manifest for the normal promoted flow; it does not define publisher code
  signing equivalent to a native app signature. Therefore, an artifact
  attestation is supply-chain provenance, **not PWA signing**, and browsers do
  not verify it during normal navigation/install. Packaging a PWA for an app
  store is a separate distribution channel with that store's own requirements.
  [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
