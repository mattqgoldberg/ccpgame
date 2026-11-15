// Prints how the coverage matrix spreads across exam domains and chapters.
import { CHAPTERS } from '../src/content/chapters';
import { COVERAGE } from '../src/content/coverage';
import { entriesByChapter, summarizeByDomain, uncoveredTasks } from '../src/content/coverageSummary';

console.log(`Coverage matrix: ${COVERAGE.length} entries\n`);
console.log('Domain                              Weight  Total  T1  T2  T3');
for (const d of summarizeByDomain()) {
  console.log(
    `${d.name.padEnd(36)}${`${d.weight}%`.padStart(6)}${String(d.total).padStart(7)}` +
      `${String(d.byTier[1]).padStart(4)}${String(d.byTier[2]).padStart(4)}${String(d.byTier[3]).padStart(4)}`,
  );
}

console.log('\nChapter                         New topics');
const byChapter = entriesByChapter();
for (const c of CHAPTERS) {
  console.log(`${`${c.id}. ${c.title}`.padEnd(32)}${byChapter.get(c.id)!.length}`);
}

const missing = uncoveredTasks();
console.log(missing.length ? `\nUncovered tasks: ${missing.join(', ')}` : '\nAll exam task statements covered.');
