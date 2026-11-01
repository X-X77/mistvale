# MISTVALE 마을 안내 / NPC 스타터
2026-11-02 · 기준 main bdefcf8

## 구조
- world.html / world.css: 독립적인 세계관 안내. 기존 오프닝 코드 변경 없음.
- js/world/map-data.js: 지도와 시설 표시 좌표. 기존 clover 좌표 유지, library 추가.
- js/world/place-data.js: 시설 정보와 A 배치. clover=로웬, library=에델린. 도서관 hours:null로 시간 숨김.
- assets/npc/characters.json: 동봉된 NPC 원본 데이터. 상대 에셋 경로는 assets/npc/ 기준.
- js/world/npc-data.js: JSON을 기존 NPC 구조에 연결하는 어댑터. {{user}}님 → 방문자님.
- js/world/npc-presentation.js: B만 변경하는 단일 설정 파일.
- assets/world/library-interior.svg: 교체 가능한 도서관 시범 배경. 정식 건축 설정 아님.

## A / B 독립 교체
A는 sprite.idle의 투명 128×128 PNG를 정지 상태로 표시합니다. 원본 비율, object-fit:contain, pixelated를 유지합니다. 로웬의 없는 work/greet 파일은 참조하지 않습니다. 에델린의 추가 포즈는 보관하며 빠른 프레임 애니메이션으로 사용하지 않습니다.

B는 기본적으로 portrait.default(256×256)를 사용합니다. 원본 초상에는 시트 배경이 일부 남아 있으며 임의로 제거하지 않았습니다.
일러스트로 전환하려면 js/world/npc-presentation.js에서 해당 캐릭터 portraitMode를 'pixel' → 'original'로 변경하세요. characters.json의 originalPortrait를 읽으며 A는 바뀌지 않습니다.
pixel 모드의 expression을 'default', 'playful' 등 제공된 키로 변경하면 초기 초상을 교체합니다. 대사별 expression도 기존 시스템에서 지원합니다.
B는 object-fit:contain, original 모드 image-rendering:auto로 표시합니다. 최종 배포 기본값은 두 명 모두 pixel/default입니다.

원본 패키지는 assets/npc/에 그대로 병합했습니다. 원본 illustration/source-sheet, 다른 표정/포즈도 보존했고 새로 그리거나 수정하지 않았습니다. source-sheet는 웹 화면에서 요청하지 않습니다.

## 브라우저 검증
실제 Chromium 기반 앱 내 브라우저 PC 및 390×844 모바일 뷰포트:
- 로웬 → 클로버 잡화점, 에델린 → 작은 도서관
- A 128×128, B 256×256 로딩, PNG 알파 및 배경 합성 확인
- NPC 클릭, 이름/대사/초상, 다음 대사, 마지막 종료, 닫기/Escape, 지도/시설 이동
- {{user}} 원문 미노출, 도서관 영업시간 미표시
- 두 캐릭터 B를 실제 original 일러스트로 전환해 로딩과 A 경로 불변 확인 후 pixel 복원
- 모바일 A/B 잘림과 가로 넘침 없음
- 로웬 A/B 파일을 잠시 제외한 상태에서 fallback 및 대화 표시 확인 후 복원
- 기존 갤러리 다음 이미지, X_XPLAY → 타이틀 → 로딩 확인
- 보호 대상 index.html, styles.css, js/app.js, js/loading.js, scripts/serve.mjs 변경 없음

실제 iOS/Android 기기와 Safari는 미검증입니다. 이 패키지는 정지 포즈 실배치 테스트이며 walk cycle이나 완성된 작업 애니메이션이 아닙니다. A의 마스킹 가장자리 품질은 원본 상태로 보존했습니다.
