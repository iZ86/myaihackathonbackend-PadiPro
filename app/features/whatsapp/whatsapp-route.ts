import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import { WhatsappController } from './whatsapp-controller';
import { sendImageBodyValidator, sendMessageBodyValidator } from "./whatsapp-validator";
import { checkAuthTokenHeader } from "../../middlewares/auth";
import { userParamValidator } from "../user/user-validator";
import WhatsappRepository from "./whatsapp-repository";

class WhatsappRoute {
    router = Router();
    controller = new WhatsappController();

    constructor() {
        this.initializeRoutes();
    }

    initializeRoutes() {
        //request for connection with Whatsapp Cloud API
        this.router.get('/', (req, res) => {
            const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

            if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
                return res.status(200).send(challenge);
            }
            return res.status(403).end();
        });

        //receive, parse, and response to msg
        this.router.post('/', asyncHandler(this.controller.handleWebhook.bind(this.controller)));

        this.router.post("/myMessage", sendMessageBodyValidator, asyncHandler(this.controller.sendMessage));
        this.router.post("/myImage", sendImageBodyValidator, asyncHandler(this.controller.sendImage));

        // Get history of images
        this.router.get("/history/:mobile_no", checkAuthTokenHeader, userParamValidator, asyncHandler(this.controller.getImagesByMobileNo));


        //OTP service 
        this.router.post('/otp/generate', this.controller.generateOTP.bind(this.controller));
        this.router.post('/otp/verify', this.controller.verifyOTP.bind(this.controller));
    }
}

export default new WhatsappRoute().router;
