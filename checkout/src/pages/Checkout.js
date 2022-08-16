import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import styled from 'styled-components/macro';

import { Row, Col, Typography, PageHeader, Select, notification, Divider, Button } from 'antd';
// import { ShoppingOutlined } from '@ant-design/icons';
import Loading from '../components/Loading';
import LineItem from '../components/LineItem';
import ShippingForm from '../components/ShippingForm';

import useQuery from "../hooks/useQuery";

import { getOrder } from '../services/api';
import Web3 from '../services/web3';

const { Option } = Select;
const { Paragraph, Title } = Typography;

const TotalContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 144px;
`;

const StyledTitle = styled(Title)`
  margin-top: 0px !important;
`;

const ActionsContainer = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export default function Checkout() {
  const query = useQuery();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [order, setOrder] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const orderId = query.get('order_id');
  const successUrl = query.get('success_url');
  const cancelUrl = query.get('cancel_url');

  const fetchOrder = async () => {
    setIsLoading(true);

    try {
      const order = await getOrder(orderId);
      setOrder(order);
    } catch(error) {
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (accounts.length > 0) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts]);

  const onSuccess = () => {
    if (successUrl) {
      navigate(successUrl);
    }
  };

  const onCancel = () => {
    if (cancelUrl) {
      navigate(cancelUrl);
    }
  };

  const onConnectWallet = async () => {
    const web3 = await Web3.getInstance();
  };
  
  return (
    <>
      <Loading isLoading={isLoading}/>
      <PageHeader
        onBack={onCancel}
        title="Checkout"
      />
      {
        !!order && 
        <Row gutter={24}>
          <Col span={12} style={{ padding: '8px 32px', borderRight: "solid 1px #ABB6B2" }}>
            <ShippingForm/>
          </Col>
          <Col span={12} style={{ padding: '8px 32px' }}>
            {
              order.line_items.map(
                (item, index) => 
                  <LineItem 
                    key={index} 
                    productImage={item.product_images[0]} 
                    productTitle={item.product_title}
                    quantity={item.quantity}
                    price={item.price}
                    currency={order.currency}
                  />
              )
            }
            <Divider/>
            <TotalContainer>
              <StyledTitle level={4}>Total</StyledTitle>
              <StyledTitle level={4}>{order.total_amount} {order.currency}</StyledTitle>
            </TotalContainer>
            <Divider/>
            <ActionsContainer>
              <Button
                type='primary'
                size='large'
                onClick={onConnectWallet}
                loading={isConnectingWallet}
              >
                Connect Wallet
              </Button>
            </ActionsContainer>
          </Col>
        </Row>
      }
    </>
  )
};
