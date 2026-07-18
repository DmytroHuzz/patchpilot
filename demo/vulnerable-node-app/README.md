# PatchPilot golden demo fixture

This disposable command-line app reads a user-provided JSON5 theme and renders a preview. It intentionally pins `json5@1.0.1` and calls the advisory-relevant `JSON5.parse` API so PatchPilot has one real, repository-specific finding to investigate.

The fixture contains no exploit payload. Do not use it as production code.

```bash
npm ci
npm test
npm run build
npm start -- "{accent: '#75f2b3', density: 'compact'}"
```

Run `../reset-demo.sh` to restore its vulnerable baseline and initialize its disposable local Git history.

