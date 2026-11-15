import { create } from 'zustand';
import { getChapter, type PlayableChapter } from '../content/campaign';
import { getQuestion } from '../content/questions';
import * as engine from '../sim/engine';
import { buildReport, type Report } from '../sim/report';
import type { NodeConfig, ServiceKind, SimState } from '../sim/types';
import { loadProgress, saveProgress, type Progress } from './progress';

export type Speed = 0 | 1 | 2 | 4;
export type SidebarTab = 'goals' | 'inspect' | 'bill' | 'advisor' | 'codex';

/** Game hours simulated per real second at 1× speed. */
export const TICKS_PER_SECOND = 4;

interface GameStore {
  screen: 'menu' | 'game';
  chapter: PlayableChapter | null;
  sim: SimState | null;
  report: Report | null;
  speed: Speed;
  showIntro: boolean;
  selectedId: string | null;
  tab: SidebarTab;
  toast: { id: number; text: string } | null;
  progress: Progress;

  startChapter: (id: number) => void;
  exitToMenu: () => void;
  closeIntro: () => void;
  setSpeed: (speed: Speed) => void;
  setTab: (tab: SidebarTab) => void;
  select: (id: string | null) => void;
  tick: () => void;
  addService: (kind: ServiceKind, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  connect: (source: string, target: string) => void;
  removeEdge: (id: string) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  configure: (id: string, patch: Partial<NodeConfig>) => void;
  enableRootMfa: () => void;
  dismissNotice: () => void;
  choose: (option: number) => void;
  answer: (option: number) => void;
  showToast: (text: string) => void;
}

export const useGame = create<GameStore>((set, get) => {
  /** Runs `fn` on a copy of the sim, then commits it. A string result is shown as an error toast. */
  function mutate(fn: (s: SimState, ch: PlayableChapter) => string | null | void) {
    const { sim, chapter } = get();
    if (!sim || !chapter) return;
    const next = structuredClone(sim);
    const err = fn(next, chapter);
    if (typeof err === 'string') {
      get().showToast(err);
      return;
    }
    commit(next, chapter);
  }

  function commit(next: SimState, chapter: PlayableChapter) {
    const progress = get().progress;
    const newCodex = next.codex.filter((id) => !progress.codex.includes(id));
    let updated = progress;
    if (newCodex.length) updated = { ...updated, codex: [...updated.codex, ...newCodex] };

    let report = get().report;
    if (next.finished && !report) {
      report = buildReport(next, chapter);
      if (report.passed) {
        engine.unlockCodex(next, chapter.codexOnComplete);
        const codex = [...new Set([...updated.codex, ...chapter.codexOnComplete])];
        const best = Math.max(updated.stars[chapter.id] ?? 0, report.stars);
        updated = { ...updated, codex, stars: { ...updated.stars, [chapter.id]: best } };
      }
    }
    if (updated !== progress) saveProgress(updated);
    set({ sim: next, report, progress: updated });
  }

  return {
    screen: 'menu',
    chapter: null,
    sim: null,
    report: null,
    speed: 1,
    showIntro: false,
    selectedId: null,
    tab: 'goals',
    toast: null,
    progress: loadProgress(),

    startChapter: (id) => {
      const chapter = getChapter(id);
      if (!chapter) return;
      const sim = engine.createSim(chapter, Date.now() % 100_000);
      engine.unlockCodex(sim, chapter.codexOnStart);
      set({ screen: 'game', chapter, report: null, speed: 1, showIntro: true, selectedId: null, tab: 'goals' });
      commit(sim, chapter);
    },
    exitToMenu: () => set({ screen: 'menu', sim: null, chapter: null, report: null }),
    closeIntro: () => set({ showIntro: false }),
    setSpeed: (speed) => set({ speed }),
    setTab: (tab) => set({ tab }),
    select: (id) => set((st) => ({ selectedId: id, tab: id ? 'inspect' : st.tab === 'inspect' ? 'goals' : st.tab })),

    tick: () => {
      const { sim, showIntro } = get();
      if (!sim || showIntro || sim.finished || sim.notices.length) return;
      mutate((s, ch) => engine.step(s, ch));
    },
    addService: (kind, position) =>
      mutate((s, ch) => {
        const err = engine.addNode(s, ch, kind, position);
        if (!err) set({ selectedId: s.nodes[s.nodes.length - 1].id, tab: 'inspect' });
        return err;
      }),
    removeNode: (id) => {
      mutate((s) => engine.removeNode(s, id));
      if (get().selectedId === id) set({ selectedId: null, tab: 'goals' });
    },
    connect: (source, target) => mutate((s) => engine.connect(s, source, target)),
    removeEdge: (id) => mutate((s) => engine.removeEdge(s, id)),
    moveNode: (id, position) => mutate((s) => engine.moveNode(s, id, position)),
    configure: (id, patch) => mutate((s) => engine.updateConfig(s, id, patch)),
    enableRootMfa: () => mutate((s) => engine.enableRootMfa(s)),
    dismissNotice: () => mutate((s) => engine.dismissNotice(s)),
    choose: (option) => mutate((s, ch) => engine.resolveChoice(s, ch, option)),
    answer: (option) =>
      mutate((s) => {
        const q = getQuestion(s.notices[0]?.questionId ?? '');
        if (!q) return;
        engine.answerQuestion(s, option === q.answer, q.reward, q.codexIds);
      }),
    showToast: (text) => {
      const id = Date.now();
      set({ toast: { id, text } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 3000);
    },
  };
});
