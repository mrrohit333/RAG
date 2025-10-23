"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Loader2,
  ArrowUpRight,
  UploadCloud,
  Sparkles,
  UserRound,
  Moon,
  Sun,
  AlertCircle,
  RotateCcw,
  Plus,
  MessageSquare,
  Trash2,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  error?: boolean
}

interface ChatHistory {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

interface UploadStatus {
  uploading: boolean
  fileName?: string
  success?: boolean
  error?: string
}

interface UserDocumentMeta {
  file: string
  chunks: number
  uploaded_at: string
}

export function ChatInterface() {
  const router = useRouter()
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ uploading: false })
  const [isDark, setIsDark] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userDocs, setUserDocs] = useState<UserDocumentMeta[] | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [displayName, setDisplayName] = useState<string>(typeof window !== "undefined" ? (localStorage.getItem("username") || "User") : "User")

  const userId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null
  const HISTORIES_KEY = `rag-chat-histories:${userId ?? "anon"}`
  const CURRENT_KEY = `rag-current-chat-id:${userId ?? "anon"}`

  useEffect(() => {
    const savedHistories = localStorage.getItem(HISTORIES_KEY)
    const savedCurrentChatId = localStorage.getItem(CURRENT_KEY)

    if (savedHistories) {
      const histories: ChatHistory[] = JSON.parse(savedHistories).map((h: any) => ({
        ...h,
        createdAt: new Date(h.createdAt),
        updatedAt: new Date(h.updatedAt),
        messages: h.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }))
      setChatHistories(histories)

      if (savedCurrentChatId) {
        const currentChat = histories.find((h) => h.id === savedCurrentChatId)
        if (currentChat) {
          setCurrentChatId(savedCurrentChatId)
          setMessages(currentChat.messages)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (chatHistories.length > 0) {
      localStorage.setItem(HISTORIES_KEY, JSON.stringify(chatHistories))
    }
  }, [chatHistories])

  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem(CURRENT_KEY, currentChatId)
    }
  }, [currentChatId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  // keep display name in sync
  useEffect(() => {
    const name = typeof window !== "undefined" ? (localStorage.getItem("username") || "User") : "User"
    setDisplayName(name)
  }, [])

  // Fetch user's uploaded docs
  const fetchUserDocs = async () => {
    const uid = Number(localStorage.getItem("user_id")) || 0
    if (!uid) return
    try {
      const res = await fetch(`http://127.0.0.1:8000/user/${uid}/docs`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setUserDocs(data as UserDocumentMeta[])
      } else {
        setUserDocs(null)
      }
    } catch (_) {
      setUserDocs(null)
    }
  }

  useEffect(() => {
    fetchUserDocs()
  }, [])

  const saveCurrentChat = (updatedMessages: Message[]) => {
    if (currentChatId) {
      setChatHistories((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId ? { ...chat, messages: updatedMessages, updatedAt: new Date() } : chat,
        ),
      )
    } else if (updatedMessages.length > 0) {
      const newChatId = Date.now().toString()
      const title = generateChatTitle(updatedMessages)
      const newChat: ChatHistory = {
        id: newChatId,
        title,
        messages: updatedMessages,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setChatHistories((prev) => [newChat, ...prev])
      setCurrentChatId(newChatId)
    }
  }

  const generateChatTitle = (messages: Message[]): string => {
    const firstUserMessage = messages.find((m) => m.role === "user")
    if (firstUserMessage) {
      return firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
    }
    return "New Chat"
  }

  const sendMessage = async (content: string, isRetry = false, messageId?: string) => {
    if (!content.trim() && !isRetry) return

    let userMessage: Message
    let updatedMessages: Message[]

    if (isRetry && messageId) {
      const originalMessage = messages.find((m) => m.id === messageId)
      if (!originalMessage) return
      userMessage = originalMessage
      updatedMessages = messages
    } else {
      userMessage = {
        id: Date.now().toString(),
        content: content.trim(),
        role: "user",
        timestamp: new Date(),
      }
      updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setInput("")
    }

    setIsLoading(true)

    // Create a placeholder assistant message to stream into
    const assistantId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    }
    let streamingMessages =
      isRetry && messageId
        ? updatedMessages.filter((m) => m.id !== messageId + "_error").concat(assistantMessage)
        : [...updatedMessages, assistantMessage]
    setMessages(streamingMessages)

    try {
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/plain",
        },
        body: JSON.stringify({
          question: userMessage.content,
          user_id: Number(localStorage.getItem("user_id")) || 0,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        // Append chunk to the assistant message content
        streamingMessages = streamingMessages.map((m) =>
          m.id === assistantId ? { ...m, content: (m.content || "") + chunk } : m,
        )
        setMessages(streamingMessages)
      }
      saveCurrentChat(streamingMessages)
    } catch (error) {
      console.error("Error sending message:", error)

      const errorMessage: Message = {
        id: isRetry ? messageId + "_error" : (Date.now() + 1).toString(),
        content:
          "Sorry, I couldn't connect to the server. Please check if the backend is running on http://127.0.0.1:8000 and try again.",
        role: "assistant",
        timestamp: new Date(),
        error: true,
      }

      const finalMessages =
        isRetry && messageId
          ? updatedMessages.filter((m) => m.id !== messageId + "_error").concat(errorMessage)
          : [...updatedMessages, errorMessage]

      setMessages(finalMessages)
      saveCurrentChat(finalMessages)
    } finally {
      setIsLoading(false)
    }
  }

  async function askQuestion(question: string) {
    const user_id = Number(localStorage.getItem("user_id")); // or get from context/state
    const res = await fetch("http://127.0.0.1:8000/ask_json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, user_id }),
    });
    if (!res.ok) {
      // Handle error (show toast, etc.)
      return { error: "Failed to get answer" };
    }
    const data = await res.json();
    return data;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input)
    if (!input.trim()) return;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedExts = ["pdf", "txt", "csv", "tsv", "xlsx", "docx", "pptx"]
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!allowedExts.includes(ext)) {
      setUploadStatus({
        uploading: false,
        error: "Please upload PDF, TXT, CSV, TSV, XLSX, DOCX, or PPTX.",
      })
      return
    }

    setUploadStatus({
      uploading: true,
      fileName: file.name,
    })

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("user_id", String(Number(localStorage.getItem("user_id")) || 0))

      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const data = await response.json()

      setUploadStatus({
        uploading: false,
        fileName: file.name,
        success: true,
      })

      // refresh user's document list
      fetchUserDocs()

      const uploadMessage: Message = {
        id: Date.now().toString(),
        content: `✅ Successfully uploaded and processed "${file.name}". You can now ask questions about this document!`,
        role: "assistant",
        timestamp: new Date(),
      }
      const updatedMessages = [...messages, uploadMessage]
      setMessages(updatedMessages)
      saveCurrentChat(updatedMessages)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus({
        uploading: false,
        fileName: file.name,
        error: "Failed to upload document. Please ensure the backend is running and try again.",
      })
    }

    setTimeout(() => {
      setUploadStatus({ uploading: false })
    }, 3000)
  }

  const retryMessage = (messageId: string) => {
    const userMessage = messages.find((m) => m.id === messageId)
    if (userMessage) {
      sendMessage(userMessage.content, true, messageId)
    }
  }

  const startNewChat = () => {
    setCurrentChatId(null)
    setMessages([])
    setSidebarOpen(false)
    localStorage.removeItem(CURRENT_KEY)
  }

  const loadChat = (chatId: string) => {
    const chat = chatHistories.find((h) => h.id === chatId)
    if (chat) {
      setCurrentChatId(chatId)
      setMessages(chat.messages)
      setSidebarOpen(false)
    }
  }

  const deleteChat = (chatId: string) => {
    setChatHistories((prev) => prev.filter((h) => h.id !== chatId))
    if (currentChatId === chatId) {
      startNewChat()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-full bg-white dark:bg-gray-950">
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-900 border-r border-purple-200/50 dark:border-purple-800/50 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-purple-200/50 dark:border-purple-800/50">
            <h2 className="font-semibold text-lg text-purple-600 dark:text-purple-400">
              Chat History
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden hover:bg-purple-100 dark:hover:bg-purple-900/50"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4">
            <Button onClick={startNewChat} className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all duration-200">
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-2">
              {chatHistories.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-purple-100/50 dark:hover:bg-purple-900/30",
                    currentChatId === chat.id
                      ? "bg-purple-100 dark:bg-purple-900/50 shadow-sm"
                      : "",
                  )}
                  onClick={() => loadChat(chat.id)}
                >
                  <MessageSquare className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(chat.updatedAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteChat(chat.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {chatHistories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50 text-purple-400" />
                  <p className="text-sm">No chat history yet</p>
                </div>
              )}
            </div>
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400 mb-2">My Documents</h3>
              {userDocs && userDocs.length > 0 ? (
                <div className="space-y-2">
                  {userDocs.map((d, idx) => (
                    <div key={`${d.file}-${idx}`} className="flex items-center justify-between rounded-md border border-purple-200/50 dark:border-purple-800/50 px-2 py-2 text-xs">
                      <div className="truncate mr-2" title={d.file}>{d.file}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground whitespace-nowrap">{d.chunks} chunks</div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-red-100 dark:hover:bg-red-900/30"
                          onClick={async () => {
                            const uid = Number(localStorage.getItem("user_id")) || 0
                            if (!uid) return
                            const ok = confirm(`Delete ${d.file}? This cannot be undone.`)
                            if (!ok) return
                            try {
                              const res = await fetch(`http://127.0.0.1:8000/user/${uid}/docs?filename=${encodeURIComponent(d.file)}`, {
                                method: "DELETE",
                              })
                              if (res.ok) {
                                // optimistic remove
                                setUserDocs(prev => (prev ? prev.filter(x => x.file !== d.file) : prev))
                              }
                            } catch {}
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No documents yet</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-col h-full flex-1 max-w-4xl mx-auto">
        <div className="flex items-center justify-between p-4 border-b border-purple-200/50 dark:border-purple-800/50 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden hover:bg-purple-100 dark:hover:bg-purple-900/50"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-purple-600 dark:text-purple-400">
                RAG Assistant
              </h1>
              <p className="text-sm text-muted-foreground">Developed By RRRS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-purple-600 text-white">{(displayName || "U").slice(0,1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Profile settings</DialogTitle>
                  <DialogDescription>Update your display name for this device.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <label className="text-sm">Display name</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setProfileOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      localStorage.setItem("username", displayName || "User")
                      setProfileOpen(false)
                    }}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              className="rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50"
            >
              {isDark ? <Sun className="w-5 h-5 text-purple-600" /> : <Moon className="w-5 h-5 text-purple-600" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.removeItem("user_id")
                router.replace("/login")
              }}
              className="border-purple-200/50 dark:border-purple-800/50"
            >
              Logout
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center animate-in fade-in-0 duration-500">
                <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/25">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-semibold mb-3 text-balance text-purple-600 dark:text-purple-400">
                  How can I help you today?
                </h2>
                <p className="text-muted-foreground text-balance max-w-md">
                  Start a conversation by typing a message or uploading a document.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.role === "assistant" && (
                  <Avatar className="w-8 h-8 border-2 border-purple-200 dark:border-purple-800 shadow-sm">
                    <AvatarFallback className="bg-purple-600 text-white">
                      <Sparkles className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className={cn("max-w-[80%] space-y-1", message.role === "user" ? "items-end" : "items-start")}>
                <Card
                  className={cn(
                   "p-3 shadow-lg transition-none hover:shadow-lg",

                      message.role === "user"
                        ? "bg-purple-600 text-white border-purple-300 shadow-purple-500/25"
                        : message.error
                          ? "bg-destructive/10 border-destructive/20 text-destructive-foreground"
                          : "bg-white/80 dark:bg-gray-800/80 border-purple-200/50 dark:border-purple-800/50 backdrop-blur-sm",
                    )}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    {message.error && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-destructive/20">
                        <AlertCircle className="w-4 h-4" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryMessage(message.id)}
                          className="h-auto p-1 text-xs hover:bg-destructive/20"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    )}
                  </Card>
                  <div
                    className={cn(
                      "flex items-center gap-2 text-xs text-muted-foreground px-1",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <span>{formatTime(message.timestamp)}</span>
                  </div>
                </div>

                {message.role === "user" && (
                  <Avatar className="w-8 h-8 border-2 border-blue-200 dark:border-blue-800 shadow-sm">
                    <AvatarFallback className="bg-purple-600 text-white">
                      <UserRound className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 transition-opacity duration-200 opacity-100">
                <Avatar className="w-8 h-8 border-2 border-purple-200 dark:border-purple-800 shadow-sm">
                  <AvatarFallback className="bg-purple-600 text-white">
                    <Sparkles className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <Card className="p-3 bg-white/80 dark:bg-gray-800/80 border-purple-200/50 dark:border-purple-800/50 backdrop-blur-sm shadow-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {(uploadStatus.uploading || uploadStatus.success || uploadStatus.error) && (
          <div className="px-4 py-2">
            <Card
              className={cn(
                "p-3 transition-all duration-200 backdrop-blur-sm",
                uploadStatus.success
                  ? "bg-green-50 dark:bg-emerald-950 border-green-200 dark:border-green-800 shadow-lg"
                  : uploadStatus.error
                    ? "bg-destructive/10 border-destructive/20"
                    : "bg-white/80 dark:bg-gray-800/80 border-purple-200/50 dark:border-purple-800/50 shadow-lg",
              )}
            >
              <div className="flex items-center gap-2 text-sm">
                {uploadStatus.uploading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                {uploadStatus.success && (
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs shadow-sm">✓</div>
                )}
                {uploadStatus.error && <AlertCircle className="w-4 h-4 text-destructive" />}
                <span
                  className={cn(
                    uploadStatus.success
                      ? "text-green-700 dark:text-green-300"
                      : uploadStatus.error
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {uploadStatus.uploading && `Uploading ${uploadStatus.fileName}...`}
                  {uploadStatus.success && `Successfully uploaded ${uploadStatus.fileName}`}
                  {uploadStatus.error && uploadStatus.error}
                </span>
              </div>
            </Card>
          </div>
        )}

        <div className="p-4 border-t border-purple-200/50 dark:border-purple-800/50 bg-white dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                className="pr-12 bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50 focus:border-purple-400 dark:focus:border-purple-600 transition-colors backdrop-blur-sm shadow-sm"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.csv,.tsv,.xlsx,.docx,.pptx"
                onChange={handleFileUpload}
                className="hidden"
                title="Upload a document"
                placeholder="Choose a file to upload"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus.uploading}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-purple-100 dark:hover:bg-purple-900/50"
              >
                {uploadStatus.uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                ) : (
                  <UploadCloud className="w-4 h-4 text-purple-500" />
                )}
              </Button>
            </div>
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">Upload PDF, TXT, CSV, TSV, XLSX, DOCX or PPTX files to chat about your documents</p>
        </div>
      </div>
    </div>
  )
}
