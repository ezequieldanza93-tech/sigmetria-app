const fs = require('fs');
const path = require('path');

const icons = new Set();
const srcDir = '.';

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next' && e.name !== 'dist' && e.name !== 'out') {
        walk(p);
      }
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const matches = content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g);
        for (const match of matches) {
          match[1].split(',').forEach(n => {
            const raw = n.trim().replace(/ as \w+$/, '');
            const name = raw.replace(/^type\s+/, '');
            if (name && name !== 'Icon' && name !== 'LucideIcon') {
              icons.add(name);
            }
          });
        }
      } catch(e) {}
    }
  }
}

walk(srcDir);
const sorted = [...icons].sort();
const decl = `declare module 'lucide-react' {
  import type { FC, SVGProps } from 'react'

  interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number
    absoluteStrokeWidth?: boolean
  }

  export type Icon = FC<LucideProps>
  export type LucideIcon = Icon
${sorted.map(n => '  export const ' + n + ': Icon').join('\n')}
}
`;
fs.writeFileSync('types/lucide-react.d.ts', decl);
console.log('Generated declarations for ' + sorted.length + ' icons');
console.log('Icons: ' + sorted.join(', '));
