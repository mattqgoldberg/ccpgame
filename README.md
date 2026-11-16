<img src="public/assets/icon.svg" width="64" height="64" alt="">

# Cloud Tycoon

A tycoon game about running an internet business on a simulated AWS. It's built to teach the AWS Certified Cloud Practitioner (CLF-C02) exam concepts through play.

- Design: [docs/DESIGN.md](docs/DESIGN.md)
- Exam coverage matrix: [src/content/coverage.ts](src/content/coverage.ts)

```sh
npm install
npm run dev               # start the prototype
npm test                  # run tests (includes coverage-matrix checks)
npm run coverage:report   # how topics spread across exam domains and chapters
npm run balance           # play every mission's intended solution and known-bad designs
npm run debug:mission 4-3 # list the hours a mission's solution drops requests, and why
npm run bill 6-1          # end-of-mission bill for the solution vs. changing nothing
```

Not affiliated with or endorsed by Amazon Web Services.
