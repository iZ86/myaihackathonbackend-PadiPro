import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";

/** Used for 400 validation checks. */
/** May be used in other domains. */
export const weatherParamValidator: any = [
  body('mobile_no')
    .exists().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be set"),
  validate,
];