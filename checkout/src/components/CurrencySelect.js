import React, { useEffect, useState } from 'react';
import {  Typography, Image, Row, Col } from 'antd';
import Currencies from '../services/currencies';
import styled from 'styled-components/macro';
import { FlexBox } from './styled-utils';

import { formatByDecimals } from '../utils/formatCurrency';

const { Paragraph, Title } = Typography;

const CurrencySelectWrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

const CurrencyOption = styled.div`
  height: 64px;
  border: ${props => props.selected ? "solid 1px #04472D" : "solid 1px #ABB6B2"};
  display: flex;
  cursor: pointer;
  align-items: center;
  padding: 8px;
  &:hover {
    background: #F7F7F7;
    border: solid 1px #04472D;
  }
`;

const CurrencyName = styled(Paragraph)`
  margin-bottom: 0px !important;
`;

const CurrencyBalance = styled(Paragraph)`
  margin-bottom: 0px !important;
`;

export default function CurrencySelect({ onChange = () => {}, balances = {}, value }) {
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    setCurrencies(Currencies.getSupportedCurrencies());
  }, []);

  return (
    <CurrencySelectWrapper>
      {
        currencies.map(currency => 
        <CurrencyOption
          key={currency.symbol}
          selected={value === currency.symbol}
          onClick={() => { onChange(currency.symbol) }}
        >
          <Image width={40} src={currency.logoURI} preview={false}/>
          <FlexBox direction='column' alignItems='flex-start' justifyContent='flex-start'>
            <CurrencyName strong>{currency.name}</CurrencyName>
            <CurrencyBalance level={4}>{ formatByDecimals(balances[currency.symbol], currency.decimals)} {currency.symbol}</CurrencyBalance>
          </FlexBox>
        </CurrencyOption>)
      }
    </CurrencySelectWrapper>
  )
}