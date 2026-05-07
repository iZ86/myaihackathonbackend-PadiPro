import { db } from "../../database/db-connection";
import { ChatHistory } from "./chat-model";

interface IChatRepository {
    getChatHistory(mobile_no: string, type: string): Promise<ChatHistory[] | undefined>;
    saveChatHistory(mobile_no: string, type: string, data: ChatHistory): Promise<string | undefined>;
    // updateChat(mobile_no: string, data: Partial<ChatData>): Promise<string | undefined>;
}

class ChatRepository implements IChatRepository {
    public async getChatHistory(mobile_no: string, type: string): Promise<ChatHistory[] | undefined> {
        try {
            const snapshot = await db
                .collection("chat_history")
                .doc(type)
                .collection(mobile_no)
                .orderBy("timestamp", "asc")
                .get();
            if (snapshot.empty) return [];

            return snapshot.docs.map((doc) => {
                const data = doc.data();
                return data as ChatHistory;
            });
        } catch (error) {
            console.error("Firestore Get Error:", error);
            throw error;
        }
    }

    public async saveChatHistory(mobile_no: string, type: string, data: ChatHistory): Promise<string | undefined> {
        try {
            const docRef = db.collection("chat_history").doc(type).collection(mobile_no).doc();
            await docRef.create({
                ...data,
                timestamp: new Date(),
            });

            return mobile_no;
        } catch (error: any) {
            if (error.code === 6) {
                console.error("Record already exists.");
                return undefined;
            }
        }
    }

    /*
  public async updateChat(mobile_no: string, data: Partial<ChatData>): Promise<string | undefined> {
    try {
      const docRef = db.collection('chat').doc(mobile_no);

      await docRef.update({
        ...data,
        updated_at: new Date().toISOString()
      });

      return mobile_no;
    } catch (error: any) {
      if (error.code === 5) { // Not found
        console.error('Chat record for this user does not exist.');
        return undefined;
      }

      console.error("Error updating chat:", error);
      return undefined;
    }
  }
  */
}

export default new ChatRepository();
