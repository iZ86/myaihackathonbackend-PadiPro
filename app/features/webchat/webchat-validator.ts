import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";

export const generateUploadUrlrBodyValidator: any = [
  body('fileName')
    .trim()
    .notEmpty().withMessage("Missing fileName.")
    .isString().withMessage("fileName must be a string."),
  body('contentType')
    .trim()
    .notEmpty().withMessage("Missing contentType.")
    .isString().withMessage("contentType must be a string."),
  validate,
];

export const updateUserCoordsByMobileNoBodyValidator: any = [
  body('lat')
    .trim()
    .notEmpty().withMessage("Missing lat.")
    .isNumeric().withMessage("lat must be a numeric."),
  body('long')
    .trim()
    .notEmpty().withMessage("Missing long.")
    .isNumeric().withMessage("long must be a numeric."),
  validate,
];
