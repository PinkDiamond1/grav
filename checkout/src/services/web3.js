import Web3 from 'web3';

const POLYGON_MAINNET_RPC = 'wss://polygon-mainnet.g.alchemy.com/v2/d9EFFkpIfWy9F72xlsKA1uWCarExbmtL';

let instance = null;

export default class Web3Wrapper {
  constructor() {

  };

  static async getInstance() {
    console.log(Web3.givenProvider === window.ethereum);
    if (instance === null) {
      if (window.ethereum) {
        instance = new Web3(web3.givenProvider);
        await window.ethereum.enable();
      } else if (window.web3) {
        console.log(Web3.givenProvider);
        instance = new Web3(Web3.givenProvider);
      } else {
        throw new Error('Non-Ethereum browser detected. You should consider trying MetaMask!');
      }
    }

    return instance;
  }
};