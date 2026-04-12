import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";


export const weatherParamValidator: any = [
  param('mobile_no')
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  validate,
];

export const saveWeatherBodyValidator: any = [
  body('mobile_no')
    .trim()
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  validate,
];
