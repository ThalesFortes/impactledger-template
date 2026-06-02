import { NextRequest, NextResponse } from "next/server";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; 


const RATE_WINDOW_MS  = 10 * 60 * 1000; 
const RATE_LIMIT      = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "bmp",
  "doc", "docx", "xls", "xlsx",
]);

type MagicEntry = { bytes: (number | null)[]; mime: string };

const MAGIC_SIGNATURES: MagicEntry[] = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },           
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: "image/png" }, 
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },                       
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },                 
  { bytes: [0x42, 0x4d], mime: "image/bmp" },                              
  { bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], mime: "image/webp" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip" },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], mime: "application/msword" },
];

function detectMimeFromBytes(header: Uint8Array): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.bytes.every((b, i) => b === null || header[i] === b)) {
      return sig.mime;
    }
  }
  return null;
}

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
      { status: 429 }
    );
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "Upload não configurado. Adicione PINATA_JWT ao .env.local (obtenha em pinata.cloud)." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Erro ao processar o arquivo." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 4 MB." }, { status: 400 });
  }

  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido. Use PDF, imagem ou documento Office." },
      { status: 400 }
    );
  }

  const headerBuffer = await file.slice(0, 12).arrayBuffer();
  const header = new Uint8Array(headerBuffer);
  const detectedMime = detectMimeFromBytes(header);
  if (!detectedMime) {
    return NextResponse.json(
      { error: "Conteúdo do arquivo não reconhecido. Envie PDF, imagem ou documento Office válido." },
      { status: 400 }
    );
  }

  const safeName = sanitizeFilename(file.name);
  const pinataBody = new FormData();
  pinataBody.append("file", file, safeName);
  pinataBody.append(
    "pinataMetadata",
    JSON.stringify({ name: `GreenTrace-${Date.now()}-${safeName}` })
  );
  pinataBody.append(
    "pinataOptions",
    JSON.stringify({ cidVersion: 1 })
  );

  let pinataRes: Response;
  try {
    pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataBody,
    });
  } catch {
    return NextResponse.json({ error: "Falha de conexão com o serviço de armazenamento. Tente novamente." }, { status: 502 });
  }

  if (!pinataRes.ok) {
    console.error(`[upload-evidence] Pinata error ${pinataRes.status}`);
    return NextResponse.json(
      { error: "Erro ao enviar arquivo para armazenamento. Tente novamente." },
      { status: 500 }
    );
  }

  const { IpfsHash } = await pinataRes.json();
  return NextResponse.json({ cid: IpfsHash as string });
}
