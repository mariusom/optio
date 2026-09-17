# Contributing to Optio

Bug reports, documentation improvements and focused pull requests are welcome.
For larger changes, open an issue first so we can agree on the intended behavior.
Use synthetic data in issues, screenshots and tests; never upload real study
records, credentials or someone else's personal information.

## Before submitting

- Follow the setup and checks in [development](docs/development.md), and the
  applicable architecture and interface guidance linked there.
- Describe the problem, the intended result, and how you verified it. Include
  screenshots for visual changes and note browser/device coverage honestly.
- Keep changes focused. Preserve offline use, accessibility, existing records,
  and the human confirmation required for destructive actions.
- For dependency changes, regenerate the license artifacts with
  `pnpm licenses:generate`, review the changes and run `pnpm licenses:check`.
  Do not approve unfamiliar licenses just to make CI pass.

## Rights and attribution

Submit only work you have the right to contribute under the project's
[MIT license](LICENSE). Identify copied or adapted code and assets with their
source, version/revision and license. Preserve copyright and notice text.
Third-party code retains its own license; this project does not relicense it.
Follow the same rules for AI-assisted contributions and verify their behavior
and provenance yourself. Do not imply endorsement by upstream authors.

No CLA or mandatory DCO sign-off is currently required. A commit signature
verifies identity/provenance, not that the submitted work is legally cleared.

## Community and security

Follow the [code of conduct](CODE_OF_CONDUCT.md). Use the
[security policy](SECURITY.md) for vulnerabilities, not a public exploit report.
Maintainers review contributions as time permits; submitting a change does not
guarantee acceptance or a response deadline.
