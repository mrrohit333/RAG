"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChatInterface } from "@/components/chat-interface"

export default function ChatPage() {
  const router = useRouter()

  useEffect(() => {
    const userId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null
    if (!userId) {
      router.replace("/login")
    }
  }, [router])

  return (
    <main className="h-screen bg-white dark:bg-gray-950">
      <ChatInterface />
    </main>
  )
}


