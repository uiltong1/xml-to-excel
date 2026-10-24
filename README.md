# XML NF-e → CSV

Function na **Vercel** que recebe um arquivo `.zip` de até **500 Notas Fiscais Eletrônicas (NF-e)** em XML e devolve um **único CSV consolidado**, com uma linha por item de nota e todos os tributos mapeados.

## Recursos

- **Upload flexível** do `.zip` em três formatos:
  - `multipart/form-data` (`curl -F "file=@notas.zip"`) ou formulário no navegador
  - binário puro (`Content-Type: application/zip`)
  - JSON com `{ "zipBase64": "..." }`
- **Descompactação em streaming** (memória constante — nunca carrega os 500 XMLs ao mesmo tempo)
- **Limites de segurança**: no máximo 500 XMLs, 10 MB por XML e 200 MB no total (proteção contra ZIP bomb e Zip Slip)
- **Tolerância a falhas**: XML corrompido ou inválido é registrado no resumo (`falhas`) e pulado — o lote nunca trava
- **CSV em padrão pt-BR**: delimitador `;`, separador decimal `,` e BOM UTF-8 (abre direto no Excel com acentos)
- **CORS liberado** para consumo por qualquer frontend

## Tributos extraídos por item

| Grupo | Campos |
|---|---|
| **ICMS** | modalidade (ICMS00–90/ICMSSN*), origem, CST/CSOSN, base, alíquota, valor, ST (base/alíquota/valor), FCP, FCP-ST, desoneração, retenção de ST |
| **DIFAL/FCP** | vFCPUFDest, vICMSUFDest, vICMSUFRemet |
| **IPI** | CST, enquadramento, base, alíquota, valor |
| **II / IOF** | base, despesas aduaneiras, valor, IOF |
| **PIS** | CST, base, alíquota, valor |
| **COFINS** | CST, base, alíquota, valor |
| **Totais da nota** | vProd, vICMS, vICMSST, vFCP, vIPI, vII, vPIS, vCOFINS, vNF |

Campos opcionais ausentes na nota (ex.: sem IPI ou II) saem como `0,00` no CSV, sem quebrar a execução.

Cada linha do CSV contém também a identificação da nota (chave de acesso, série, número, data de emissão, CNPJ/nome do emitente e destinatário) e os dados do produto (código, descrição, NCM, CFOP, quantidade, valores).

## Requisitos

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli) (para rodar localmente ou fazer deploy)

## Como rodar localmente

```bash
# 1. Dependências (o postinstall aplica um patch de compatibilidade do vercel dev)
npm install

# 2. Sobe a Function local
npx vercel dev
# → http://localhost:3000

# 3. Enviar o ZIP e baixar o CSV
curl -F "file=@xml/notas.zip" http://localhost:3000/api/nfe-to-csv -o consolidado.csv
```

No navegador, abra **http://localhost:3000/api/nfe-to-csv** — aparece uma página com seletor de arquivo que dispara o download do CSV automaticamente.

### Alternativa via CLI (sem subir servidor)

```bash
npm run nfe:csv -- xml/notas.zip        # gera notas.csv na pasta atual
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/nfe-to-csv` | Página HTML de upload (navegador) ou instruções JSON (API) |
| `POST` | `/api/nfe-to-csv` | Processa o `.zip` e retorna o CSV (`text/csv` com `Content-Disposition: attachment`) |
| `OPTIONS` | `/api/nfe-to-csv` | Preflight CORS |

Respostas de sucesso trazem o resumo nos headers: `x-nfe-xmls`, `x-nfe-processados`, `x-nfe-itens`, `x-nfe-falhas`.

## Deploy (Vercel)

O projeto já está vinculado ao projeto **xml-to-excel** na Vercel. Para publicar alterações:

```bash
npm run deploy        # executa: vercel --prod
```

A Function fica em `api/nfe-to-csv.ts` (filesystem routing da Vercel: o arquivo define a rota).

> **Nota:** em uploads grandes o `curl` envia o header `Expect: 100-continue`, que o `vercel dev` local rejeita. O script `scripts/patch-vercel-expect.js` (executado no `postinstall`) corrige isso automaticamente apenas no ambiente local — a produção da Vercel não é afetada.

## Estrutura

```
api/
  nfe-to-csv.ts      # Vercel Function (rota /api/nfe-to-csv)
  hello.ts           # Function de exemplo
src/
  http.ts            # leitura de corpo (multipart) e mensagens de ajuda
  nfe/
    zip.ts           # unzip streaming seguro (fflate)
    parser.ts        # extração de identificação, itens e tributos (fast-xml-parser)
    csv.ts           # gerador de CSV (delimitador/decimal/BOM configuráveis)
    pipeline.ts      # orquestração ZIP → CSV com resumo de falhas
    types.ts         # interfaces e helpers
scripts/
  run-nfe-csv.ts     # CLI local (npm run nfe:csv)
  patch-vercel-expect.js  # patch do vercel dev (postinstall)
```

## Testes

```bash
npm test           # 9 testes (node:test)
npm run typecheck  # verificação de tipos
```

## Stack

- TypeScript + Vercel Functions
- [fflate](https://github.com/101arrowz/fflate) — descompactação ZIP em streaming
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — parsing performático de XML
