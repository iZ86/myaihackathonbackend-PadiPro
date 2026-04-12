import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";


export const userParamValidator: any = [
  param('mobile_no')
    .notEmpty().withMessage("Missing mobile_no.")
    .isInt().withMessage("mobile_no must be a set"),
  validate,
];
