import {execFileSync} from 'node:child_process';
import {lstat,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const assets=[
 'features/mobile-demo/demo.mjs','features/mobile-demo/copy.mjs','features/mobile-demo/demo.css','features/mobile-demo/sample-art.svg',
 'features/i18n/i18n.mjs',...['en','gu','hi'].map(lang=>'features/i18n/catalogs/'+lang+'.mjs'),
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
 if(!demo.includes('<div id="demoNotice"')||!demo.includes('</head>')||!demo.includes('</body>'))throw new Error('Demo shell changed; review the visual preview build');
 const html=demo
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,`<meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('</head>','<meta name="robots" content="noindex, nofollow"><link rel="stylesheet" href="./visual-review.css"></head>')
  .replace('<div id="demoNotice"',`<div class="demo-notice" role="note"><strong>SYNTHETIC PREVIEW</strong> · Non-production · Source <code>${sha}</code> · Build ${date}</div><div id="demoNotice"`)
  .replace('</body>',homepageTemplate(await readSource('index.html'))+'</body>');
 const files=new Map([
  ['index.html',html],
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
