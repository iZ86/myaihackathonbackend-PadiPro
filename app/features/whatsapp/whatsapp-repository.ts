import { db } from '../../database/db-connection';
import { Timestamp } from 'firebase-admin/firestore';
import { OTPData } from './whatsapp-model';

interface IWhatsappRepository {
  
}

class WhatsappRepository implements IWhatsappRepository {

  private readonly collection: string = 'OTP';


  public async saveOTP(mobile_no: string, otp: string, expiresAt: Date): Promise<boolean> {
    const docRef = db.collection(this.collection).doc(mobile_no);

    await docRef.set({
      otp,
      expires_at: expiresAt.toISOString()
    })

    return true;
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

  public async getOTPByMobileNo(mobile_no: string): Promise<OTPData | undefined> {
    const snapshot = await db.collection(this.collection)
    .where('mobile_no', '==', mobile_no).
    limit(1)
    .get();

    if (snapshot.empty) return undefined;

    const doc = snapshot.docs[0];
    if (!doc) return undefined;

    const otpData: OTPData = doc.data() as OTPData;

    return otpData;
  }

  public async deleteOTPByOTPAndMobileNo(otp: string, mobile_no: string): Promise<boolean> {
    const snapshot = await db.collection(this.collection)
    .where('otp', '==', otp)
    .where('mobile_no', '==', mobile_no)
    .limit(1)
    .get();

    if (snapshot.empty) return false;

    const doc = snapshot.docs[0];
    if (!doc) return false;

    await doc.ref.delete();

    return true;
  }
  
}

export default new WhatsappRepository();