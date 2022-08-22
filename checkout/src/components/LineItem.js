import React from 'react';
import { Image, Typography } from 'antd';
import styled from 'styled-components/macro';

const { Title, Paragraph } = Typography;

const Container = styled.div`
  padding-bottom: 16px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Product = styled.div`
  display: flex;
  align-items: center;
`;

const ProductImageContainer = styled.div`
  position: relative;
  max-width: 128px;
  margin-right: 16px;
`;

const ProductImage = styled(Image)`
  width: 100%;
  border-radius: 4px;
`;

const Quantity = styled.div`
  padding: 0px 8px;
  background: #000;
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Price = styled(Paragraph)`
  text-transform: capitalize;
`;

export default function LineItem({
  productTitle,
  productImage,
  variant,
  price,
  quantity,
  currency,
}) {
  return (
    <Container>
      <Product>
        <ProductImageContainer>
          <ProductImage src={productImage}/>
          <Quantity>x {quantity}</Quantity>
        </ProductImageContainer>
        <div>
          <Title level={5}>{productTitle}</Title>
          <Paragraph>{variant}</Paragraph>
        </div>
      </Product>
      <Price strong>${price * quantity} {currency}</Price>
    </Container>
  )
};
