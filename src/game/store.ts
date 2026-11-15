import { create } from 'zustand';
import { MISSIONS, missionIndex } from '../content/missions';
import { getQuestion } from '../content/questions';
import { featuresAt, type Feature, type Mission, type Step, type Tab } from '../content/tutorial';
import * as engine from '../sim/engine';
import { buildReport, type Report } from '../sim/report';
import type { NodeConfig, ServiceKind, SimState } from '../sim/types';
import { clearProgress, loadProgress, saveProgress, type Progress } from './progress';

export type Speed = 0 | 1 | 2 | 4 | 8 | 16;

/** Game hours simulated per real second at 1× speed. */
export const TICKS_PER_SECOND = 2;

interface GameStore {
  screen: 'menu' | 'game';
  missionIdx: number;
  mission: Mission | null;
  sim: SimState | null;
  report: Report | null;
  speed: Speed;
  stepIndex: number;
  /** The current step's task has been verified; waiting for the player to press Next. */
  stepDone: boolean;
  coachOpen: boolean;
  selectedId: string | null;
  selectedEdgeId: string | null;
  tab: Tab;
  toast: { id: number; text: string } | null;
  progress: Progress;

  startMission: (id: string) => void;
  exitToMenu: () => void;
  resetProgress: () => void;
  setSpeed: (speed: Speed) => void;
  setTab: (tab: Tab) => void;
  select: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  nextStep: () => void;
  setCoachOpen: (open: boolean) => void;
  /** Advances up to `hours` game hours, stopping early when something needs the player's attention. */
  tick: (hours?: number) => void;
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

export function currentStep(st: Pick<GameStore, 'mission' | 'stepIndex'>): Step | undefined {
  return st.mission?.steps[st.stepIndex];
}

export function featuresOf(st: Pick<GameStore, 'missionIdx' | 'stepIndex' | 'mission'>): Set<Feature> {
  if (!st.mission) return new Set();
  return featuresAt(MISSIONS, st.missionIdx, Math.min(st.stepIndex, st.mission.steps.length - 1));
}

/** Time may pass: the current step lets the clock run and isn't finished yet. */
export function clockAllowed(st: Pick<GameStore, 'mission' | 'stepIndex' | 'stepDone'>): boolean {
  const step = currentStep(st);
  return !step || (!!step.clock && !st.stepDone);
}

export function isMissionUnlocked(progress: Progress, id: string): boolean {
  const i = missionIndex(id);
  return i === 0 || (progress.stars[MISSIONS[i - 1]?.id] ?? 0) > 0;
}

export const useGame = create<GameStore>((set, get) => {
  /** Runs `fn` on a copy of the sim, then commits it. A string result is shown as an error toast. */
  function mutate(fn: (s: SimState, m: Mission) => string | null | void) {
    const { sim, mission } = get();
    if (!sim || !mission) return;
    const next = structuredClone(sim);
    const err = fn(next, mission);
    if (typeof err === 'string') {
      get().showToast(err);
      return;
    }
    commit(next, mission);
  }

  function commit(next: SimState, mission: Mission) {
    const prev = get().sim;
    const progress = get().progress;
    let updated = progress;
    const newCodex = next.codex.filter((id) => !progress.codex.includes(id));
    if (newCodex.length) updated = { ...updated, codex: [...updated.codex, ...newCodex] };

    let report = get().report;
    if (next.finished && !report) {
      report = buildReport(next, mission);
      if (report.passed) {
        engine.unlockCodex(next, mission.codexOnComplete);
        const codex = [...new Set([...updated.codex, ...mission.codexOnComplete])];
        const best = Math.max(updated.stars[mission.id] ?? 0, report.stars);
        updated = { ...updated, codex, stars: { ...updated.stars, [mission.id]: best } };
      }
    }
    if (updated !== progress) saveProgress(updated);

    // Pause whenever something happens: a new message, an urgent alert, or the end of the mission.
    const newNotice = next.notices.length > (prev?.notices.length ?? 0);
    const newDanger = next.alerts.length > (prev?.alerts.length ?? 0) && next.alerts.at(-1)?.tone === 'danger';
    const pause = newNotice || newDanger || next.finished;
    set({ sim: next, report, progress: updated, ...(pause ? { speed: 0 as Speed } : {}) });
    if (newDanger) get().showToast(`⏸ ${next.alerts.at(-1)!.text}`);
    evaluate();
  }

  /** Checks whether the player has completed the current step's task. */
  function evaluate() {
    const st = get();
    const step = currentStep(st);
    if (!step || st.stepDone || !step.done || !st.sim) return;
    if (!step.done({ sim: st.sim, ui: { selectedId: st.selectedId, tab: st.tab, speed: st.speed } })) return;
    const last = st.mission!.steps.at(-1) === step;
    if (step.auto) advance();
    else if (step.clock && !last) {
      // "Run until…" steps hand straight over to whatever happens next, paused so the player reads it.
      set({ speed: 0 });
      advance();
    } else set({ stepDone: true, speed: 0, coachOpen: true });
  }

  function advance() {
    const { mission, stepIndex } = get();
    if (!mission) return;
    const next = Math.min(stepIndex + 1, mission.steps.length);
    set({ stepIndex: next, stepDone: false, coachOpen: true });
    unlockStepCodex();
    evaluate();
  }

  function unlockStepCodex() {
    const { sim, mission, stepIndex } = get();
    const ids = mission?.steps[stepIndex]?.codex;
    if (!sim || !mission || !ids?.length) return;
    const next = structuredClone(sim);
    engine.unlockCodex(next, ids);
    commit(next, mission);
  }

  return {
    screen: 'menu',
    missionIdx: 0,
    mission: null,
    sim: null,
    report: null,
    speed: 0,
    stepIndex: 0,
    stepDone: false,
    coachOpen: true,
    selectedId: null,
    selectedEdgeId: null,
    tab: 'inspect',
    toast: null,
    progress: loadProgress(),

    startMission: (id) => {
      const idx = missionIndex(id);
      const mission = MISSIONS[idx];
      if (!mission) return;
      const sim = engine.createSim(mission, Date.now() % 100_000);
      engine.unlockCodex(sim, mission.codexOnStart);
      set({
        screen: 'game', missionIdx: idx, mission, sim: null, report: null, speed: 0,
        stepIndex: 0, stepDone: false, coachOpen: true, selectedId: null, selectedEdgeId: null, tab: 'inspect',
      });
      commit(sim, mission);
      unlockStepCodex();
    },
    exitToMenu: () => set({ screen: 'menu', sim: null, mission: null, report: null, speed: 0 }),
    resetProgress: () => set({ progress: clearProgress() }),
    setSpeed: (speed) => {
      const st = get();
      if (speed > 0 && !clockAllowed(st)) {
        const step = currentStep(st);
        get().showToast(step?.task ? `First: ${step.task}` : 'Read the message, then press Next.');
        return;
      }
      if (speed > 0 && st.sim?.notices.length) return;
      set({ speed });
      evaluate();
    },
    setTab: (tab) => {
      set({ tab });
      evaluate();
    },
    select: (id) => {
      set((st) => ({ selectedId: id, selectedEdgeId: null, tab: id && featuresOf(st).has('tab-inspect') ? 'inspect' : st.tab }));
      evaluate();
    },
    selectEdge: (id) => {
      set((st) => ({ selectedEdgeId: id, selectedId: null, tab: id && featuresOf(st).has('tab-inspect') ? 'inspect' : st.tab }));
    },
    nextStep: () => {
      const st = get();
      const step = currentStep(st);
      if (!step || (step.done && !st.stepDone)) return;
      advance();
    },
    setCoachOpen: (coachOpen) => set({ coachOpen }),

    tick: (hours = 1) => {
      const st = get();
      if (!st.sim || st.sim.finished || st.sim.notices.length || !clockAllowed(st)) return;
      const step = currentStep(st);
      const ui = { selectedId: st.selectedId, tab: st.tab, speed: st.speed };
      mutate((s, m) => {
        const alerts = s.alerts.length;
        for (let i = 0; i < hours; i++) {
          engine.step(s, m);
          if (s.finished || s.notices.length || s.alerts.length > alerts) break;
          if (step?.clock && step.done?.({ sim: s, ui })) break;
        }
      });
    },
    addService: (kind, position) =>
      mutate((s, m) => {
        const err = engine.addNode(s, m, kind, position);
        if (!err) set({ selectedId: s.nodes[s.nodes.length - 1].id, ...(featuresOf(get()).has('tab-inspect') ? { tab: 'inspect' as Tab } : {}) });
        return err;
      }),
    removeNode: (id) => {
      if (get().selectedId === id) set({ selectedId: null });
      mutate((s) => engine.removeNode(s, id));
    },
    connect: (source, target) => mutate((s) => engine.connect(s, source, target)),
    removeEdge: (id) => {
      if (get().selectedEdgeId === id) set({ selectedEdgeId: null });
      mutate((s) => engine.removeEdge(s, id));
    },
    moveNode: (id, position) => mutate((s) => engine.moveNode(s, id, position)),
    configure: (id, patch) => mutate((s) => engine.updateConfig(s, id, patch)),
    enableRootMfa: () => mutate((s) => engine.enableRootMfa(s)),
    dismissNotice: () => {
      const notice = get().sim?.notices[0];
      if (notice?.strike && !get().progress.seenStrikeIntro) {
        const progress = { ...get().progress, seenStrikeIntro: true };
        saveProgress(progress);
        set({ progress });
      }
      mutate((s) => engine.dismissNotice(s));
    },
    choose: (option) => mutate((s, m) => engine.resolveChoice(s, m, option)),
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
      }, 3500);
    },
  };
});

/** Feature set for the current mission step. */
export function useFeatures(): Set<Feature> {
  const missionIdx = useGame((s) => s.missionIdx);
  const stepIndex = useGame((s) => s.stepIndex);
  const mission = useGame((s) => s.mission);
  return featuresOf({ missionIdx, stepIndex, mission });
}

/** Class for an element the tutorial is pointing at. */
export function useTut(key: string): string {
  const active = useGame((s) => {
    const step = currentStep(s);
    // Once time is running there's nothing to click, so drop the marker.
    if (!step || s.stepDone || step.highlight !== key) return false;
    return !(step.clock && s.speed > 0);
  });
  return active ? ' tut-pulse' : '';
}

// Dev-only handle for debugging and automated play-testing.
if (import.meta.env.DEV) (globalThis as Record<string, unknown>).__game = useGame;
