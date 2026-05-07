import { body } from "express-validator";
import validate from "../../middlewares/validate";

export const generateOTPBodyValidator: any = [
  body('mobile_no')
    .trim()
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  validate,
];
