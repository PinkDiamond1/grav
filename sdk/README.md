# Gravity's JS SDK

---

### Usage

```html
<script src="https::/grav.atscale.xyz/grav-sdk.js"></script>
<button
  class="grav_pay_button"
  data-shop="shop_id"
  data-line-items='[]'
  data-amount="100000"
  data-currency="USDT"
>
  Pay now
</button>

window.addEventListener('load', () => {
  Grav.elements.addPayButtons();
});
```

### Developer

```bash
yarn install
yarn dev
```
