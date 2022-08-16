import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Row, Col, Image, Button, Input, Form, Typography, PageHeader, Divider, Space, InputNumber, Alert, Select, notification } from 'antd';
import { ShoppingOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Paragraph, Title } = Typography;

export default function ShippingForm() {
  const [form] = Form.useForm();

  return (
    <>
      <Form
        title='Shipping'
        form={form}
        layout="vertical"
      >
        <Form.Item label="Email" name="email">
          <Input placeholder="Email" />
        </Form.Item>
        <Form.Item label="Full name" name="name">
          <Input placeholder="Full name" />
        </Form.Item>
        <Form.Item label="Address" name="address">
          <Input placeholder="Address" />
        </Form.Item>
        <Form.Item label="City" name="city">
          <Input placeholder="City" />
        </Form.Item>
        <Form.Item label="Country/Region" name="country">
          <Input placeholder="Country" />
        </Form.Item>
      </Form>
    </>
  )
};
