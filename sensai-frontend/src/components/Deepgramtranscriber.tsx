"use client";
import React from "react";
import { useDeepgramTranscriber } from "@/app/hooks/useDeepgram";

export default function DeepgramTranscriber() {
  const { transcript, isRecording, startTranscription, stopTranscription } = useDeepgramTranscriber();

  return (
    <div className="p-4 border rounded-xl shadow-md bg-white max-w-xl mx-auto my-6 space-y-4">
      <div>
        <button
          onClick={isRecording ? stopTranscription : startTranscription}
          className={`px-4 py-2 rounded text-white font-semibold ${
            isRecording ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
      </div>
      <div className="text-gray-700 whitespace-pre-line">
        <strong>Transcript:</strong>
        <div className="mt-2 bg-gray-100 p-2 rounded-md min-h-[50px]">{transcript}</div>
      </div>
    </div>
  );
}
