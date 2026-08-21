interface ComicItem {
  title: string;
  thumbUrl: string;
  detailUrl: string;
  desc: string;
  rank: string;
  comicId: string;
}

export interface ParseResult {
  items: ComicItem[];
  blockCount: number;
  skipped: { comicId: string; reason: string }[];
}

const SOURCE_URL = 'https://webcomics.jp/ranking/new-recent';

interface Draft {
  comicId: string;
  thumbUrl: string;
  detailUrl: string;
  title: string;
  dateText: string;
  desc: string;
}

function newDraft(): Draft {
  return { comicId: '', thumbUrl: '', detailUrl: '', title: '', dateText: '', desc: '' };
}

export async function parseRanking(html: string): Promise<ParseResult> {
  const items: ComicItem[] = [];
  const skipped: { comicId: string; reason: string }[] = [];
  let blockCount = 0;
  let draft: Draft | null = null;

  const missingField = (d: Draft): string | null => {
    if (!d.comicId) return 'comic-no';
    if (!d.thumbUrl) return 'thumb';
    if (!d.title.trim()) return 'title';
    if (!d.detailUrl) return 'detail-url';
    return null;
  };

  const appendTo = (field: 'title' | 'dateText' | 'desc') => ({
    text(chunk: Text) {
      if (draft) draft[field] += chunk.text;
    },
  });

  await new HTMLRewriter()
    .on('div.entry', {
      element(el) {
        blockCount++;
        draft = newDraft();
        draft.comicId = el.getAttribute('data-comic-no') ?? '';
        el.onEndTag(() => {
          const d = draft;
          draft = null;
          if (!d) return;
          const missing = missingField(d);
          if (missing) {
            skipped.push({ comicId: d.comicId || '?', reason: missing });
            return;
          }
          items.push({
            title: decodeEntities(d.title).trim(),
            thumbUrl: d.thumbUrl,
            detailUrl: d.detailUrl,
            desc: decodeEntities(d.desc).trim(),
            rank: d.dateText.match(/#(\d+)/)?.[1] ?? '?',
            comicId: d.comicId,
          });
        });
      },
    })
    .on('div.entry-thumb img', {
      element(el) {
        if (draft) draft.thumbUrl = el.getAttribute('src') ?? '';
      },
    })
    .on('div.entry-title a', appendTo('title'))
    .on('div.entry-date', appendTo('dateText'))
    .on('div.entry-summary', appendTo('desc'))
    .on('span.entry-detail a', {
      element(el) {
        if (draft) draft.detailUrl = el.getAttribute('href') ?? '';
      },
    })
    .transform(new Response(html))
    .arrayBuffer();

  return { items, blockCount, skipped };
}

const DEGRADED_THRESHOLD = 10;

export default {
  async fetch(request: Request): Promise<Response> {
    const now = new Date();
    const res = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)',
      },
    });

    if (!res.ok) {
      console.error(`upstream fetch failed: status=${res.status}`);
      return feedResponse(
        request.url,
        now,
        [alertItem(now, `webcomics.jp が HTTP ${res.status} を返しました。`)],
        false,
      );
    }

    const html = await res.text();
    const { items, blockCount, skipped } = await parseRanking(html);
    const rssItems = items.map(item => renderItem(item));

    if (items.length === 0) {
      console.error(
        `extraction failed: blocks=${blockCount} items=0 htmlBytes=${html.length} skipped=${JSON.stringify(skipped.slice(0, 5))}`,
      );
      return feedResponse(
        request.url,
        now,
        [
          alertItem(
            now,
            `記事を 1 件も抽出できませんでした（entry ブロック ${blockCount} 件、HTML ${html.length} バイト）。webcomics.jp の HTML 構造が変わった可能性があります。`,
          ),
        ],
        false,
      );
    }

    if (items.length < DEGRADED_THRESHOLD) {
      console.error(
        `degraded extraction: blocks=${blockCount} items=${items.length} skipped=${JSON.stringify(skipped.slice(0, 10))}`,
      );
      rssItems.unshift(
        alertItem(
          now,
          `${blockCount} 件中 ${items.length} 件しか抽出できませんでした。失敗理由: ${summarizeSkipped(skipped)}`,
        ),
      );
      return feedResponse(request.url, now, rssItems, false);
    }

    if (skipped.length > 0) {
      console.warn(
        `partial extraction: blocks=${blockCount} items=${items.length} skipped=${JSON.stringify(skipped)}`,
      );
    } else {
      console.log(`extracted ${items.length}/${blockCount} entries`);
    }

    return feedResponse(request.url, now, rssItems, true);
  },
};

function renderItem(item: ComicItem): string {
  return `
    <item>
      <title>#${item.rank} ${escapeXml(item.title)}</title>
      <link>${escapeXml(item.detailUrl)}</link>
      <guid isPermaLink="false">webcomics-new-${item.comicId}</guid>
      <description><![CDATA[
        <img src="${item.thumbUrl}" alt="${escapeXml(item.title)}" style="max-width:200px"><br>
        ${escapeXml(item.desc)}
      ]]></description>
      <enclosure url="${item.thumbUrl}" type="image/jpeg" length="0"/>
      <media:content url="${item.thumbUrl}" medium="image"/>
    </item>`;
}

// guid と pubDate を JST 日付単位で固定し、復旧するまで 1 日 1 件だけ届くようにする
function alertItem(now: Date, detail: string): string {
  const day = jstDay(now);
  return `
    <item>
      <title>⚠️ 抽出に失敗しています (${day})</title>
      <link>${SOURCE_URL}</link>
      <guid isPermaLink="false">webcomics-alert-${day}</guid>
      <pubDate>${new Date(`${day}T00:00:00+09:00`).toUTCString()}</pubDate>
      <description><![CDATA[
        ${escapeXml(detail)}<br><br>
        このフィードは webcomics.jp の HTML を解析して生成しています。解析に失敗したため記事を配信できません。<br>
        <a href="${SOURCE_URL}">元ページを確認する</a>
      ]]></description>
    </item>`;
}

function summarizeSkipped(skipped: { reason: string }[]): string {
  const counts = new Map<string, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  return [...counts].map(([reason, count]) => `${reason} ${count} 件`).join(', ');
}

export function jstDay(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function feedResponse(selfUrl: string, now: Date, rssItems: string[], healthy: boolean): Response {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Webマンガアンテナ - 新着ランキング</title>
    <link>${SOURCE_URL}</link>
    <description>Webマンガアンテナ 新着ランキング（カスタムフィード）</description>
    <language>ja</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>
${rssItems.join('\n')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': healthy ? 'public, max-age=3600' : 'no-store',
    },
  });
}

// HTMLRewriter の text チャンクはエンティティを解決せずに渡してくる
function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
