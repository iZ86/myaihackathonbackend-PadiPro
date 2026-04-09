
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { UserData } from "./user-model";
import userRepository from "./user-repository";

interface IUserService {
  getUsers(): Promise<Result<UserData[]>>;
  getUserByMobileNo(mobile_no: string): Promise<Result<UserData>>;
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
}

export default new UserService();
