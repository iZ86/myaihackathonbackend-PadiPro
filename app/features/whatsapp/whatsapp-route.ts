import express from 'express';
import { Router } from "express";
import { asyncHandler } from "../../utils/utils";
import { WhatsappController } from './whatsapp-controller';
import { checkAuthTokenHeader } from "../../middlewares/auth";

class WhatsappRoute {
    router = Router();
    controller = new WhatsappController();

    constructor() {
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/', (req, res) => {
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            console.log(`\n\nWebhook received ${timestamp}\n`);

            const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

            if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
                return res.status(200).send(challenge);
            }
            return res.status(403).end();
        });

        this.router.post('/', this.controller.handleWebhook.bind(this.controller));
    } 
}

export default new WhatsappRoute().router;