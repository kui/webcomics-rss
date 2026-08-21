import { parseRanking } from './index';

const MIN_ITEMS = 20;

const res = await fetch('https://webcomics.jp/ranking/new-recent', {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)' },
});
if (!res.ok) {
  throw new Error(`upstream returned HTTP ${res.status}`);
}

const html = await res.text();
const { items, blockCount, skipped } = await parseRanking(html);

console.log(`blocks=${blockCount} items=${items.length} skipped=${skipped.length}`);
for (const s of skipped) console.log(`  skipped ${s.comicId}: ${s.reason}`);
if (items[0]) console.log(`  first: #${items[0].rank} ${items[0].title} -> ${items[0].detailUrl}`);

if (items.length < MIN_ITEMS) {
  throw new Error(`extracted ${items.length} items (expected >= ${MIN_ITEMS}). Upstream HTML likely changed.`);
}
console.log('OK');
