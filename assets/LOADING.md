# 도트 로딩 에셋 / 컴포넌트

도트 농장주와 이동용 베르는 이번 변경에서 Canvas로 그린 **임시 코드 애니메이션**입니다. 최종 스프라이트로 표현하지 않습니다. 기존 배경과 비주얼노벨 베르 PNG는 교체하지 않았습니다.

## 오프닝

`createPixelLoader(canvas, { mode: 'farm', reduced })`가 6.4초 루프로 걷기, 씨앗 뿌리기, 물주기, 새싹 성장, 부드러운 초기화를 그립니다. 농장주는 이름·성별·외형을 확정하는 주인공이 아닌 익명의 상징입니다. 동작 줄이기에서는 성장한 밭의 정지 프레임을 표시합니다.

`prepareImages(urls, { signal, onProgress, timeout })`는 이미지 로딩·디코딩 완료를 기다립니다. 실패도 준비 완료 항목으로 처리해 대체 배경으로 계속할 수 있습니다. 기본 8초 타임아웃, AbortSignal, 완료 비율 콜백을 지원합니다. 오프닝 진행바는 준비 상태와 최소 6.5초 연출을 결합합니다. 동작 줄이기에서는 최소 1.6초입니다.

빛이 시작되면 도트 애니메이션의 프레임 루프를 정지합니다. 이후 농가에서 재생하지 않습니다.

## 수평 스프라이트 시트로 교체

```js
const animation = createPixelLoader(canvas, {
  mode: 'farm',
  reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  sprite: { src: './assets/farmer-sheet.png', width: 160, height: 86, frames: 40, frameMs: 160 },
});
animation.start();
animation.stop();
```

`width` / `height`는 단일 프레임 크기입니다. 모든 프레임이 가로 한 줄로 놓인 PNG를 사용하세요. 이미지 로딩 실패 시 코드 애니메이션을 유지합니다.

## 일반 이동용 베르

```js
const loading = createTravelLoader(container, { reduced: () => reduceMotion });
loading.show();
try { await prepareNextScene(); }
finally { loading.hide(); }
// 상위 화면 제거 시
loading.destroy();
```

동일한 `sprite` 옵션을 전달할 수 있습니다. 현재 오프닝에서는 호출하지 않습니다. `tests/loading-preview.html`에서 표시/숨기기와 동작 줄이기를 독립적으로 확인할 수 있습니다.
