# MISTVALE 마을 안내 확장 가이드

기준: main 652d296 (Add files via upload). 기존 오프닝과 별개인 세계관 소개 화면입니다. 농장 게임, NPC AI, 경제, 인벤토리, 이동·충돌·진행 저장 기능은 없습니다.

## 진입
- X_XPLAY 상단의 마을 안내 / 타이틀의 마을 지도 둘러보기
- world.html#map / world.html#clover
- index.html에는 CSS 링크와 진입 링크 2개만 추가했습니다.
- styles.css, js/app.js, js/loading.js, scripts/serve.mjs는 변경하지 않았습니다.
- world.css는 mv- 접두사를 사용합니다. 기존 설정 중 대사 속도와 모션 감소만 읽습니다.

## 데이터와 에셋 교체
- js/world/map-data.js: 지도 배경 및 시설 위치 (x/y는 이미지의 백분율)
- js/world/place-data.js: 장소 이름, 시간, 용도, 설명, 배경 경로, NPC 배치
- js/world/npc-data.js: 역할명, 작은 이미지, idle 프레임, 큰 이미지/표정, 대사
- js/world/world.js: 화면 전환, 이미지 대체 표시, 대화, 키보드 포커스, 히스토리
- assets/world/: 교체용 이미지. 상대 경로는 world.html 기준입니다.

PNG 교체 예:
```js
small: {
  image: './assets/world/keeper/idle-1.png',
  frames: [
    './assets/world/keeper/idle-1.png',
    './assets/world/keeper/idle-2.png',
    './assets/world/keeper/idle-3.png'
  ],
  frameMs: 650,
  alt: '승인된 점주의 작은 전신 도트'
},
portrait: {
  default: './assets/world/keeper/neutral.png',
  expressions: {
    neutral: './assets/world/keeper/neutral.png',
    smile: './assets/world/keeper/smile.png'
  },
  alt: '승인된 점주의 대화용 도트'
},
dialogue: [
  { text: '승인된 대사', expression: 'neutral' },
  { text: '다음 대사', expression: 'smile' }
]
```

전신 PNG는 투명 배경과 동일한 캔버스 크기/발 위치를 사용하세요. frames 2–4개가 idle로 교체되고 1개면 정지 이미지입니다. 모션 감소 시 정지합니다. CSS image-rendering: pixelated로 확대합니다. 큰 도트는 같은 캐릭터의 별도 PNG로 교체할 수 있습니다.

새 시설은 places에 고유 id를 추가하고 villageMap.locations에 placeId와 좌표를 넣습니다. npcs는 장소별로 배열 배치 가능합니다. 배경은 16:9 권장, x/y는 NPC 발 아래 중심 좌표이며 width는 배경 너비 대비 비율입니다.

현재 점주는 역할명 '잡화점 점주'와 물음표 실루엣뿐입니다. 정식 이름·외형이 아닙니다. 현재 대사는 임시 안내 데이터입니다. 정식 에셋으로 변경할 때 world.html의 외형 미정/시범 표시와 world.js의 접근성 설명도 함께 갱신하세요.

## 시범 이미지
village-map.jpg와 clover-interior.jpg는 이번 작업에서 생성한 교체 가능한 시범 배경입니다. 기존 세계관의 지리나 건물 외형을 확정하지 않습니다. 작은/큰 NPC는 동일한 직접 작성 SVG 실루엣이며 NPC가 배경에 합쳐져 있지 않습니다.
배경 생성 방향: 16:9 판타지 도트풍 초록 마을, 중앙 클로버 잡화점, 글자/인물 없음. 내부는 목재 선반·씨앗·농기구·생활 잡화·중앙 계산대, 인물 없음. 원본을 1440px JPEG로 최적화했습니다.

## 브라우저 검증 (2026-11-01)
실제 Chromium 기반 앱 내 브라우저의 PC 화면과 390×844 모바일 뷰포트에서 확인했습니다.
- 지도 열기, 표시 클릭 → 잡화점, 정보/배경 표시
- 독립 NPC 이미지와 2프레임 src 교체
- NPC 클릭 → 큰 이미지 로딩(210px PC) 및 대화창
- 버튼/본문 클릭, Enter로 다음 대사 및 마지막 종료
- 닫기 버튼, Escape, 지도 복귀
- 모바일 지도·장소·대화 배치 및 가로 넘침 없음
- 지도/내부/NPC 4개 파일을 잠시 치운 상태에서 대체 표시와 대화·복귀 동작, 이후 파일 복원
- 기존 X_XPLAY → 타이틀, NEW GAME → 로딩 → 농가 각성/대사, 새 진입 링크
- 정상 에셋 상태 마을 페이지 콘솔 오류 없음

마우스 hover 전용 동작, 실제 iOS/Safari/Android 기기, 모든 기존 설정 조합은 별도 실기기 검증하지 않았습니다. hover 스타일과 키보드 focus 표시를 구현했고 focus 표시는 브라우저에서 확인했습니다.
