# 치비 누끼 파이프라인

원본(`assets/characters/chibi-originals/*.png`)은 건드리지 않고 `assets/characters/chibis-matted/*.webp` 를 만듭니다.

1. `seg.py`   — isnet-anime(rembg)로 사람·소품·날개·꼬리 전체의 전경 마스크 생성 (흰색 일괄 삭제 아님)
2. `matte.py` — 마스크를 trimap 으로 바꿔 pymatting(closed-form)으로 머리카락 같은 가는 경계의 알파와 전경색을 추정
3. `post.py`  — 흰 테두리·바닥 안개 제거, 경계 색 오염 보정 (흰 옷·피부 안쪽은 건드리지 않음)
4. `export.py`— 원본에서 잘려 있던 변은 부드럽게 흐리고, 여백을 잘라 900px WebP 로 저장 + `matte-report.json`

실행 경로는 작업용 폴더(`raw/`, `matted/`, `matted2/`) 기준이며 필요하면 경로를 맞춰 쓰세요.
