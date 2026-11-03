// 치비 주민 배치. 한 줄이 한 명이며, 이 파일만 고치면 위치·크기를 NPC별로 바꿀 수 있습니다.
//   src     : 누끼 완성본 (assets/characters/chibis-matted/<id>.webp)  — 원본은 assets/characters/chibi-originals 에 그대로 있습니다.
//   ratio   : 가로/세로 비율 (그림이 늘어나거나 잘리지 않도록)
//   x       : 가로 중심 위치(%)       ground : 발이 닿는 세로 위치(%)       height : 화면 높이(svh) 기준 크기
//   mobileX / mobileGround / mobileHeight : 모바일 값
//   foot    : 그림 맨 아래에서 발바닥까지의 높이(%)       shadow : 발밑 그림자 너비(%)
export const chibiResidents = {
  "edelin": {"src": "./assets/characters/chibis-matted/edelin.webp?v=20261104c", "ratio": 0.713, "x": 66, "ground": 80, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "rowen": {"src": "./assets/characters/chibis-matted/rowen.webp?v=20261104c", "ratio": 0.594, "x": 62, "ground": 81, "height": 46, "mobileX": 56, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "luciel": {"src": "./assets/characters/chibis-matted/luciel.webp?v=20261104c", "ratio": 0.757, "x": 66, "ground": 80, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "bianca": {"src": "./assets/characters/chibis-matted/bianca.webp?v=20261104c", "ratio": 0.57, "x": 66, "ground": 82, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "noah": {"src": "./assets/characters/chibis-matted/noah.webp?v=20261104c", "ratio": 0.606, "x": 66, "ground": 81, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "mariel": {"src": "./assets/characters/chibis-matted/mariel.webp?v=20261104c", "ratio": 0.698, "x": 64, "ground": 82, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "isabel": {"src": "./assets/characters/chibis-matted/isabel.webp?v=20261104c", "ratio": 0.75, "x": 66, "ground": 80, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "theo": {"src": "./assets/characters/chibis-matted/theo.webp?v=20261104c", "ratio": 0.641, "x": 65, "ground": 81, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "adela": {"src": "./assets/characters/chibis-matted/adela.webp?v=20261104c", "ratio": 0.61, "x": 65, "ground": 79, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "lillian": {"src": "./assets/characters/chibis-matted/lillian.webp?v=20261104c", "ratio": 0.584, "x": 66, "ground": 80, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "edwin": {"src": "./assets/characters/chibis-matted/edwin.webp?v=20261104c", "ratio": 0.584, "x": 65, "ground": 81, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "cordelia": {"src": "./assets/characters/chibis-matted/cordelia.webp?v=20261104c", "ratio": 0.646, "x": 64, "ground": 80, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "felix": {"src": "./assets/characters/chibis-matted/felix.webp?v=20261104c", "ratio": 0.702, "x": 65, "ground": 81, "height": 46, "mobileX": 58, "mobileGround": 82, "mobileHeight": 36, "foot": 3, "shadow": 56},
  "sarkan": {"src": "./assets/characters/chibis-matted/sarkan.webp?v=20261104c", "ratio": 0.723, "x": 62, "ground": 81, "height": 44, "mobileX": 56, "mobileGround": 82, "mobileHeight": 34, "foot": 2, "shadow": 80},
  "miel": {"src": "./assets/characters/chibis-matted/miel.webp?v=20261104c", "ratio": 0.683, "x": 65, "ground": 80, "height": 44, "mobileX": 58, "mobileGround": 82, "mobileHeight": 34, "foot": 3, "shadow": 62},
  "serepina": {"src": "./assets/characters/chibis-matted/serepina.webp?v=20261104c", "ratio": 0.672, "x": 14, "ground": 78, "height": 36, "mobileX": 27, "mobileGround": 56, "mobileHeight": 26, "foot": 3, "shadow": 66},
  "arachne": {"src": "./assets/characters/chibis-matted/arachne.webp?v=20261104c", "ratio": 0.724, "x": 31, "ground": 84, "height": 38, "mobileX": 73, "mobileGround": 56, "mobileHeight": 26, "foot": 3, "shadow": 70},
  "neri": {"src": "./assets/characters/chibis-matted/neri.webp?v=20261104c", "ratio": 0.834, "x": 49, "ground": 78, "height": 34, "mobileX": 23, "mobileGround": 82, "mobileHeight": 26, "foot": 4, "shadow": 66},
  "morel": {"src": "./assets/characters/chibis-matted/morel.webp?v=20261104c", "ratio": 0.683, "x": 66, "ground": 85, "height": 40, "mobileX": 51, "mobileGround": 82, "mobileHeight": 29, "foot": 3, "shadow": 52},
  "lepion": {"src": "./assets/characters/chibis-matted/lepion.webp?v=20261104c", "ratio": 0.719, "x": 85, "ground": 79, "height": 38, "mobileX": 79, "mobileGround": 82, "mobileHeight": 27, "foot": 5, "shadow": 56},
  "kylen": {"src": "./assets/characters/chibis-matted/kylen.webp?v=20261104c", "ratio": 0.643, "x": 25, "ground": 81, "height": 44, "mobileX": 27, "mobileGround": 58, "mobileHeight": 31, "foot": 3, "shadow": 56},
  "nepia": {"src": "./assets/characters/chibis-matted/nepia.webp?v=20261104c", "ratio": 0.777, "x": 54, "ground": 85, "height": 43, "mobileX": 73, "mobileGround": 58, "mobileHeight": 31, "foot": 4, "shadow": 56},
  "seira": {"src": "./assets/characters/chibis-matted/seira.webp?v=20261104c", "ratio": 0.68, "x": 81, "ground": 80, "height": 42, "mobileX": 50, "mobileGround": 88, "mobileHeight": 30, "foot": 0, "shadow": 70},
};
