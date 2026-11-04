# MISTVALE 미니게임 (낚시 · 요리 · 채광)

`world.html` 의 장소 화면에서 바로 플레이합니다. 오프닝(`index.html`)은 건드리지 않습니다.

| 미니게임 | 위치 | 진입 |
| --- | --- | --- |
| 낚시 | 은빛 호수 · 푸른 해안 | 장소 화면의 「낚시하기」 |
| 요리 | 외곽 농가 · 주방 (지도 하단) | 「요리하기」 |
| 채광 | 숲의 습한 동굴 | 「광맥 캐기」 |
| 채집(미니게임 아님) | 속삭임 숲 | 채집 지점 버튼을 누르면 재료 획득 |

## 구조
- `js/game/*-engine.js` : 화면 없이 도는 순수 규칙(시드 가능한 난수). `npm test` 와 `scripts/fishing-sim.mjs` 가 이것을 직접 돌려 난이도를 검증합니다.
- `js/game/*-ui.js` : 캔버스/DOM 화면. `host.js` 가 공통 틀(상단 바·튜토리얼·결과·그만두기 확인)을 제공하고 `launcher.js` 가 필요할 때만 불러옵니다.
- `js/game/items.js` : 물고기·광석·재료·요리 데이터(수치 조정은 여기). `progress.js` : 소지품·숙련도.
- 저장 키: `mistvale.progress.v1`(소지품·숙련도), `mistvale.minigameTutorial.v1`(튜토리얼 본 여부), `mistvale.mgSound`(효과음). 저장소를 못 쓰면 메모리로만 동작하고 안내가 표시됩니다.

## 난이도 조정
- 낚시: `items.js` 의 `FISH.*.fight`(돌진 세기 `dashForce`, 신호 시간 `tele`, 연속 돌진 `chain`, 체력·거리), `fishing-engine.js` 의 `TUNING`. 바꾼 뒤 `node scripts/fishing-sim.mjs` 로 성공률 표를 확인하세요.
- 요리: `RECIPES` 의 단계, `DISH_QUALITY` 의 점수 기준.
- 채광: `ORES.*.mine` (횟수·약점 크기·이동·박동 주기).

## 아직 없는 것
판매·상점·소지금 변동, 농사 시스템은 이 사이트에 없으며 이번 작업에도 만들지 않았습니다. 아이템의 `value` 는 데이터로만 있고 화면에 가격으로 표시하지 않습니다.
