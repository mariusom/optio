# Contributing to Optio

Optio is for recording observations while you work and reviewing where the time
went. Bug reports, clearer documentation and focused pull requests are welcome.
For larger changes, open an issue so we can discuss how they fit.

## Making a change

1. Follow [development](docs/development.md) to run the app and its checks.
   [Architecture](docs/architecture.md) explains where behavior lives;
   [interface conventions](docs/interface.md) covers UI changes.
2. Work on a branch and open a PR targeting `main`. Describe the problem, your
   change and how you tested it. Screenshots help with visual changes.
3. Keep the branch up to date and wait for `validate` to pass before merging.
   Merges deploy automatically, so changes go straight to the live app.

Use made-up study data in reports, tests and screenshots. When changing recording
or storage, check that offline use and existing records still work. UI changes
should remain keyboard-accessible and ask before deleting data.

For dependency changes, run `pnpm licenses:generate`, review the notices and run
`pnpm licenses:check`. See [dependency guidance](docs/development.md#dependencies-and-generated-assets)
for version constraints and generated files.

## Sharing code and reporting problems

Please contribute original work you have the right to license under
[MIT](LICENSE). Copied or adapted code and assets retain their own licenses;
include their source, version/revision and required notices. Review AI-assisted
work for behavior and provenance too. No CLA or DCO sign-off is required.

Use [private reporting](SECURITY.md) for vulnerabilities and public issues for
other bugs. Please follow the [code of conduct](CODE_OF_CONDUCT.md); this is a
volunteer project, so reviews may take time.
