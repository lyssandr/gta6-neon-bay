// Local save: cash, story progress, best score and settings in localStorage.
import { SAVE_KEY, START_CASH } from './config.js';

export function createSave() {
  function read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || !data) return null;
      return data;
    } catch { return null; }
  }
  function write(state) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash, missionIndex: state.missionIndex, missionsDone: state.missionsDone,
        kills: state.kills, carsStolen: state.carsStolen, bestCash: state.bestCash,
        savedAt: new Date().toISOString(),
      }));
      return true;
    } catch { return false; }
  }
  function clear() { try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
  function fresh() {
    return { cash: START_CASH, missionIndex: 0, missionsDone: 0, kills: 0, carsStolen: 0, bestCash: START_CASH };
  }
  return { read, write, clear, fresh };
}
