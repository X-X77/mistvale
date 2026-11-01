// Deliberately provisional: do not assign a canonical name, gender or appearance.
export const npcs = {
  'clover-keeper': {
    id: 'clover-keeper',
    name: '잡화점 점주',
    note: '임시 대화 · 이름과 외형 미정',
    small: {
      image: './assets/world/npc-placeholder.svg',
      frames: [
        './assets/world/npc-placeholder.svg',
        './assets/world/npc-placeholder-idle.svg',
      ],
      frameMs: 650,
      alt: '정식 외형이 정해지지 않은 점주의 작은 도트 자리 표시',
    },
    portrait: {
      default: './assets/world/npc-placeholder.svg',
      expressions: { neutral: './assets/world/npc-placeholder.svg' },
      alt: '작은 도트와 같은 점주의 큰 도트 자리 표시',
    },
    dialogue: [
      { expression: 'neutral', text: '클로버 잡화점에 오신 것을 환영합니다.' },
      { expression: 'neutral', text: '이곳에서는 씨앗과 농기구, 생활에 필요한 잡화를 취급합니다.' },
      { expression: 'neutral', text: '영업시간은 오전 9시부터 오후 6시까지입니다. 마을을 둘러보실 때 참고해 주세요.' },
    ],
  },
};
