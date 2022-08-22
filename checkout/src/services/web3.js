import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import ERC20TransferABI from './data/transfer-erc20-abi';
import currencies from './data/supported_currencies';
import config from '../config.json';

const web3 = createAlchemyWeb3(config.alchemyApiUrl);

const NATIVE_TOKEN_SYMBOL = 'MATIC';
const NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export function transferToken({fromAddress, toAddress, contractAddress, amount}) {
  const tokenContract = new web3.eth.Contract(ERC20TransferABI, contractAddress);
  return new Promise((resolve, reject) => {
    tokenContract.methods.transfer(toAddress, amount).send({ from: fromAddress, gasPrice: web3.utils.toWei('50','gwei').toString() }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

export function getAccounts() {
  return new Promise((resolve, reject) => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(accounts => { resolve(accounts)})
        .catch(reason => { reject(reason.message)});
    } else {
      reject('The Metamask has not been installed.');
    }
  });
}

function getNativeTokenBalance(address) {
  return web3.eth.getBalance(address);
}

export async function getBalances(address) {
  const tokenAddresses = currencies
    .filter(item => item.address !== NATIVE_TOKEN_ADDRESS)
    .map(item => item.address);
  const [nativeTokenBalance, { tokenBalances }] = await Promise.all([
    getNativeTokenBalance(address),
    web3.alchemy.getTokenBalances(address, tokenAddresses),
  ]);

  const result = {
    [NATIVE_TOKEN_SYMBOL]: nativeTokenBalance,
  };

  tokenBalances.forEach((item) => {
    const symbol = currencies.find(currency => currency.address === item.contractAddress).symbol;
    result[symbol] = item.tokenBalance;
  });

  return result;
}

export function sendTransaction(tx) {
  return web3.eth.sendTransaction(tx);
}

export default web3;

