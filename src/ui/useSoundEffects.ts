import { useEffect } from 'react';
import { useGame } from '../game/store';
import { sfx } from './sound';

/** Plays sound effects by watching game state change, so the store and engine stay sound-free. */
export function useSoundEffects() {
  useEffect(
    () =>
      useGame.subscribe((st, prev) => {
        // A new mission resets everything; don't treat that as events.
        if (st.mission !== prev.mission || !st.sim || !prev.sim) return;
        const s = st.sim;
        const p = prev.sim;

        if (st.report && !prev.report) return st.report.passed ? sfx.win() : sfx.lose();

        const notice = s.notices[0];
        if (notice && notice.id !== p.notices[0]?.id) {
          if (notice.strike) return sfx.strike();
          if (notice.tone === 'danger') return sfx.alarm();
          if (notice.tone === 'success') return sfx.good();
          return sfx.notice();
        }

        if (s.alerts.length > p.alerts.length) {
          const tone = s.alerts.at(-1)!.tone;
          if (tone === 'danger') return sfx.alarm();
          if (s.cash > p.cash) return sfx.coin();
        }

        const stepFinished = (st.stepDone && !prev.stepDone) || st.stepIndex > prev.stepIndex;
        const taskStep = st.mission?.steps[prev.stepIndex]?.done;
        if (stepFinished && taskStep) return sfx.taskDone();

        if (s.nodes.length > p.nodes.length) return sfx.place();
        if (s.nodes.length < p.nodes.length) return sfx.remove();
        if (s.edges.length > p.edges.length) return sfx.connect();
        if (s.edges.length < p.edges.length) return sfx.remove();
      }),
    [],
  );
}
