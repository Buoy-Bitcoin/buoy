#!/usr/bin/env node
/* Builds the Buoy site from data/services.json.

   Run:     node build.mjs
   Writes:  index.html, about.html, 404.html, compare/<a>-vs-<b>.html (one per pair), js/logos.js, sitemap.xml, _redirects,
            robots.txt and data/review.md (every answer with its reason and source, for checking; not linked anywhere).

   To change an answer, edit data/services.json and run this again. To change a logo, replace its file in
   images/logos/ and run this again. The About text is edited straight in about.html, between its two "YOUR TEXT" lines; the build keeps it.
   The homepage text is further down in this file. Do not edit index.html or the compare pages by hand: this script
   writes them again every time it runs. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://buoybitcoin.com';
const data = JSON.parse(readFileSync(join(ROOT, 'data/services.json'), 'utf8'));
const { groups, services } = data;
const POINTS = 3;                                   // each yes is worth 3, so seven markers make 21
const MAX = POINTS * groups.reduce((n, g) => n + g.markers.length, 0);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const logoUri = id => 'data:image/svg+xml;base64,' + readFileSync(join(ROOT, 'images/logos', id + '.svg')).toString('base64');
const logos = Object.fromEntries(services.map(s => [s.id, logoUri(s.id)]));
const score = s => POINTS * Object.values(s.m).filter(x => x.v === true).length;
const slug = (a, b) => [a.id, b.id].sort().join('-vs-');
const write = (rel, text) => { mkdirSync(dirname(join(ROOT, rel)), { recursive: true }); writeFileSync(join(ROOT, rel), text); };

/* ------------------------------------------------------------------ shared parts */
/* Links carry no ".html": the live site (Cloudflare Pages) serves /about and /compare/a-vs-b, and sends the
   ".html" forms there with a redirect. To look at the site on this computer, run tools/serve.py, which does the same. */
