import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const nome = req.query.name || (req.body as { name?: string } | undefined)?.name || 'Mundo';

  return res.status(200).json({
    mensagem: `Olá, ${nome}! A sua função em TypeScript está rodando na Vercel com sucesso!`,
  });
}
