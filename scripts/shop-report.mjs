// 상점 가격표·매입 목록을 마크다운으로 뽑아 줍니다.  사용: node scripts/shop-report.mjs
import { SHOPS, PRICES, DISH_BASE, buyPrice, baseSell } from '../js/game/shop-data.js';
import { describeItem, FISH, ORES, RECIPES, DISH_QUALITY } from '../js/game/items.js';
import { GOODS, GROUPS, groupOf } from '../js/game/goods.js';
import { sellPrice, hoursText } from '../js/game/shop-engine.js';
const out = [];
out.push('## 상점별 판매 목록 (구매가)');
for (const shop of Object.values(SHOPS)) {
  out.push(`\n### ${shop.name} — ${shop.npcId} · 영업 ${hoursText(shop)}`);
  out.push('| 물품 | 분류 | 구매가 | 비고 |', '|---|---|---:|---|');
  for (const row of shop.stock) {
    const info = describeItem(row.id), need = row.need ? '강화 재료: ' + Object.entries(row.need).map(([k, n]) => `${describeItem(k).name} ×${n}`).join(', ') : '';
    out.push(`| ${info.name} | ${GROUPS.find(g => g.id === groupOf(info.kind)).label} | ${buyPrice(row.id)}G | ${[need, info.unique ? '고유 장비(되팔 수 없음)' : '', info.season ? info.season + ' 씨앗' : ''].filter(Boolean).join(' · ')} |`);
  }
}
out.push('\n## 상점별 매입(판매) 배율');
for (const shop of Object.values(SHOPS)) out.push(`- **${shop.name}**: ` + Object.entries(shop.buys).map(([k, v]) => `${k.replace('id:', '').replace('kind:', '')} ×${v}`).join(', '));
out.push('\n## 직접 얻는 물건의 판매가 (로웬 기준 ×1.0)');
out.push('| 물건 | 등급 | 기본 판매가 | 최고가 상점 |', '|---|---|---:|---|');
const best = id => Object.values(SHOPS).map(s => ({ s, p:sellPrice(s, id) })).sort((a, b) => b.p - a.p)[0];
for (const f of Object.values(FISH)) out.push(`| ${f.name} | ${f.tier} | ${baseSell(f.id)}G | ${best(f.id).s.name} ${best(f.id).p}G |`);
for (const o of Object.values(ORES)) out.push(`| ${o.name} | ${o.tier} | ${baseSell(o.id)}G | ${best(o.id).s.name} ${best(o.id).p}G |`);
for (const id of ['herb', 'mushroom', 'berry']) out.push(`| ${describeItem(id).name} | 채집 | ${baseSell(id)}G (사면 ${buyPrice(id)}G) | ${best(id).s.name} ${best(id).p}G |`);
out.push('\n## 요리 판매가 (기본가 × 품질 배율)');
out.push('| 요리 | 일반 | 잘 만든(×1.5) | 훌륭한(×2.2) | 재료 구입비 |', '|---|---:|---:|---:|---:|');
for (const r of Object.values(RECIPES)) { const cost = Object.entries(r.need).reduce((s, [id, n]) => s + buyPrice(id) * n, 0); out.push(`| ${r.name} | ${baseSell(`dish:${r.id}:normal`)}G | ${baseSell(`dish:${r.id}:good`)}G | ${baseSell(`dish:${r.id}:great`)}G | ${cost}G${r.fishAny ? ' + 생선 1마리' : ''} |`); }
out.push('\n## 작물 (수확물. 지금은 얻는 방법이 없고 가격만 정해 둠)');
out.push('| 작물 | 씨앗값 | 자라는 날 | 판매가 | 하루 이익 |', '|---|---:|---:|---:|---:|');
for (const g of Object.values(GOODS).filter(g => g.kind === 'crop')) { const seed = buyPrice('seed-' + g.id.slice(5)); out.push(`| ${g.name} | ${seed}G | ${g.growDays}일 | ${baseSell(g.id)}G | ${((baseSell(g.id) - seed) / g.growDays).toFixed(1)}G |`); }
console.log(out.join('\n'));
