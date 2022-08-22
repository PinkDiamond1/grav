import GravityApi from '../services/grav-api';
import config from '../config.json';

const defaultStyles = {
  height: '45px',
  width: '348px',
  fontSize: '14px',
  padding: '8px 16px',
  background: '#000',
  color: '#fff',
  border: 'none',
  cursor: 'pointer'
};

const setStyles = (el, styles) => {
  Object.keys(styles).forEach((property) => {
    el.style[property] = styles[property];
  });
};

const PayButton = ({
  element,
  text,
  styles = {}
}) => {
  element.innerHTML = text || element.innerHTML || 'Pay by cryptocurrencies';
  setStyles(element, { ...defaultStyles, styles });

  console.log(element.dataset);
  const shop = element.dataset['shop'];
  const amount = element.dataset['amount'];
  const currency = element.dataset['currency'];
  const line_items = JSON.parse(element.dataset['lineItems']);

  element.addEventListener('click', async () => {
    try {
      const order = await GravityApi.createOrder({ shop, line_items, amount, currency });
      window.location = `${config.checkoutUrl}?order_id=${order.id}`;
    } catch (err) { 

    };
  });
};

export default PayButton;