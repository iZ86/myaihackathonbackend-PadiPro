import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import { WhatsappController } from './whatsapp-controller';
import { generateOTPBodyValidator, verifyOTPBodyValidator } from "./whatsapp-validator";
import { whatsappConfig } from "../../config/config";

class WhatsappRoute {
    router = Router();
    controller = new WhatsappController();

    constructor() {
        this.initializeRoutes();
    }

    initializeRoutes() {
        //request for connection with Whatsapp Cloud API
        this.router.get("/", (req, res) => {
            const { "hub.mode": mode, "hub.challenge": challenge, "hub.verify_token": token } = req.query;

            if (mode === "subscribe" && token === whatsappConfig.VERIFY_TOKEN) {
                return res.status(200).send(challenge);
            }
            return res.status(403).end();
        });

        //receive, parse, and response to msg
        this.router.post("/", asyncHandler(this.controller.handleWebhook.bind(this.controller)));


        //OTP service 
        this.router.post('/otp/generate', generateOTPBodyValidator, this.controller.generateOTP.bind(this.controller));
        this.router.post('/otp/verify', verifyOTPBodyValidator, this.controller.verifyOTP.bind(this.controller));
    }
}

export default new WhatsappRoute().router;
