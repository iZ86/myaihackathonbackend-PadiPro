import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";

export const weatherParamValidator: any = [
  body('mobile_no')
    .exists().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be set"),
  validate,
];