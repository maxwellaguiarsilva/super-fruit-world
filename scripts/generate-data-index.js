import { writeFileSync } from 'node:fs';
import { generateDataIndex } from './data-index.js';

const output = generateDataIndex();
const payload = `${JSON.stringify(output, null, 2)}\n`;

writeFileSync('data/index.json', payload);
console.log(`Generated data/index.json with ${output.files.length} file(s).`);
