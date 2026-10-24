import { XMLParser } from 'fast-xml-parser';
import { asArray, NfeItemRow, num, str } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
});

type XmlNode = Record<string, unknown>;

function asNode(value: unknown): XmlNode | undefined {
  return value && typeof value === 'object' ? (value as XmlNode) : undefined;
}

function firstChild(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  if (!node) return undefined;
  return asNode(asArray(node[tag])[0]);
}

function extractChaveAcesso(infNFe: XmlNode): string {
  const id = str(infNFe['Id']);
  return id.replace(/^NFe/i, '');
}

function extractDataEmissao(infNFe: XmlNode): string {
  const ide = firstChild(infNFe, 'ide');
  const dh = str(ide?.['dhEmi'] ?? ide?.['dEmi']);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(dh);
  return match ? match[1] : dh;
}

interface IcmsInfo {
  modalidade: string;
  origem: string;
  cstCsosn: string;
  base: number;
  aliquota: number;
  valor: number;
  stBase: number;
  stAliquota: number;
  stValor: number;
  fcpValor: number;
  fcpStValor: number;
  desonerado: number;
  stBaseRetido: number;
  stValorRetido: number;
}

const ICMS_ZERO: IcmsInfo = {
  modalidade: '',
  origem: '',
  cstCsosn: '',
  base: 0,
  aliquota: 0,
  valor: 0,
  stBase: 0,
  stAliquota: 0,
  stValor: 0,
  fcpValor: 0,
  fcpStValor: 0,
  desonerado: 0,
  stBaseRetido: 0,
  stValorRetido: 0,
};

export function extractIcms(imposto: XmlNode | undefined): IcmsInfo {
  const icmsWrapper = firstChild(imposto, 'ICMS');
  if (!icmsWrapper) return { ...ICMS_ZERO };

  const modalidade = Object.keys(icmsWrapper).find((key) => /^ICMS/i.test(key));
  const grupo = modalidade ? asNode(icmsWrapper[modalidade]) : undefined;
  if (!grupo) return { ...ICMS_ZERO };

  return {
    modalidade: modalidade ?? '',
    origem: str(grupo['orig']),
    cstCsosn: str(grupo['CST'] ?? grupo['CSOSN']),
    base: num(grupo['vBC']),
    aliquota: num(grupo['pICMS']),
    valor: num(grupo['vICMS']),
    stBase: num(grupo['vBCST']),
    stAliquota: num(grupo['pICMSST']),
    stValor: num(grupo['vICMSST']),
    fcpValor: num(grupo['vFCP']),
    fcpStValor: num(grupo['vFCPST']),
    desonerado: num(grupo['vICMSDeson']),
    stBaseRetido: num(grupo['vBCSTRet']),
    stValorRetido: num(grupo['vICMSSTRet']),
  };
}

interface DifalInfo {
  fcpUfDestino: number;
  icmsUfDestino: number;
  icmsUfRemetente: number;
}

export function extractDifal(imposto: XmlNode | undefined): DifalInfo {
  const difal = firstChild(imposto, 'ICMSUFDest');
  if (!difal) {
    return { fcpUfDestino: 0, icmsUfDestino: 0, icmsUfRemetente: 0 };
  }
  return {
    fcpUfDestino: num(difal['vFCPUFDest']),
    icmsUfDestino: num(difal['vICMSUFDest']),
    icmsUfRemetente: num(difal['vICMSUFRemet']),
  };
}

interface IpiInfo {
  cst: string;
  enquadramento: string;
  base: number;
  aliquota: number;
  valor: number;
}

export function extractIpi(imposto: XmlNode | undefined): IpiInfo {
  const ipi = firstChild(imposto, 'IPI');
  if (!ipi) return { cst: '', enquadramento: '', base: 0, aliquota: 0, valor: 0 };

  const tributado = firstChild(ipi, 'IPITrib');
  const naoTributado = firstChild(ipi, 'IPINT');
  const grupo = tributado ?? naoTributado;

  return {
    cst: str(grupo?.['CST'] ?? ipi['CST']),
    enquadramento: str(ipi['cEnq']),
    base: num(grupo?.['vBC']),
    aliquota: num(grupo?.['pIPI']),
    valor: num(grupo?.['vIPI']),
  };
}