const head = ({ title, desc, path, up, extra = '', gone = false }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${gone ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}/${path}">`}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${gone ? '' : `<meta property="og:url" content="${SITE}/${path}">
`}<link rel="icon" href="${up}favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="${up}favicon-32x32.png">
<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<link rel="preload" as="font" type="font/woff" href="${up}fonts/Baskerville-Italic.woff" crossorigin>
<link rel="preload" as="font" type="font/woff" href="${up}fonts/WhitneyHTF-Book.woff" crossorigin>
${extra}<link rel="stylesheet" href="${up}css/site.css">
</head>
<body>
<header class="nav">
  <a class="logo" href="${up || './'}"><img src="${up}images/logos/buoy-logo-horizontal.svg" alt="Buoy, to the homepage" width="158" height="40"></a>
  <nav aria-label="Main">
    <a href="${up}about"${path === 'about' ? ' aria-current="page"' : ''}>About</a>
    <a href="${up}about#v4v" data-v4v>V4V</a>
  </nav>
</header>`;

const footLinks = `<ul>
    <li><a href="https://snort.social/p/npub165w944kqt29hrt90l2ssc0rvmhf0u77dgezskknfnczr7r030v0s2g6kae" target="_blank" rel="noopener">Nostr</a></li>
    <li><a href="https://x.com/jaspervanderee" target="_blank" rel="noopener">X</a></li>
    <li><a href="https://github.com/Buoy-Bitcoin/buoy" target="_blank" rel="noopener">GitHub</a></li>
  </ul>
  <ul>
    <li class="lbl">From the maker of Buoy:</li>
    <li><a href="https://breen.studio/" target="_blank" rel="noopener">Breen Studio</a></li>
    <li><a href="https://dittotranscriptgenerator.com/" target="_blank" rel="noopener">Ditto</a></li>
  </ul>`;

/* The V4V pop-up, on every page. It opens from the V4V link in the navigation. Without JavaScript that link
   goes to the V4V part of the About page instead. */
const v4v = up => `<dialog class="v4v" id="v4v-pop" aria-labelledby="v4v-title">
  <button type="button" class="x" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <h2 id="v4v-title">Value for value</h2>
  <p>If Buoy helped you choose, send back what that was worth to you.</p>
  <img class="qr" src="${up}images/v4v-qr.svg" width="200" height="200" alt="QR code for the Lightning address ${esc(data.v4v.address)}">
  <p class="addr"><b id="ln">${esc(data.v4v.address)}</b> <button type="button" class="clear" id="copy-ln">Copy</button></p>
  <a class="go ink" href="lightning:${esc(data.v4v.address)}" autofocus>Open in wallet</a>
</dialog>
<script src="${up}js/v4v.js"></script>`;

/* inner pages end with the two shores, then the footer */
const innerEnd = up => `<picture class="art shores" aria-hidden="true">
  <img src="${up}images/shores.webp" width="2172" height="724" loading="lazy" alt="">
</picture>
<footer class="foot page-foot">
  ${footLinks}
</footer>
${v4v(up)}
</body>
</html>
`;

const ICON = {
  yes: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M10.5 16.5l4 4 7-8.5"/></svg>',
  no: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M11.5 11.5l9 9M20.5 11.5l-9 9"/></svg>',
  unknown: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 5.1" aria-hidden="true"><circle cx="16" cy="16" r="13"/></svg>',
};
/* The score as a dotted gauge: one dot per point. Scored dots are orange, the rest are grey and fade toward the end. */
const gauge = n => {
  const dots = [];
  for (let i = 0; i < MAX; i++) {
    const t = (190 + (160 * i) / (MAX - 1)) * Math.PI / 180;
    const x = (60 + 52 * Math.cos(t)).toFixed(1), y = (60 + 52 * Math.sin(t)).toFixed(1);
    dots.push(i < n ? `<circle cx="${x}" cy="${y}" r="1.15" class="on"/>` : `<circle cx="${x}" cy="${y}" r="1.15" class="off" opacity="${(0.7 - 0.45 * (i - n) / Math.max(1, MAX - n - 1)).toFixed(2)}"/>`);
  }
  return `<svg viewBox="0 0 120 64" aria-hidden="true">${dots.join('')}</svg>`;
};
const state = v => v === true ? 'yes' : v === false ? 'no' : 'unknown';
const say = { yes: 'yes', no: 'no', unknown: 'not confirmed' };

/* ------------------------------------------------------------------ comparison pages */
function comparePage(a, b) {
  const path = 'compare/' + slug(a, b);
  // the Lightning row always says its answer in a word; the other rows only show a line when the data has one
  const line = (c, key, st) => c.say || (key === 'lightning' && st !== 'unknown' ? (st === 'yes' ? 'Yes' : 'No') : '');
  const cell = (s, key) => { const c = s.m[key], st = state(c.v), txt = line(c, key, st); return `<span class="cell ${st}">${ICON[st]}<span class="vh">${esc(s.name)}: ${say[st]}${c.say ? '. ' : ''}</span>${txt ? `<small${c.say ? '' : ' aria-hidden="true"'}>${esc(txt)}</small>` : ''}</span>`; };
  const open = [a, b].some(s => Object.values(s.m).some(c => c.v == null));
  const svc = s => `<div class="svc"><span class="mark" style="-webkit-mask-image:url(${logos[s.id]});mask-image:url(${logos[s.id]})"></span><span class="vh">${esc(s.name)}</span>
      <div class="score">${gauge(score(s))}<span class="vh">Score: </span><b>${score(s)}<small><span class="vh"> out of</span><span aria-hidden="true"> /</span> ${MAX}</small></b></div></div>`;
  const body = groups.map((g, i) => `  <section class="group">
    <h2>${esc(g.name)}</h2>
${g.markers.map(([key, label]) => `    <div class="row"><span class="label">${esc(label)}</span>${cell(a, key)}${cell(b, key)}</div>`).join('\n')}
  </section>${i < groups.length - 1 ? '\n  <hr class="dots">' : ''}`).join('\n');
  return head({
    title: `${a.name} vs ${b.name}: which one points toward a free market? | Buoy`,
    desc: `${a.name} and ${b.name} side by side on seven yes-or-no markers: ID, payment, custody, Lightning, loans and yield, fiat balances and open source.`,
    path, up: '../',
  }) + `
<main class="page">
  <h1>${esc(a.name)} <span aria-hidden="true">vs</span><span class="vh">versus</span> ${esc(b.name)}</h1>
  <div class="cmp">
  <div class="row head"><span></span>
    ${svc(a)}
    ${svc(b)}
  </div>
${body}
  <p class="key"><span class="yes">${ICON.yes} Yes</span><span class="no">${ICON.no} No</span>${open ? `<span>${ICON.unknown} Not confirmed</span>` : ''}<span>Each yes counts ${POINTS}, up to ${MAX}.</span></p>
  </div>
</main>
` + innerEnd('../');
}

/* ------------------------------------------------------------------ homepage */
const FIVE = [
  ['Privacy', 'Can you buy without showing ID, and pay without your bank?'],
  ['Self-custody', 'Do the coins go straight to you, with no balance left at the company?'],
  ['Medium of exchange', 'Does it deliver over Lightning, so you can spend what you buy?'],
  ['Fiat incentives', 'Does it stay away from loans, yield, and balances in fiat or stablecoins?'],
  ['Verify', 'Is the software open source, so anyone can check it?'],
];
const home = () => head({
  title: 'Buoy: compare Bitcoin-only ways to buy bitcoin',
  desc: 'What Bitcoin future are you building with your choice? Pick two Bitcoin-only services and see which one points toward a free market and which toward control.',
  path: '', up: '',
  extra: `<link rel="preload" as="image" href="images/river-top-desktop.webp" media="(min-width:761px)">
<link rel="preload" as="image" href="images/river-top-mobile.webp" media="(max-width:760px)">
`,
}) + `
<main class="hero">
  <h1>What Bitcoin future <br>are you building with your choice?</h1>
  <div class="sea">
    <div class="stack">
      <picture class="art top">
        <source media="(max-width:760px)" srcset="images/river-top-mobile.webp" width="1280" height="946">
        <img src="images/river-top-desktop.webp" width="2172" height="1678" alt="A painting of one water between two shores. On the left, a walled factory town where people hand their baskets in at a gate. On the right, an orchard where people share baskets of fruit. Below them the view sinks under the surface of the water.">
      </picture>
      <div class="more"></div>
    </div>
    <section class="water" aria-label="Services">
      <div class="pick" id="pick" aria-live="polite"></div>
      <div class="tiles" id="tiles"></div>
      <section class="five">
        <h2>Five things decide every comparison</h2>
        <p class="lead">A yes points toward a free market. A no points toward control.</p>
        <ol>
${FIVE.map(([k, q]) => `          <li><b>${k}</b><span>${q}</span></li>`).join('\n')}
        </ol>
      </section>
    </section>
  </div>
</main>
<footer class="bed">
  <picture class="art">
    <source media="(max-width:760px)" srcset="images/river-bed-mobile.webp" width="1240" height="544">
    <img src="images/river-bed-desktop.webp" width="2244" height="544" loading="lazy" alt="The pale riverbed. On the sand lie a sunken stone in the shape of the FTX logo, a dollar bill, and a set of keys on a bitcoin key ring.">
  </picture>
  <div class="foot">
  ${footLinks}
  </div>
</footer>
<script src="js/logos.js"></script>
<script src="js/home.js"></script>
${v4v('')}
</body>
</html>
`;

/* ------------------------------------------------------------------ About
   The QR code is images/v4v-qr.svg, made by tools/make_qr.py from the address. */
/* The About text is edited straight in about.html, between the two "YOUR TEXT" lines. The build reads that part
   back out of the page and puts the fresh header, footer and V4V pop-up around it, so hand edits are never lost.
   Only the Lightning address inside it is kept in step with data/services.json. */
const aboutText = () => {
  const m = readFileSync(join(ROOT, 'about.html'), 'utf8').match(/<!-- YOUR TEXT STARTS HERE[^>]*-->\n([\s\S]*?)\n<!-- YOUR TEXT ENDS HERE -->/);
  if (!m) throw new Error('about.html has lost its "YOUR TEXT STARTS HERE / ENDS HERE" lines; put them back around the text.');
  return m[1].replace(/href="lightning:[^"]*"/g, `href="lightning:${esc(data.v4v.address)}"`);
};
const about = () => head({
  title: 'About Buoy',
  desc: 'Why Buoy exists: where you buy bitcoin is a choice between a free market and more control. What the site compares, and who made it.',
  path: 'about', up: '',
}) + `
<main class="page">
  <h1>About</h1>
  <div class="prose">
<!-- YOUR TEXT STARTS HERE. Edit anything between this line and the matching line below, then save. The build keeps it. -->
${aboutText()}
<!-- YOUR TEXT ENDS HERE -->
  </div>
</main>
` + innerEnd('');

/* ------------------------------------------------------------------ the page for addresses that no longer exist
   It can be shown at any depth (/blog/something/old), so its links start at the root of the site. */
const gonePage = () => head({
  title: 'Page not found | Buoy',
  desc: 'This page is not part of Buoy any more.',
  path: '404', up: '/', gone: true,
}) + `
<main class="page">
  <h1>This page has sailed</h1>
  <div class="prose">
    <p>Buoy used to cover wallets, nodes and more. It now does one thing: it compares Bitcoin-only ways to buy bitcoin, and shows which ones point toward a free market.</p>
    <p><a class="go ink" href="/">Go to the homepage</a></p>
  </div>
</main>
` + innerEnd('/');

/* ------------------------------------------------------------------ redirects (Cloudflare Pages reads the file _redirects)
   Each comparison has one address, with the two names in alphabetical order. The other order, and the forms the
   first Buoy used, are sent there. data/old-urls.txt holds the rules for pages of the old site that are gone. */
const redirects = pairs => `# Made by build.mjs. Do not edit by hand: edit data/old-urls.txt instead.

# Comparisons asked for in the other order, or in an older form
${pairs.map(p => { const [a, b] = p.split('-vs-'); return `/compare/${b}-vs-${a} /compare/${p} 301\n/${p}.html /compare/${p} 301\n/${b}-vs-${a}.html /compare/${p} 301`; }).join('\n')}

${readFileSync(join(ROOT, 'data/old-urls.txt'), 'utf8').trim()}
`;

/* ------------------------------------------------------------------ write everything */
write('index.html', home());
write('about.html', about());
mkdirSync(join(ROOT, 'compare'), { recursive: true });
for (const f of readdirSync(join(ROOT, 'compare'))) if (f.endsWith('.html')) unlinkSync(join(ROOT, 'compare', f));
const pairs = [];
for (let i = 0; i < services.length; i++) for (let j = i + 1; j < services.length; j++) {
  const a = services[i], b = services[j];
  write(`compare/${slug(a, b)}.html`, comparePage(a, b)); pairs.push(slug(a, b));
}
write('js/logos.js', '/* Made by build.mjs. Do not edit by hand. */\nwindow.BUOY_SERVICES=' + JSON.stringify(services.map(s => ({ id: s.id, name: s.name }))) + ';\nwindow.BUOY_LOGOS=' + JSON.stringify(logos) + ';\n');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'about', ...pairs.sort().map(p => 'compare/' + p)].map(p => `  <url><loc>${SITE}/${p}</loc><lastmod>${data.checked}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('404.html', gonePage());
write('_redirects', redirects(pairs));
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /data/\n\nSitemap: ${SITE}/sitemap.xml\n`);

const mark = v => v === true ? 'yes' : v === false ? 'no' : '**?**';
write('data/review.md', `# Buoy marker answers, for review\n\nChecked ${data.checked}. Made by build.mjs from services.json. Not linked from the site.\n\n` + services.map(s =>
  `## ${s.name} (score ${score(s)} of ${MAX})\n\n| Marker | Answer | Why | Source |\n|---|---|---|---|\n` + groups.flatMap(g => g.markers).map(([k, label]) => `| ${label} | ${mark(s.m[k].v)} | ${s.m[k].why} | ${s.m[k].src} |`).join('\n')).join('\n\n') + '\n');

console.log(`built: homepage, about, ${pairs.length} comparison pages`);
console.log(services.map(s => `${s.name} ${score(s)}`).join(' · '));
