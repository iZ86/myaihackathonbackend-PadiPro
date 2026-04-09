/** Datatypes to be used. 
 * Can be used by other domains.
*/
export interface UserData {
  id: string; 
  mobile_no: string;
  coords?: {
    _latitude: number;
    _longitude: number;
  }
}
