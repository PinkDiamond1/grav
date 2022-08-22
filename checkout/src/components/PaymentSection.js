import React, { useEffect, useState } from 'react';
import MetaMaskOnboarding from '@metamask/onboarding';
import styled from 'styled-components/macro';

import { Typography, notification, Button, Select, Alert } from 'antd';
import CurrencySelect from './CurrencySelect';
import { FlexBox } from './styled-utils';

import { getAccounts, getBalances, sendTransaction, transferToken } from '../services/web3';
import Currencies from '../services/currencies';

const { Paragraph } = Typography;
const { Option } = Select;

const Label = styled(Paragraph)`
`;

export default function PaymentSection({ amount, currency, shopWalletAddress, onPaymentComplete }) {
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [allowances, setAllowances] = useState({});
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const onboarding = React.useRef();

  useEffect(() => {
    if (!onboarding.current) {
      onboarding.current = new MetaMaskOnboarding();
    }
  }, []);

  useEffect(() => {
    setSelectedCurrency(currency);
  }, [currency])

  useEffect(() => {
    if (MetaMaskOnboarding.isMetaMaskInstalled() && accounts > 0) {
      onboarding.current.stopOnboarding();
    }
  }, [accounts]);

  useEffect(() => {
    if (accounts.length > 0) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts]);

  const fetchBalances = async () => {
    try {
      const tokenAddresses = Currencies.getSupportedCurrencies().map(item => item.address);
      const result = await getBalances(selectedAccount, tokenAddresses);
      setBalances(result);
    } catch(err) {
      notification.error({
        message: err.message,
      })
    }
  }

  useEffect(() => {
    if (selectedAccount) {
      fetchBalances();
    }
  }, [selectedAccount]);

  const connectWallet = async () => {
    setIsConnectingWallet(true);
    if (MetaMaskOnboarding.isMetaMaskInstalled()) {
      try {
        const accounts = await getAccounts();
        setAccounts(accounts);
      } catch (err) {
        notification.error({
          message: err.message,
        })
      }
    } else {
      onboarding.current.startOnboarding();
    }
    setIsConnectingWallet(false);
  };

  const pay = async () => {
    try {
      const currencyAddress = Currencies.getCurrency(currency).address;

      const result = await transferToken({
        fromAddress: selectedAccount,
        toAddress: shopWalletAddress,
        contractAddress: currencyAddress,
        amount,
      });
  
      onPaymentComplete(result);
    } catch (err) {
      notification.error({ message: err.message });
    }

  };

  const checkAllowance = async () => {
    if (allowances[selectedCurrency] === undefined) {
      setIsCheckingAllowance(true);
      const tokenAddress = Currencies.getCurrency(selectedCurrency).address;
      setAllowances({
        ...allowances,
        [selectedCurrency]: await Currencies.checkAllowance({ tokenAddress, walletAddress: selectedAccount }),
      });
      setIsCheckingAllowance(false);
    }
  };

  useEffect(() => {
    checkAllowance();
  }, [selectedCurrency, selectedAccount])

  if (accounts.length === 0) {
    return (
      <FlexBox justifyContent='flex-end'>
        <Button
          type='primary'
          size='large'
          disabled={isConnectingWallet}
          onClick={connectWallet}
          loading={isConnectingWallet}
        >
          Connect Wallet
        </Button>
      </FlexBox>
    )
  }

  const convertCurrencyButtonText = () => {
    if (isCheckingAllowance) {
      return 'Checking';
    }

    if (allowances[selectedCurrency]) {
      return 'Swap currency';
    }

    return 'Approve currency';
  };

  const onSwapCurrency = async () => {
    setIsSwapping(true);

    try {
      const fromTokenAddress = Currencies.getCurrency(selectedCurrency).address;
      const toTokenAddress = Currencies.getCurrency(currency).address;
  
      const quote = await Currencies.getQuote({ fromTokenAddress, toTokenAddress, amount: balances[selectedCurrency]});

      if (quote.toTokenAmount < amount) {
        throw new Error(`Your ${selectedCurrency} is not enough to swap.`);
      }
  
      const rate = (balances[selectedCurrency] / quote.toTokenAmount + 1);
      const estimateSpend = amount * 1.1 * rate;
  
      if (estimateSpend > Number.parseFloat(allowances[selectedCurrency])) {
        const approveTx = await Currencies.buildApproveTx({ tokenAddress: fromTokenAddress, amount: estimateSpend });
        await sendTransaction({
          ...approveTx,
          from: selectedAccount,
        });
      }

      const swapTx = await Currencies.buildSwapTX({
        fromAddress: selectedAccount,
        fromTokenAddress,
        toTokenAddress,
        amount: amount * rate,
      });

      await sendTransaction(swapTx.tx);
      await fetchBalances();
      setSelectedCurrency(currency);
    } catch (err) {
      notification.error({
        message: err.message,
      });
    }

    setIsSwapping(false);
  };

  return (
    <>
      <FlexBox direction="column" alignItems="flex-start">
        <Label>Select account</Label>
        <Select value={selectedAccount} onChange={(value) => setSelectedAccount(value)}>
          {
            accounts.map(item => <Option value={item} key={item}>{item}</Option>)
          }
        </Select>
      </FlexBox>
      <FlexBox alignItems="flex-start" direction="column">
        <Label>Select currency</Label>
        <CurrencySelect value={selectedCurrency} onChange={(value) => { setSelectedCurrency(value) }} balances={balances}/>
      </FlexBox>

      {
        currency === selectedCurrency &&
        <>
          {
            Number.parseFloat(balances[currency]) < Number.parseFloat(amount)
            && <FlexBox>
              <Alert
                message="Insufficient balance"
                description={`Your ${currency} balance is insufficient to complete order. Please consider to swap other currencies to ${currency} to complete order.`}
                type="error"
              />
            </FlexBox>
          }
          <FlexBox justifyContent='flex-end'>
            <Button
              type='primary'
              size='large'
              disabled={Number.parseFloat(balances[currency]) < Number.parseFloat(amount)}
              onClick={pay}
              loading={isProcessingOrder}
            >
              Complete Order
            </Button>
          </FlexBox>
        </>
      }

      {
        selectedCurrency !== currency && 
        <FlexBox justifyContent='flex-end'>
          <Button
            type='primary'
            size='large'
            disabled={isCheckingAllowance || isSwapping}
            onClick={onSwapCurrency}
            loading={isCheckingAllowance || isSwapping}
          >
            { convertCurrencyButtonText() }
          </Button>
      </FlexBox>
      }
    </>
  )
}
