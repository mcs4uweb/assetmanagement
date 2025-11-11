// src/app/askgemini/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

export default function AskGeminiPage() {
  const [status, setStatus] = useState<string>('Click "Start Recording" to begin the audio capture.');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>('Your transcription will appear here after analysis.');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [base64Preview, setBase64Preview] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // If you want to expose the key to client, set NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY in .env.local
  // Prefer proxying via an API route to avoid exposing secrets.
  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY || 'YOUR_API_KEY';

  const startRecording = async (): Promise<void> => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatus('Error: getUserMedia is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      const deviceName = audioTrack?.label || 'Default Microphone';

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = async () => {
          const result = reader.result;
          if (!(result instanceof ArrayBuffer)) return;
          const base64 = arrayBufferToBase64(result);
          setBase64Preview(`${base64.substring(0, 100)}... (Total length: ${base64.length})`);
          await analyzeAudio(base64, 'audio/webm');
        };
        reader.readAsArrayBuffer(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus(`🔴 Recording started using: ${deviceName}. Say something now!`);
      setTranscription('Recording in progress...');
    } catch (err: unknown) {
      console.error('Mic access error:', err);
      const name = err && typeof err === 'object' && 'name' in err ? (err as any).name : 'UnknownError';
      setStatus(`Error: Could not access microphone. (${name})`);
      setIsRecording(false);
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Recording finished. Preparing for analysis...');
      setIsAnalyzing(true);
      setTranscription('');
    }
  };

  const analyzeAudio = async (base64Audio: string, mimeType: string): Promise<void> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = 'Transcribe the following audio recording and summarize its content in one sentence.';

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Audio } },
          ],
        },
      ],
    } as const;

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const text: string =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Analysis failed to produce text.';
        setTranscription(text);
        setStatus('Analysis Complete! Check the output below.');
        setIsAnalyzing(false);
        return;
      } catch (err: any) {
        console.error(`Attempt ${attempt} failed:`, err);
        if (attempt === maxRetries) {
          setTranscription(`Error: Failed after ${maxRetries} attempts. (${err?.message || 'Unknown error'})`);
          setStatus('Error during analysis.');
          setIsAnalyzing(false);
        } else {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="p-4 sm:p-8 flex justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-3xl">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🎤 Ask AI</h1>
          <p className="text-gray-600 mt-2">
            Record your voice, and transcribe it. And Magic
          </p>
        </header>

        <div className="bg-white p-6 rounded-xl shadow space-y-6">
          {/* Step 1: Record */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-blue-600 border-b pb-2">1. Record Audio</h2>
            <div
              className={`p-3 rounded-lg text-sm ${
                status.includes('Error')
                  ? 'bg-red-200 text-red-800'
                  : status.includes('Recording')
                  ? 'bg-yellow-200'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {status}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={startRecording}
                disabled={isRecording}
                className={`flex-1 font-semibold py-3 px-6 rounded-lg transition ${
                  isRecording
                    ? 'bg-red-500 text-white pulsing'
                    : 'bg-green-500 text-white hover:bg-green-600 disabled:opacity-50'
                }`}
              >
                {isRecording ? '🔴 Recording...' : 'Start Recording'}
              </button>
              <button
                onClick={stopRecording}
                disabled={!isRecording}
                className="flex-1 bg-red-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                Stop &amp; Analyze
              </button>
            </div>
          </div>

          {/* Step 2: Output */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-blue-600 border-b pb-2">2. LLM Analysis Output (Transcription)</h2>
            {isAnalyzing ? (
              <div className="text-center p-8">
                <div className="w-10 h-10 border-4 border-t-4 border-t-blue-500 border-gray-200 rounded-full animate-spin mx-auto"></div>
                <p className="mt-3 text-blue-600">Analyzing audio with Gemini...</p>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg min-h-[100px]">
                <p className="text-gray-500">{transcription}</p>
              </div>
            )}
          </div>

          {/* Step 3: Debug */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-blue-600 border-b pb-2">3. Playback / Debug</h2>
            {audioUrl && <audio src={audioUrl} controls className="w-full" />}
            {base64Preview && (
              <textarea
                readOnly
                value={base64Preview}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
                placeholder="Base64 audio data will appear here."
              />
            )}
          </div>
        </div>
      </div>

      {/* Tailwind & Custom Styles */}
      <style jsx>{`
        body {
          font-family: 'Inter', sans-serif;
        }
        .pulsing {
          animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(1.05); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

