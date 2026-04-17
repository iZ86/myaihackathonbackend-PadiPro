import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";


export const historyParamValidator: any = [
  param('mobile_no')
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  validate,
];