import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import { WhatsappController } from './whatsapp-controller';
import debugRoute from './media-route';

class WhatsappRoute {
    router = Router();
    controller = new WhatsappController();

    constructor() {
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', (req, res) => {
            const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
            if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
                return res.status(200).send(challenge);
            }
            return res.status(403).end();
        });

        this.router.post('/', asyncHandler(this.controller.handleWebhook.bind(this.controller)));

        // TEMPORARY — remove before prod
        this.router.use('/debug', debugRoute);
    }
}

export default new WhatsappRoute().router;