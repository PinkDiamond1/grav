import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/Result';

const routes = [
  {
    path: '/',
    name: 'Checkout',
    element: Checkout,
    exact: true,
  },
  {
    path: '/success',
    name: 'CheckoutSuccess',
    element: CheckoutSuccess,
    exact: true,
  },
]

export default routes;
