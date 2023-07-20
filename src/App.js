import './App.css';
import Nav from './components/Nav/Nav';
import Fetch from './components/FetchTokenBound/Fetch';
import { ethers } from 'ethers';
import { abi } from './abi';
import { useState, useRef } from 'react';
import SocialLogin from "@biconomy/web3-auth";
import "@biconomy/web3-auth/dist/src/style.css"
import { ChainId } from "@biconomy/core-types";
import SmartAccount from "@biconomy/smart-account";
const web3 = require('web3');

require("dotenv").config();

const tokenMessengerAbi = require('./abis/cctp/TokenMessenger.json');
const usdcAbi = require('./abis/Usdc.json');
const messageAbi = require('./abis/cctp/Message.json');
const messageTransmitterAbi = require('./abis/cctp/MessageTransmitter.json');


function App() {

  const [smartAccount, setSmartAccount] = useState(null);
  const sdkRef =  useRef(null);
  const [text, setText] = useState('');
  const [add, setadd] = useState('');
  const [mintAdd, setmintAdd] = useState('');
  
  let provider;

  async function logIn() {
    
    if(!sdkRef.current){
      const socialLoginSDK = new SocialLogin();
      const signature1 = await socialLoginSDK.whitelistUrl('http://127.0.0.1:3000/')
      await socialLoginSDK.init({
        chainId: ethers.utils.hexValue(ChainId.GOERLI).toString(),
        network: "GOERLI",
        whitelistUrls: {
          'http://127.0.0.1:5173/': signature1,
        }
      });
      sdkRef.current = socialLoginSDK;
    }
    
    if(!sdkRef.current.provider){
      sdkRef.current.showWallet();
    }
    else {
      initSmartWallet();
    }
  }

  async function initSmartWallet() {

    if(!sdkRef?.current.provider) return;
    sdkRef.current.hideWallet();
    provider = new ethers.providers.Web3Provider(
      sdkRef.current.provider,
    );

    let options = {
      activeNetworkId: ChainId.GOERLI,
      supportedNetworksIds: [ChainId.GOERLI],
      networkConfig: [
        {
          chainId: ChainId.GOERLI,
          dappAPIKey: "tRhQTlOd1.ff08ac50-5906-4237-95d7-8743043b5687",
          providerUrl: "https://goerli.infura.io/v3/2ccdacfc917f4fd3bd8112d2e205a8e3"
        }
      ]
    };

    let smartAccount = new SmartAccount(provider, options);
    smartAccount = await smartAccount.init();
    setSmartAccount(smartAccount);
    console.log("SM: ", smartAccount.address);
    const ele = document.getElementById('btn');
    ele.innerHTML = "Disconnect";

    /* 
      Logic for batching transaction
      1. allow usdc to be spended
          bridge usdc from arbitrum to goerli
      
      2. swap to eth 
      3. mint

      Encode nft contract address = 0x60155DF180066aD68ee39D64B5AeBF1440971Ccf

    */

  }
  async function transferETH() {
    
    let tx = {
      to: String(add),
      value: ethers.utils.parseEther(String(text)),
      gasLimit: 21000,
      maxPriorityFeePerGas: ethers.utils.parseUnits('5', 'gwei'),
      maxFeePerGas: ethers.utils.parseUnits('20', 'gwei'),
    }

    const temp = "0x7199D548f1B30EA083Fe668202fd5E621241CC89";
    let CONT = new ethers.Contract("0x60155DF180066aD68ee39D64B5AeBF1440971Ccf", abi, provider);
    const tx1 = await CONT.populateTransaction.safeMint(String(mintAdd), "uriTesting123");

    const txs = [];
    txs.push(tx);
    txs.push(tx1);

    const txResponse = await smartAccount.sendTransactionBatch({ transactions: txs });
    console.log('UserOp hash', txResponse.hash);
    const txReciept = await txResponse.wait();
    console.log('Tx Hash', txReciept.transactionHash);
  }

  const handleChange = (event) => {
    setText(event.target.value);
  };

  const handleChangeAdd = (event) => {
    setadd(event.target.value);
  };
  
  const handleChangeMintAdd = (event) => {
    setmintAdd(event.target.value);
  };

  async function bridgeUsdc() {
    const ETH_TOKEN_MESSENGER_CONTRACT_ADDRESS = "0xd0c3da58f55358142b8d3e06c1c30c5c6114efe8";
    const USDC_ETH_CONTRACT_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f";
    const ETH_MESSAGE_CONTRACT_ADDRESS = "0x1a9695e9dbdb443f4b20e3e4ce87c8d963fda34f"
    const AVAX_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS = '0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79';

    const ethTokenMessengerContract = new ethers.Contract(ETH_TOKEN_MESSENGER_CONTRACT_ADDRESS, tokenMessengerAbi, provider);
    const usdcEthContract = new ethers.Contract(USDC_ETH_CONTRACT_ADDRESS, usdcAbi, provider);
    const ethMessageContract = new ethers.Contract(ETH_MESSAGE_CONTRACT_ADDRESS, messageAbi, provider);
    const avaxMessageTransmitterContract = new ethers.Contract(AVAX_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS, messageTransmitterAbi, provider);

    // AVAX destination address
    const mintRecipient = process.env.RECIPIENT_ADDRESS;
    //----------tx1
    const destinationAddressInBytes32 = await ethMessageContract.populateTransaction.addressToBytes32("0x7199D548f1B30EA083Fe668202fd5E621241CC89");
    //const destinationAddressInBytes32 = await ethMessageContract.methods.addressToBytes32(mintRecipient).call();
    const AVAX_DESTINATION_DOMAIN = 1;
    console.log("destinationAddressInBytes32: ",destinationAddressInBytes32);
    
    // Amount that will be transferred
    const amount = 1000000;

    // STEP 1: Approve messenger contract to withdraw from our active eth address
    //----------tx2
    const approveTx = await usdcEthContract.populateTransaction.approve(ETH_TOKEN_MESSENGER_CONTRACT_ADDRESS, 10000000);
     //const approveTx = await usdcEthContract.methods.approve(ETH_TOKEN_MESSENGER_CONTRACT_ADDRESS, amount).send({gas: approveTxGas})
    console.log('ApproveTxReceipt: ', approveTx)


    
    // STEP 2: Burn USDC
    const burnTx = await ethTokenMessengerContract.populateTransaction.depositForBurn(amount, AVAX_DESTINATION_DOMAIN, ethers.utils.hexZeroPad("0x7199D548f1B30EA083Fe668202fd5E621241CC89", 32), USDC_ETH_CONTRACT_ADDRESS);
    //const burnTx = await ethTokenMessengerContract.methods.depositForBurn(amount, AVAX_DESTINATION_DOMAIN, destinationAddressInBytes32, USDC_ETH_CONTRACT_ADDRESS).send({gas: burnTxGas});
    //----------tx3
    //const burnTxReceipt = await waitForTransaction(web3, burnTx.transactionHash);
    console.log('BurnTxReceipt: ', burnTx);



    const txs = [];
    txs.push(destinationAddressInBytes32);
    txs.push(approveTx);
    txs.push(burnTx);



    const txResponse = await smartAccount.sendTransactionBatch({ transactions: txs });
    console.log('UserOp hash', txResponse.hash);
    const txReciept = await txResponse.wait();
    console.log('Tx Hash', txReciept.transactionHash);
  
  }

  async function contin () {
    
    //const messageBytes = "0x00000000000000000000000100000000000391bb000000000000000000000000d0c3da58f55358142b8d3e06c1c30c5c6114efe8000000000000000000000000eb08f243e5d3fcff26a9e38ae5520a669f4019d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007865c6e87b9f70255377e024ace6630c1eaa37f0000000000000000000000007199d548f1b30ea083fe668202fd5e621241cc8900000000000000000000000000000000000000000000000000000000000f42400000000000000000000000007199d548f1b30ea083fe668202fd5e621241cc89";
    const messageBytes =   "0x00000000000000000000000100000000000391BD000000000000000000000000D0C3DA58F55358142B8D3E06C1C30C5C6114EFE8000000000000000000000000EB08F243E5D3FCFF26A9E38AE5520A669F4019D000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007865C6E87B9F70255377E024ACE6630C1EAA37F0000000000000000000000007199D548F1B30EA083FE668202FD5E621241CC8900000000000000000000000000000000000000000000000000000000000F42400000000000000000000000008F20E56A3CA86C4EC446042C89F0717A60BCF830";                    
    const messageHash = web3.utils.keccak256(String(messageBytes));
    console.log(messageHash);

    let attestationResponse = {status: 'pending'};
    while(attestationResponse.status != 'complete') {
        const response = await fetch(`https://iris-api-sandbox.circle.com/attestations/${messageHash}`);
        attestationResponse = await response.json()
        await new Promise(r => setTimeout(r, 2000));
    }

    const attestationSignature = attestationResponse.attestation;
    console.log(`Signature: ${attestationSignature}`)

    // STEP 5: Using the message bytes and signature recieve the funds on destination chain and address
    //web3.setProvider("https://avalanche-fuji.infura.io/v3/2ccdacfc917f4fd3bd8112d2e205a8e3"); // Connect web3 to AVAX testnet
    const AVAX_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS = '0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79';

    const providesr = new ethers.providers.JsonRpcProvider("https://avalanche-fuji.infura.io/v3/2ccdacfc917f4fd3bd8112d2e205a8e3");
    const avaxMessageTransmitterContract = new ethers.Contract(AVAX_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS, messageTransmitterAbi, providesr);

    const receiveTx = await avaxMessageTransmitterContract.populateTransaction.receiveMessage(messageBytes, attestationSignature);

    const txs = [];
    txs.push(receiveTx);

    const txResponse = await smartAccount.sendTransactionBatch({ transactions: txs });
    console.log('UserOp hash', txResponse.hash);
    const txReciept = await txResponse.wait();
    console.log('Tx Hash', txReciept.transactionHash);
    
  }

  /*
    console.log(text);
    console.log(add);
    console.log(mintAdd)
  */
  return (
    <>
        <Nav/>
        <Fetch/>
        <button  id='btn' className="btn" onClick={logIn}>Connect Wallet</button>
        {
          smartAccount == null ? 
          <></>
          :
          <>
          <h3>Smart Wallet Address</h3>
          <h3>{smartAccount.address}</h3>
          </>
        }
        <h3>Enter the amount of ether to transfer</h3>
        <div>
      
      <input type="text" value={text} onChange={handleChange} />
      </div>

      <h3>Enter the address to sent Ether</h3>
      
      <div>
        <input type="text" value={add} onChange={handleChangeAdd} />
      </div>

      <h3>Enter the address to mint nft</h3>
      
      <div>
        <input type="text" value={mintAdd} onChange={handleChangeMintAdd} />
      </div>
      
      <div className='st'>
        <button className='button1' onClick={transferETH}>Transfer and Mint</button>
        <button className='button1' onClick={bridgeUsdc}>Bridge USDC</button>
        <button className='button1' onClick={contin}>continue transaction</button>
      </div>
    </>
  );
}

export default App;


/*
0x10d4e2fef0a6f4e49d1a226aa1eeecb377584208ae14956af5bd992bd33bd19a
0x10d4e2fef0a6f4e49d1a226aa1eeecb377584208ae14956af5bd992bd33bd19a
0x10d4e2fef0a6f4e49d1a226aa1eeecb377584208ae14956af5bd992bd33bd19a
0xac66ff1166f90bed1d6e9e0a350678a48c850ce09344244174d63cb0df1af6d3
*/