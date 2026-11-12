import {execFileSync} from 'node:child_process';
import {lstat,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {listingReviewSource} from './visual-review-listings.mjs';
import {servicesReviewSource} from './visual-review-services.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const assets=[
 'features/mobile-demo/demo.mjs','features/mobile-demo/copy.mjs','features/mobile-demo/demo.css','features/mobile-demo/sample-art.svg',
 'features/i18n/i18n.mjs','features/i18n/dom.mjs',...['en','gu','hi'].map(lang=>'features/i18n/catalogs/'+lang+'.mjs'),
 'features/stores/preview-fixtures.mjs','features/stores/store-catalogue.mjs',
 'features/service-providers/preview-fixtures.mjs','features/service-providers/provider-public-profile.mjs',
 'features/service-providers/provider-public-card.mjs','features/service-providers/service-selections.mjs',
 'features/marketplace/product-integration.mjs','features/marketplace/public-read-client.mjs','features/marketplace/store-integration.mjs',
 'features/chat/message-text.mjs','features/chat/read-acknowledgement.mjs',
 'features/media/mandatory-photos.mjs','features/shared/bounded-read.mjs'
];
const csp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

function homepageTemplate(homepage){
 const hero=homepage.match(/<section id="oldxHomeHero"[^>]*>[\s\S]*?<\/section>/)?.[0];
 const heading=hero?.match(/<h2 class="[^"<>]+" data-i18n="market\.home\.hero">[^<>]+<\/h2>/)?.[0];
 const intro=hero?.match(/<p class="[^"<>]+" data-i18n="market\.home\.tagline">[^<>]+<\/p>/)?.[0];
 const search=hero?.match(/<input type="text" id="searchInput"[^>]*>/)?.[0];
 if(!heading||!intro||!search?.includes('data-i18n-aria-label="market.search"'))throw new Error('Homepage markup changed; review the visual preview extraction');
 return '<template id="visualReviewHomepage"><section id="oldxHomeHero" class="hero">'+heading+intro+
  '<input type="search" id="searchInput" aria-label="Search products"></section></template>';
}

