export const places = {
  clover: {
    id:'clover', name:'클로버 잡화점', category:'생활과 준비', hours:'09:00–18:00',
    purpose:'씨앗, 농기구, 생활 잡화 판매',
    description:'미스트베일의 생활에 필요한 물건을 소개하는 장소입니다.',
    background:'./assets/world/clover-interior.jpg',
    alt:'나무 선반과 생활 잡화, 계산대가 놓인 클로버 잡화점 시범 내부',
    npcs:[{npcId:'rowen',x:57,y:68}],
  },
  library: {
    id:'library', name:'작은 도서관', category:'책과 이야기', hours:null,
    purpose:'작은 도서관 사서 · 에델린',
    description:'에델린을 만나 이야기를 나눌 수 있는 작은 도서관입니다.',
    background:'./assets/world/library-interior.svg',
    alt:'책장과 창문, 독서 테이블이 놓인 작은 도서관 시범 내부',
    npcs:[{npcId:'edelin',x:57,y:72}],
  },
};
