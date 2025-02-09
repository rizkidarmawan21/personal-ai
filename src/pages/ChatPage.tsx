import { Loader2, Menu } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ChatMessage } from "~/components/ChatMessage";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import ollama from "ollama";
import { ThoughtMessage } from "~/components/ThoughtMessage";
import { db } from "~/lib/dexie";
import { useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { set } from "react-hook-form";

const ChatPage = () => {
  const [messageInput, setMessageInput] = useState("");
  const [streamMessage, setStreamMessage] = useState("");
  const [streamThought, setStreamThought] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollToBottomRef = useRef<HTMLDivElement>(null);

  const params = useParams();

  const messages = useLiveQuery(
    () => db.getMessagesByThread(params.threadId as string),
    [params.threadId]
  );

  const handleSubmit = async () => {
    setIsLoading(true);
    await db.createMessage({
      role: "user",
      content: messageInput.trim(),
      thought: "",
      thread_id: params.threadId as string,
    });

    const stream = await ollama.chat({
      model: "deepseek-r1:1.5b",
      messages: [
        {
          role: "user",
          content: messageInput.trim(),
        },
      ],
      stream: true,
    });

    setMessageInput("");

    let fullContent = "";
    let fullThought = "";

    let outputMode: "think" | "response" = "think";
    for await (const part of stream) {
      const messageContent = part.message.content;
      if (outputMode === "think") {
        if (
          !(
            messageContent.includes("<think>") ||
            messageContent.includes("</think>")
          )
        ) {
          fullThought += messageContent;
        }

        setStreamThought(fullThought);

        if (messageContent.includes("</think>")) {
          outputMode = "response";
        }
      } else {
        fullContent += messageContent;
        setStreamMessage(fullContent);
      }
    }

    await db.createMessage({
      role: "assistant",
      content: fullContent,
      thought: fullThought,
      thread_id: params.threadId as string,
    });

    setStreamMessage("");
    setStreamThought("");
    setIsLoading(false);
  };

  const handleScrollToBottom = () => {
    scrollToBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useLayoutEffect(() => {
    handleScrollToBottom();
  }, [streamMessage, streamThought, messages]);

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center px-4 h-16 border-b">
        <h1 className="text-xl font-bold ml-4">AI Chat Dashboard</h1>
      </header>
      <main className="flex-1 overflow-auto p-4 w-full">
        <div className="mx-auto space-y-4 pb-20 max-w-screen-md">
          {messages?.map((message, index) => (
            <ChatMessage
              key={index}
              role={message.role}
              content={message.content}
              thought={message.thought}
            />
          ))}

          {!!streamThought && <ThoughtMessage thought={streamThought} />}

          {!!streamMessage && (
            <ChatMessage role="assistant" content={streamMessage} />
          )}

          <div ref={scrollToBottomRef} />
        </div>
      </main>
      <footer className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            className="flex-1"
            placeholder="Type your message here..."
            rows={5}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
          />
          <Button onClick={handleSubmit} type="button" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Send"}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;