export async function buildVisualReview({readSource,sha,date,out}){
 if(!/^[a-f0-9]{40}$/.test(sha)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid source provenance');
 const demo=await readSource('mobile-demo.html');
 const homepage=await readSource('index.html');
 const listings=listingReviewSource(homepage);
 const services=servicesReviewSource(await readSource('service-preview.html'),await readSource('features/service-providers/service-preview.mjs'));
 const servicesClient=await readSource('scripts/visual-review-services-client.mjs');
 const servicesImports=new Set(['./features/i18n/i18n.mjs','./features/i18n/dom.mjs',
  './features/service-providers/preview-fixtures.mjs','./features/service-providers/provider-public-profile.mjs']);
 const servicesLogic=servicesClient.replace(/^import \{[\w, ]+\} from '([^']+)';$/gm,(statement,path)=>servicesImports.delete(path)?'':statement);
 if(servicesImports.size||/\b(?:import|firebase|fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|navigator)\b/i.test(servicesLogic+services.renderers)){
  throw new Error('Unexpected Services review client dependency');
 }
 const notice=`<div class="demo-notice" role="note"><strong>SYNTHETIC PREVIEW</strong> · Non-production · Source <code>${sha}</code> · Build ${date}</div>`;
 if(!demo.includes('<div id="demoNotice"')||!demo.includes('</head>')||!demo.includes('</body>'))throw new Error('Demo shell changed; review the visual preview build');
 const html=demo
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,`<meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('</head>','<meta name="robots" content="noindex, nofollow"><link rel="stylesheet" href="./visual-review.css"></head>')
  .replace('<div id="demoNotice"',notice+'<div id="demoNotice"')
  .replace('</body>',homepageTemplate(homepage)+'<a class="action" href="./listings.html">Product &amp; Store visual review</a> <a class="action" href="./services-review.html">Service Provider visual review</a></body>');
 const files=new Map([
  ['index.html',html],
  ['listings.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="robots" content="noindex, nofollow">
<title>OLDX · Product and Store visual review</title><link rel="stylesheet" href="./features/mobile-demo/demo.css">
<link rel="stylesheet" href="./visual-review.css"><link rel="stylesheet" href="./listings.css"><script type="module" src="./listings.mjs"></script></head>
<body>${notice}<div class="review-toolbar"><a href="./index.html">Back to synthetic demo</a>
<label><span data-i18n="market.language">Language</span><select id="reviewLocale"><option value="en">English</option><option value="gu">ગુજરાતી</option><option value="hi">हिन्दी</option></select></label>
<label>Catalogue fixture<select id="reviewScenario"><option value="ready">Loaded</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error and retry</option></select></label></div>
<main id="reviewOverview"><h1 data-i18n="market.product.discover">Browse products</h1><div id="reviewCards"></div><h2 data-i18n="market.home.store">Store</h2><section id="storePublicWrap"></section></main>
${listings.markup}</body></html>`],
  ['listings.css',listings.styles+'\n'+await readSource('scripts/visual-review-listings.css')],
  ['listings.mjs',(await readSource('scripts/visual-review-listings-client.mjs'))+'\n'+listings.renderers],
  ['services-review.html',`<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="robots" content="noindex, nofollow">
<title>OLDX · Service Provider visual review</title><link rel="stylesheet" href="./services-review.css"><script type="module" src="./services-review.mjs"></script></head>
<body>${notice}<header><div class="nav"><a class="btn" href="./index.html">OLDX</a></div><div class="locale-bar">
<label for="reviewLocale" data-i18n="languageLabel">Language</label><select id="reviewLocale"><option value="gu">ગુજરાતી</option><option value="hi">हिन्दी</option><option value="en">English</option></select>
<label for="reviewScenario">Discovery fixture</label><select id="reviewScenario"><option value="ready">Loaded</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error and retry</option></select></div></header>
<main><p id="reviewReadStatus" role="status"></p><button type="button" id="reviewRetry" class="btn" hidden data-i18n="market.provider.reload">Reload providers</button>${services.markup}</main></body></html>`],
  ['services-review.css',services.styles],
  ['services-review.mjs',servicesClient+'\n'+services.renderers],
  ['visual-review.css','.demo-notice code{overflow-wrap:anywhere}#oldxHomeHero{background:#102a43}#oldxHomeHero .toolbar{margin-bottom:0}'],
  ['404.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><h1>Preview page not found</h1><a href="/">Return to synthetic preview</a>'],
  ['robots.txt','User-agent: *\nDisallow: /\n'],
  ['_headers',`/*\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n`]
 ]);
 for(const path of assets)files.set(path,await readSource(path));
 for(const [path,body] of files){
  if(/\b(?:AIza[\w-]{30,}|gh[pousr]_[\w]{30,}|sk-[\w-]{25,}|BEGIN [A-Z ]*PRIVATE KEY|firebase-env\.js|firestore\.googleapis\.com|firebaseio\.com|cloudinary\.com)\b/i.test(body))throw new Error('Forbidden material in '+path);
  if(/https?:\/\//i.test(body.replace('http://www.w3.org/2000/svg','')))throw new Error('External URL in '+path);
 }
 for(const [path,body] of files){
  const destination=join(out,path);
  await mkdir(dirname(destination),{recursive:true});
  await writeFile(destination,body,{flag:'wx'});
 }
 return [...files.keys()];
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
 const revision=process.argv[2]??'HEAD';
 if(process.argv.length>3||!(/^(?:HEAD|[a-f0-9]{40})$/.test(revision)))throw new Error('Use HEAD or a full commit SHA');
 const sha=git('rev-parse','--verify',revision+'^{commit}').trim();
 const parent=join(root,'visual-review');
 await mkdir(parent,{recursive:true});
 if(!(await lstat(parent)).isDirectory())throw new Error('Preview output root must be a directory');
 const out=await mkdtemp(join(parent,sha+'-'));
 await buildVisualReview({sha,date:new Date().toISOString().slice(0,10),out,readSource:path=>git('show',sha+':'+path)});
 console.log(out);
}
