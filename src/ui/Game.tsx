import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { TICKS_PER_SECOND, useGame } from '../game/store';
import { Canvas } from './Canvas';
import { IntroModal, NoticeModal, ReportModal } from './Modals';
import { Palette } from './Palette';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Game() {
  const speed = useGame((s) => s.speed);
  const showIntro = useGame((s) => s.showIntro);
  const notice = useGame((s) => s.sim?.notices[0]);
  const finished = useGame((s) => s.sim?.finished);
  const report = useGame((s) => s.report);
  const toast = useGame((s) => s.toast);
  const paused = speed === 0 || showIntro || !!notice || !!finished;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => useGame.getState().tick(), 1000 / (TICKS_PER_SECOND * speed));
    return () => clearInterval(id);
  }, [paused, speed]);

  // Space toggles pause, unless typing in a field.
  useEffect(() => {
    let resume: 1 | 2 | 4 = 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, select, textarea, button')) return;
      e.preventDefault();
      const { speed: current, setSpeed } = useGame.getState();
      if (current === 0) setSpeed(resume);
      else {
        resume = current;
        setSpeed(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="game">
        <TopBar />
        <Palette />
        <main className="canvas">
          <Canvas />
          {speed === 0 && !showIntro && !notice && !finished && <div className="paused-banner">Paused: press Space or choose a speed</div>}
        </main>
        <Sidebar />
      </div>
      {showIntro && <IntroModal />}
      {!showIntro && notice && <NoticeModal notice={notice} />}
      {!showIntro && !notice && finished && report && <ReportModal />}
      {toast && <div className="toast" key={toast.id}>{toast.text}</div>}
    </ReactFlowProvider>
  );
}
