import { db } from '../../database/db-connection';
import { OTPData } from './whatsapp-model';

interface IWhatsappRepository {
  
}

class WhatsappRepository implements IWhatsappRepository {

  private readonly collection: string = 'otp';


  public async saveOTP(mobile_no: string, otp: string, expiresAt: Date): Promise<boolean> {
    const docRef = db.collection(this.collection).doc(mobile_no);

    await docRef.set({
      otp,
      expires_at: expiresAt.toISOString()
    })

    return true;
  }

  public async getOTPByMobileNo(mobile_no: string): Promise<OTPData | undefined> {
    const doc = await db.collection(this.collection).doc(mobile_no).get()

    if (!doc.exists) return undefined;

    const otpData: OTPData = doc.data() as OTPData;

    return otpData;
  }

  public async deleteOTPByOTPAndMobileNo(otp: string, mobile_no: string): Promise<boolean> {
    const doc = await db.collection(this.collection).doc(mobile_no).get();

    if (!doc.exists) return false;

    await doc.ref.delete();

    return true;
  }

}

export default new WhatsappRepository();
