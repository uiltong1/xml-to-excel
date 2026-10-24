import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { zipSync } from 'fflate';
import { CsvBuilder } from '../csv';
import { parseNfeXml } from '../parser';
import { processNfeZip } from '../pipeline';
import { iterateZipXmlEntries, ZipProcessError } from '../zip';

const XML_SAMPLE = readFileSync(
  join(__dirname, '..', '..', '..', 'xml', '29260810230480000300550100020562051205270502-nfe.xml'),
  'utf8',
);

function toZip(files: Record<string, string | Uint8Array>): Uint8Array {
  const enc = new TextEncoder();
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = typeof content === 'string' ? enc.encode(content) : content;
  }
  return zipSync(entries);
}

test('parseNfeXml: extrai identificação, ICMS60, PIS/COFINS e totais', () => {
  const rows = parseNfeXml(XML_SAMPLE);
  assert.equal(rows.length, 1);

  const row = rows[0];
  assert.equal(row.chave_acesso, '29260810230480000300550100020562051205270502');
  assert.equal(row.numero_nota, '2056205');
  assert.equal(row.serie, '10');
  assert.equal(row.data_emissao, '2026-08-14');
  assert.equal(row.cnpj_emitente, '10230480000300');
  assert.equal(row.nome_emitente, 'FERREIRA COSTA   CIA. LTDA');
  assert.equal(row.cfop, '5405');
  assert.equal(row.ncm, '73241000');

  assert.equal(row.icms_modalidade, 'ICMS60');
  assert.equal(row.icms_cst_csosn, '60');
  assert.equal(row.icms_base_calculo, 0);
  assert.equal(row.icms_valor, 0);

  assert.equal(row.pis_cst, '01');
  assert.equal(row.pis_base_calculo, 234.9);
  assert.equal(row.pis_aliquota, 1.65);
  assert.equal(row.pis_valor, 3.88);
  assert.equal(row.cofins_cst, '01');
  assert.equal(row.cofins_valor, 17.85);

  assert.equal(row.ipi_cst, '53');
  assert.equal(row.ipi_valor, 0);

  assert.equal(row.ii_valor, 0);
  assert.equal(row.iof_valor, 0);

  assert.ok(row.nota_valor_total_nfe > 0);
});

test('parseNfeXml: rejeita XML sem NF-e', () => {
  assert.throws(() => parseNfeXml('<foo><bar/></foo>'), /NFe/);
});

test('parseNfeXml: lida com tag opcional ausente sem lançar', () => {
  const semIpi = XML_SAMPLE.replace(/<IPI>.*?<\/IPI>/, '');
  const rows = parseNfeXml(semIpi);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ipi_valor, 0);
  assert.equal(rows[0].ipi_cst, '');
});

test('processNfeZip: consolida lote e pula XMLs corrompidos', () => {
  const zip = toZip({
    'nota1.xml': XML_SAMPLE,
    'corrompido.xml': '<nfeProc><NFe>',
    'nao-e-xml.txt': 'ignorar',
    'README.md': 'ignorar',
  });

  const { csv, summary } = processNfeZip(zip, { includeBom: false });

  assert.equal(summary.totalXmls, 2);
  assert.equal(summary.processados, 1);
  assert.equal(summary.falhas.length, 1);
  assert.match(summary.falhas[0].arquivo, /corrompido\.xml/);
  assert.equal(summary.totalItens, 1);

  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('chave_acesso'));
  assert.ok(lines[1].includes('29260810230480000300550100020562051205270502'));
  assert.ok(lines[1].includes('3,88'));
});

test('processNfeZip: erro claro para ZIP sem XMLs', () => {
  const zip = toZip({ 'leia-me.txt': 'nada aqui' });
  assert.throws(() => processNfeZip(zip), ZipProcessError);
});

test('processNfeZip: erro claro para buffer que não é ZIP', () => {
  assert.throws(() => processNfeZip(Buffer.from('não sou zip')), ZipProcessError);
});

test('iterateZipXmlEntries: ignora Zip Slip (path traversal)', () => {
  const zip = toZip({ '../escape.xml': XML_SAMPLE });
  let chamado = 0;
  try {
    iterateZipXmlEntries(zip, () => {
      chamado += 1;
    });
  } catch (e) {
    assert.ok(e instanceof ZipProcessError);
  }
  assert.equal(chamado, 0);
});

test('CsvBuilder: escapa aspas e delimitadores (RFC 4180)', () => {
  const csv = new CsvBuilder({ includeBom: false, decimalComma: false });
  const row = parseNfeXml(XML_SAMPLE)[0];
  row.descricao_produto = 'Produto "especial", com vírgula';
  csv.addRow(row);
  const out = csv.toString();
  assert.ok(out.includes('"Produto ""especial"", com vírgula"'));
});

test('CsvBuilder: decimalComma=false gera ponto decimal', () => {
  const csv = new CsvBuilder({ includeBom: false, decimalComma: false });
  const row = parseNfeXml(XML_SAMPLE)[0];
  csv.addRow(row);
  assert.ok(csv.toString().includes('3.88'));
});
