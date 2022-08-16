import axios from 'axios';

const instance = axios.create({
  baseURL: 'https://api.zapper.fi/api/v2',
  timeout: 1000,
  headers: {
    Authorization: 'Basic Mzg4YjY0NDQtMjJmYi00NmFlLThmNTYtZWIyMzhkOGY1YjRiOg=='
  }
});

export async function getTokenBalances(address) {
  const response = await instance.get(`/apps/tokens/balances?network=polygon&addresses[]=${address}`);

  return response.data.balances[address];
}

export async function getExchangePrice(fromToken, toToken, amount) {
  const response = await instance.get('/exchange/price');

  return response.data;
}

