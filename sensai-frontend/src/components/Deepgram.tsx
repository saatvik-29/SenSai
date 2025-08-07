"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

interface DeepgramTranscriberProps {
  apiKey: string;
  onTranscript?: (transcript: string) => void;
  onError?: (error: Error) => void;
}

const DeepgramTranscriber: React.FC<DeepgramTranscriberProps> = ({
  apiKey,
  onTranscript,
  onError,
}) => {
  const connectionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    console.log("🧹 Starting cleanup...");
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        console.log("📱 MediaRecorder stopped");
      } catch (e) {
        console.warn("MediaRecorder stop error:", e);
      }
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("🎤 Audio track stopped");
      });
      mediaStreamRef.current = null;
    }

    // Close Deepgram connection
    if (connectionRef.current) {
      try {
        connectionRef.current.finish();
        console.log("🔌 Deepgram connection closed");
      } catch (e) {
        console.warn("Deepgram connection close error:", e);
      }
      connectionRef.current = null;
    }

    setIsListening(false);
    setIsConnected(false);
  }, []);

  useEffect(() => {
    let isComponentMounted = true;

    const startTranscription = async () => {
      try {
        setError(null);
        console.log("🚀 Starting transcription...");

        // Create Deepgram client
        const deepgram = createClient(apiKey);

        // Get microphone access with specific constraints
        console.log("🎤 Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
            channelCount: 1,
          }
        });

        if (!isComponentMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        console.log("✅ Microphone access granted");

        // Create live connection
        console.log("🔗 Creating Deepgram connection...");
        const connection = deepgram.listen.live({
          model: "nova-2",
          language: "en-US",
          smart_format: true,
          interim_results: false, // Only get final results
          utterance_end_ms: 1000,
          vad_events: true,
        });

        connectionRef.current = connection;

        // Set up connection event listeners
        connection.on(LiveTranscriptionEvents.Open, () => {
          if (isComponentMounted) {
            console.log("🟢 Deepgram connection opened");
            setIsConnected(true);
            setIsListening(true);
          }
        });

        connection.on(LiveTranscriptionEvents.Close, (closeEvent) => {
          console.log("🔴 Deepgram connection closed:", closeEvent);
          if (isComponentMounted) {
            setIsConnected(false);
            setIsListening(false);
          }
        });

        connection.on(LiveTranscriptionEvents.Error, (error) => {
          console.error("❌ Deepgram error:", error);
          if (isComponentMounted) {
            const errorMsg = error?.message || "Connection error";
            setError(errorMsg);
            setIsListening(false);
            setIsConnected(false);
            if (onError) onError(new Error(errorMsg));
          }
        });

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          console.log("📝 Received data:", data);
          
          if (!isComponentMounted) return;
          
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          if (transcript && transcript.trim() && data.is_final) {
            console.log("✨ Final transcript:", transcript);
            if (onTranscript) {
              onTranscript(transcript);
            }
          }
        });

        // Set up MediaRecorder for audio capture
        console.log("🎙️ Setting up MediaRecorder...");
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && connection && isComponentMounted) {
            // Send raw audio data to Deepgram
            connection.send(event.data);
            console.log("📤 Sent audio chunk:", event.data.size, "bytes");
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          if (isComponentMounted && onError) {
            onError(new Error("MediaRecorder error occurred"));
          }
        };

        mediaRecorder.onstart = () => {
          console.log("🎬 MediaRecorder started");
        };

        mediaRecorder.onstop = () => {
          console.log("⏹️ MediaRecorder stopped");
        };

        // Start recording with frequent data chunks
        mediaRecorder.start(100); // Send data every 100ms
        console.log("🎤 Recording started");

      } catch (err) {
        console.error("💥 Initialization error:", err);
        if (isComponentMounted) {
          const errorMessage = err instanceof Error ? err.message : "Failed to initialize transcription";
          setError(errorMessage);
          setIsListening(false);
          setIsConnected(false);
          if (onError && err instanceof Error) {
            onError(err);
          }
        }
      }
    };

    startTranscription();

    // Cleanup on unmount
    return () => {
      isComponentMounted = false;
      cleanup();
    };
  }, [apiKey, onTranscript, onError, cleanup]);

  if (error) {
    return (
      <div className="text-red-400 p-3 bg-red-900/20 rounded border border-red-600">
        <div className="flex items-center gap-2 mb-2">
          <span>❌</span>
          <span className="font-medium">Connection Error</span>
        </div>
        <div className="text-sm mb-3">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {isConnected ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400">🎙️ Recording & Transcribing...</span>
          </div>
        ) : isListening ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-yellow-400">⏳ Connecting to Deepgram...</span>
          </div>
        ) : (
          <span className="text-gray-400">🔄 Initializing...</span>
        )}
      </div>
      
      <div className="text-xs text-gray-500">
        Status: {isConnected ? "Connected" : isListening ? "Connecting" : "Starting"}
      </div>
    </div>
  );
};

export default DeepgramTranscriber;