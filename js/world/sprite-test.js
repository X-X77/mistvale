// Opt-in visual test only. Portraits, dialogue and the other 21 NPCs stay unchanged.
export const spriteTest = new URLSearchParams(location.search).get('sprites') === '1';
export const testSprites = {
  edelin: './assets/characters/sprite-test/edelin_sprite.png',
  rowen: './assets/characters/sprite-test/rowen_sprite.png',
};
