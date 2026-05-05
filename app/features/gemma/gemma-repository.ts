
import { db } from "../../database/db-connection";
import { ChatHistory } from "./gemma-model";

interface IGemmaRepository {
  getChatHistory(mobile_no: string): Promise<ChatHistory[] | undefined>;
  // saveGemma(mobile_no: string, data: GemmaData) : Promise<string|undefined>;
  // updateGemma(mobile_no: string, data: Partial<GemmaData>): Promise<string | undefined>;
}

class GemmaRepository implements IGemmaRepository {

  public async getChatHistory(mobile_no: string): Promise<ChatHistory[] | undefined> {
    try {
      const snapshot = await db.collection('chat_history')
        .where('from', '==', mobile_no)
        .get();

      if (snapshot.empty) return [];

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as ChatHistory[];
    } catch (error) {
      console.error('Firestore Get Error:', error);
      throw error;
    }
  }

  public async saveChatHistory(mobile_no: string, data: ChatHistory): Promise<string | undefined> {
    try {
      const docRef = db.collection('chat_history').doc(mobile_no);
      await docRef.create({
        ...data,
      });

      return mobile_no;
    } catch (error: any) {
      if (error.code === 6) { 
        console.error('Record already exists.');
        return undefined;
      }
    }
  }

  /*
  public async updateGemma(mobile_no: string, data: Partial<GemmaData>): Promise<string | undefined> {
    try {
      const docRef = db.collection('gemma').doc(mobile_no);

      await docRef.update({
        ...data,
        updated_at: new Date().toISOString()
      });

      return mobile_no;
    } catch (error: any) {
      if (error.code === 5) { // Not found
        console.error('Gemma record for this user does not exist.');
        return undefined;
      }

      console.error("Error updating gemma:", error);
      return undefined;
    }
  }
  */
}

export default new GemmaRepository();
