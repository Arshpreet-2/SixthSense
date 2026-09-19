# Project report

`build-report.js` generates `SixthSense_Project_Report_vX.Y.docx`.

When the design changes:
1. Edit the relevant section in `build-report.js`.
2. Increase `VERSION` and add a row to `CHANGELOG`.
3. Run `node docs/build-report.js` (needs `npm install docx` once).
