interface ComicItem {
  title: string;
  thumbUrl: string;
  detailUrl: string;
  desc: string;
  rank: string;
  comicId: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const res = await fetch('https://webcomics.jp/ranking/new-recent', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)',
      },
    });
    const html = await res.text();

    const items: ComicItem[] = [];
    const blocks = html.split('<div class="entry">').slice(1);

    for (const block of blocks) {
      try {
        const thumbMatch = block.match(/<img src="(https:\/\/webcomics\.jp\/img\/thumb\/[^"]+)"/);
        if (!thumbMatch) continue;
        const thumbUrl = thumbMatch[1];

        const idMatch = thumbUrl.match(/\/(\d+)\.jpg$/);
        const comicId = idMatch ? idMatch[1] : Math.random().toString();

        const titleBlockMatch = block.match(/<div class="entry-title[^"]*">([\s\S]*?)<\/div>/);
        if (!titleBlockMatch) continue;
        const titleMatch = titleBlockMatch[1].match(/<a[^>]*>([^<]+)<\/a>/);
        if (!titleMatch) continue;
        const title = titleMatch[1].trim();

        const detailBlockMatch = block.match(/<span class="entry-detail">([\s\S]*?)<\/span>/);
        if (!detailBlockMatch) continue;
        const detailUrlMatch = detailBlockMatch[1].match(/href="(https:\/\/webcomics\.jp\/[^"]+)"/);
        if (!detailUrlMatch) continue;
        const detailUrl = detailUrlMatch[1];

        const rankMatch = block.match(/#(\d+)/);
        const rank = rankMatch ? rankMatch[1] : '?';

        const summaryMatch = block.match(/<div class="entry-summary[^"]*">([\s\S]*?)<\/div>/);
        const desc = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        items.push({ title, thumbUrl, detailUrl, desc, rank, comicId });
      } catch {
        continue;
      }
    }

    const now = new Date().toUTCString();
    const rssItems = items.map(item => `
    <item>
      <title>#${item.rank} ${escapeXml(item.title)}</title>
      <link>${escapeXml(item.detailUrl)}</link>
      <guid isPermaLink="false">webcomics-new-${item.comicId}</guid>
      <description><![CDATA[
        <img src="${item.thumbUrl}" alt="${escapeXml(item.title)}" style="max-width:200px"><br>
        ${item.desc}
      ]]></description>
      <enclosure url="${item.thumbUrl}" type="image/jpeg" length="0"/>
      <media:content url="${item.thumbUrl}" medium="image"/>
    </item>`).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Webマンガアンテナ - 新着ランキング</title>
    <link>https://webcomics.jp/ranking/new-recent</link>
    <description>Webマンガアンテナ 新着ランキング（カスタムフィード）</description>
    <language>ja</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${request.url}" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
