
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { UserData } from "./user-model";
import userRepository from "./user-repository";

interface IUserService {
  getUsers(): Promise<Result<UserData[]>>;
  getUserByMobileNo(mobile_no: string): Promise<Result<UserData>>;
}

/** This is where the business logic of the software occurs.
 * Service methods may call other service methods from itself or other domain service methods.
 * External API calls are also done here.
 */
class UserService implements IUserService {
  public async getUsers(): Promise<Result<UserData[]>> {
    const users: UserData[] = await userRepository.getUsers();

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, users, "Users successfully retrieved.");
  }

  public async getUserByMobileNo(mobile_no: string): Promise<Result<UserData>> {
    const user: UserData | undefined = await userRepository.getUserByMobileNo(mobile_no);

    if (!user) {
      return Result.fail(ENUM_STATUS_CODES_FAILURE.NOT_FOUND, "User not found.", { mobile_no: "" } as UserData);
    }

    return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, user, `User with mobile_no ${mobile_no} found.`);
  }
}

export default new UserService();
