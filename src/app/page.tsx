"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatWindow } from "@/components/chat-window";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        activeId={conversationId}
        onSelect={setConversationId}
        userName={session?.user?.name ?? session?.user?.email}
        isAdmin={session?.user?.role === "ADMIN"}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />
      <ChatWindow
        conversationId={conversationId}
        onConversationCreated={setConversationId}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </div>
  );
}