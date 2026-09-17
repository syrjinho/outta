const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 10000;

const allowedOrigin = process.env.FRONTEND_URL || "https://outta.onrender.com";

app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST"],
}));

app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({
    app: "OUTTA",
    status: "ok",
    message: "OUTTA AI backend is running.",
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/generate-avatar", upload.single("photo"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured on the server.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a photo.",
      });
    }

    const prompt = `
Turn the uploaded person's photo into a polished OUTTA 2D avatar.

IMPORTANT:
- Preserve the person's recognizable facial characteristics, hairstyle, approximate age, and overall appearance.
- Create a clearly illustrated 2D character, NOT a photorealistic portrait.
- Modern mobile-app character illustration.
- Clean shapes, expressive face, subtle shading, tasteful colors.
- Head-and-shoulders composition.
- Front-facing or slightly three-quarter view.
- Simple neutral background.
- No text, no logos, no extra people.
- The result should feel like a premium social/mobile app avatar.
`;

    // GPT Image models accept PNG, WEBP, or JPG input images.
    // The OpenAI Node SDK exposes image editing through client.images.edit().
    const response = await openai.images.edit({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      image: new File([req.file.buffer], req.file.originalname || "photo.jpg", {
        type: req.file.mimetype || "image/jpeg",
      }),
      prompt,
      size: "1024x1024",
    });

    const image = response.data?.[0];

    if (!image?.b64_json) {
      throw new Error("The image API did not return image data.");
    }

    res.json({
      success: true,
      imageDataUrl: `data:image/png;base64,${image.b64_json}`,
    });
  } catch (error) {
    console.error("Avatar generation error:", error);

    res.status(500).json({
      success: false,
      error: "Avatar generation failed.",
      details: process.env.NODE_ENV === "development"
        ? error.message
        : undefined,
    });
  }
});

app.listen(port, () => {
  console.log(`OUTTA AI backend listening on port ${port}`);
});
