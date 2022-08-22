import supportedCurrencies from '../services/data/supported_currencies';

// eslint-disable-next-line
export default (amount, currencySymbol) => {
  const currency = supportedCurrencies.find(item => item.symbol === currencySymbol);

  if (currency) {
    return formatByDecimals(amount, currency.decimals);
  }
  
  throw new Error(`Currency ${currencySymbol} is unsupported.`);
};

export function formatByDecimals(amount, decimals) {
  return Math.round(amount / (10 ** (decimals - 5))) / 10 ** 5;
}
