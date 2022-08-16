'use strict';

var index = ({ filter, action }, { accountability }) => {
	filter('items.create', async (input, { collection }, { accountability: { user }}) => {
		if (collection === 'shops') {
			input.owner = user;
		}
		return input;
	});

	// action('items.create', (event) => {
	// 	console.log('Item created!');
	// 	console.log(event);
	// });
};

module.exports = index;
