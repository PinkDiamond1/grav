import supportedCurrencies from '../services/data/supported_currencies';

export default (amount, currencySymbol) => {
  const currency = supportedCurrencies.find(item => item.symbol === currencySymbol);

  if (currency) {
    return amount / (10 ** currency.decimals);
  }
  
  throw new Error(`Currency ${currencySymbol} is unsupported.`);
};
