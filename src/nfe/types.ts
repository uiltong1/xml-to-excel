export interface NfeCsvOptions {
  delimiter?: string;
  decimalComma?: boolean;
  includeBom?: boolean;
}

export interface ZipLimits {
  maxXmlEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxXmlEntries: 500,
  maxEntryBytes: 10 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
};

export interface NfeProcessingSummary {
  totalXmls: number;
  processados: number;
  falhas: Array<{ arquivo: string; erro: string }>;
  totalItens: number;
}

export interface NfeItemRow {
  chave_acesso: string;
  serie: string;
  numero_nota: string;
  data_emissao: string;
  natureza_operacao: string;
  cnpj_emitente: string;
  nome_emitente: string;
  uf_emitente: string;
  cnpj_destinatario: string;
  nome_destinatario: string;
  uf_destinatario: string;
  item: string;
  codigo_produto: string;
  descricao_produto: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total_produto: number;
  icms_modalidade: string;
  icms_origem: string;
  icms_cst_csosn: string;
  icms_base_calculo: number;
  icms_aliquota: number;
  icms_valor: number;
  icms_st_base_calculo: number;
  icms_st_aliquota: number;
  icms_st_valor: number;
  icms_fcp_valor: number;
  icms_fcp_st_valor: number;
  icms_desonerado_valor: number;
  icms_st_base_retido: number;
  icms_st_valor_retido: number;
  difal_fcp_uf_destino: number;
  difal_icms_uf_destino: number;
  difal_icms_uf_remetente: number;
  ipi_cst: string;
  ipi_enquadramento: string;
  ipi_base_calculo: number;
  ipi_aliquota: number;
  ipi_valor: number;
  ii_base_calculo: number;
  ii_despesas_aduaneiras: number;
  ii_valor: number;
  iof_valor: number;
  pis_cst: string;
  pis_base_calculo: number;
  pis_aliquota: number;
  pis_valor: number;
  cofins_cst: string;
  cofins_base_calculo: number;
  cofins_aliquota: number;
  cofins_valor: number;
  nota_valor_total_produtos: number;
  nota_valor_total_icms: number;
  nota_valor_total_icms_st: number;
  nota_valor_total_fcp: number;
  nota_valor_total_ipi: number;
  nota_valor_total_ii: number;
  nota_valor_total_pis: number;
  nota_valor_total_cofins: number;
  nota_valor_total_nfe: number;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    const text = (value as { '#text'?: unknown })['#text'];
    return text === undefined ? '' : String(text);
  }
  return String(value);
}
