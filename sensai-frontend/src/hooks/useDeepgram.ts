import { useState, useEffect, useRef } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const useLiveTranscription = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deepgramRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const bufferRef = useRef<string>("");

  // Fetch Deepgram token for authentication
  const fetchDeepgramToken = async () => {
    try {
      const tokenRes = await fetch("/api/deepgram-token");
      const tokenJson = await tokenRes.json();
      if (!tokenJson.token) throw new Error("No Deepgram token");
      return tokenJson.token;
    } catch (err) {
      setError("Could not fetch Deepgram token");
      console.error(err);
      return null;
    }
  };

  // Start the live transcription process
  const startListening = async () => {
    const token = await fetchDeepgramToken();
    if (!token) return;

    const client = createClient(token);

    // Create live transcription client
    deepgramRef.current = await client.listen.live({
      model: "nova",
      language: "en-US",
      smart_format: true,
    });

    deepgramRef.current.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcriptText = data.channel.alternatives[0].transcript;
      if (transcriptText) {
        bufferRef.current += (bufferRef.current ? " " : "") + transcriptText;
        setTranscript(bufferRef.current);
      }
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && deepgramRef.current) {
          deepgramRef.current.send(event.data); // Send audio to Deepgram
        }
      };

      mediaRecorder.start(250); // Send audio every 250ms
      setIsListening(true);
    } catch (error) {
      setError("Microphone error: " + error);
      console.error(error);
    }
  };

  // Stop the live transcription process
  const stopListening = () => {
    // Check if mediaRecorder is not null and is active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks of the media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Finish the Deepgram connection
    if (deepgramRef.current) {
      deepgramRef.current.finish();
    }

    // Reset state
    setIsListening(false);
  };

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  };
};

export default useLiveTranscription;
