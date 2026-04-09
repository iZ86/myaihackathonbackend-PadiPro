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
        const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

        if (mode === 'subscribe' && token === verifyToken) {
            console.log('WEBHOOK VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.status(403).end();
        }
        });
    } 
}

export default new WhatsappRoute().router;