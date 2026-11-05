// 미니게임 시작/종료: 화면을 덮고 → 오버레이를 올리고 → 걷어내는 전환. 장소 화면(world.html)에서 호출합니다.
import { Progress } from './progress.js?v=mine1';
import { Sfx } from './sfx.js?v=mine1';
import { MinigameHost } from './host.js?v=mine1';

export const progress = new Progress();
const sfx = new Sfx();
let active = null;
/* 상점 화면도 같은 효과음·같은 켜기/끄기 설정을 씁니다 */
export function shopSfx() { let sound = true; try { sound = localStorage.getItem('mistvale.mgSound') !== '0'; } catch { /* 기본 켜짐 */ } sfx.setEnabled(sound); return sfx; }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const loaders = {
  fishing: () => import('./fishing-ui.js?v=mine1').then(m => m.createFishing),
  cooking: () => import('./cooking-ui.js?v=mine1').then(m => m.createCooking),
  mining:  () => import('./mining-ui.js?v=mine1').then(m => m.createMining),
  gathering: () => import('./gathering-ui.js?v=mine1').then(m => m.createGathering),
  mine: () => import('./mine-ui.js?v=mine1').then(m => m.createMine),
};
const TITLES = { fishing:'낚시', cooking:'요리', mining:'채광', gathering:'채집', mine:'광산' };

/* app: 전환 막(.mv-changing)을 가진 #world, placeName: 헤더 부제 */
export async function startMinigame({ type, placeId, placeName, app, reduced, onExit }) {
  if (active || !loaders[type]) return false;
  active = { type };
  let sound = true; try { sound = localStorage.getItem('mistvale.mgSound') !== '0'; } catch { /* 기본 켜짐 */ }
  sfx.setEnabled(sound);
  app.classList.add('mv-changing'); app.inert = true;
  if (!reduced) await wait(280);
  let host;
  try {
    const create = await loaders[type]();
    host = new MinigameHost({ parent:document.body, progress, sfx, reduced, onClose: async () => {
      document.documentElement.classList.remove('mg-open'); app.classList.add('mv-changing'); if (!reduced) await wait(260);
      app.inert = false; app.classList.remove('mv-changing'); active = null; onExit?.();
    } });
    host.open({ id:type, title:TITLES[type], subtitle:placeName });
    host.setGame(create({ host, placeId, progress, sfx, reduced }));
    document.documentElement.classList.add('mg-open');
    host.root.__game = host.game; host.root.__host = host;
  } catch (error) {
    console.error(error); host?.root?.remove(); active = null; app.inert = false; app.classList.remove('mv-changing'); document.documentElement.classList.remove('mg-open');
    return false;
  }
  app.classList.remove('mv-changing');
  host.showTutorial(false);
  return true;
}
export const isActive = () => !!active;
