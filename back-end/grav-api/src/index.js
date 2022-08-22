export default (router, { services, exceptions }) => {
	const { ItemsService } = services;

	router.post('/checkout', async  (req, res) => {
		try {
			const order_id = req.body.order;
			const orderService = new ItemsService('orders', { schema: req.schema });
			const orders = await orderService.readByQuery({
				filter: { 
					"id": {
						"_eq": order_id,
					},
				},
				fields: ['*']
			});

			if (orders.length === 0) {
				res.json({
					status: 400,
					message: 'Order not found.',
				});

				return;
			}

			const paymentService  = new ItemsService('payments', { schema: req.schema });
			const result = await paymentService.createOne({
				...req.body,
			});

			orderService.updateOne(order_id, { payment: result });
			
			res.json({
				id: result,
			});
		} catch (err) {
			console.log(err);
			res.json(err);
		}
	});
};
