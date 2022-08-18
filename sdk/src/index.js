import PayButton from './elements/PayButton';
import Api from './services/grav-api';

export default {
  elements: {
    addPayButtons: () => {
      const els = document.getElementsByClassName('grav_pay_button');
      
      [...els].forEach((element) => {
        console.log(element);
        PayButton({ element })
      });
    },
  },
  api: {
    createOrder: Api.createOrder,
  },
}