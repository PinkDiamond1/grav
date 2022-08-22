import React from 'react';
import { Result } from 'antd';

export default function CheckoutSuccess() {
  // const navigate = useNavigate();
  return (
    <Result
      status="success"
      title="Your order is completed!"
    />
  )
}