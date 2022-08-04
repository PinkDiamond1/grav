# Project Gravity

## Features
- `Pay now` button
	- Include script to show button
	- Click to create `payment` in backend
	- Redirect to `hosted checkout page`
- Hosted checkout page
	- Display product, price, ...
	- Currencies conversion
		- Refresh each 30s to get new quote
		- Swap and pay
- Dashboard
	- Login by wallet
	- Payment list
	- Integration
		- Shopify
	- Webhooks
	- Branding config for hosted checkout page
- Demo shop
	- Create a shopify with products
	- Integrate with `Gravity`
	- Payment success -> Place order in Shopify

## Data model

- **Payment**
```js
const payment = {
	id: 'payment_aswerxdxa',
	network: 'polygon',
	payer: 'payer_address', 
	payee: 'payee_address', // Merchant address
	amount: 1000, // Integer, smallest currency unit
	currency: 'dai',
	status: 'cancel || success || failed',
	order_id: '',
  metadata: {}
}
```


- **Integration**
```js
const integration = {
	id: 'integration_id',
	platform: 'shopify | woocomerce | magento, ...',
	credential: {
		api_key: 'api_key',
		secret: 'secret'
	},
}
```

- **Order**
```js
const order = {
	id: 'order_afgdrtrvc',
	integration_id: 'integration_id',
	line_items: {},
	shipping: {},
	amount: 1000, // Integer, smallest currency unit
	currency: 'dai',
  metadata: {}
	...
}
```

- **Event**

```js
const event = {
	id: 'uuid',
	type: 'draft_order_created | ...',
	payload: { ///TBD }
}
```

- **Webhooks**
```js
const webhook = {
	id: 'uuid',
	integration_id: 'integration_id',
	events: [
		'draft_order_created',
		'payment_cancelled',
		'payment_failed',
		'payment_success'
	],
	secret: 'asdfasdwer',
}
```

## Techstack
- **Authentication:** https://web3auth.io/
- **Frontend** 
	- Onboarding: https://docs.blocknative.com/onboard/web3auth
	- On-chain events: https://dashboard.alchemyapi.io/notify
	- DEX currencies conversion:
		- Docs: https://api.zapper.fi/api/static/index.html
		- API key: `388b6444-22fb-46ae-8f56-eb238d8f5b4b`
- **Backend**
	- Language: Python
	- Framework:  https://flask.palletsprojects.com/
	- Database: Sqlite