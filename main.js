// main.js
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const bot = new Telegraf('ISI_TOKEN_BOT_KAMU');
const signatures = [
  /eval\s*\(/i,
  /base64_decode\s*\(/i,
  /system\s*\(/i,
  /shell_exec\s*\(/i,
  /passthru\s*\(/i,
  /\$_(GET|POST|REQUEST)\[/i,
  /for\s*\(\$i=0;/i,
  /\$func\s*=\s*['\"]eval['\"]/i,
  /gz(inflate|decode)/i,
  /textarea.*exec/i
];

let lastReport = [];

function scanContent(content, source = '') {
  const results = [];
  for (const sig of signatures) {
    if (sig.test(content)) {
      results.push(`🔗 ${source} → Signature: ${sig}`);
    }
  }
  return results;
}

bot.command('scanurl', async (ctx) => {
  const url = ctx.message.text.split(' ')[1];
  if (!url) return ctx.reply('Gunakan format: /scanurl <url>');
  try {
    const res = await axios.get(url);
    const found = scanContent(res.data, url);
    if (found.length) {
      ctx.reply(`🚨 Signature ditemukan:\n${found[0]}`);
      fs.writeFileSync('hasil_scan.txt', found.join('\n'));
      await ctx.replyWithDocument({ source: 'hasil_scan.txt' });
    } else {
      ctx.reply('✅ Tidak ditemukan signature berbahaya.');
    }
    lastReport = found;
  } catch (e) {
    ctx.reply('❌ Gagal mengakses URL.');
  }
});

bot.command('scanfile', async (ctx) => {
  const file = ctx.message.document;
  if (!file) return ctx.reply('Kirim file terlebih dahulu.');
  const ext = path.extname(file.file_name);
  if (!['.php', '.txt', '.html', '.js'].includes(ext)) return ctx.reply('Format file tidak didukung.');

  const link = await ctx.telegram.getFileLink(file.file_id);
  const res = await axios.get(link.href);
  const content = res.data.toString();
  const found = scanContent(content, file.file_name);

  if (found.length) {
    ctx.reply(`🚨 Signature ditemukan dalam file:\n${found[0]}`);
    fs.writeFileSync('hasil_scan.txt', found.join('\n'));
    await ctx.replyWithDocument({ source: 'hasil_scan.txt' });
  } else {
    ctx.reply('✅ Tidak ditemukan signature berbahaya dalam file.');
  }
  lastReport = found;
});

bot.command('laporan', (ctx) => {
  if (!lastReport.length) return ctx.reply('Belum ada hasil scan.');
  const summary = `📊 Laporan terakhir:\nJumlah hasil: ${lastReport.length}\nSignature umum: ${[...new Set(lastReport.map(x => x.split(': ')[1]))].join(', ')}`;
  ctx.reply(summary);
});

bot.command('export', (ctx) => {
  if (fs.existsSync('hasil_scan.txt')) {
    ctx.replyWithDocument({ source: 'hasil_scan.txt' });
  } else {
    ctx.reply('Belum ada file hasil untuk diekspor.');
  }
});

bot.command('sqlmap', async (ctx) => {
  const url = ctx.message.text.split(' ')[1];
  if (!url) return ctx.reply('Gunakan format: /sqlmap <url>');

  const timestamp = Date.now();
  const outFile = `sqlmap_${timestamp}.txt`;

  ctx.reply('🕵️ Menjalankan sqlmap, mohon tunggu...');

  exec(`sqlmap -u "${url}" --dbs --batch`, (error, stdout, stderr) => {
  if (error) {
    ctx.reply(`❌ Gagal menjalankan sqlmap:\n${stderr}`);
  } else {
    const hasil = stdout
      .split('\n')
      .filter(line =>
        line.includes('available databases') ||
        line.includes('[*]') ||
        line.includes('the back-end DBMS')
      )
      .join('\n');

    ctx.reply(`✅ Hasil SQLMap:\n\n${hasil || 'Tidak ditemukan output yang relevan.'}`);
  }
  });
});

bot.launch();
console.log('🤖 Bot Shell Finder aktif.');
