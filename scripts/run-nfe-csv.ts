import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { processNfeZip } from '../src/nfe/pipeline';

function main(): void {
  const input = process.argv[2];
  if (!input) {
    console.error('Uso: npm run nfe:csv -- <arquivo.zip> [arquivo-saida.csv]');
    process.exit(1);
  }

  const output = process.argv[3] ?? basename(input).replace(/\.zip$/i, '') + '.csv';

  const { csv, summary } = processNfeZip(readFileSync(input));

  writeFileSync(output, csv, 'utf8');

  console.table({
    'XMLs no ZIP': summary.totalXmls,
    'Processados com sucesso': summary.processados,
    'Itens no CSV': summary.totalItens,
    'Falhas': summary.falhas.length,
  });

  if (summary.falhas.length > 0) {
    console.warn('Arquivos com falha (pulados):');
    for (const { arquivo, erro } of summary.falhas) {
      console.warn(`  - ${arquivo}: ${erro}`);
    }
  }
}

main();
