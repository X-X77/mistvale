// 상점 가격표를 마크다운으로 뽑아 줍니다.  사용: node scripts/shop-report.mjs
import { SHOPS, DISH_BASE, GIFT, buyPrice, baseSell } from '../js/game/shop-data.js';
import { describeItem, FISH, ORES, RECIPES } from '../js/game/items.js';
import { sellPrice, auditEconomy } from '../js/game/shop-engine.js';
const shop = SHOPS.clover, out = [];
out.push(`## 사는 물건 (${shop.name})`, '| 물건 | 구매가 | 효과 |', '|---|---:|---|');
for (const row of shop.stock) { const info = describeItem(row.id); out.push(`| ${info.name} | ${buyPrice(row.id)} 코인 | ${info.desc || '요리 재료'} |`); }
out.push(`| ${GIFT.name} | ${GIFT.cost} 코인 | 누적 ${GIFT.unlockEarned} 코인을 번 뒤에 나타남 |`);
out.push('\n## 파는 물건 (미니게임에서 얻은 것만)', '| 물건 | 등급 | 판매가 |', '|---|---|---:|');
for (const f of Object.values(FISH)) out.push(`| ${f.name} | ${f.tier} | ${sellPrice(shop, f.id)} 코인 |`);
for (const o of Object.values(ORES)) out.push(`| ${o.name} | ${o.tier} | ${sellPrice(shop, o.id)} 코인 |`);
out.push('\n## 요리 (품질 배율 일반 ×1 / 잘 만든 ×1.5 / 훌륭한 ×2.2)', '| 요리 | 일반 | 잘 만든 | 훌륭한 | 재료 구입비 |', '|---|---:|---:|---:|---:|');
for (const r of Object.values(RECIPES)) { const cost = Object.entries(r.need).reduce((s, [id, n]) => s + buyPrice(id) * n, 0); out.push(`| ${r.name} | ${['normal', 'good', 'great'].map(q => sellPrice(shop, `dish:${r.id}:${q}`)).join(' | ')} | ${cost}${r.fishAny ? ' + 생선 1마리' : ''} |`); }
const problems = auditEconomy(); out.push(`\n## 점검: ${problems.length ? problems.join(', ') : '문제 없음'}`);
console.log(out.join('\n'));
