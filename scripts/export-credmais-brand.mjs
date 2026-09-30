import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const symbol = await readFile(new URL('src/assets/credmais-mark.svg',root),'utf8');
await mkdir(new URL('public/brand/',root),{recursive:true});
await writeFile(new URL('public/brand/credmais-symbol.svg',root),symbol);
await writeFile(new URL('public/favicon.svg',root),symbol);
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({deviceScaleFactor:1});
 const jobs=[['favicon-16.png',16],['favicon-32.png',32],['favicon.png',64],['pwa-192.png',192],['pwa-512.png',512],['apple-touch-icon.png',180],['pwa-maskable-512.png',512]];
 for(const [name,size] of jobs){
  const mask=name.includes('maskable');
  await page.setViewportSize({width:size,height:size});
  await page.setContent('<style>*{box-sizing:border-box}body{margin:0;display:grid;place-items:center;width:100vw;height:100vh;background:'+(mask?'#11100e':'transparent')+'}svg{width:'+(mask?'64%':'100%')+';height:auto}</style>'+symbol);
  await page.screenshot({path:new URL('public/'+name,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'),omitBackground:!mask});
 }
 const pngs=await Promise.all(['favicon-16.png','favicon-32.png','favicon.png'].map(n=>readFile(new URL('public/'+n,root))));
 const header=Buffer.alloc(6+16*pngs.length);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
 let offset=header.length;
 pngs.forEach((png,i)=>{const p=6+i*16;header[p]=[16,32,64][i];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);header.writeUInt32LE(offset,p+12);offset+=png.length;});
 await writeFile(new URL('public/favicon.ico',root),Buffer.concat([header,...pngs]));
 const logo=await readFile(new URL('public/brand/credmais-logo.svg',root),'utf8');
 await page.setViewportSize({width:860,height:224});
 await page.setContent('<style>body{margin:0}svg{width:100%;height:100%}</style>'+logo);
 await page.screenshot({path:new URL('public/brand/credmais-logo.png',root).pathname.replace(/^\/([A-Za-z]:)/,'$1'),omitBackground:true});
 console.log('Exported SVG logo, transparent PNG logo, ICO and PNG icons at 16/32/64/180/192/512 px.');
} finally {await browser.close();}

