// server.js
const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const STORAGE = path.resolve(__dirname, 'videos');
if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE);

app.get('/watch', (req, res) => {
  const vid = req.query.v;
  if (!vid) return res.status(400).send('missing v parameter');
  const outPath = path.join(STORAGE, vid + '.mp4');

  if (fs.existsSync(outPath)) return res.sendFile(outPath);

  const tmpFile = path.join(STORAGE, vid + '.tmp');
  const ytdlpArgs = ['-f', 'best', '-o', tmpFile, `https://www.youtube.com/watch?v=${vid}`];

  execFile('yt-dlp', ytdlpArgs, (err) => {
    if (err) return res.status(500).send('yt-dlp failed');

    const ffArgs = [
      '-i', tmpFile,
      '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0',
      '-pix_fmt', 'yuv420p', '-b:v', '300k', '-vf', 'scale=320:-2',
      '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart',
      outPath
    ];

    execFile('ffmpeg', ffArgs, (ffErr) => {
      fs.unlinkSync(tmpFile);
      if (ffErr) return res.status(500).send('ffmpeg failed');
      return res.sendFile(outPath);
    });
  });
});

app.get('/', (req, res) => {
  res.send(`<h3>Enter YouTube ID</h3>
    <form method="get" action="/watch">
      <input name="v" placeholder="YouTube ID"/>
      <button type="submit">Get Video</button>
    </form>`);
});

app.listen(PORT, () => console.log('Server running on ' + PORT));
