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
npm run balance           # play each chapter with scripted strategies and print outcomes
```

Not affiliated with or endorsed by Amazon Web Services.
