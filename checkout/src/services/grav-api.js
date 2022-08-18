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

    return response.data.data;
  },

  async pay({ orderId, merchantAddress, payer, amount, currency, metadata = {} }) {
    try {
      const currencyData = Currencies.getCurrency(currency);
      const tx_hash = transferToken(payer, merchantAddress, currencyData.contractAddress, amount);

      const payment = (await instance.post('/payments', {
        orderId,
        payer,
        amount,
        currency,
        tx_hash,
        metadata,
      })).data;

      return payment;
    } catch (err) {
      throw err;
    }
  },
}