interface IiInfo {
  base: number;
  despesasAduaneiras: number;
  valor: number;
  iof: number;
}

export function extractIi(imposto: XmlNode | undefined): IiInfo {
  const ii = firstChild(imposto, 'II');
  if (!ii) return { base: 0, despesasAduaneiras: 0, valor: 0, iof: 0 };

  return {
    base: num(ii['vBC']),
    despesasAduaneiras: num(ii['vDespAdu']),
    valor: num(ii['vII']),
    iof: num(ii['vIOF']),
  };
}

interface ImpostoValorado {
  cst: string;
  base: number;
  aliquota: number;
  valor: number;
}

const IMPOSTO_ZERO: ImpostoValorado = { cst: '', base: 0, aliquota: 0, valor: 0 };

export function extractPisCofins(
  imposto: XmlNode | undefined,
  tag: 'PIS' | 'COFINS',
): ImpostoValorado {
  const wrapper = firstChild(imposto, tag);
  if (!wrapper) return { ...IMPOSTO_ZERO };

  const variante = Object.keys(wrapper).find((key) => key.startsWith(tag));
  const grupo = variante ? asNode(wrapper[variante]) : undefined;
  if (!grupo) return { ...IMPOSTO_ZERO };

  const aliquota = num(grupo['pPIS'] ?? grupo['pCOFINS'] ?? grupo['vAliqProd']);
  const base = num(grupo['vBC'] ?? grupo['qBCProd']);

  return {
    cst: str(grupo['CST']),
    base,
    aliquota,
    valor: num(grupo['vPIS'] ?? grupo['vCOFINS']),
  };
}

interface NotaTotais {
  valorTotalProdutos: number;
  valorTotalIcms: number;
  valorTotalIcmsSt: number;
  valorTotalFcp: number;
  valorTotalIpi: number;
  valorTotalIi: number;
  valorTotalPis: number;
  valorTotalCofins: number;
  valorTotalNfe: number;
}

const TOTAIS_ZERO: NotaTotais = {
  valorTotalProdutos: 0,
  valorTotalIcms: 0,
  valorTotalIcmsSt: 0,
  valorTotalFcp: 0,
  valorTotalIpi: 0,
  valorTotalIi: 0,
  valorTotalPis: 0,
  valorTotalCofins: 0,
  valorTotalNfe: 0,
};

function extractTotais(infNFe: XmlNode): NotaTotais {
  const total = firstChild(infNFe, 'total');
  const icmsTot = firstChild(total, 'ICMSTot');
  if (!icmsTot) return { ...TOTAIS_ZERO };

  return {
    valorTotalProdutos: num(icmsTot['vProd']),
    valorTotalIcms: num(icmsTot['vICMS']),
    valorTotalIcmsSt: num(icmsTot['vICMSST']),
    valorTotalFcp: num(icmsTot['vFCP']),
    valorTotalIpi: num(icmsTot['vIPI']),
    valorTotalIi: num(icmsTot['vII']),
    valorTotalPis: num(icmsTot['vPIS']),
    valorTotalCofins: num(icmsTot['vCOFINS']),
    valorTotalNfe: num(icmsTot['vNF']),
  };
}

