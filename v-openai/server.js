// Minimal local server to generate and persist overlay images.
// Reads OPENAI_API_KEY from .env, calls OpenAI Images API (dall-e-3),
// saves PNGs under ./generated, returns a dataURL for the browser.
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();

// CORS configuration - allow requests from your web app
app.use(cors({
  origin: "http://localhost:8000",   // Your web app URL
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Handle preflight requests
app.options("*", cors());

app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Ensure output folder exists
const OUT_DIR = path.join(process.cwd(), 'generated');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

app.post('/gen', async (req, res) => {
  try {
    const { state, prompt, width = 640, height = 480 } = req.body;

    // 1) Call OpenAI Images API (dall-e-3) asking for transparent PNG
    const apiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024', // DALL-E 3 only supports specific sizes
        n: 1,
        response_format: 'b64_json'
      })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      return res.status(500).json({ error: 'OpenAI error', detail: errTxt });
    }

    const data = await apiRes.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: 'No image data from API' });

    // 2) Persist to disk with timestamped filename for history
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeState = (state || 'Neutral').replace(/[^a-z0-9-_]/gi, '_');
    const filename = `${safeState}_${ts}.png`;
    const filePath = path.join(OUT_DIR, filename);
    const pngBuffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(filePath, pngBuffer);

    // 3) Return a data URL for p5.js to load immediately + file path for reference
    const dataUrl = `data:image/png;base64,${b64}`;
    res.json({ dataUrl, filename, savedPath: `/generated/${filename}` });

  } catch (err) {
    res.status(500).json({ error: 'Server exception', detail: String(err) });
  }
});

// Static serving of saved images (so you can open them in the browser if needed)
app.use('/generated', express.static(OUT_DIR));

app.listen(PORT, () => {
  console.log(`Overlay server running on http://localhost:${PORT}`);
});
