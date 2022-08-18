import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import ERC20TransferABI from './data/transfer-erc20-abi';

const web3 = createAlchemyWeb3('wss://polygon-mainnet.g.alchemy.com/v2/d9EFFkpIfWy9F72xlsKA1uWCarExbmtL');

export function transferToken(fromAddress, toAddress, contractAddress, amount) {
  const tokenContract = new web3.eth.Contract(ERC20TransferABI, contractAddress);

  return new Promise((resolve, reject) => {
    tokenContract.methods.transfer(toAddress, amount).send({ from: fromAddress }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

export default web3;

