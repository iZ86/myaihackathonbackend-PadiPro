
import { db } from "../../database/db-connection";
import { UserData } from "./user-model";
import { GeoPoint } from "firebase-admin/firestore";

interface IUserRepository {
  getUsers(): Promise<UserData[]>
  getUserByMobileNo(mobile_no: string): Promise<UserData | undefined>;
}

class UserRepository implements IUserRepository {
  public async getUsers(): Promise<UserData[]> {
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserData));
  }

  public async getUserByMobileNo(mobile_no: string): Promise<UserData | undefined> {
    const snapshot = await db.collection('users')
      .where("mobile_no", "==", mobile_no)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return undefined;
    }

    return {
      id: doc.id,
      ...doc.data()
    } as UserData;
  }

  public async createUser(mobile_no: string, name: string): Promise<boolean> {
    try {
      await db.collection("users").doc(mobile_no).set({
        mobile_no,
        name
      });

      return true;
    } catch (error) {
      console.error("Create user error:", error);
      return false;
    }
  }

  public async updateUserCoordsByMobileNo(coords: GeoPoint, mobile_no: string): Promise<boolean> {
    try {
      const docRef = db.collection('users').doc(mobile_no);

      await docRef.update({
        coords: coords
      });

      return true;
    } catch (error) {
      console.error("Create user error:", error);
      return false;
    }
  }
}

export default new UserRepository();
