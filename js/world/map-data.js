// Coordinates are percentages of the complete 3:2 illustrations. Width and
// height describe the visible footprint, independent of screen size.
const site = (id, x, y, w, h, name, note) => ({ id, x, y, w, h, name, note });
export const atlas = {
  town: {
    title:'마을 중심', art:'./assets/world/atlas-town.webp',
    alt:'목장과 회관, 도서관, 우체국 아래로 분수 광장을 둘러싼 상점과 작업장들이 이어지는 지도',
    sites:[
      site('ranch',17,17,30,26), site('hall',46,16,19,25),
      site('library',67,18,15,20), site('post',88,18,15,20),
      site('workshop',11,46,19,20), site('clover',31,46,16,19),
      site('plaza',49,49,16,21,'중심 광장','분수를 중심으로 마을의 길이 만나는 곳입니다.'),
      site('clinic',67,46,17,21), site('apothecary',88,46,17,20),
      site('forge',10,76,18,24), site('pub',30,76,16,23), site('inn',49,76,18,24),
      site('bakery',69,76,16,23), site('tailor',88,76,17,23),
    ],
  },
  region: {
    title:'주변 지역', art:'./assets/world/atlas-region.webp',
    alt:'북서쪽 숲과 서쪽 농장 사이의 온실, 북쪽 광산, 북동쪽 온천, 동쪽 호수와 남쪽 해안, 동남쪽 꽃밭이 이어지는 지형도',
    sites:[
      site('farmhouse',15,53,25,23,'오래된 농장'),
      site('greenhouse',21,33,15,13,'버려진 온실','오래된 농장과 속삭임 숲이 맞닿는 경계에 있습니다.'),
      site('whisper-forest',14,13,25,21), site('grey-mine',52,12,14,17,'회색산 광산','마을 북쪽 회색산의 갱도입니다.'),
      site('mist-springs',87,13,18,14,'안개 온천','북동쪽 바위 사이로 온천수가 솟습니다.'),
      site('wet-cave',72,25,11,11), site('silver-lake',81,44,24,18),
      site('flower-meadow',83,72,22,17,'꽃바람 초원','마을 동남쪽, 해안 위로 꽃밭이 펼쳐집니다.'),
      site('blue-coast',44,92,33,12),
    ],
  },
};
