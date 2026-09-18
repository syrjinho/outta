const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const { toFile } = require('openai');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

const PORT = process.env.PORT || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://outta.onrender.com';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const OPENAI_EXPRESSION_MODEL = process.env.OPENAI_EXPRESSION_MODEL || 'gpt-image-2.5-flare';

app.use(cors({
  origin: [FRONTEND_URL, 'https://outta.onrender.com'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.get('/', (req, res) => res.send('OUTTA AI backend is running.'));
app.get('/health', (req, res) => res.json({ ok: true }));

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured on the server.');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function imageDataUrlFromResponse(response) {
  const b64 = response?.data?.[0]?.b64_json;
  return b64 ? `data:image/png;base64,${b64}` : null;
}

app.post('/api/generate-avatar', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo was uploaded.' });

    const client = getClient();
    const image = await toFile(
      req.file.buffer,
      req.file.originalname || 'photo.jpg',
      { type: req.file.mimetype || 'image/jpeg' }
    );

    const response = await client.images.edit({
      model: OPENAI_IMAGE_MODEL,
      image,
      prompt: [
        'Create a polished 2D character avatar based on the person in the reference photo.',
        'Preserve the person’s recognizable facial characteristics, hairstyle, approximate age, skin tone, and overall appearance.',
        'Make it a modern premium 2D digital character cutout for a mobile app, head-and-shoulders composition, natural expressive face, no text, no logos.',
        'Isolate the character completely on a fully transparent background. Show only the person/avatar with clean alpha edges. No scenery, no room, no backdrop, no solid color, no circle, no frame, no shadow.',
        'This is the base neutral/calm version of the character. Keep the identity consistent because this same character will later be shown with different facial expressions. Preserve the transparent background.'
      ].join(' '),
      size: '1024x1024',
      quality: 'medium',
      background: 'transparent',
      output_format: 'png'
    });

    const imageDataUrl = imageDataUrlFromResponse(response);
    if (!imageDataUrl) {
      return res.status(502).json({ error: 'OpenAI did not return an image.' });
    }

    res.json({ imageDataUrl });
  } catch (error) {
    console.error('generate-avatar error:', error);
    res.status(500).json({ error: error?.message || 'Avatar generation failed.' });
  }
});

app.post('/api/preload-expressions', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No avatar image was uploaded.' });

    const requested = String(req.body.expressions || 'annoyed,angry,furious')
      .split(',').map(s => s.trim()).filter(Boolean);
    const allowed = new Set(['annoyed', 'angry', 'furious']);
    const expressions = requested.filter(x => allowed.has(x));
    if (!expressions.length) return res.status(400).json({ error: 'No supported expressions requested.' });

    const client = getClient();
    const expressionText = {
      annoyed: 'clearly annoyed, narrowed eyes and visibly irritated expression',
      angry: 'angry, tense eyebrows and jaw, visibly upset but still natural and non-threatening',
      furious: 'very angry and overwhelmed, intense eyes, strongly furrowed brows, clenched expression, still a clean stylized illustration'
    };

    const jobs = expressions.map(async (expression) => {
      const image = await toFile(
        req.file.buffer,
        req.file.originalname || 'avatar.png',
        { type: req.file.mimetype || 'image/png' }
      );
      const response = await client.images.edit({
        model: OPENAI_EXPRESSION_MODEL,
        image,
        prompt: [
          'Edit this existing OUTTA character avatar only by changing the facial expression.',
          `Make the expression: ${expressionText[expression]}.`,
          'Preserve the exact same character identity, face shape, hairstyle, skin tone, clothing, framing, and illustration style. Preserve the fully transparent background and clean alpha edges.',
          'Do not redesign the character. Do not change age, gender, hairstyle, clothes, camera angle, or composition.',
          'The result must look like the same person in the same avatar at a different emotional state.'
        ].join(' '),
        size: '1024x1024',
        quality: 'low',
        background: 'transparent',
        output_format: 'png'
      });
      const imageDataUrl = imageDataUrlFromResponse(response);
      if (!imageDataUrl) throw new Error(`OpenAI did not return the ${expression} expression image.`);
      return [expression, imageDataUrl];
    });

    const results = await Promise.allSettled(jobs);
    const output = {};
    const errors = [];
    results.forEach((result, i) => {
      const expression = expressions[i];
      if (result.status === 'fulfilled') output[result.value[0]] = result.value[1];
      else errors.push(`${expression}: ${result.reason?.message || 'failed'}`);
    });

    if (!Object.keys(output).length) {
      return res.status(502).json({ error: errors.join('; ') || 'No expressions were generated.' });
    }
    res.json({ expressions: output, warnings: errors });
  } catch (error) {
    console.error('preload-expressions error:', error);
    res.status(500).json({ error: error?.message || 'Expression preload failed.' });
  }
});

app.post('/api/generate-expression', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No avatar image was uploaded.' });

    const expression = String(req.body.expression || '').trim();
    const allowed = new Set([
      'calm', 'uncomfortable', 'annoyed', 'angry', 'furious', 'overloaded'
    ]);

    if (!allowed.has(expression)) {
      return res.status(400).json({ error: 'Unsupported expression.' });
    }

    const client = getClient();
    const image = await toFile(
      req.file.buffer,
      req.file.originalname || 'avatar.png',
      { type: req.file.mimetype || 'image/png' }
    );

    const expressionText = {
      calm: 'calm, relaxed, neutral expression',
      uncomfortable: 'slightly uncomfortable, uneasy eyes and subtle tension around the mouth',
      annoyed: 'clearly annoyed, narrowed eyes and visibly irritated expression',
      angry: 'angry, tense eyebrows and jaw, visibly upset but still natural and non-threatening',
      furious: 'very angry and overwhelmed, intense eyes, strongly furrowed brows, clenched expression, still a clean stylized illustration',
      overloaded: 'comically overwhelmed, exaggerated stressed expression, wide tense eyes and strained face, playful rather than scary'
    }[expression];

    const response = await client.images.edit({
      model: OPENAI_EXPRESSION_MODEL,
      image,
      prompt: [
        'Edit this existing OUTTA character avatar only by changing the facial expression.',
        `Make the expression: ${expressionText}.`,
        'Preserve the exact same character identity, face shape, hairstyle, skin tone, clothing, framing, and illustration style. Preserve the fully transparent background and clean alpha edges.',
        'Do not redesign the character. Do not change age, gender, hairstyle, clothes, camera angle, or composition.',
        'The result must look like the same person in the same avatar at a different emotional state.'
      ].join(' '),
      size: '1024x1024',
      quality: 'low',
      background: 'transparent',
      output_format: 'png'
    });

    const imageDataUrl = imageDataUrlFromResponse(response);
    if (!imageDataUrl) {
      return res.status(502).json({ error: 'OpenAI did not return an expression image.' });
    }

    res.json({ imageDataUrl, expression });
  } catch (error) {
    console.error('generate-expression error:', error);
    res.status(500).json({ error: error?.message || 'Expression generation failed.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OUTTA AI backend listening on port ${PORT}`);
});
