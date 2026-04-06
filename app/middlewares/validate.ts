import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator/lib/validation-result';
import { ENUM_STATUS_CODES_FAILURE } from '../../libs/status-codes-enum';

// Used for express-validator
export default function (req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.sendResponse(ENUM_STATUS_CODES_FAILURE.BAD_REQUEST, errors.array()[0]!.msg); // ! because errors.array()[0] The error will always be at index 0.
    }

    return next();
}