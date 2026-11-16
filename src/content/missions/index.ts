import { featuresAt, mfaOn, servicesIn, type Mission } from '../tutorial';
import { CHAPTER_0 } from './chapter0';
import { CHAPTER_1 } from './chapter1';
import { CHAPTER_2 } from './chapter2';
import { CHAPTER_3 } from './chapter3';
import { CHAPTER_4 } from './chapter4';
import { CHAPTER_5 } from './chapter5';
import { CHAPTER_6 } from './chapter6';
import { CHAPTER_7 } from './chapter7';
import { CHAPTER_8 } from './chapter8';
import { CHAPTER_9 } from './chapter9';
import { CHAPTER_10 } from './chapter10';

export { COMPANY } from './shared';

export const MISSIONS: Mission[] = [...CHAPTER_0, ...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4, ...CHAPTER_5, ...CHAPTER_6, ...CHAPTER_7, ...CHAPTER_8, ...CHAPTER_9, ...CHAPTER_10];

const MFA_MISSION = 1 + MISSIONS.findIndex((m) => m.steps.some((st) => st.done === mfaOn));
MISSIONS.forEach((m, i) => {
  // The engine validates placements against `available`: everything unlocked by the end of the mission.
  m.available = servicesIn(featuresAt(MISSIONS, i, m.steps.length - 1));
  // Same AWS account all game: once the tutorial has you enable root MFA, it stays on.
  m.startsWithMfa = MFA_MISSION > 0 && i >= MFA_MISSION;
});

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function missionIndex(id: string): number {
  return MISSIONS.findIndex((m) => m.id === id);
}
