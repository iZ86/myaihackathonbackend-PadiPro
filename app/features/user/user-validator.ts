import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";


export const userParamValidator: any = [
  param('mobile_no')
    .notEmpty().withMessage("Missing mobile_no.")
    .isInt().withMessage("mobile_no must be a set"),
  validate,
];

export const createUserBodyValidator: any = [
  body('mobile_no')
    .trim()
    .notEmpty().withMessage("Missing mobile_no.")
    .isString().withMessage("mobile_no must be a string."),
  body('name')
    .trim()
    .notEmpty().withMessage("Missing name.")
    .isString().withMessage("name must be a string."),
  validate,
];

export const updateUserCoordsByMobileNoBodyValidator: any = [
  body('lat')
    .trim()
    .notEmpty().withMessage("Missing lat.")
    .isInt().withMessage("lat must be a number.")
    .toInt(),
  body('long')
    .trim()
    .notEmpty().withMessage("Missing long.")
    .isInt().withMessage("long must be a number.")
    .toInt(),
  validate,
];
