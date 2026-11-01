// 마을 지도 데이터. 지도 그림(village-map.jpg)은 그대로 두고, 장소 핀(%)만 올립니다.
//   kind 'building' : 지도 위의 건물·시설 핀
//   kind 'route'    : 지도에 건물이 없는 곳(숲·해안·동굴·호수)으로 드는 길 입구 핀. 지도 가장자리/물가·숲 쪽에 둡니다.
// x, y 는 핀 끝점의 위치(가로·세로 %). 새 장소는 place-data.js 에 장소를 추가하고 여기에 한 줄만 더하면 됩니다.
export const villageMap = {
  id: 'mistvale',
  title: '미스트베일',
  subtitle: '안개가 머무는 마을',
  description: '지도에서 장소를 선택해 미스트베일의 공간과 인물을 살펴보세요.',
  background: './assets/world/village-map.jpg',
  alt: '초록 들판과 작은 집, 개울이 어우러진 미스트베일 시범 지도',
  locations: [
    // 마을 시설 (기존 2곳의 위치는 그대로)
    { placeId: 'clover', x: 56, y: 49 },
    { placeId: 'library', x: 81, y: 52 },
    { placeId: 'hall', x: 31, y: 37 },
    { placeId: 'clinic', x: 42, y: 45 },
    { placeId: 'tailor', x: 24, y: 50 },
    { placeId: 'inn', x: 20, y: 69 },
    { placeId: 'workshop', x: 44, y: 63 },
    { placeId: 'pub', x: 67, y: 63 },
    { placeId: 'bakery', x: 74, y: 56 },
    { placeId: 'post', x: 79, y: 29 },
    { placeId: 'apothecary', x: 70, y: 17 },
    { placeId: 'ranch', x: 92, y: 27 },
    { placeId: 'forge', x: 82, y: 77 },
    // 길 입구 (지도에 건물이 없는 서식지)
    { placeId: 'whisper-forest', x: 7, y: 84, kind: 'route', glyph: '♣' },
    { placeId: 'wet-cave', x: 8, y: 20, kind: 'route', glyph: '◖' },
    { placeId: 'silver-lake', x: 47, y: 26, kind: 'route', glyph: '≈' },
    { placeId: 'blue-coast', x: 91, y: 91, kind: 'route', glyph: '≈' },
  ],
};
