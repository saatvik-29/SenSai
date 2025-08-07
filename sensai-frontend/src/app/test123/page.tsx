"use client";

import React, { useRef, useState, useCallback } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { useRouter } from "next/navigation";

// Deepgram Transcript Data Interface
interface DeepgramTranscriptData {
  channel: {
    alternatives: Array<{
      transcript: string;
    }>;
  };
  is_final: boolean;
}

// Deepgram Connection Interface
interface DeepgramConnection {
  on: (event: string, callback: (data: DeepgramTranscriptData) => void) => void;
  send: (data: ArrayBuffer) => void;
  finish: () => void;
}

interface VoiceControlsProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
  liveTranscript: string;
  className?: string;
}

// Hook for Deepgram Voice Input Handling
export const useDeepgramVoice = ({
  onTranscriptUpdate,
  onError,
}: {
  onTranscriptUpdate: (transcript: string) => void;
  onError: (error: string) => void;
}) => {
  const dgConnRef = useRef<DeepgramConnection | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const bufferRef = useRef(""); // Persists per session
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  const cleanupVoice = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {}
    try {
      dgConnRef.current?.finish();
    } catch {}

    recorderRef.current = null;
    dgConnRef.current = null;
    setIsVoiceActive(false);
    setLiveTranscript("");
    bufferRef.current = "";
  }, []);

  const startVoice = useCallback(async () => {
    cleanupVoice();

    setIsVoiceActive(true);
    setLiveTranscript("");
    bufferRef.current = "";

    // Fetch a NEW Deepgram token every time
    let token;
    try {
      const tokenRes = await fetch("/api/deepgram-token");
      const tokenJson = await tokenRes.json();
      if (!tokenJson.token) throw new Error("No Deepgram token");
      token = tokenJson.token;
    } catch (err: unknown) {
      onError("Could not fetch Deepgram token: " + err);
      setIsVoiceActive(false);
      return;
    }

    // Create Deepgram client and connection
    const dgClient = createClient({ accessToken: token });

    // Setup microphone
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      onError("Could not access microphone: " + err);
      setIsVoiceActive(false);
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    recorderRef.current = recorder;

    const dgConn = dgClient.listen.live({
      model: "nova-3",
      interim_results: true,
      punctuate: true,
    });
    dgConnRef.current = dgConn;

    // Start recording
    dgConn.on(LiveTranscriptionEvents.Open, () => {
      recorder.start(250);
    });

    // Handle transcription results
    dgConn.on(LiveTranscriptionEvents.Transcript, (data: DeepgramTranscriptData) => {
      const txt = data.channel.alternatives[0]?.transcript.trim();

      if (txt && data.is_final) {
        // Final result - add to buffer
        bufferRef.current += (bufferRef.current ? " " : "") + txt;
        setLiveTranscript(bufferRef.current);
        onTranscriptUpdate(bufferRef.current);
      } else if (txt) {
        // Interim result - show preview
        setLiveTranscript(bufferRef.current + " " + txt);
      }
    });

    // Handle audio data
    recorder.addEventListener("dataavailable", async (e) => {
      const buf = await e.data.arrayBuffer();
      dgConn.send(buf);
    });

    // Clean up when recording stops
    recorder.onstop = () => {
      setIsVoiceActive(false);
      stream.getTracks().forEach((track) => track.stop());
      try {
        dgConn.finish();
      } catch {}
    };
  }, [cleanupVoice, onError, onTranscriptUpdate]);

  const stopVoice = useCallback(() => {
    cleanupVoice();
  }, [cleanupVoice]);

  return {
    isVoiceActive,
    liveTranscript,
    startVoice,
    stopVoice,
    cleanupVoice,
  };
};

// Voice Controls Component
const VoiceControls: React.FC<VoiceControlsProps> = ({
  isActive,
  onStart,
  onStop,
  disabled,
  liveTranscript,
  className = "",
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex space-x-3">
        <button
          onClick={onStart}
          disabled={disabled || isActive}
          className={`inline-flex items-center px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-lg ${
            isActive
              ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
              : disabled
              ? "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-500 cursor-not-allowed"
              : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
          }`}
        >
          {isActive ? "Recording..." : "Start Voice"}
        </button>

        <button
          onClick={onStop}
          disabled={!isActive}
          className="inline-flex items-center px-4 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
        >
          Done Speaking
        </button>
      </div>

      {/* Live Transcript Display */}
      {isActive && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
            </div>
            <span className="font-semibold text-slate-700">Live Transcript:</span>
            <span className="text-slate-600 flex-1">{liveTranscript || "Listening..."}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Component to Handle Voice Input
const DeepgramVoiceInput: React.FC<{
  onTranscriptUpdate: (transcript: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}> = ({ onTranscriptUpdate, onError, disabled = false, className = "" }) => {
  const { isVoiceActive, liveTranscript, startVoice, stopVoice } = useDeepgramVoice({
    onTranscriptUpdate,
    onError,
  });

  const router = useRouter();

  // Handle the transcript and perform actions
  const handleTranscriptUpdate = (transcript: string) => {
    const normalizedTranscript = transcript.toLowerCase();

    // Action when user wants to create a course
    if (normalizedTranscript.includes("create course")) {
      handleCreateCourseButtonClick();
    } else if (normalizedTranscript.includes("join course")) {
      handleJoinCourseAction();
    } else if (normalizedTranscript.includes("submit task")) {
      handleSubmitTaskAction();
    } else {
      handleFallbackAction();
    }
  };

  // Logic for Course Creation
  const handleCreateCourseButtonClick = () => {
    router.push("/school/admin/create"); // Redirect to course creation page
  };

  // Logic for Joining Course
  const handleJoinCourseAction = () => {
    router.push(`/courses/join`); // Redirect to course joining page
  };

  // Logic for Task Submission
  const handleSubmitTaskAction = () => {
    console.log("User is attempting to submit a task.");
    // Add task submission logic here
  };

  // Fallback action for unrecognized voice commands
  const handleFallbackAction = () => {
    console.log("Sorry, I didn't understand that. Could you please repeat?");
  };

  return (
    <div className={className}>
      <VoiceControls
        isActive={isVoiceActive}
        onStart={startVoice}
        onStop={stopVoice}
        disabled={disabled}
        liveTranscript={liveTranscript}
        className={className}
      />
    </div>
  );
};

export default DeepgramVoiceInput;
