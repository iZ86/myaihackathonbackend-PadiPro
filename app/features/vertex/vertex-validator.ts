import { body, param, query } from "express-validator";
import validate from "../../middlewares/validate";



export const sendQueryVertexBodyValidator: any = [
  body('text')
    .trim()
    .notEmpty().withMessage("Missing text.")
    .isString().withMessage("text must be a string."),
  body('session')
    .trim()
    .notEmpty().withMessage("Missing session.")
    .isString().withMessage("session must be a string."),
  validate,
];
