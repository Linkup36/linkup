const fs = require('fs');
const path = require('path');
const https = require('https');

const phrase = "You have a notification from LinkUp";
const encodedPhrase = encodeURIComponent(phrase);
const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedPhrase}&tl=en&client=tw-ob`;

const mobileDir = path.join(__dirname, '..', 'assets', 'sounds');
const publicDir = path.join(__dirname, '..', '..', 'public', 'sounds');

fs.mkdirSync(mobileDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const mobilePath = path.join(mobileDir, 'linkup-notification.mp3');
const publicPath = path.join(publicDir, 'linkup-notification.mp3');
const publicLegacyPath = path.join(publicDir, 'notification.mp3');

console.log(`Downloading speech: "${phrase}"...`);

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://translate.google.com/'
  }
};

https.get(url, options, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed with status code: ${res.statusCode}`);
    process.exit(1);
  }

  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(mobilePath, buffer);
    fs.writeFileSync(publicPath, buffer);
    fs.writeFileSync(publicLegacyPath, buffer);
    console.log(`Saved MP3 (${buffer.length} bytes) to:`);
    console.log(` - ${mobilePath}`);
    console.log(` - ${publicPath}`);
    console.log(` - ${publicLegacyPath}`);

    // Also write Base64 file with proper audio/mpeg MIME type
    const base64Content = `export const LINKUP_NOTIFICATION_SOUND_BASE64 = 'data:audio/mpeg;base64,${buffer.toString('base64')}';\n`;
    const base64TsPath = path.join(__dirname, '..', 'src', 'assets', 'sounds', 'notificationSound.ts');
    fs.mkdirSync(path.dirname(base64TsPath), { recursive: true });
    fs.writeFileSync(base64TsPath, base64Content);
    console.log(` - ${base64TsPath}`);
  });
}).on('error', (err) => {
  console.error('Download error:', err);
  process.exit(1);
});
