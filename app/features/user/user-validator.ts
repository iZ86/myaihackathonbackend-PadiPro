import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";

/** Used for 400 validation checks. */
/** May be used in other domains. */
export const userParamValidator: any = [
  param('mobile_no')
    .exists().withMessage("Missing mobile_no.")
    .isInt().withMessage("mobile_no must be a set"),
  validate,
];

// Examples of other req fields.
// Keep in mind of the toInt() method, it should only be used in body validation.
// Express will auto convert the query and param of the request to string so need to manually convert them back.
// But the body is any type, so the conversion here will persist.

// export const getUsersQueryValidator: any = [
//   query('page')
//     .optional()
//     .isInt().withMessage('page must be an integer'),
//   query('pageSize')
//     .optional()
//     .isInt().withMessage('pageSize must be an integer'),
//   query('query')
//     .optional()
//     .isString().withMessage('query must be a string'),
//   validate,
// ];

// export const createUserBodyValidator: any = [
//   body('username')
//     .trim()
//     .notEmpty().withMessage('Missing firstName')
//     .isString().withMessage('firstName must be a string'),
//   body('email')
//     .trim()
//     .notEmpty().withMessage('Missing email')
//     .isEmail().withMessage('Invalid email format'),
//   body('phoneNumber')
//     .trim()
//     .notEmpty().withMessage('Missing phoneNumber')
//     .matches(/^01\d{8,9}$/).withMessage("phoneNumber must start with 01 and contain 10-11 digits"),
//   body('password')
//     .trim()
//     .notEmpty().withMessage('Missing password')
//     .isString().withMessage('password must be a string'),
//   body('userStatusId')
//     .trim()
//     .notEmpty().withMessage('Missing userStatusId')
//     .toInt(),
//   validate,
// ];

// export const updateUserBodyValidator: any = [
//   ...createUserBodyValidator
// ];