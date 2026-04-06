import { ENUM_STATUS_CODES_SUCCESS, ENUM_STATUS_CODES_FAILURE } from "./status-codes-enum";

/** This class follows the result pattern used in web development.
 * It's always used to return data from the service layer to the controller layer.
 */
export class Result<T> {

  protected constructor(
    readonly success: boolean,
    readonly data: T,
    readonly statusCode: ENUM_STATUS_CODES_SUCCESS | ENUM_STATUS_CODES_FAILURE,
    readonly message: string
  ) { }

  static succeed<T>(statusCode: ENUM_STATUS_CODES_SUCCESS, data: T, message: string): Success<T> {
    return new Result(true, data, statusCode, message) as Success<T>;
  }

  // ---- FAIL OVERLOADS ----
  static fail(statusCode: ENUM_STATUS_CODES_FAILURE, message: string): Failure;
  static fail<T>(statusCode: ENUM_STATUS_CODES_FAILURE, message: string, data: T): FailureWithData<T>;

  static fail<T>(statusCode: ENUM_STATUS_CODES_FAILURE, message: string, data?: T): Failure | FailureWithData<T> {
    if (data) {
      return new Result(false, data, statusCode, message);
    }
    return new Result(false, null, statusCode, message) as Failure;
  }

  isSuccess(): boolean {
    return this.success;
  }

  getData(): T {
    return this.data;
  }

  getStatusCode(): ENUM_STATUS_CODES_SUCCESS | ENUM_STATUS_CODES_FAILURE {
    return this.statusCode;
  }

  getMessage(): string {
    return this.message;
  }

}

export type Success<T> = Result<T>;
export type Failure = Result<never>;
export type FailureWithData<T> = Result<T>;
