# Security

Optio is pre-release software. Security fixes target the current `main` branch;
older snapshots are not maintained separately.

Report security issues of any type by [opening a GitHub issue](https://github.com/mariusom/optio/issues/new).
Include the affected version, browser, reproduction steps and likely impact.
Issues are public. Use synthetic study data; do not include credentials or
sensitive observations.

Studies are stored in the browser without automatic backup or sync. Optional
[agent access](docs/agent-access.md) can expose study data to an assistant
provider. Exported raw CSV can contain spreadsheet formulas; use the spreadsheet
export or import untrusted fields explicitly as text.

CI checks known dependency advisories, including build-time dependencies. A clean
audit is not proof that the app or its dependencies are free of vulnerabilities.
