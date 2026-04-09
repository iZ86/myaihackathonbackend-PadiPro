import express from 'express';
import { Router } from "express";
import WhatsappController from './whatsapp-controller';


class WhatsappRoute {
    router = Router();
    // controller = new WhatsappController();

    constructor() {
        this.initializeRoutes();
    }

    initializeRoutes() {
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

        this.router.get('/', (req, res) => {
            console.log("META HIT RECEIVED:", req.query);

            const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

            if (mode === 'subscribe' && token === verifyToken) {
                console.log('WEBHOOK VERIFIED');
                return res.status(200).send(challenge);
            }

            return res.status(403).end();
        });

        this.router.post('/', (req, res) => {
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            console.log(`\n\nWebhook received ${timestamp}\n`);
            console.log(JSON.stringify(req.body, null, 2));
            res.status(200).end();
        })
    } 
}

export default new WhatsappRoute().router;