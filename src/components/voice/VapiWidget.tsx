"use client";

import { vapi } from "@/lib/vapi";
import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { Card } from "../ui/card";
import Image from "next/image";
import { Button } from "../ui/button";

interface Message {
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
}

function VapiWidget() {
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callEnded, setCallEnded] = useState(false);
  const [debugMode, setDebugMode] = useState(true); // Toggle this for debugging

  const { user, isLoaded } = useUser();
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // auto-scroll for messages with smooth animation
  useEffect(() => {
    if (messageContainerRef.current) {
      const scrollElement = messageContainerRef.current;
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // setup event listeners for VAPI
  useEffect(() => {
    const handleCallStart = () => {
      console.log("✅ Call started");
      setConnecting(false);
      setCallActive(true);
      setCallEnded(false);
      
      // Add welcome message
      setMessages([{
        content: "Call connected. Start speaking!",
        role: "system",
        timestamp: new Date()
      }]);
    };

    const handleCallEnd = () => {
      console.log("❌ Call ended");
      setCallActive(false);
      setConnecting(false);
      setIsSpeaking(false);
      setCallEnded(true);
      
      // Add end message
      setMessages((prev) => [...prev, {
        content: "Call ended. Thank you for using DentWise AI!",
        role: "system",
        timestamp: new Date()
      }]);
    };

    const handleSpeechStart = () => {
      console.log("🗣️ AI started Speaking");
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      console.log("🤐 AI stopped Speaking");
      setIsSpeaking(false);
    };

    const handleMessage = (message: any) => {
      // Log ALL messages for debugging
      if (debugMode) {
        console.log("📨 VAPI Message received:", {
          type: message.type,
          transcriptType: message.transcriptType,
          role: message.role,
          transcript: message.transcript,
          fullMessage: message
        });
      }

      // Handle transcript messages (most common)
      if (message.type === "transcript") {
        const newRole = message.role === "assistant" ? "assistant" : "user";
        
        if (message.transcriptType === "partial") {
          // Update or add partial transcript
          console.log("⏳ Adding/Updating PARTIAL transcript:", message.transcript);
          
          setMessages((prev) => {
            // Check if we should update the last message or add a new one
            const lastMessage = prev[prev.length - 1];
            const shouldUpdate = lastMessage && 
                                 lastMessage.role === newRole && 
                                 lastMessage.content.endsWith('...');
            
            const newMessage: Message = {
              content: `${message.transcript}...`,
              role: newRole,
              timestamp: new Date()
            };
            
            if (shouldUpdate) {
              // Update existing partial message
              console.log("  → Updating existing partial message");
              return [...prev.slice(0, -1), newMessage];
            } else {
              // Add new partial message
              console.log("  → Adding new partial message");
              return [...prev, newMessage];
            }
          });
        } 
        else if (message.transcriptType === "final") {
          // Replace partial with final transcript
          console.log("✉️ Adding FINAL message:", message.transcript);
          
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            const shouldReplace = lastMessage && 
                                  lastMessage.role === newRole && 
                                  lastMessage.content.endsWith('...');
            
            const newMessage: Message = {
              content: message.transcript,
              role: newRole,
              timestamp: new Date()
            };
            
            if (shouldReplace) {
              // Replace the partial with final
              console.log("  → Replacing partial with final");
              return [...prev.slice(0, -1), newMessage];
            } else {
              // Add as new message
              console.log("  → Adding as new final message");
              return [...prev, newMessage];
            }
          });
        }
      }
      
      // Log other message types (don't add them to UI to avoid duplicates)
      else if (message.type === "conversation-update") {
        // Don't add these - they duplicate the transcript messages
        if (debugMode) {
          console.log("💬 Conversation update (ignored - using transcripts instead)");
        }
      }
      else if (message.type === "function-call") {
        console.log("🔧 Function call:", message);
      }
      else if (message.type === "model-output") {
        // These are the raw AI generation tokens - ignore them
        // Too verbose for debugging
      }
      else if (message.type === "voice-input") {
        // Voice input summary - ignore as we have transcripts
        // Too verbose for debugging
      }
      else if (message.type === "speech-update" || message.type === "status-update" || message.type === "assistant.started") {
        // Status messages - already handled by event listeners
        if (debugMode) {
          console.log(`📊 Status: ${message.type}`);
        }
      }
      else if (debugMode) {
        console.log("❓ Unhandled message type:", message.type);
      }
    };

    const handleError = (error: any) => {
      console.error("❌ Vapi Error:", error);
      setConnecting(false);
      setCallActive(false);
      
      // Add error message to UI
      setMessages((prev) => [...prev, {
        content: `Error: ${error.message || "Connection failed"}`,
        role: "system",
        timestamp: new Date()
      }]);
    };

    // Register event listeners
    vapi
      .on("call-start", handleCallStart)
      .on("call-end", handleCallEnd)
      .on("speech-start", handleSpeechStart)
      .on("speech-end", handleSpeechEnd)
      .on("message", handleMessage)
      .on("error", handleError);

    console.log("🎧 VAPI event listeners registered");

    // cleanup event listeners on unmount
    return () => {
      console.log("🧹 Cleaning up VAPI event listeners");
      vapi
        .off("call-start", handleCallStart)
        .off("call-end", handleCallEnd)
        .off("speech-start", handleSpeechStart)
        .off("speech-end", handleSpeechEnd)
        .off("message", handleMessage)
        .off("error", handleError);
    };
  }, [debugMode]);

  const toggleCall = async () => {
    if (callActive) {
      console.log("🛑 Stopping call...");
      vapi.stop();
    } else {
      try {
        setConnecting(true);
        setMessages([]);
        setCallEnded(false);

        console.log("📞 Starting call with assistant ID:", process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);
        await vapi.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);
      } catch (error) {
        console.error("❌ Failed to start call:", error);
        setConnecting(false);
        
        // Show error in UI
        setMessages([{
          content: `Failed to start call: ${error instanceof Error ? error.message : "Unknown error"}`,
          role: "system",
          timestamp: new Date()
        }]);
      }
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 flex flex-col overflow-hidden pb-20">
      {/* TITLE */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold font-mono">
          <span>Talk to Your </span>
          <span className="text-primary uppercase">AI Dental Assistant</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Have a voice conversation with our AI assistant for dental advice and guidance
        </p>
      </div>

      {/* VIDEO CALL AREA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* AI ASSISTANT CARD */}
        <Card className="bg-card/90 backdrop-blur-sm border border-border overflow-hidden relative">
          <div className="aspect-video flex flex-col items-center justify-center p-6 relative">
            {/* AI VOICE ANIMATION */}
            <div
              className={`absolute inset-0 ${
                isSpeaking ? "opacity-30" : "opacity-0"
              } transition-opacity duration-300`}
            >
              {/* voice wave animation when speaking */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-center items-center h-20">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`mx-1 h-16 w-1 bg-primary rounded-full ${
                      isSpeaking ? "animate-sound-wave" : ""
                    }`}
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      height: isSpeaking ? `${Math.random() * 50 + 20}%` : "5%",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* AI LOGO */}
            <div className="relative size-32 mb-4">
              <div
                className={`absolute inset-0 bg-primary opacity-10 rounded-full blur-lg ${
                  isSpeaking ? "animate-pulse" : ""
                }`}
              />

              <div className="relative w-full h-full rounded-full bg-card flex items-center justify-center border border-border overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-primary/5"></div>
                <Image
                  src="/logo.png"
                  alt="AI Dental Assistant"
                  width={80}
                  height={80}
                  className="w-20 h-20 object-contain"
                />
              </div>
            </div>

            <h2 className="text-xl font-bold text-foreground">DentWise AI</h2>
            <p className="text-sm text-muted-foreground mt-1">Dental Assistant</p>

            {/* SPEAKING INDICATOR */}
            <div
              className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border ${
                isSpeaking ? "border-primary" : ""
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isSpeaking ? "bg-primary animate-pulse" : "bg-muted"
                }`}
              />

              <span className="text-xs text-muted-foreground">
                {isSpeaking
                  ? "Speaking..."
                  : callActive
                  ? "Listening..."
                  : callEnded
                  ? "Call ended"
                  : "Waiting..."}
              </span>
            </div>
          </div>
        </Card>

        {/* USER CARD */}
        <Card className={`bg-card/90 backdrop-blur-sm border overflow-hidden relative`}>
          <div className="aspect-video flex flex-col items-center justify-center p-6 relative">
            {/* User Image */}
            <div className="relative size-32 mb-4">
              <Image
                src={user?.imageUrl!}
                alt="User"
                width={128}
                height={128}
                className="size-full object-cover rounded-full"
              />
            </div>

            <h2 className="text-xl font-bold text-foreground">You</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {user ? (user.firstName + " " + (user.lastName || "")).trim() : "Guest"}
            </p>

            {/* User Ready Text */}
            <div className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border`}>
              <div className={`w-2 h-2 rounded-full bg-muted`} />
              <span className="text-xs text-muted-foreground">Ready</span>
            </div>
          </div>
        </Card>
      </div>

      {/* MESSAGE CONTAINER - Now shows when call is active OR has messages */}
      {(callActive || messages.length > 0) && (
        <div
          ref={messageContainerRef}
          className="w-full bg-card/90 backdrop-blur-sm border border-border rounded-xl p-4 mb-8 h-64 overflow-y-auto transition-all duration-300 scroll-smooth"
        >
          {messages.length === 0 && callActive ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center">
                Waiting for conversation to start...
                <br />
                <span className="text-xs">Start speaking to begin</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => {
                const isPartial = msg.content.endsWith('...');
                return (
                  <div 
                    key={index} 
                    className={`message-item animate-in fade-in duration-300 ${
                      msg.role === "system" ? "opacity-70" : ""
                    } ${isPartial ? "opacity-80" : ""}`}
                  >
                    <div className={`font-semibold text-xs mb-1 flex items-center gap-2 ${
                      msg.role === "assistant" 
                        ? "text-primary" 
                        : msg.role === "system"
                        ? "text-muted-foreground"
                        : "text-blue-500"
                    }`}>
                      <span>
                        {msg.role === "assistant" 
                          ? "DentWise AI" 
                          : msg.role === "system"
                          ? "System"
                          : "You"}:
                      </span>
                      {isPartial && (
                        <span className="text-xs opacity-50 animate-pulse">●</span>
                      )}
                    </div>
                    <p className="text-foreground">{msg.content}</p>
                    {debugMode && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* CALL CONTROLS */}
      <div className="w-full flex justify-center gap-4">
        <Button
          className={`w-44 text-xl rounded-3xl ${
            callActive
              ? "bg-destructive hover:bg-destructive/90"
              : callEnded
              ? "bg-red-500 hover:bg-red-700"
              : "bg-primary hover:bg-primary/90"
          } text-white relative`}
          onClick={toggleCall}
          disabled={connecting || callEnded}
        >
          {connecting && (
            <span className="absolute inset-0 rounded-full animate-ping bg-primary/50 opacity-75"></span>
          )}

          <span>
            {callActive
              ? "End Call"
              : connecting
              ? "Connecting..."
              : callEnded
              ? "Call Ended"
              : "Start Call"}
          </span>
        </Button>
        
        {callEnded && (
          <Button
            variant="outline"
            onClick={() => {
              setCallEnded(false);
              setMessages([]);
            }}
          >
            New Call
          </Button>
        )}
      </div>
    </div>
  );
}

export default VapiWidget;