import axios from 'axios';
import web3, { transferToken } from './web3';
import Currencies from './currencies';
import config from '../config';

const instance = axios.create({
  baseURL: config.gravApiUrl,
  timeout: 1000,
  headers: {
    'Content-Type': 'application/json'
  },
});

export default {
  async createOrder({ shop, line_items, amount, currency }) {
    const response = await instance.post('/orders',
      {
        shop,
        line_items,
        amount,
        currency,
      }
    );

    return response.data.data;
  },

  async pay({ orderId, merchantAddress, payerAddress, amount, currency, metadata = {} }) {
    try {
      const currencyData = Currencies.getCurrency(currency);
      const tx_hash = transferToken(payerAddress, merchantAddress, currencyData.contractAddress, amount);

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