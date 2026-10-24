import { CsvBuilder } from './csv';
import { parseNfeXml } from './parser';
import { NfeCsvOptions, NfeProcessingSummary, ZipLimits } from './types';
import { iterateZipXmlEntries } from './zip';

export interface NfeZipResult {
  csv: string;
  summary: NfeProcessingSummary;
}

export function processNfeZip(
  zipBuffer: Uint8Array,
  csvOptions: NfeCsvOptions = {},
  zipLimits: Partial<ZipLimits> = {},
): NfeZipResult {
  const csv = new CsvBuilder(csvOptions);
  const summary: NfeProcessingSummary = {
    totalXmls: 0,
    processados: 0,
    falhas: [],
    totalItens: 0,
  };

  iterateZipXmlEntries(
    zipBuffer,
    (name, data) => {
      summary.totalXmls += 1;
      try {
        const xml = new TextDecoder('utf-8').decode(data);
        const rows = parseNfeXml(xml);
        for (const row of rows) {
          csv.addRow(row);
          summary.totalItens += 1;
        }
        summary.processados += 1;
      } catch (error) {
        summary.falhas.push({
          arquivo: name,
          erro: error instanceof Error ? error.message : String(error),
        });
      }
    },
    zipLimits,
  );

  return { csv: csv.toString(), summary };
}
