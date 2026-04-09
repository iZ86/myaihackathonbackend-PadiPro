import express from 'express';
import { Router } from "express";
import WhatsappController from './whatsapp-controller';


class WhatsappRoute {
    router = Router();
    controller = new WhatsappController();

    constructor() {
        this.initializeRoutes();
    }

    initializeRoutes() {
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

        this.router.get('/', (req, res) => {
            console.log("META HIT RECEIVED:", req.query);

            const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

            console.log("MODE:", mode);
            console.log("TOKEN:", token);
            console.log("EXPECTED:", process.env.WHATSAPP_VERIFY_TOKEN);

            if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
                console.log('WEBHOOK VERIFIED');
                return res.status(200).send(challenge);
            }

            return res.status(403).end();
        });
    } 
}

export default new WhatsappRoute().router;