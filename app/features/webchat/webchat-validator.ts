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

export const saveMediaMetaDataByMobileNoBodyValidator: any = [
  body('fileName')
    .trim()
    .notEmpty().withMessage("Missing fileName.")
    .isString().withMessage("fileName must be a string."),
  body('mimeType')
    .trim()
    .notEmpty().withMessage("Missing mimeType.")
    .isMimeType().withMessage("mimeType must be a mimetype."),
  body('storagePath')
    .trim()
    .notEmpty().withMessage("Missing storagePath.")
    .isString().withMessage("storagePath must be a string."),
  body('downloadUrl')
    .trim()
    .notEmpty().withMessage("Missing downloadUrl.")
    .isURL().withMessage("downloadUrl must be a url."),
  body('caption')
    .trim()
    .optional()
    .isString().withMessage("caption must be a string."),
  body('fileType')
    .trim()
    .notEmpty().withMessage("Missing fileType.")
    .isIn(['image', 'audio', 'video']).withMessage("fileType must be a image, audio or video."),
  validate,
];
