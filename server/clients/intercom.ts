import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const intercom = axios.create({
  baseURL: 'https://api.intercom.io',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.INTERCOM_API_KEY}`,
  },
});
