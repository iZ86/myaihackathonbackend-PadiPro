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
            console.log("🔥 ROUTE HIT");
            res.status(200).send("OK");
        });
    } 
}

export default new WhatsappRoute().router;