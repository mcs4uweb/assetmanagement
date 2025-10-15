// src/app/api/generate-description/route.ts
import { NextRequest, NextResponse } from 'next/server';

const MODEL_ID = 'gemini-2.5-flash';
const GOOGLE_GENERATIVE_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;
const MAX_GENERATION_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 800;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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

    const clientRetryHeader =
      request.headers.get('x-client-retry') ??
      request.headers.get('x-client-retries') ??
      request.nextUrl.searchParams.get('clientRetry');
    const clientManagesRetries =
      clientRetryHeader === '1' ||
      clientRetryHeader?.toLowerCase() === 'true' ||
      clientRetryHeader === 'yes';
    const maxAttempts = clientManagesRetries
      ? 1
      : MAX_GENERATION_ATTEMPTS;

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
      'Compare this product with reasonable alternatives when the provided details allow it.',
      'Evaluate the information carefully and keep the description accurate.',
      'Call out price versus quality considerations whenever the prompt includes enough detail.',
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

    const allowedFinishReasons = [
      'STOP',
      'FINISH_REASON_UNSPECIFIED',
      'MAX_TOKENS',
    ];
    let generatedText: string | null = null;
    let finishReason: string | undefined;
    let attemptsUsed = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsUsed = attempt;
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

        return NextResponse.json(
          {
            error: message,
            attempts: attemptsUsed,
            maxAttempts,
          },
          { status: response.status }
        );
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
            attempts: attemptsUsed,
            maxAttempts,
          },
          { status: 400 }
        );
      }

      finishReason = resultPayload?.candidates?.[0]?.finishReason;
      if (finishReason && !allowedFinishReasons.includes(finishReason)) {
        const reasonText =
          resultPayload?.candidates?.[0]?.safetyRatings?.find?.(
            (rating: any) => rating.blocked
          )?.category ?? finishReason;
        return NextResponse.json(
          {
            error: `Google Generative AI could not finish the request (${reasonText}). Please refine the prompt and try again.`,
            attempts: attemptsUsed,
            maxAttempts,
          },
          { status: 400 }
        );
      }

      generatedText = extractTextFromResponse(resultPayload);
      if (generatedText) {
        break;
      }

      if (attempt < maxAttempts) {
        const delay = INITIAL_RETRY_DELAY_MS * attempt;
        await wait(delay);
      }
    }

    if (!generatedText) {
      return NextResponse.json(
        {
          error:
            'The AI response did not include any content after multiple attempts.',
          attempts: attemptsUsed,
          maxAttempts,
        },
        { status: 502 }
      );
    }

    const responseBody: {
      result: string;
      partial?: boolean;
      attempts: number;
      maxAttempts: number;
    } = {
      result: generatedText,
      attempts: attemptsUsed,
      maxAttempts,
    };

    if (finishReason === 'MAX_TOKENS') {
      responseBody.partial = true;
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('generate-description API error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error while generating description.' },
      { status: 500 }
    );
  }
}
