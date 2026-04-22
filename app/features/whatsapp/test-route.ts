import express from 'express';
import WhatsappRepository  from './whatsapp-repository';

const router = express.Router();

router.post('/otp/generate', async (req, res) => {
  const { mobile_no } = req.body;
  if (!mobile_no) return res.status(400).json({ message: 'mobile_no is required' });

  const otp = await WhatsappRepository.generateAndStoreOTP(mobile_no);
  return res.status(200).json({ message: 'OTP generated', otp });
});

router.post('/otp/verify', async (req, res) => {
  const { mobile_no, otp } = req.body;
  if (!mobile_no || !otp) return res.status(400).json({ message: 'mobile_no and otp are required' });

  const valid = await WhatsappRepository.verifyOTP(mobile_no, otp);
  return valid
    ? res.status(200).json({ message: 'OTP verified' })
    : res.status(400).json({ message: 'Invalid or expired OTP' });
});

export default router;