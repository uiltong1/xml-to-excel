import { NfeCsvOptions, NfeItemRow } from './types';

export interface ResolvedCsvOptions {
  delimiter: string;
  decimalComma: boolean;
  includeBom: boolean;
}

export function resolveCsvOptions(options: NfeCsvOptions = {}): ResolvedCsvOptions {
  return {
    delimiter: options.delimiter ?? ';',
    decimalComma: options.decimalComma ?? true,
    includeBom: options.includeBom ?? true,
  };
}

export const CSV_COLUMNS: ReadonlyArray<keyof NfeItemRow> = [
  'chave_acesso',
  'serie',
  'numero_nota',
  'data_emissao',
  'natureza_operacao',
  'cnpj_emitente',
  'nome_emitente',
  'uf_emitente',
  'cnpj_destinatario',
  'nome_destinatario',
  'uf_destinatario',
  'item',
  'codigo_produto',
  'descricao_produto',
  'ncm',
  'cfop',
  'unidade',
  'quantidade',
  'valor_unitario',
  'valor_total_produto',
  'icms_modalidade',
  'icms_origem',
  'icms_cst_csosn',
  'icms_base_calculo',
  'icms_aliquota',
  'icms_valor',
  'icms_st_base_calculo',
  'icms_st_aliquota',
  'icms_st_valor',
  'icms_fcp_valor',
  'icms_fcp_st_valor',
  'icms_desonerado_valor',
  'icms_st_base_retido',
  'icms_st_valor_retido',
  'difal_fcp_uf_destino',
  'difal_icms_uf_destino',
  'difal_icms_uf_remetente',
  'ipi_cst',
  'ipi_enquadramento',
  'ipi_base_calculo',
  'ipi_aliquota',
  'ipi_valor',
  'ii_base_calculo',
  'ii_despesas_aduaneiras',
  'ii_valor',
  'iof_valor',
  'pis_cst',
  'pis_base_calculo',
  'pis_aliquota',
  'pis_valor',
  'cofins_cst',
  'cofins_base_calculo',
  'cofins_aliquota',
  'cofins_valor',
  'nota_valor_total_produtos',
  'nota_valor_total_icms',
  'nota_valor_total_icms_st',
  'nota_valor_total_fcp',
  'nota_valor_total_ipi',
  'nota_valor_total_ii',
  'nota_valor_total_pis',
  'nota_valor_total_cofins',
  'nota_valor_total_nfe',
];

export function formatNumber(value: number, opts: ResolvedCsvOptions): string {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(2);
  return opts.decimalComma ? fixed.replace('.', ',') : fixed;
}

export function escapeCsvField(raw: string, delimiter: string): string {
  if (raw === '') return '';
  const needsQuotes =
    raw.includes(delimiter) || raw.includes('"') || raw.includes('\n') || raw.includes('\r');
  if (!needsQuotes) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

export class CsvBuilder {
  private readonly opts: ResolvedCsvOptions;
  private readonly lines: string[] = [];

  constructor(options: NfeCsvOptions = {}) {
    this.opts = resolveCsvOptions(options);
    this.lines.push(
      CSV_COLUMNS.map((col) => escapeCsvField(String(col), this.opts.delimiter)).join(
        this.opts.delimiter,
      ),
    );
  }

  addRow(row: NfeItemRow): void {
    const fields = CSV_COLUMNS.map((col) => {
      const value = row[col];
      if (typeof value === 'number') {
        return formatNumber(value, this.opts);
      }
      return escapeCsvField(value ?? '', this.opts.delimiter);
    });
    this.lines.push(fields.join(this.opts.delimiter));
  }

  get rowCount(): number {
    return Math.max(0, this.lines.length - 1);
  }

  toString(): string {
    const body = this.lines.join('\r\n') + '\r\n';
    return this.opts.includeBom ? `\uFEFF${body}` : body;
  }
}
