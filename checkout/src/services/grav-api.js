import axios from 'axios';
import config from '../config.json';

const instance = axios.create({
  baseURL: config.gravApiUrl,
  timeout: 1000,
});

// eslint-disable-next-line
export default {
  async getOrder(orderId) {
    const response = await instance.get(`items/orders/${orderId}`);
    const shopRes= await instance.get(`items/shops/${response.data.data.shop}`);

    return {
      ...response.data.data,
      shop: shopRes.data.data,
    };
  },

  async checkout({ orderId, payer, amount, currency, tx_hash, metadata = {} }) {
    try {
      await instance.post('grav-api/checkout', {
        order: orderId,
        payer,
        amount,
        currency,
        tx_hash,
        metadata,
      });
    } catch (err) {
      throw err;
    }
  },
}