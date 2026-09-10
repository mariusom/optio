# Security

Optio is pre-release software. Security fixes target the current `main` branch;
older snapshots are not maintained separately.

Report suspected vulnerabilities privately to [Marius Matei](mailto:marius@mariusom.com).
Include the affected version, browser, reproduction steps and likely impact.
Use synthetic study data; do not send credentials or sensitive observations.
Avoid public exploit details until the report has been assessed.

Studies are stored in the browser without automatic backup or sync. Optional
[agent access](docs/agent-access.md) can expose study data to an assistant
provider. Exported raw CSV can contain spreadsheet formulas; use the spreadsheet
export or import untrusted fields explicitly as text.

CI checks known dependency advisories, including build-time dependencies. A clean
audit is not proof that the app or its dependencies are free of vulnerabilities.
