
import { UserData } from "./user-model";

const USERSDATA: UserData[] = [
  {
    userId: 1,
    username: "iZ86"
  },
  {
    userId: 2,
    username: "SkyFoo"
  }
]


interface IUserRepostory {
  getUsers(): Promise<UserData[]>;
  getUserById(userId: number): Promise<UserData | undefined>;
}


/** Here you would connect to whatever database you want to use, and the methods here interact with the database. */
class UserRepository implements IUserRepostory {
  public async getUsers(): Promise<UserData[]> {

    return USERSDATA;
  }

  public async getUserById(userId: number): Promise<UserData | undefined> {
    for (const user of USERSDATA) {
      if (user.userId === userId) {
        return user;
      }
    }
    return undefined
  }
}

export default new UserRepository();
