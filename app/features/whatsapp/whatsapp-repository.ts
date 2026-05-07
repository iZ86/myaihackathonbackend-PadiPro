import { db } from '../../database/db-connection';
import { Timestamp } from 'firebase-admin/firestore';

interface IWhatsappRepository {
  
}

class WhatsappRepository implements IWhatsappRepository {

  private readonly collection: string = 'OTP';
  public async generateAndStoreOTP(mobile_no: string): Promise<string> {
    const docRef = db.collection('OTP').doc(mobile_no);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));

    await docRef.set({
      otp,
      expires_at: expiresAt
    })

    return otp;
  }

  public async verifyOTP(mobileNo: string, inputOtp: string): Promise<boolean> {
    const doc = await db.collection('OTP').doc(mobileNo).get();
    if (!doc.exists) return false;

    const { otp, expires_at } = doc.data()!;

    if (expires_at.toDate() < new Date()) return false;
    if (String(otp) !== String(inputOtp)) return false;

    await db.collection('OTP').doc(mobileNo).delete();
    return true;
  }
}

export default new WhatsappRepository();