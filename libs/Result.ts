import { ENUM_STATUS_CODES_SUCCESS, ENUM_STATUS_CODES_FAILURE } from "./status-codes-enum";

/** This class follows the result pattern used in web development.
 * It's always used to return data from the service layer to the controller layer.
 */
export abstract class Result<T> {

  protected constructor(
    readonly _tag: "Success" | "Failure",
    protected readonly value: T,
    protected readonly message: string
  ) { }

  static succeed<T>(statusCode: ENUM_STATUS_CODES_SUCCESS, data: T, message: string): Success<T> {
    return new Success(statusCode, data, message);
  }

  static fail(statusCode: ENUM_STATUS_CODES_FAILURE, message: string): Failure {
    return new Failure(statusCode, message);
  }

  abstract isSuccess(): this is Success<T>;
  abstract isFailure(): this is Failure;

  getData(): T {
    if (this.isSuccess()) return this.value;
    throw new Error("Cannot get data from a Failure");
  }

  getMessage(): string {
    return this.message;
  }
}

export class Success<T> extends Result<T> {

  protected readonly statusCode: ENUM_STATUS_CODES_SUCCESS;

  constructor(statusCode: ENUM_STATUS_CODES_SUCCESS, data: T, message: string) {
    super("Success", data, message);

    this.statusCode = statusCode;
  }

  isSuccess(): this is Success<T> {
    return true;
  }

  isFailure(): this is Failure {
    return false;
  }

  getStatusCode(): ENUM_STATUS_CODES_SUCCESS {
    return this.statusCode;
  }
}

export class Failure extends Result<never> {

  protected readonly statusCode: ENUM_STATUS_CODES_FAILURE;


  constructor(statusCode: ENUM_STATUS_CODES_FAILURE, message: string) {
    super("Failure", null as never, message);
    this.statusCode = statusCode;
  }

  isSuccess(): this is Success<never> {
    return false;
  }

  isFailure(): this is Failure {
    return true;
  }

  getStatusCode(): ENUM_STATUS_CODES_FAILURE {
    return this.statusCode;
  }
}


