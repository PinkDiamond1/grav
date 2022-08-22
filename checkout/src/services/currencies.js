import axios from 'axios';
import supportedCurrencies from './data/supported_currencies.js';

const instance = axios.create({
  baseURL: 'https://api.1inch.io/v4.0/137',
  timeout: 3000,
  headers: {}
});

const request = async (path, params) => {
  const response = await instance.get(`${path}?${(new URLSearchParams(params)).toString()}`);

  return response.data;
};

export default {
  getSupportedCurrencies() {
    return supportedCurrencies;
  },

  getCurrency(symbol) {
    const currency = supportedCurrencies.find(item => item.symbol === symbol);
    if (!currency) {
      throw new Error('Currency is unsupported!');
    }
    return currency;
  },

  getCurrencyPrices() {

  },

  async checkAllowance({ tokenAddress, walletAddress }) {
    return (await request('/approve/allowance', { tokenAddress, walletAddress })).allowance;
  },

  async getQuote({ fromTokenAddress, toTokenAddress, amount }) {
    const params = {
      fromTokenAddress,
      toTokenAddress,
      amount,
    };

    return (await request('/quote', params));
  },

  async buildApproveTx({ tokenAddress, amount }) {
    const params = {
      tokenAddress,
      amount,
    };
    return (await request('/approve/transaction', params));
  },

  async buildSwapTX({ fromAddress, fromTokenAddress, toTokenAddress, amount, slippage = 1, disableEstimate = false, allowPartialFill = false }) {
    const params = {
      fromTokenAddress,
      toTokenAddress,
      amount,
      fromAddress,
      slippage,
      disableEstimate,
      allowPartialFill,
    };

    return (await request('/swap', params));
  }
}