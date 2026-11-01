# MISTVALE | NPC 등록 방법 (로웬 · 에델린 적용 완료)

NPC는 **이미지 두 장**만 등록하면 됩니다. 크기·발끝·그림자·대화창 배치는 공통 코드가 처리합니다.

| 항목 | 용도 | 권장 형식 |
|---|---|---|
| `sprite` | 장소 화면의 작은 전신 도트 (정면 1장) | 투명 PNG, 128×128 캔버스, 발끝을 아래쪽에 맞춘 도트 (로웬·에델린과 동일) |
| `portrait` | 대화 화면의 큰 원화 | 세로형 원화(JPG/PNG). 비율 유지, 잘리지 않음 |

## 등록 순서
1. 이미지를 `assets/npc/characters/<id>/` 아래에 둡니다. (예: `sprites/front.png`, `original/illustration.jpg`)
2. `assets/npc/characters.json` 의 `npc` 에 항목을 추가합니다.
   ```json
   "<id>": { "name": "이름", "role": "역할", "sprite": "characters/<id>/sprites/front.png",
             "portrait": "characters/<id>/original/illustration.jpg",
             "lines": [ { "speaker": "이름", "text": "대사" } ] }
   ```
3. `js/world/place-data.js` 의 해당 장소 `npcs` 에 `{ npcId:'<id>', x:57, y:70 }` 를 추가합니다. (`x`,`y` = 발끝 위치, 장면 가로·세로 %)

## 공통 처리 (코드가 자동으로)
- 캐릭터 키는 장소 화면 높이의 약 23%로 통일됩니다.
- 도트는 화면 실제 픽셀 기준 정수 배율(1×, 2×, 3×…)로 표시되어 흐려지지 않습니다.
- 발끝 위치는 이미지의 투명 영역을 읽어 자동으로 찾고, 그림자는 발끝에 맞춰 그려집니다.
- 대화창이 캐릭터를 가리면 장면이 필요한 만큼 위로 올라갑니다.
- 정면 도트 1장만 사용합니다(행동 프레임·반복 애니메이션 없음).

## 개별 배치가 필요한 경우 (인외 등)
`js/world/npc-presentation.js` 에 해당 id만 추가합니다. (`spriteScale`, `spriteFootY`, `portraitFit`, `portraitPosition`)

## 에셋 메모
- `characters/edelin/sprites/front.png` 는 제공된 `idle-front.png`(1254×1254, 도트풍 확대 이미지)를 128×128 도트 규격으로 환산한 파생 파일입니다. 원본 `idle-front.png` 는 그대로 보관되어 있습니다.
- `portraits/*.png`(도트 초상)와 `sprites/idle|read|work|greet.png` 는 현재 사용하지 않지만 삭제하지 않았습니다.
- 에델린 도서관 영업시간은 정해지지 않아 표시하지 않습니다.
