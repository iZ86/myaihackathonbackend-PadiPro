
import { db } from "../../database/db-connection";
import { WeatherData } from "./weather-model";

interface IWeatherRepostory {
  getWeatherByMobileNo(mobile_no: string): Promise<WeatherData | undefined>;
  saveWeather(mobile_no: string, data: WeatherData) : Promise<string|undefined>; 
}

class WeatherRepository implements IWeatherRepostory {
  public async getWeatherByMobileNo(mobile_no: string): Promise<WeatherData | undefined> {
    try {
      const snapshot = await db.collection('weather')
        .where('mobile_no', '==', mobile_no)
        .limit(1)
        .get();

      if (snapshot.empty) return undefined;

      const doc = snapshot.docs[0];
      if (!doc) {return undefined;}
      const data = doc.data();

      return {
        id: doc.id,
        mobile_no: data.mobile_no, 
        updated_at: data.updated_at, 
        ...data
      } as WeatherData;

    } catch (error) {
      console.error("Firestore Get Error:", error);
      throw error;
    }
  }

  public async fetchWeatherApi(apiKey: string, lat: number, lng: number) {
    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${lat}&location.longitude=${lng}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Google API Error:', errorData);
        throw new Error(`Weather API responded with status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Fetch Error:', error);
      throw error;
    }
  }

  public async saveWeather(mobile_no: string, data: WeatherData): Promise<string | undefined> {
    try {
      const docRef = db.collection('weather').doc(mobile_no);
      
      await docRef.create({
        ...data,
        updated_at: data.updated_at || new Date().toISOString()
      });

      return mobile_no;
    } catch (error: any) {
      if (error.code === 6) { // Already exists
        console.error('Weather record for this user already exists.');
        return undefined;
      }
    }
  }

  public async updateWeather(mobile_no: string, data: Partial<WeatherData>): Promise<string | undefined> {
    try {
      const docRef = db.collection('weather').doc(mobile_no);

      await docRef.update({
        ...data,
        updated_at: new Date().toISOString()
      });

      return mobile_no;
    } catch (error: any) {
      if (error.code === 5) { // Not found
        console.error('Weather record for this user does not exist.');
        return undefined;
      }

      console.error("Error updating weather:", error);
      return undefined;
    }
  }
}

export default new WeatherRepository();
