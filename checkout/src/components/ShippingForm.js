import React from 'react';
import { Input, Form } from 'antd';

export default function ShippingForm({ defaultValue }) {
  const [form] = Form.useForm();

  return (
    <>
      <Form
        title='Shipping'
        form={form}
        layout="vertical"
      >
        <Form.Item label="Email" name="email">
          <Input disabled placeholder="Email" />
        </Form.Item>
        <Form.Item label="Full name" name="name">
          <Input disabled placeholder="Full name" />
        </Form.Item>
        <Form.Item label="Address" name="address">
          <Input placeholder="Address" />
        </Form.Item>
        <Form.Item disabled label="City" name="city">
          <Input placeholder="City" />
        </Form.Item>
        <Form.Item disabled label="Country/Region" name="country">
          <Input placeholder="Country" />
        </Form.Item>
      </Form>
    </>
  )
};
