import axios from 'axios';

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

		pendingPayments.forEach(async (payment) => {
			try {
				const params = {
					method:'eth_getTransactionReceipt',
					params: [payment.tx_hash],
					id:42,
					jsonrpc:"2.0"
				};
				
				const response = await axios.post('https://polygon-mainnet.g.alchemyapi.io/v2/d9EFFkpIfWy9F72xlsKA1uWCarExbmtL', params);


				if (response.data.result) {
					paymentService.updateOne(payment.id, { status: "Success" });
				}
			} catch (err) {
				console.log(err);
			}
		});
	});
};