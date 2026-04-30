// src/pages/api/status.json.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 获取当前文件的目录路径（兼容 ESM）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 拼出同目录下的 json 文件路径
const jsonFilePath = path.resolve(__dirname, 'list.json');

export async function GET() {
  try {
    const rawData = fs.readFileSync(jsonFilePath, 'utf-8');
    const jsonData = JSON.parse(rawData);
    return new Response(JSON.stringify(jsonData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to read list' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}