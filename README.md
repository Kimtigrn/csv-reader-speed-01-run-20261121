# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Kimtigrn/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Kimtigrn/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Write a faster drop-in for make.fun's own csv-reader 1.0.0 that answers exactly as it does on every case; places go by CPU time, least first, and beating csv-reader, the house baseline, at 95% confidence only qualifies an entry for a place.

`solve.js` is a dependency-free ES module whose `run(input)` returns csv-reader 1.0.0's answer — `{columns, rows, errors}` — for every `{text, header}` input, including its broken-row policy (BOM drop, stray CRs, quote junk, unterminated quotes, short/long rows, exact error line numbers). It never walks the text a character at a time: fields are cut with `indexOf` jumps and `String.slice`, and values are assembled from slices only where a special character forces it. `main.ts` is the house driver: it reads every case from `$MAKEFUN_INPUT_DIR/cases.json`, answers each one alone with `run`, and writes `$MAKEFUN_OUTPUT_DIR/answers.json`.

## Run it

```sh
node main.ts
```

It reads cases from `$MAKEFUN_INPUT_DIR` (`/input` in the grader) and writes answers to `$MAKEFUN_OUTPUT_DIR` (`/output` in the grader). Node 22 or later, no dependencies, no network.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8de05yb1&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
