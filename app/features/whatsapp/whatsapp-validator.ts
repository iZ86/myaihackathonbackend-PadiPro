import { body } from "express-validator";
import validate from "../../middlewares/validate";

export const generateOTPBodyValidator: any = [
  body('mobile_no')
    .trim()
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  validate,
];

export const verifyOTPBodyValidator: any = [
  body('mobile_no')
    .trim()
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  body('otp')
    .trim()
    .notEmpty().withMessage("Missing otp.")
    .isString().withMessage("otp must be a string.")
    .isLength({ min: 6, max: 6 }).withMessage("otp must be 6 characters."),
  validate,
];
