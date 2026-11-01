const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 3456;
const ROOT = __dirname;
const TELEGRAM_SCRIPT = 'C:\\Users\\manja\\.gemini\\antigravity\\scratch\\antigravity-workspace\\scripts\\telegram_remote.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/telegram') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const msg = [
          `🐎 <b>[오늘의 조선 야사록 · 파발마 도착]</b>`,
          `📅 <b>양력 ${data.month}월 ${data.day}일</b> (${data.king}, ${data.year}년) | 🔥 흥미도 ${data.interestScore}점`,
          ``,
          `<b>「${data.title}」</b>`,
          `${data.summary}`,
          ``,
          `🏛️ <i>실록 원문: "${data.officialRecord}"</i>`,
          ``,
          `📱 <b>모바일 웹 열기 (어디서나):</b> https://manjaedo.github.io/joseon-daily-yasa/`,
          `🏠 <b>집 Wi-Fi 열기:</b> http://192.168.0.11:${PORT}`
        ].join('\n');

        execFile('node', [TELEGRAM_SCRIPT, 'send', msg], (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  const safeUrl = req.url.split('?')[0];
  const filePath = path.join(ROOT, safeUrl === '/' ? 'index.html' : safeUrl);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`오늘의 조선 야사록 서버 실행 중: http://localhost:${PORT} / 모바일 Wi-Fi: http://192.168.0.11:${PORT}`);
});
