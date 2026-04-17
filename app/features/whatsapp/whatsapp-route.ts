import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import { WhatsappController } from './whatsapp-controller';
import { checkAuthTokenHeader } from "../../middlewares/auth";
import { historyParamValidator } from "./whatsapp-validator";

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
       
        // Get history of images
        this.router.get("/:mobile_no", checkAuthTokenHeader, historyParamValidator, asyncHandler(this.controller.getImagesByMobileNo));
    } 
}

export default new WhatsappRoute().router;