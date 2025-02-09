import Dexie, { Table } from "dexie";
interface DEX_Thread {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

interface DEX_Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought: string;
  thread_id: string;
  created_at: Date;
}

class ChatDB extends Dexie {
  threads!: Table<DEX_Thread>;
  messages!: Table<DEX_Message>;

  constructor() {
    super("ChatDBAi");

    // 1 adalah versi database dari indexedDB
    this.version(1).stores({
      threads: "id, title, created_at, updated_at",
      messages: "id, role, content, thought, thread_id, created_at",
    });

    // buat hook untuk mengisi data ketika thread dibuat, atau data dibuat
    this.threads.hook("creating", (_key, obj) => {
      obj.created_at = new Date();
      obj.updated_at = new Date();
    });

    this.messages.hook("creating", (_key, obj) => {
      obj.created_at = new Date();
    });
  }

  async createThread(title: string) {
    const id = crypto.randomUUID();

    await this.threads.add({
      id,
      title,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return id;
  }

  async getAllThreads() {
    return this.threads.reverse().sortBy("created_at");
  }

  async createMessage(
    message: Pick<DEX_Message, "role" | "content" | "thought" | "thread_id">
  ) {
    const id = crypto.randomUUID();
    await this.transaction("rw", [this.threads, this.messages], async () => {
      await this.messages.add({
        ...message,
        id,
        created_at: new Date(),
      });

      // update thread updated_at
      await this.threads.update(message.thread_id, {
        updated_at: new Date(),
      });
    });

    return id;
  }

  async getMessagesByThread(threadId: string) {
    return this.messages
      .where("thread_id")
      .equals(threadId)
      .sortBy("created_at");
  }
}

export const db = new ChatDB();
