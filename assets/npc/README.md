# MISTVALE | NPC 등록 방법 (23명 등록 완료 · 원화는 2명 적용)

NPC 한 명 = `characters.json` 의 항목 한 개 + 원화 한 장. 장소 화면의 카드, 대화창, 장소별 인물 목록은 공통 코드가 만듭니다.

## 장소 화면과 대화창
- 장소 화면: 그 장소에 있는 인물이 **원화 카드**(세로 2:3, 비율 유지)로 나옵니다. 점 캐릭터는 쓰지 않습니다.
- 카드를 누르면 모든 NPC가 **같은 대화창**(큰 원화 + 이름·직업 + 대사 상자)을 씁니다. 다음 대사 / 닫기 / 클릭·Enter 지원, 모바일 대응.
- 원화는 잘리거나 늘어나지 않습니다. `illustration` 이 `null` 이면 '원화 준비 중' 카드가 나오며 **다른 그림으로 대신하지 않습니다.**

## 새 NPC 추가 (또는 원화 교체)
1. 원화를 `assets/npc/characters/<id>/original/illustration.jpg` 로 둡니다(세로형 JPG/PNG).
2. `assets/npc/characters.json` 에 항목을 추가하거나, 기존 항목의 `illustration` 을 `null` → `"characters/<id>/original/illustration.jpg"` 로 바꿉니다.
   ```json
   "<id>": { "name":"이름", "kind":"human", "role":"직업/종족", "placeId":"library", "spot":"세부 장소",
             "speech":{ "style":"말투", "first":"초면 호칭", "later":"이후 호칭" },
             "illustration":"characters/<id>/original/illustration.jpg",
             "lines":[ "첫 대사", "다음 대사" ] }
   ```
3. `placeId` 가 `js/world/place-data.js` 의 장소 id 와 같으면 **그 장소에 자동으로 나타납니다.** 장소 파일에 인물을 적을 필요가 없습니다.
4. `npm test` 가 경로·장소·대사·금지어를 점검하고 누락 원화를 알려 줍니다.

필드: `kind`(human | nonhuman) · `role`(카드·대화창에 표시) · `spot`(세부 서식처, 인외는 대화창에 표시) · `appears`(출현 시간대 메모, 선택) · `speech`(말투·호칭 기록, 화면에는 표시하지 않음) · `lines`(`{{user}}` 는 안내 사이트에서 '방문자'로 표시됩니다).

> **공개 규칙**: `characters.json` 은 사이트에서 누구나 내려받을 수 있습니다. 비밀 설정(비설)·성인 설정은 절대 넣지 않습니다. 성별 호칭(군/양/오빠/누나)도 쓰지 않습니다.

## 지도와 장소 추가
- 지도 그림(`assets/world/village-map.jpg`)은 그대로 두고 `js/world/map-data.js` 에 핀 한 줄(`placeId`, `x`, `y`)만 더합니다. 건물이 없는 숲·해안·호수 같은 곳은 `kind:'route'` 로 길 입구 핀을 둡니다.
- 장소는 `js/world/place-data.js` 에 추가합니다. `background` 가 `null` 이면 `mood` 색으로 분위기 배경이 나오고 '배경 일러스트 준비 중'으로 표시됩니다.

## 개별 배치가 필요한 경우
`js/world/npc-presentation.js` 에 해당 id만 추가합니다. (`portraitFit`, `portraitPosition`, `cardPosition`)

## 에셋 메모
- 에델린·로웬의 `sprites/`(도트)와 `portraits/`(도트 초상)는 장소 화면에서 더 이상 쓰지 않지만 삭제하지 않았습니다.
- 에델린 도서관 영업시간은 정해지지 않아 표시하지 않습니다.
