// src/app/api/generate-description/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MODEL_ID = 'gemini-2.5-flash';
const GOOGLE_GENERATIVE_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;

interface GenerateDescriptionRequestBody {
  prompt?: string;
  context?: string;
}

const extractTextFromResponse = (payload: any): string | null => {
  if (!payload) return null;

  if (typeof payload?.text === 'string' && payload.text.trim().length > 0) {
    return payload.text.trim();
  }

  const candidates: any[] = Array.isArray(payload?.candidates)
    ? payload.candidates
    : [];
  for (const candidate of candidates) {
    if (
      typeof candidate?.text === 'string' &&
      candidate.text.trim().length > 0
    ) {
      return candidate.text.trim();
    }

    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;

    const textFromParts = parts
      .map((part: any) => {
        if (typeof part?.text === 'string') {
          return part.text;
        }

        if (typeof part?.inlineData?.data === 'string') {
          try {
            const decoded = Buffer.from(
              part.inlineData.data,
              'base64'
            ).toString('utf-8');
            return decoded;
          } catch {
            return '';
          }
        }

        return '';
      })
      .join('')
      .trim();

    if (textFromParts) {
      return textFromParts;
    }
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    const body: GenerateDescriptionRequestBody = await request.json();
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt text is required to generate a description.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Google Generative AI API key is not configured on the server.',
        },
        { status: 500 }
      );
    }

    const instruction = [
      'You are helping a shopper understand whether a product suits their needs.',
      'Compose a concise yet vivid description that highlights key features, benefits, and ideal use cases.',
      'Avoid speculation beyond the provided details, and keep the tone informative and friendly.',
    ].join(' ');

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${instruction}\n\nProduct details:\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const response = await fetch(
      `${GOOGLE_GENERATIVE_API_ENDPOINT}?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const message =
        (errorPayload &&
          (errorPayload.error?.message || JSON.stringify(errorPayload))) ||
        'Google Generative AI request failed.';

      return NextResponse.json({ error: message }, { status: response.status });
    }

    const resultPayload = await response.json();

    const promptBlockReason =
      resultPayload?.promptFeedback?.blockReason ??
      resultPayload?.promptFeedback?.safetyRatings?.find?.(
        (rating: any) => rating.blocked
      )?.category;
    if (promptBlockReason) {
      return NextResponse.json(
        {
          error: `Google Generative AI blocked this prompt (${promptBlockReason}). Adjust the product description and try again.`,
        },
        { status: 400 }
      );
    }

    const finishReason = resultPayload?.candidates?.[0]?.finishReason;
    const allowedFinishReasons = ['STOP', 'FINISH_REASON_UNSPECIFIED', 'MAX_TOKENS'];
    if (finishReason && !allowedFinishReasons.includes(finishReason)) {
      const reasonText =
        resultPayload?.candidates?.[0]?.safetyRatings?.find?.(
          (rating: any) => rating.blocked
        )?.category ?? finishReason;
      return NextResponse.json(
        {
          error: `Google Generative AI could not finish the request (${reasonText}). Please refine the prompt and try again.`,
        },
        { status: 400 }
      );
    }

    const generatedText = extractTextFromResponse(resultPayload);

    if (!generatedText) {
      return NextResponse.json(
        { error: 'The AI response did not include any content.' },
        { status: 502 }
      );
    }

    const responseBody =
      finishReason === 'MAX_TOKENS'
        ? { result: generatedText, partial: true }
        : { result: generatedText };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('generate-description API error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error while generating description.' },
      { status: 500 }
    );
  }
}
