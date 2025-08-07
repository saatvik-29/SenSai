"use client"
import React, { useState, useEffect, useCallback } from 'react';
import Vapi from '@vapi-ai/web';

interface VapiWidgetProps {
  apiKey: string;
  assistantId: string;
  config?: Record<string, unknown>;
}

// UI Element mapping for highlighting
const UI_ELEMENT_MAP: Record<string, string> = {
  // Account creation flow
  'create account': '#create-account-btn',
  'sign up': '#signup-button', 
  'signup': '#signup-button',
  'email': '#email-input',
  'email field': '#email-input',
  'password': '#password-input',
  'password field': '#password-input',
  'confirm password': '#confirm-password-input',
  

  'mark complete': '#mark-complete-btn',
  'next task': '#next-task-btn',
  'next': '#next-task-btn', // Add a shorter alias
  'previous task': '#prev-task-btn',
  'previous': '#prev-task-btn', // Add a shorter alias
  'the quiz': '#quiz-container',
  'quiz': '#quiz-container',
  // Course flow
  'create course': '#create-course-btn',
  'join course': '#join-course-btn',
  'course name': '#course-name-input',
  'course code': '#course-code-input',
  'enroll': '#enroll-btn',
  'enrollment': '#enroll-btn',
   'your courses': '#course-grid',
  'list of courses': '#course-grid',
  'course list': '#course-grid',
  'courses': '#course-grid', // A general keyword
  
  // Submission flow
  'submit': '#submit-btn',
  'submit task': '#submit-task-btn',
  'upload': '#upload-btn',
  'storage queue': '.storage-queue-icon',
  'storage-queue': '.storage-queue-icon',
  'offline submit': '#offline-submit-btn',
  'file upload': '#file-upload-input',
  
  // Navigation
  'dashboard': '#dashboard-link',
  'profile': '#profile-link',
  'settings': '#settings-link'
};

// Keywords that indicate UI interaction
const INTERACTION_KEYWORDS = [
  'click', 'tap', 'press', 'select', 'choose', 'find', 'look for', 
  'go to', 'navigate', 'open', 'access', 'enter', 'fill', 'type'
];

