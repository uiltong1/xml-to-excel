export function parseMultipartFile(
  body: Buffer,
  contentType: string,
): { filename: string; data: Buffer } | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) return undefined;

  const boundary = Buffer.from(`--${(match[1] || match[2]).trim()}`);
  const headerEnd = Buffer.from('\r\n\r\n');

  let partStart = body.indexOf(boundary);
  while (partStart !== -1) {
    const next = body.indexOf(boundary, partStart + boundary.length);
    if (next === -1) break;

    const contentStart = body.indexOf(headerEnd, partStart);
    if (contentStart === -1 || contentStart > next) {
      partStart = next;
      continue;
    }

    const headers = body.subarray(partStart + boundary.length, contentStart).toString('utf8');
    const filenameMatch = /filename="([^"]*)"/i.exec(headers);
    if (filenameMatch && filenameMatch[1]) {
      const data = body.subarray(contentStart + headerEnd.length, next - 2);
      return { filename: filenameMatch[1], data: Buffer.from(data) };
    }
    partStart = next;
  }
  return undefined;
}

export const UPLOAD_HELP = {
  erro: 'Envie o .zip em um destes formatos:',
  formatos: [
    'POST application/zip com o binário do ZIP no corpo',
    'POST multipart/form-data com campo de arquivo (ex.: curl -F "file=@notas.zip")',
    'POST application/json com { "zipBase64": "<base64 do zip>" }',
  ],
};
