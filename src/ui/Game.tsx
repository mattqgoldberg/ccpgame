import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { servicesIn } from '../content/tutorial';
import { TICKS_PER_SECOND, clockAllowed, featuresOf, useFeatures, useGame, type Speed } from '../game/store';
import { Canvas } from './Canvas';
import { Coach } from './Coach';
import { NoticeModal, ReportModal } from './Modals';
import { DotLegend } from './RequestDots';
import { Palette } from './Palette';
import { Sidebar, TABS } from './Sidebar';
import { TopBar } from './TopBar';
import { useSoundEffects } from './useSoundEffects';

export function Game() {
  const speed = useGame((s) => s.speed);
  const notice = useGame((s) => s.sim?.notices[0]);
  const finished = useGame((s) => s.sim?.finished);
  const report = useGame((s) => s.report);
  const toast = useGame((s) => s.toast);
  const canRun = useGame(clockAllowed);
  const features = useFeatures();
  const hasPalette = servicesIn(features).length > 0;
  const hasSidebar = TABS.some((t) => features.has(t.feature));
  const running = speed > 0 && canRun && !notice && !finished;
  useSoundEffects();

  // Fixed frame rate; faster speeds simulate more hours per frame instead of rendering more often.
  useEffect(() => {
    if (!running) return;
    const FRAME_MS = 100;
    let owed = 0;
    const id = setInterval(() => {
      owed += (TICKS_PER_SECOND * speed * FRAME_MS) / 1000;
      const hours = Math.floor(owed);
      if (hours > 0) {
        owed -= hours;
        useGame.getState().tick(hours);
      }
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [running, speed]);

  // Space toggles pause, unless typing in a field.
  useEffect(() => {
    let resume: Exclude<Speed, 0> = 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, select, textarea, button')) return;
      const st = useGame.getState();
      if (!featuresOf(st).has('play')) return;
      const { speed: current, setSpeed } = st;
      e.preventDefault();
      if (current === 0) setSpeed(resume);
      else {
        resume = current;
        setSpeed(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const columns = `${hasPalette ? '230px ' : ''}1fr${hasSidebar ? ' 300px' : ''}`;

  return (
    <ReactFlowProvider>
      <div className="game" style={{ gridTemplateColumns: columns }}>
        <TopBar />
        {hasPalette && <Palette />}
        <main className="canvas">
          <Canvas />
          {running && <DotLegend />}
          <Coach />
        </main>
        {hasSidebar && <Sidebar />}
      </div>
      {notice && <NoticeModal notice={notice} />}
      {!notice && finished && report && <ReportModal />}
      {toast && <div className="toast" key={toast.id}>{toast.text}</div>}
    </ReactFlowProvider>
  );
}
