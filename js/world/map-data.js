// 마을 지도 데이터. 지도 그림(village-map.jpg)은 그대로 두고, 장소 핀(%)만 올립니다.
//   kind 'building' : 지도 위의 건물·시설 핀
//   kind 'route'    : 지도에 건물이 없는 곳(숲·해안·동굴·호수)으로 드는 길 입구 핀. 지도 가장자리/물가·숲 쪽에 둡니다.
// hx, hy 는 건물·지형 한가운데(가로·세로 %), r 은 눌러지는 영역의 지름(가로 %). 마커는 작게 두고 이 영역이 호버·선택 때 은은하게 빛납니다.
// x, y 는 예전 핀 끝점 위치(호환용). 새 장소는 place-data.js 에 장소를 추가하고 여기에 한 줄만 더하면 됩니다.
export const villageMap = {
  id: 'mistvale',
  title: '미스트베일',
  subtitle: '안개가 머무는 마을',
  description: '지도에서 장소를 선택해 미스트베일의 공간과 인물을 살펴보세요.',
  background: './assets/world/village-map.jpg',
  alt: '초록 들판과 작은 집, 개울이 어우러진 미스트베일 시범 지도',
  locations: [
    // 마을 시설 (기존 2곳의 위치는 그대로)
    { placeId: 'clover', x: 56, y: 49, hx: 57.6, hy: 41.4, r: 10 },
    { placeId: 'library', x: 81, y: 52, hx: 84.4, hy: 40.2, r: 8 },
    { placeId: 'hall', x: 31, y: 37, hx: 33.4, hy: 27.2, r: 8.5 },
    { placeId: 'clinic', x: 42, y: 45, hx: 42.2, hy: 37.6, r: 5.5 },
    { placeId: 'tailor', x: 24, y: 50, hx: 20.6, hy: 40.2, r: 8 },
    { placeId: 'inn', x: 20, y: 69, hx: 16.4, hy: 57.2, r: 8.5 },
    { placeId: 'workshop', x: 44, y: 63, hx: 44.4, hy: 58, r: 7.2 },
    { placeId: 'pub', x: 67, y: 63, hx: 68, hy: 56.2, r: 6.4 },
    { placeId: 'bakery', x: 74, y: 56, hx: 75.7, hy: 51.2, r: 6.4 },
    { placeId: 'post', x: 79, y: 29, hx: 79.9, hy: 21.6, r: 6.8 },
    { placeId: 'apothecary', x: 70, y: 17, hx: 72.9, hy: 12.4, r: 6.2 },
    { placeId: 'ranch', x: 92, y: 27, hx: 92, hy: 17.6, r: 6.6 },
    { placeId: 'forge', x: 82, y: 77, hx: 84.4, hy: 66.6, r: 8 },
    // 길 입구 (지도에 건물이 없는 서식지)
    { placeId: 'whisper-forest', x: 7, y: 84, hx: 6.9, hy: 77.4, r: 7.5, kind: 'route', glyph: '♣' },
    { placeId: 'wet-cave', x: 8, y: 20, hx: 8.2, hy: 14, r: 6.5, kind: 'route', glyph: '◖' },
    { placeId: 'silver-lake', x: 47, y: 26, hx: 47.4, hy: 19.8, r: 7, kind: 'route', glyph: '≈' },
    { placeId: 'blue-coast', x: 91, y: 91, hx: 91, hy: 84.6, r: 6.6, kind: 'route', glyph: '≈' },
  ],
};
