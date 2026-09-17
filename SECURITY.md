# Security

Optio is pre-release software. Security fixes target the current `main` branch;
older snapshots are not maintained separately.

Please report vulnerabilities privately using GitHub's
[private reporting form](https://github.com/mariusom/optio/security/advisories/new)
when **Report a vulnerability** is available on the repository's Security tab.
If the form is unavailable, open an issue asking @mariusom for a private
security contact, without disclosing the vulnerability itself.

In the private report, include the affected build/commit, browser, synthetic
reproduction steps and likely impact. Leave out real study data and credentials.
Please allow time to investigate and coordinate disclosure before publishing
details. This volunteer project has no guaranteed response time or bug bounty.

## Data and security limits

- Studies stay in browser storage, without automatic backup, sync or
  application-level encryption. The hosting provider receives normal web requests.
- Optional [agent access](docs/agent-access.md) can share study data with an
  assistant provider. Consider these limits before collecting sensitive data.
- UI exports protect formula-like cells. For raw programmatic exports, import
  untrusted fields explicitly as text.
- CI runs dependency audits and code scanning. These catch known issues, not
  every vulnerability; setup is covered in the
  [maintainer guide](docs/development.md#maintainer-security-and-releases).
