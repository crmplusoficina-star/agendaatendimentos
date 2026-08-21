import fs from 'node:fs';

const mapPath = new URL('../src/MapPanelV2.tsx', import.meta.url);
let source = fs.readFileSync(mapPath, 'utf8');
source = source.replace(/\n\s*<div className='branch-address-strip'>[\s\S]*?<\/div>\n\s*<div className='map-dashboard-grid'>/, "\n    <div className='map-dashboard-grid'>");
fs.writeFileSync(mapPath, source);
console.log('fix-v9 aplicado');
