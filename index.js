import express from "express";
import YTDlpWrapPkg from "yt-dlp-wrap";  // default import
const ytDlpWrap = new YTDlpWrapPkg();    // ✅ use default class directly
import ffmpegPath from "ffmpeg-static";
import path from "path";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;
const STORAGE = path.resolve("./videos");

// Create folder if missing
if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE);

// ===== CONFIG =====
// Put your playlist ID here
const PLAYLIST_ID = "https://youtube.com/playlist?list=PL391TjC_3CFJJkrXrZsvjbR4FfZ6DtAqt&si=X4wz4wQ6GKn6fG1D"; // Example: PLxxxxxxx

async function fetchPlaylistVideos() {
  try {
    const result = await ytDlpWrap.exec([
      `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
      "--flat-playlist",
      "-J"
    ]);
    const json = JSON.parse(result);
    // json.entries = array of videos {id, title}
    return json.entries;
  } catch (err) {
    console.error("Failed to fetch playlist:", err);
    return [];
  }
}

// ===== ROUTES =====

// Homepage: show playlist as clickable links
app.get("/", async (req, res) => {
  const videos = await fetchPlaylistVideos();
  let html = "<h3>My YouTube Playlist (W995-friendly)</h3><ul>";
  videos.forEach(v => {
    html += `<li>
      ${v.title} - <a href="/play?id=${v.id}">Play</a>
    </li>`;
  });
  html += "</ul>";
  res.send(html);
});

// Play route: download + transcode + stream
app.get("/play", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send("Missing ?id=VIDEO_ID");

  const url = `https://www.youtube.com/watch?v=${id}`;
  const outPath = path.join(STORAGE, `${id}.mp4`);

  // Serve cached file if exists
  if (fs.existsSync(outPath)) {
    return res.sendFile(outPath);
  }

  const tmpPath = path.join(STORAGE, `${id}.tmp`);

  // Step 1: download best audio+video
  await ytDlpWrap.exec([
    url,
    "-f",
    "best[ext=mp4]/best",
    "-o",
    tmpPath
  ]);

  // Step 2: transcode to W995-friendly format
  const spawn = await import("child_process").then(m => m.spawn);
  const ffmpeg = spawn(ffmpegPath, [
    "-i", tmpPath,
    "-c:v", "libx264",
    "-profile:v", "baseline",
    "-level", "3.0",
    "-pix_fmt", "yuv420p",
    "-b:v", "300k",
    "-vf", "scale=320:-2",
    "-c:a", "aac",
    "-b:a", "64k",
    "-movflags", "+faststart",
    outPath
  ]);

  ffmpeg.stderr.on("data", d => console.log(d.toString()));
  ffmpeg.on("close", () => {
    fs.unlinkSync(tmpPath); // delete temp file
    res.sendFile(outPath);
  });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
