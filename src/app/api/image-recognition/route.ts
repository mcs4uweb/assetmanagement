'use server';

import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_VISION_MODEL = 'mistral:latest';

interface ImageRecognitionRequestBody {
  prompt?: string;
  imageBase64?: string;
  imageUrl?: string;
}

const fetchImageAsBase64 = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download image (${response.status} ${response.statusText})`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return base64;
};

const normalizeBase64 = (input: string) => {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex !== -1) {
    return trimmed.slice(commaIndex + 1);
  }

  return trimmed;
};

export async function POST(request: NextRequest) {
  try {
    const body: ImageRecognitionRequestBody = await request.json();
    const prompt =
      body.prompt?.trim() ||
      'Describe the contents of this asset image and identify notable details relevant to asset management.';

    let base64Image = normalizeBase64(body.imageBase64 ?? '');

    if (!base64Image && body.imageUrl) {
      base64Image = await fetchImageAsBase64(body.imageUrl);
    }

    if (!base64Image) {
      return NextResponse.json(
        { error: 'An image (base64 or accessible URL) is required.' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_URL;
    const model =
      process.env.OLLAMA_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;

    const ollamaResponse = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        images: [base64Image],
        stream: false,
      }),
    });

    if (!ollamaResponse.ok) {
      let errorPayload: unknown = null;
      try {
        errorPayload = await ollamaResponse.json();
      } catch {
        // ignore JSON parse errors
      }

      return NextResponse.json(
        {
          error:
            (errorPayload as any)?.error ||
            `Ollama request failed (${ollamaResponse.status} ${ollamaResponse.statusText}).`,
          status: ollamaResponse.status,
        },
        { status: ollamaResponse.status }
      );
    }

    const payload = await ollamaResponse.json();
    const textResponse: string | null =
      typeof payload?.response === 'string'
        ? payload.response.trim()
        : Array.isArray(payload?.message?.content)
        ? payload.message.content
            .map((part: any) =>
              typeof part?.text === 'string' ? part.text : ''
            )
            .join('')
            .trim()
        : null;

    if (!textResponse) {
      return NextResponse.json(
        {
          error:
            'Ollama did not return any textual response for this image analysis.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      result: textResponse,
      model,
    });
  } catch (error) {
    console.error('image-recognition API error:', error);
    const apiUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_URL;
    const model =
      process.env.OLLAMA_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;

    const isFetchFailed =
      error instanceof Error && error.message.toLowerCase().includes('fetch');

    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected server error while contacting Ollama.';

    return NextResponse.json(
      {
        error: isFetchFailed
          ? `Unable to reach Ollama at ${apiUrl}. Ensure the server is running and the ${model} model is available. (${message})`
          : message,
      },
      { status: 500 }
    );
  }
}
