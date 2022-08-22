
import { Network, Alchemy } from "alchemy-sdk";
import fetch from "node-fetch";

// Optional config object, but defaults to demo api-key and eth-mainnet.
const settings = {
  apiKey: 'd9EFFkpIfWy9F72xlsKA1uWCarExbmtL', // Replace with your Alchemy API Key.
  network: Network.MATIC_MAINNET, // Replace with your network.
};
const alchemy = new Alchemy(settings);



export default ({ filter, schedule }, { services, exceptions, getSchema }) => {
	const { ItemsService } = services;

	filter('items.create', async (input, { collection }, { accountability: { user }}) => {
		if (collection === 'shops') {
			input.owner = user;
		}
		return input;
	});

	schedule('*/1 * * * *', async (foo) => {
		const schema = await getSchema();
		const paymentService = new ItemsService('payments', { schema });
		
		const pendingPayments = await paymentService.readByQuery({
			filter: { 
				"status": {
					"_eq": "Pending",
				},
			},
			fields: ['id', 'tx_hash']
		});

		pendingPayments.forEach((payment) => {
			try {
				alchemy.core.getTransactionReceipt(payment.tx_hash)
				.then(console.log);
			} catch (err) {
				console.log(err);
			}
		});

		console.log(pendingPayments);
	});
};