
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { UserData } from "./user-model";
import userRepository from "./user-repository";

interface IUserService {
  getUsers(): Promise<Result<UserData[]>>;
  getUserByMobileNo(mobile_no: string): Promise<Result<UserData>>;
  createUser(mobile_no: string, name: string): Promise<Result<UserData>>;
}

class UserService implements IUserService {
  public async getUsers(): Promise<Result<UserData[]>> {
    const users: UserData[] = await userRepository.getUsers();

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, users, "Users successfully retrieved.");
  }

  public async getUserByMobileNo(mobile_no: string): Promise<Result<UserData>> {
    const user: UserData | undefined = await userRepository.getUserByMobileNo(mobile_no);

    if (!user) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "User not found.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, user, `User with mobile_no ${mobile_no} found.`);
  }

  public async createUser(mobile_no: string, name: string): Promise<Result<UserData>> {
    const userResult: Result<UserData> = await this.getUserByMobileNo(mobile_no);
    if (userResult.isSuccess()) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.CONFLICT, "User already exist with mobile_no.");
    }

    const createUserResult: boolean = await userRepository.createUser(mobile_no, name);
    if (!createUserResult) {
      throw new Error("createUser failed to create user.")
    }

    const user: Result<UserData> = await this.getUserByMobileNo(mobile_no);

    if (user.isFailure()) {
      throw new Error("createUser failed to get created user.");
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.CREATED, user.getData(), "User successfully created.");
  }
}

export default new UserService();