export function parseNfeXml(xml: string | Uint8Array): NfeItemRow[] {
  const doc = parser.parse(xml) as XmlNode;

  const nfeList = [
    ...asArray(asNode(doc['nfeProc'])?.['NFe']),
    ...asArray(doc['NFe']),
  ].filter(Boolean);

  if (nfeList.length === 0) {
    throw new Error('XML não contém o elemento <NFe> de uma NF-e.');
  }

  const rows: NfeItemRow[] = [];

  for (const nfe of nfeList) {
    const nfeNode = asNode(nfe);
    const infNFe = firstChild(nfeNode, 'infNFe');
    if (!infNFe) {
      throw new Error('Elemento <infNFe> ausente.');
    }

    const ide = firstChild(infNFe, 'ide');
    const emit = firstChild(infNFe, 'emit');
    const dest = firstChild(infNFe, 'dest');
    const totais = extractTotais(infNFe);

    const identificacao = {
      chave_acesso: extractChaveAcesso(infNFe),
      serie: str(ide?.['serie']),
      numero_nota: str(ide?.['nNF']),
      data_emissao: extractDataEmissao(infNFe),
      natureza_operacao: str(ide?.['natOp']),
      cnpj_emitente: str(emit?.['CNPJ'] ?? emit?.['CPF']),
      nome_emitente: str(emit?.['xNome']),
      uf_emitente: str(asNode(emit?.['enderEmit'])?.['UF']),
      cnpj_destinatario: str(dest?.['CNPJ'] ?? dest?.['CPF']),
      nome_destinatario: str(dest?.['xNome']),
      uf_destinatario: str(asNode(dest?.['enderDest'])?.['UF']),
    };

    const totaisRow = {
      nota_valor_total_produtos: totais.valorTotalProdutos,
      nota_valor_total_icms: totais.valorTotalIcms,
      nota_valor_total_icms_st: totais.valorTotalIcmsSt,
      nota_valor_total_fcp: totais.valorTotalFcp,
      nota_valor_total_ipi: totais.valorTotalIpi,
      nota_valor_total_ii: totais.valorTotalIi,
      nota_valor_total_pis: totais.valorTotalPis,
      nota_valor_total_cofins: totais.valorTotalCofins,
      nota_valor_total_nfe: totais.valorTotalNfe,
    } as const;

    const dets = asArray(infNFe['det']);
    if (dets.length === 0) {
      throw new Error('NF-e sem itens (<det>).');
    }

    for (const detRaw of dets) {
      const det = asNode(detRaw);
      if (!det) continue;

      const prod = firstChild(det, 'prod');
      const imposto = firstChild(det, 'imposto');

      const icms = extractIcms(imposto);
      const difal = extractDifal(imposto);
      const ipi = extractIpi(imposto);
      const ii = extractIi(imposto);
      const pis = extractPisCofins(imposto, 'PIS');
      const cofins = extractPisCofins(imposto, 'COFINS');

      rows.push({
        ...identificacao,
        item: str(det['nItem']),
        codigo_produto: str(prod?.['cProd']),
        descricao_produto: str(prod?.['xProd']),
        ncm: str(prod?.['NCM']),
        cfop: str(prod?.['CFOP']),
        unidade: str(prod?.['uCom']),
        quantidade: num(prod?.['qCom']),
        valor_unitario: num(prod?.['vUnCom']),
        valor_total_produto: num(prod?.['vProd']),

        icms_modalidade: icms.modalidade,
        icms_origem: icms.origem,
        icms_cst_csosn: icms.cstCsosn,
        icms_base_calculo: icms.base,
        icms_aliquota: icms.aliquota,
        icms_valor: icms.valor,
        icms_st_base_calculo: icms.stBase,
        icms_st_aliquota: icms.stAliquota,
        icms_st_valor: icms.stValor,
        icms_fcp_valor: icms.fcpValor,
        icms_fcp_st_valor: icms.fcpStValor,
        icms_desonerado_valor: icms.desonerado,
        icms_st_base_retido: icms.stBaseRetido,
        icms_st_valor_retido: icms.stValorRetido,

        difal_fcp_uf_destino: difal.fcpUfDestino,
        difal_icms_uf_destino: difal.icmsUfDestino,
        difal_icms_uf_remetente: difal.icmsUfRemetente,

        ipi_cst: ipi.cst,
        ipi_enquadramento: ipi.enquadramento,
        ipi_base_calculo: ipi.base,
        ipi_aliquota: ipi.aliquota,
        ipi_valor: ipi.valor,

        ii_base_calculo: ii.base,
        ii_despesas_aduaneiras: ii.despesasAduaneiras,
        ii_valor: ii.valor,
        iof_valor: ii.iof,

        pis_cst: pis.cst,
        pis_base_calculo: pis.base,
        pis_aliquota: pis.aliquota,
        pis_valor: pis.valor,

        cofins_cst: cofins.cst,
        cofins_base_calculo: cofins.base,
        cofins_aliquota: cofins.aliquota,
        cofins_valor: cofins.valor,

        ...totaisRow,
      });
    }
  }

  return rows;
}
