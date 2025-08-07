"use client";

import React, { useRef, useState, useCallback } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

interface DeepgramTranscriptData {
  channel: {
    alternatives: Array<{
      transcript: string;
    }>;
  };
  is_final: boolean;
}

interface DeepgramConnection {
  on: (event: string, callback: (data: DeepgramTranscriptData) => void) => void;
  send: (data: ArrayBuffer) => void;
  finish: () => void;
}

interface DeepgramVoiceInputProps {
  onTranscriptUpdate: (transcript: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

interface VoiceControlsProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
  liveTranscript: string;
  className?: string;
}

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

    // Create a new Deepgram client and connection
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
      mimeType: "audio/webm;codecs=opus" 
    });
    recorderRef.current = recorder;

    const dgConn = dgClient.listen.live({
      model: "nova-3",
      interim_results: true,
      punctuate: true,
    });
    dgConnRef.current = dgConn;

    // Start recording when connection opens
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
    // The final transcript is already set in the onTranscriptUpdate callback
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
export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isActive,
  onStart,
  onStop,
  disabled,
  liveTranscript,
  className = "",
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Control Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onStart}
          disabled={disabled || isActive}
          className={`inline-flex items-center px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-lg ${
            isActive 
              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200' 
              : disabled
              ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
          }`}
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          {isActive ? 'Recording...' : 'Start Voice'}
        </button>
        
        <button
          onClick={onStop}
          disabled={!isActive}
          className="inline-flex items-center px-4 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
        >
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Done Speaking
        </button>
      </div>

      {/* Live Transcript Display */}
      {isActive && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="font-semibold text-slate-700">Live Transcript:</span>
            <span className="text-slate-600 flex-1">{liveTranscript || "Listening..."}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Deepgram Voice Input Component
const DeepgramVoiceInput: React.FC<DeepgramVoiceInputProps> = ({
  onTranscriptUpdate,
  onError,
  disabled = false,
  className = "",
}) => {
  const {
    isVoiceActive,
    liveTranscript,
    startVoice,
    stopVoice,
  } = useDeepgramVoice({
    onTranscriptUpdate,
    onError,
  });

  return (
    <VoiceControls
      isActive={isVoiceActive}
      onStart={startVoice}
      onStop={stopVoice}
      disabled={disabled}
      liveTranscript={liveTranscript}
      className={className}
    />
  );
};

export default DeepgramVoiceInput;