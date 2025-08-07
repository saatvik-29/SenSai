"use client";

import React, { useState, useEffect, useCallback } from "react";
import DeepgramTranscriber from "./Deepgram"; // Ensure this points to your correct DeepgramTranscriber file

interface VoiceTranscriberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript?: (text: string) => void;
  apiKey: string;
  autoStart?: boolean;
  title?: string;
}

const VoiceTranscriberDialog: React.FC<VoiceTranscriberDialogProps> = ({
  isOpen,
  onClose,
  onTranscript,
  apiKey,
  autoStart = false,
  title = "Live Transcription",
}) => {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [allTranscripts, setAllTranscripts] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTranscribedText("");
      setAllTranscripts([]);
      if (autoStart) setIsVoiceActive(true);
    } else {
      setIsVoiceActive(false);
    }
  }, [isOpen, autoStart]);

  useEffect(() => {
    if (isOpen && apiKey) {
      // Check microphone permission
      navigator.permissions?.query({ name: "microphone" as PermissionName })
        .then((result) => {
          setHasPermission(result.state === "granted");
          
          // Listen for permission changes
          result.onchange = () => {
            setHasPermission(result.state === "granted");
          };
        })
        .catch(() => {
          // Fallback: try to get user media to test permission
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              setHasPermission(true);
              stream.getTracks().forEach(track => track.stop()); // Clean up test stream
            })
            .catch(() => setHasPermission(false));
        });
    }
  }, [isOpen, apiKey]);

  const handleTranscript = useCallback((text: string) => {
    console.log("Received transcript:", text);
    setTranscribedText(text);
    setAllTranscripts(prev => [...prev, text]);
    if (onTranscript) onTranscript(text);
  }, [onTranscript]);

  const handleError = useCallback((err: Error) => {
    console.error("Transcriber error:", err);
    setHasPermission(false);
    setIsVoiceActive(false);
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (hasPermission === false) {
      // Try to request permission again
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasPermission(true);
        stream.getTracks().forEach(track => track.stop()); // Clean up
      } catch (err) {
        console.error("Permission denied:", err);
        return;
      }
    }
    
    setIsVoiceActive(prev => !prev);
  }, [hasPermission]);

  const clearTranscripts = useCallback(() => {
    setTranscribedText("");
    setAllTranscripts([]);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a1a] rounded-lg shadow-xl w-full max-w-md mx-auto border border-gray-700 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl text-white font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            {allTranscripts.length > 0 && (
              <button 
                onClick={clearTranscripts}
                className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700"
                title="Clear transcripts"
              >
                Clear
              </button>
            )}
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white text-lg"
              title="Close"
            >
              ✖
            </button>
          </div>
        </div>

        {/* API Key Status */}
        {!apiKey && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded">
            <p className="text-red-300 text-sm">⚠️ API key is required for transcription</p>
          </div>
        )}

        {/* Toggle Mic Button */}
        <div className="flex justify-center mb-4">
          <button
            onClick={toggleMicrophone}
            disabled={!apiKey || hasPermission === false}
            className={`p-4 rounded-full transition-all duration-200 relative ${
              isVoiceActive
                ? "bg-red-600 hover:bg-red-700"
                : hasPermission === false || !apiKey
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            } ${isVoiceActive ? 'animate-pulse' : ''}`}
            title={
              !apiKey
                ? "API key required"
                : hasPermission === false
                ? "Microphone permission required"
                : isVoiceActive
                ? "Stop transcription"
                : "Start transcription"
            }
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <path d="M12 19v4"/>
              <path d="M8 23h8"/>
            </svg>
            {isVoiceActive && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
            )}
          </button>
        </div>

        {/* Permission Error */}
        {hasPermission === false && (
          <div className="mb-3 p-3 bg-yellow-900/50 border border-yellow-600 rounded">
            <p className="text-yellow-300 text-sm">
              🎤 Microphone access required. Please allow microphone permissions and try again.
            </p>
            <button 
              onClick={toggleMicrophone}
              className="mt-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded"
            >
              Request Permission
            </button>
          </div>
        )}

        {/* Transcriber */}
        {isVoiceActive && hasPermission !== false && apiKey && (
          <div className="mb-3">
            <div className="p-4 bg-[#2a2a2a] rounded border border-gray-600 mb-3">
              <DeepgramTranscriber
                apiKey={apiKey}
                onTranscript={handleTranscript}
                onError={handleError}
              />
            </div>
            
            {/* Latest Transcript */}
            {transcribedText && (
              <div className="p-3 bg-[#333333] rounded border-l-4 border-blue-500 mb-2">
                <p className="text-sm text-gray-300">
                  <span className="text-blue-400 font-medium">Latest:</span> "{transcribedText}"
                </p>
              </div>
            )}

            {/* All Transcripts */}
            {allTranscripts.length > 1 && (
              <div className="max-h-32 overflow-y-auto p-3 bg-[#2a2a2a] rounded border border-gray-600">
                <p className="text-xs text-gray-400 mb-2">All transcripts:</p>
                {allTranscripts.map((transcript, index) => (
                  <div key={index} className="text-sm text-gray-300 mb-1 pb-1 border-b border-gray-600 last:border-b-0">
                    {index + 1}. "{transcript}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <p className="text-center text-gray-400 text-sm">
          {!apiKey
            ? "Add your Deepgram API key to start transcription"
            : isVoiceActive
            ? "Speak clearly into your microphone..."
            : "Click the microphone to start transcription"}
        </p>
      </div>
    </div>
  );
};

export default VoiceTranscriberDialog;