const VapiWidget: React.FC<VapiWidgetProps> = ({ 
  apiKey, 
  assistantId, 
  config = {} 
}) => {
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<Array<{role: string, text: string}>>([]);
  const [currentHighlight, setCurrentHighlight] = useState<string | null>(null);

  // Parse message for UI elements to highlight
  const parseForUIElements = useCallback((text: string) => {
    const lowercaseText = text.toLowerCase();
    
    // Check if this message contains interaction keywords
    const hasInteractionKeyword = INTERACTION_KEYWORDS.some(keyword => 
      lowercaseText.includes(keyword)
    );
    
    if (!hasInteractionKeyword) return null;

    // Find UI elements mentioned in the text
    for (const [elementName, selector] of Object.entries(UI_ELEMENT_MAP)) {
      if (lowercaseText.includes(elementName.toLowerCase())) {
        return { elementName, selector };
      }
    }
    
    return null;
  }, []);

  // Highlight UI element
  const highlightElement = useCallback((selector: string, elementName: string) => {
    try {
      const element = document.querySelector(selector);
      if (element) {
        // Remove any existing highlights
        document.querySelectorAll('.vapi-highlight').forEach(el => {
          el.classList.remove('vapi-highlight');
        });

        // Add highlight class
        element.classList.add('vapi-highlight');
        
        // Scroll element into view
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });

        setCurrentHighlight(selector);

        // Auto-remove highlight after 5 seconds
        setTimeout(() => {
          element.classList.remove('vapi-highlight');
          setCurrentHighlight(null);
        }, 5000);

        console.log(`Highlighted element: ${elementName} (${selector})`);
      } else {
        console.warn(`Element not found: ${selector}`);
      }
    } catch (error) {
      console.error('Error highlighting element:', error);
    }
  }, []);

  // Clear current highlight
  const clearHighlight = useCallback(() => {
    if (currentHighlight) {
      const element = document.querySelector(currentHighlight);
      if (element) {
        element.classList.remove('vapi-highlight');
      }
      setCurrentHighlight(null);
    }
  }, [currentHighlight]);

  useEffect(() => {
    const vapiInstance = new Vapi(apiKey);
    setVapi(vapiInstance);

    // Event listeners
    vapiInstance.on('call-start', () => {
      console.log('Call started');
      setIsConnected(true);
    });

    vapiInstance.on('call-end', () => {
      console.log('Call ended');
      setIsConnected(false);
      setIsSpeaking(false);
      clearHighlight();
    });

    vapiInstance.on('speech-start', () => {
      console.log('Assistant started speaking');
      setIsSpeaking(true);
    });

    vapiInstance.on('speech-end', () => {
      console.log('Assistant stopped speaking');
      setIsSpeaking(false);
    });

    vapiInstance.on('message', (message) => {
      if (message.type === 'transcript') {
        const newMessage = {
          role: message.role,
          text: message.transcript
        };
        
        setTranscript(prev => [...prev, newMessage]);

        // Check if assistant message contains UI elements to highlight
        if (message.role === 'assistant') {
          const uiElement = parseForUIElements(message.transcript);
          if (uiElement) {
            // Small delay to ensure the message is processed
            setTimeout(() => {
              highlightElement(uiElement.selector, uiElement.elementName);
            }, 500);
          }
        }
      }
    });

    vapiInstance.on('error', (error) => {
      console.error('Vapi error:', error);
    });

    return () => {
      clearHighlight();
      vapiInstance?.stop();
    };
  }, [apiKey, parseForUIElements, highlightElement, clearHighlight]);

  const startCall = () => {
    if (vapi) {
      vapi.start(assistantId);
    }
  };

  const endCall = () => {
    if (vapi) {
      clearHighlight();
      vapi.stop();
    }
  };

  // Inject CSS for highlighting effect
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .vapi-highlight {
        animation: vapi-pulse 2s infinite, vapi-glow 0.5s ease-in-out !important;
        box-shadow: 0 0 20px 4px rgba(18, 165, 148, 0.6) !important;
        border: 2px solid #12A594 !important;
        border-radius: 8px !important;
        position: relative !important;
        z-index: 9999 !important;
      }
      
      .vapi-highlight::after {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        background: rgba(18, 165, 148, 0.1);
        border-radius: 10px;
        pointer-events: none;
        z-index: -1;
      }
      
      @keyframes vapi-pulse {
        0% { box-shadow: 0 0 20px 4px rgba(18, 165, 148, 0.6); }
        50% { box-shadow: 0 0 30px 8px rgba(18, 165, 148, 0.8); }
        100% { box-shadow: 0 0 20px 4px rgba(18, 165, 148, 0.6); }
      }
      
      @keyframes vapi-glow {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 1000,
      fontFamily: 'Arial, sans-serif'
    }}>
      {!isConnected ? (
        <button
          onClick={startCall}
          style={{
            background: '#12A594',
            color: '#fff',
            border: 'none',
            borderRadius: '50px',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(18, 165, 148, 0.3)',
            transition: 'all 0.3s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(18, 165, 148, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(18, 165, 148, 0.3)';
          }}
        >
          🎤 Start Voice Guide
        </button>
      ) : (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          width: '320px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          border: '1px solid #e1e5e9'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: isSpeaking ? '#ff4444' : '#12A594',
                animation: isSpeaking ? 'pulse 1s infinite' : 'none'
              }}></div>
              <span style={{ fontWeight: 'bold', color: '#333' }}>
                {isSpeaking ? 'Guide Speaking...' : 'Listening...'}
              </span>
            </div>
            <button
              onClick={endCall}
              style={{
                background: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              End Call
            </button>
          </div>
          
          {currentHighlight && (
            <div style={{
              background: '#e8f5f3',
              padding: '8px 12px',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#12A594',
              fontWeight: 'bold'
            }}>
              💡 Element highlighted on page
            </div>
          )}
          
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            marginBottom: '12px',
            padding: '8px',
            background: '#f8f9fa',
            borderRadius: '8px'
          }}>
            {transcript.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                Say "help me create account" or "how do I join course" to start...
              </p>
            ) : (
              transcript.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: '8px',
                    textAlign: msg.role === 'user' ? 'right' : 'left'
                  }}
                >
                  <span style={{
                    background: msg.role === 'user' ? '#12A594' : '#333',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    display: 'inline-block',
                    fontSize: '14px',
                    maxWidth: '80%'
                  }}>
                    {msg.text}
                  </span>
                </div>
              ))
            )}
          </div>
          
          <div style={{
            fontSize: '11px',
            color: '#666',
            textAlign: 'center'
          }}>
            Voice commands: "stop", "repeat", "help"
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default VapiWidget;