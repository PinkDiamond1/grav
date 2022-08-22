import axios from 'axios';
import web3, { transferToken } from './web3';
import Currencies from './currencies';
import config from '../config.json';

const instance = axios.create({
  baseURL: config.gravApiUrl,
  timeout: 1000,
});

export default {
  async getOrder(orderId) {
    const response = await instance.get(`/orders/${orderId}`);
    const shopRes= await instance.get(`/shops/${response.data.data.shop}`);

    return {
      ...response.data.data,
      shop: shopRes.data.data,
    };
  },

  async checkout({ orderId, payer, amount, currency, tx_hash, metadata = {} }) {
    try {
      const payment = (await instance.post('/payments', {
        orderId,
        payer,
        amount,
        currency,
        tx_hash,
        metadata,
      })).data;
    } catch (err) {
      throw err;
    }
  },
}