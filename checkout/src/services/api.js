// import axios from 'axios';

// const instance = axios.create({
//   baseURL: '',
//   timeout: 10000,
//   headers: {

//   }
// });


const delay = (time) => new Promise((resolve) => {
  setTimeout(resolve, time);
});

export async function getOrder(orderId) {
  await delay(500);

  return {
    id: 'dd9995dc-16ed-11ed-861d-0242ac120002',
    integration_id: 'integration_id',
    line_items: [
      {
        product_id: '0a843f66-16ee-11ed-861d-0242ac120002',
        product_title: 'Awesome product',
        product_images: ['https://user-images.githubusercontent.com/92568442/178114702-b682e886-7881-42d6-866a-be2aa8533847.jpg'],
        price: 1000,
        quantity: 1,
      }
    ],
    shipping: {},
    total_amount: 1000, // Integer, smallest currency unit
    currency: 'dai',
    metadata: {}
  }
}

