# 대장간 시범 화면 · 첫 만남 대사

기준 main: b6e530d. 디자인 변경은 검은모루 대장간에만 적용했습니다. 다른 장소의 스타일, 23명 원화, 오프닝 및 스토어 파일은 변경하지 않았습니다.

- forge-encounter.css: PC 1560px / 82svh 장면, 원화 영역 44%, 하단 대화창, 모바일 700px 분기.
- assets/world/forge-interior.jpg: 새 작업장 배경. 기존 대장간 배경은 없었습니다. 인물 없는 배경만 생성했으며 비앙카 원화는 원본 그대로 사용합니다.
- js/world/first-meetings.js: 첨부 원문의 23명 × 3문장 및 짧은 재방문 인사.
- js/world/encounter-session.js: sessionStorage로 현재 탭 방문 세션만 유지. 마지막 문장 종료 시에만 완료. 중간 닫기/취소는 미완료. 저장 차단 시 메모리만 사용.
- js/world/npc-data.js, world.js: 공통 대화 데이터 선택/완료 연결.
- js/world/place-data.js, world.html: 대장간 배경과 시범 스타일 연결.

## 검증
- 첨부 원문과 69개 대사의 문자열/순서 일치 확인.
- 실제 브라우저: 지도 17곳 이동, NPC 23명 클릭 및 첫 문장 표시/닫기/지도 복귀 확인.
- 비앙카: 중간 닫기 후 첫 문장 유지, 3개 대사 순서, Enter 진행, 마지막 종료 후 재방문 인사, 새로고침 유지 확인. 새 탭에서는 첫 만남으로 시작 확인.
- PC 1920×1080 및 모바일 390×844 뷰포트 확인. 모바일 가로 넘침 없음, 원화 얼굴과 대화창 동시 표시. 실물 휴대폰 검증은 하지 않았습니다.
- 전체 23명의 모든 문장을 브라우저에서 끝까지 순회하지는 않았습니다. 비앙카 전체 흐름 및 나머지 NPC 첫 문장, 전체 데이터 원문 비교로 검증했습니다.
- 저장 차단 브라우저의 메모리 대체 경로는 실제 브라우저에서 별도 재현하지 않았습니다.

## 생성 배경
도구: 내장 imagegen. 원본 PNG를 크기 변경 없이 JPEG 품질 90으로 변환했습니다.
원본: C:/Users/Sea/.codex/generated_images/01a19229-304b-7cb3-95b8-db756996584e/exec-f1584fe2-1fc5-4262-948b-4ccce652cda1.png
배포 에셋: assets/world/forge-interior.jpg

생성 프롬프트:

Use case: stylized-concept. Asset type: wide 16:9 background for a cozy fantasy visual novel blacksmith encounter, MISTVALE. Detailed painted anime-game environment, no people, no characters, no text, no interface. A believable intimate working village forge: dark iron anvil in lower left foreground, worn wooden workbench, hanging hammers and tongs on the left wall, piles of iron tools, charcoal, soot-dark stone furnace with warm orange fire in the back-left, timber beams, stone floor, amber sparks very subtle. Rich dark brown wood, charcoal steel gray, warm muted orange furnace light, soft cream daylight from a small high window. Compose the useful workshop detail mostly on the left and middle. Right third is a darker quiet workshop wall so an unchanged separate large vertical character illustration can overlay there. Full scene with tangible tools and material detail, inviting grounded farm-life fantasy, elegant hand-painted environment art, no giant decorative arches, no flat gradient void, no neon, no exaggerated fantasy weapons, no new lore symbols.

추가 회귀 검증: 스토어 갤러리 → 게임 실행 → 타이틀 → NEW GAME → 로딩 → 농가 각성 → SKIP → 초기 마을 선택 → dev 우회 없는 지도 진입을 실제 브라우저에서 확인했습니다. 전체 스토리의 모든 대사는 재생 검증하지 않았습니다. 브라우저 오류 로그 없음.
