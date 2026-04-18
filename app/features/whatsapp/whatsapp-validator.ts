import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";


export const sendMessageBodyValidator: any = [
  body('mobile_no')
    .trim()
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  body('name')
    .trim()
    .notEmpty().withMessage("Missing name.")
    .isString().withMessage("name must be a string."),
  body('message')
    .trim()
    .notEmpty().withMessage("Missing message.")
    .isString().withMessage("message must be a string."),
  validate,
];
