# Security

Optio is pre-release software. Security fixes target the current `main` branch;
older snapshots are not maintained separately.

Do not publish vulnerabilities, exploit instructions, credentials or sensitive
study data in public issues. Use GitHub's
[private reporting form](https://github.com/mariusom/optio/security/advisories/new)
when **Report a vulnerability** is available on the repository's Security tab.
Private reporting still requires the repository administrator to enable it.
If the form is unavailable, open an issue asking @mariusom for a private
security contact, without disclosing the vulnerability itself.

In the private report, include the affected build/commit, browser, synthetic
reproduction steps and likely impact. Please allow time to investigate and
coordinate disclosure before publishing details. This volunteer project does
not promise a response deadline or offer a bug bounty. Critical fixes need not
wait for the normal weekly dependency-maintenance review.

Studies are stored in the browser without automatic backup or sync. Optional
[agent access](docs/agent-access.md) can expose study data to an assistant
provider. UI exports protect formula-like cells automatically. When processing
raw programmatic exports, import untrusted fields explicitly as text.

CI checks known dependency advisories, including build-time dependencies. A clean
audit is not proof that the app or its dependencies are free of vulnerabilities.
The security workflow also schedules dependency audits and code scanning;
these controls become active only once the workflows are on the default branch
and GitHub permits them to run.

Local browser storage is not an application-level encryption or backup promise.
The hosting provider receives normal web requests, and optional assistants can
send shared data to their providers. Avoid collecting sensitive personal data
unless you have assessed these limits and have permission to do so.
