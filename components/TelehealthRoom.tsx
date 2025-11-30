"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPeerConnection, getUserMedia, getDisplayMedia, addMediaTracksToPeer, removeMediaTracksFromPeer, createOffer, createAnswer, setRemoteDescription } from "@/lib/webrtc/peer-connection"
import { createAudioStreamer, sendAudioChunkToSTT } from "@/lib/webrtc/audio-capture"
import { createSignalingChannel } from "@/lib/webrtc/signaling"
import { useAuth } from "@/contexts/AuthContext"
import { getFirestoreClient } from "@/lib/firestore/client"
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  MessageSquare,
  FileText,
  Upload,
  Send,
  X,
  Image as ImageIcon,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface TelehealthRoomProps {
  appointmentId: string
  sessionId: string
  consultationId: string
  remoteUserId: string
  onEndCall?: () => void
}

export function TelehealthRoom({
  appointmentId,
  sessionId,
  consultationId,
  remoteUserId,
  onEndCall,
}: TelehealthRoomProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const audioStreamerRef = useRef<ReturnType<typeof createAudioStreamer> | null>(null)
  const signalingRef = useRef<ReturnType<typeof createSignalingChannel> | null>(null)
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // State
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new")
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [transcription, setTranscription] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("chat")

  // Initialize WebRTC connection
  useEffect(() => {
    let mounted = true
    let signalingCleanups: (() => void)[] = []

    const initializeConnection = async () => {
      if (!user) return

      try {
        setIsLoading(true)

        // Get user media
        const stream = await getUserMedia({
          video: true,
          audio: true,
        })
        localStreamRef.current = stream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Create peer connection
        const peerConnection = await createPeerConnection()
        peerConnectionRef.current = peerConnection

        // Add local tracks
        addMediaTracksToPeer(peerConnection, stream)

        // Handle remote stream
        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0]
          }
        }

        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
          if (mounted) {
            setConnectionState(peerConnection.connectionState)
          }
        }

        // Create signaling channel
        const signaling = createSignalingChannel(sessionId, user.id, remoteUserId)
        signalingRef.current = signaling

        // Handle ICE candidates
        peerConnection.onicecandidate = async (event) => {
          if (event.candidate && signaling) {
            await signaling.sendIceCandidate(event.candidate.toJSON())
          }
        }

        // Listen for remote ICE candidates
        const iceCandidateUnsubscribe = signaling.onIceCandidate(async (candidate) => {
          if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
          }
        })
        signalingCleanups.push(iceCandidateUnsubscribe)

        // Determine if we should initiate
        const isInitiator = user.id < remoteUserId

        if (isInitiator) {
          const offer = await createOffer(peerConnection)
          await signaling.sendOffer(offer)

          const answerUnsubscribe = signaling.onRemoteAnswer(async (answer) => {
            await setRemoteDescription(peerConnection, answer)
          })
          signalingCleanups.push(answerUnsubscribe)
        } else {
          const offerUnsubscribe = signaling.onRemoteOffer(async (offer) => {
            await setRemoteDescription(peerConnection, offer)
            const answer = await createAnswer(peerConnection)
            await signaling.sendAnswer(answer)
          })
          signalingCleanups.push(offerUnsubscribe)
        }

        // Start audio streaming to STT
        const audioStreamer = createAudioStreamer(stream, async (chunk: ArrayBuffer) => {
          try {
            await fetch("/api/stt/stream", {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "X-Session-Id": sessionId,
                "X-Consultation-Id": consultationId,
              },
              body: chunk,
            })
          } catch (error) {
            console.error("Error sending audio chunk:", error)
          }
        })
        audioStreamerRef.current = audioStreamer
        audioStreamer.start()

        // Poll for transcription updates
        const pollTranscription = async () => {
          try {
            const response = await fetch(
              `/api/stt/stream?consultationId=${consultationId}`,
              { credentials: "include" }
            )
            if (response.ok) {
              const data = await response.json()
              if (data.transcription) {
                const fullText = data.transcription
                  .filter((t: any) => t.isFinal)
                  .map((t: any) => t.text)
                  .join(" ")
                const partialText = data.transcription
                  .filter((t: any) => !t.isFinal)
                  .map((t: any) => t.text)
                  .join(" ")
                setTranscription(fullText + (partialText ? ` ${partialText}...` : ""))
              }
            }
          } catch (error) {
            console.error("Error fetching transcription:", error)
          }
        }

        transcriptionIntervalRef.current = setInterval(pollTranscription, 2000)

        setIsLoading(false)
      } catch (error) {
        console.error("Error initializing connection:", error)
        setIsLoading(false)
        toast({
          title: "Connection Error",
          description: "Failed to initialize video call. Please try again.",
          variant: "destructive",
        })
      }
    }

    initializeConnection()

    return () => {
      mounted = false
      signalingCleanups.forEach((cleanup) => cleanup())
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current)
      }
      cleanup()
    }
  }, [sessionId, user, remoteUserId, consultationId, toast])

  // Cleanup on unmount
  const cleanup = useCallback(async () => {
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop()
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }

    if (signalingRef.current) {
      await signalingRef.current.cleanup()
    }

    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current)
    }
  }, [])

  // Setup Firestore chat listener
  useEffect(() => {
    if (!user || !appointmentId) return

    const firestore = getFirestoreClient()
    const chatId = `appointment-${appointmentId}`
    const messagesRef = collection(firestore, "messages")

    const messagesQuery = query(
      messagesRef,
      where("threadId", "==", chatId),
      orderBy("createdAt", "desc"),
      limit(50)
    )

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setMessages(newMessages.reverse())
      },
      (error) => {
        console.error("Error listening to messages:", error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [user, appointmentId])

  // Toggle mute/unmute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }, [isMuted])

  // Toggle video on/off
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !isVideoOn
      })
      setIsVideoOn(!isVideoOn)
    }
  }, [isVideoOn])

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current) return

    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop())
          removeMediaTracksFromPeer(peerConnectionRef.current)

          if (localStreamRef.current) {
            addMediaTracksToPeer(peerConnectionRef.current, localStreamRef.current)
          }

          screenStreamRef.current = null
          setIsScreenSharing(false)
        }
      } else {
        const screenStream = await getDisplayMedia()
        screenStreamRef.current = screenStream

        const senders = peerConnectionRef.current.getSenders()
        const videoSender = senders.find(
          (sender) => sender.track && sender.track.kind === "video"
        )

        if (videoSender && screenStream.getVideoTracks()[0]) {
          await videoSender.replaceTrack(screenStream.getVideoTracks()[0])
        }

        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare()
        }

        setIsScreenSharing(true)
      }
    } catch (error) {
      console.error("Error toggling screen share:", error)
      toast({
        title: "Screen Share Error",
        description: "Failed to start screen sharing.",
        variant: "destructive",
      })
    }
  }, [isScreenSharing, toast])

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user) return

    try {
      const firestore = getFirestoreClient()
      const chatId = `appointment-${appointmentId}`
      const messagesRef = collection(firestore, "messages")

      await addDoc(messagesRef, {
        threadId: chatId,
        senderId: user.id,
        senderRole: user.role.toUpperCase(),
        content: newMessage,
        attachments: [],
        read: false,
        createdAt: serverTimestamp(),
      })

      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      })
    }
  }, [newMessage, user, appointmentId, toast])

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // TODO: Upload file to storage and add to chat
      toast({
        title: "File Upload",
        description: `Uploading ${file.name}...`,
        variant: "default",
      })
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload Error",
        description: "Failed to upload file.",
        variant: "destructive",
      })
    }
  }, [toast])

  // End call
  const endCall = useCallback(async () => {
    await cleanup()
    if (onEndCall) {
      onEndCall()
    }
  }, [cleanup, onEndCall])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background overflow-hidden grid grid-cols-[1fr_400px]">
      {/* Main Video Area */}
      <div className="relative bg-black flex flex-col">
        {/* Remote Video (Patient) - Large */}
        <div className="flex-1 relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {connectionState !== "connected" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
              <div className="text-center">
                <div className="text-lg mb-2 font-medium">
                  {connectionState === "connecting" && "Connecting..."}
                  {connectionState === "disconnected" && "Disconnected"}
                  {connectionState === "failed" && "Connection Failed"}
                </div>
                {connectionState === "connecting" && (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local Video (Doctor) - Small Inset */}
        <div className="absolute bottom-24 right-6 w-64 h-48 bg-black rounded-lg overflow-hidden border-2 border-primary shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <VideoOff className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="lg"
              onClick={toggleMute}
              className="rounded-full h-14 w-14"
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant={!isVideoOn ? "destructive" : "secondary"}
              size="lg"
              onClick={toggleVideo}
              className="rounded-full h-14 w-14"
            >
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="lg"
              onClick={toggleScreenShare}
              className="rounded-full h-14 w-14"
            >
              <Monitor className="h-5 w-5" />
            </Button>

            <Button
              variant="destructive"
              size="lg"
              onClick={endCall}
              className="rounded-full h-14 w-14"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side Panel */}
      <div className="bg-background border-l flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Files
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0">
            <Card className="flex-1 flex flex-col rounded-none border-0 border-t">
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Messages</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No messages yet. Start the conversation.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.senderId === user?.id ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-lg ${
                          message.senderId === user?.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div
                          className={`text-xs mt-1 ${
                            message.senderId === user?.id
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {new Date(
                            message.createdAt?.toDate?.() || message.createdAt
                          ).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Notes Tab - Live Transcription */}
          <TabsContent value="notes" className="flex-1 flex flex-col m-0 p-0">
            <Card className="flex-1 flex flex-col rounded-none border-0 border-t">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Live Transcription</CardTitle>
                  <Badge variant="secondary">Live</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4">
                {transcription ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {transcription}
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Transcription will appear here as the conversation progresses.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-1 flex flex-col m-0 p-0">
            <Card className="flex-1 flex flex-col rounded-none border-0 border-t">
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Shared Files</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm font-medium mb-2">Upload Image or File</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Share medical images, documents, or other files
                    </p>
                    <label>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button variant="outline" asChild>
                        <span>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Choose File
                        </span>
                      </Button>
                    </label>
                  </div>

                  {/* Sample uploaded files */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recent Files</p>
                    <div className="space-y-2">
                      {[
                        { name: "X-Ray_2024-01-15.jpg", date: "2024-01-15", size: "2.4 MB" },
                        { name: "Lab_Results.pdf", date: "2024-01-10", size: "156 KB" },
                      ].map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {file.date} • {file.size}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
