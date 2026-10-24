import { Unzip, UnzipFile, UnzipInflate } from 'fflate';
import { DEFAULT_ZIP_LIMITS, ZipLimits } from './types';

export class ZipProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipProcessError';
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function isSafeXmlEntry(name: string): boolean {
  if (!name || name.endsWith('/')) return false;
  if (name.includes('..') || name.startsWith('/') || name.includes('\\')) return false;
  return /\.xml$/i.test(name);
}

export interface ZipEntryStats {
  xmlAceitos: number;
  xmlIgnorados: number;
  bytesDescompactados: number;
}

export function iterateZipXmlEntries(
  zipData: Uint8Array,
  onXmlEntry: (name: string, data: Uint8Array) => void,
  limits: Partial<ZipLimits> = {},
  onEntryError?: (name: string, error: Error) => void,
): ZipEntryStats {
  const cfg: ZipLimits = { ...DEFAULT_ZIP_LIMITS, ...limits };
  const stats: ZipEntryStats = { xmlAceitos: 0, xmlIgnorados: 0, bytesDescompactados: 0 };
  let totalBytes = 0;
  let aborted = false;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);

  unzip.onfile = (file: UnzipFile) => {
    const name = file.name;

    if (!isSafeXmlEntry(name)) {
      stats.xmlIgnorados += 1;
      file.terminate();
      return;
    }

    if (stats.xmlAceitos >= cfg.maxXmlEntries) {
      aborted = true;
      file.terminate();
      return;
    }

    stats.xmlAceitos += 1;
    const chunks: Uint8Array[] = [];
    let entryBytes = 0;

    file.ondata = (err, data, final) => {
      if (aborted) return;

      if (err) {
        chunks.length = 0;
        onEntryError?.(name, err instanceof Error ? err : new Error(String(err)));
        return;
      }

      if (data && data.length > 0) {
        entryBytes += data.length;
        totalBytes += data.length;

        if (entryBytes > cfg.maxEntryBytes || totalBytes > cfg.maxTotalBytes) {
          aborted = true;
          chunks.length = 0;
          file.terminate();
          return;
        }

        chunks.push(data);
      }

      if (final) {
        stats.bytesDescompactados += entryBytes;
        try {
          onXmlEntry(name, concatChunks(chunks));
        } finally {
          chunks.length = 0;
        }
      }
    };

    file.start();
  };

  try {
    const CHUNK = 64 * 1024;
    for (let offset = 0; offset < zipData.length && !aborted; offset += CHUNK) {
      const end = Math.min(offset + CHUNK, zipData.length);
      unzip.push(zipData.subarray(offset, end), end >= zipData.length);
    }
  } catch (error) {
    throw new ZipProcessError(
      `Arquivo .zip inválido ou corrompido: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (aborted) {
    throw new ZipProcessError(
      `ZIP excede os limites de segurança (máx. ${cfg.maxXmlEntries} XMLs, ` +
        `${cfg.maxEntryBytes} bytes/XML, ${cfg.maxTotalBytes} bytes no total).`,
    );
  }

  if (stats.xmlAceitos === 0) {
    throw new ZipProcessError('Nenhum arquivo .xml encontrado dentro do ZIP.');
  }

  return stats;
}
