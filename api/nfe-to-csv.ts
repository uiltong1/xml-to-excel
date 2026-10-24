import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IncomingMessage } from 'node:http';
import { parseMultipartFile, UPLOAD_HELP } from '../src/http';
import { processNfeZip } from '../src/nfe/pipeline';
import { ZipProcessError } from '../src/nfe/zip';

function applyCors(res: VercelResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader(
    'access-control-expose-headers',
    'x-nfe-xmls, x-nfe-processados, x-nfe-itens, x-nfe-falhas, content-disposition',
  );
}

const UPLOAD_PAGE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>XML (NF-e) -> CSV</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; }
    fieldset { padding: 20px; border-radius: 8px; }
    button { margin-top: 14px; padding: 8px 22px; cursor: pointer; }
    p { color: #555; font-size: .9em; }
  </style>
</head>
<body>
  <fieldset>
    <legend><b>Gerar CSV de NF-e</b></legend>
    <form method="POST" action="/api/nfe-to-csv" enctype="multipart/form-data">
      <input type="file" name="file" accept=".zip,application/zip" required />
      <br />
      <button type="submit">Gerar e baixar CSV</button>
    </form>
    <p>Selecione o .zip (até 500 XMLs) — o download começa automaticamente.</p>
  </fieldset>
</body>
</html>`;

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const preParsed = (req as unknown as { body?: unknown }).body;
  if (Buffer.isBuffer(preParsed)) return Promise.resolve(preParsed);
  if (typeof preParsed === 'string' && preParsed.length > 0) {
    return Promise.resolve(Buffer.from(preParsed, 'utf8'));
  }
  if (preParsed && typeof preParsed === 'object') {
    return Promise.resolve(Buffer.from(JSON.stringify(preParsed), 'utf8'));
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const accept = String(req.headers.accept ?? '');
    if (accept.includes('text/html')) {
      res.status(200).setHeader('content-type', 'text/html; charset=utf-8').send(UPLOAD_PAGE);
      return;
    }
    res.status(200).json({
      mensagem: 'POST o arquivo .zip de NF-e para gerar o CSV consolidado.',
      ...UPLOAD_HELP,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido. Use POST.' });
    return;
  }

  try {
    const contentType = String(req.headers['content-type'] ?? '');
    let zipData: Buffer | undefined;

    if (/multipart\/form-data/i.test(contentType)) {
      const parsed = parseMultipartFile(await readRawBody(req), contentType);
      if (parsed) zipData = parsed.data;
    } else if (/zip|octet-stream|binary/i.test(contentType)) {
      zipData = await readRawBody(req);
    } else {
      let body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
        const raw = await readRawBody(req);
        if (raw.length > 0) {
          try {
            body = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
          } catch {
            body = undefined;
          }
        }
      }
      const base64 =
        body && (body['zipBase64'] ?? body['file'] ?? body['data'] ?? body['zip']);
      if (typeof base64 === 'string' && base64.length > 0) {
        zipData = Buffer.from(base64, 'base64');
      }
    }

    if (!zipData || zipData.length === 0) {
      res.status(400).json(UPLOAD_HELP);
      return;
    }

    const { csv, summary } = processNfeZip(zipData);

    if (summary.processados === 0) {
      res.status(422).json({
        erro: 'Nenhum XML de NF-e pôde ser processado.',
        resumo: summary,
      });
      return;
    }

    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="nfe-consolidado.csv"');
    res.setHeader('x-nfe-xmls', String(summary.totalXmls));
    res.setHeader('x-nfe-processados', String(summary.processados));
    res.setHeader('x-nfe-itens', String(summary.totalItens));
    res.setHeader('x-nfe-falhas', String(summary.falhas.length));
    res.status(200).send(csv);
  } catch (error) {
    const status = error instanceof ZipProcessError ? 400 : 500;
    res.status(status).json({
      erro: error instanceof Error ? error.message : 'Erro interno ao processar o ZIP.',
    });
  }
}
