# OUTTA Backend

This is the Node/Express backend for OUTTA's AI avatar generation.

## What it does

`POST /api/generate-avatar`

Accepts a photo in a multipart field named `photo` and sends it to the OpenAI image editing API to create a 2D OUTTA avatar.

## Render setup

Create this as a **Web Service** from the `outta` GitHub repository.

- Language: Node
- Branch: `main`
- Build Command: `npm install`
- Start Command: `npm start`

Add these Environment Variables in Render:

- `OPENAI_API_KEY` = your OpenAI API key
- `OPENAI_IMAGE_MODEL` = `gpt-image-2`
- `FRONTEND_URL` = `https://outta.onrender.com`

Never commit the API key to GitHub.

## Important

The frontend must call the backend URL, not OpenAI directly. This keeps the API key on the server.
