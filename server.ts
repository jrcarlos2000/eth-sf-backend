import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { storeToNFTStorage, storeToWeb3Storage } from "./ipfs";
import {
  buildReceiptTable,
  createPDF,
  createTaxPDF,
  buildTaxDeclaration
} from "./pdfkit";
import {
  fetchAllTokenBalancesForAllAccounts,
  fetchAllTokenTransactionsForAllAccounts,
} from "./etherscan";
import axios from "axios";
import bodyParser from "body-parser";
import morganBody from "morgan-body";
import { awaitAndFilter } from "./utils";
import { Contract, providers, utils, Wallet } from "ethers";
import { fetchTokenPriceBsc } from "./coingecko";
import { supportedTokens } from "./constants";
import { worldCoinABI, JomTxABI } from "./utils/abis";
import { addresses } from "./utils/addresses";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, packToSolidityProof } from "@semaphore-protocol/proof";
import  { ZkIdentity, Strategy } from  "@zk-kit/identity";
import { actionID, getProof } from "./utils/proof";
import { solidityPack } from  'ethers/lib/utils'

const cors = require("cors");

const corsOptions = {
  origin: "http://localhost:3000",
  optionsSuccessStatus: 200,
};
const winston = require("winston");
const consoleTransport = new winston.transports.Console();
dotenv.config();
const myWinstonOptions = {
  transports: [consoleTransport],
};
const logger = new winston.createLogger(myWinstonOptions);

const ethereumPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;

const serverProviders: any = {
  "0x2696efe5": new providers.JsonRpcProvider(process.env.SKALE_RPC_PROVIDER!),
  "80001" : new providers.JsonRpcProvider(process.env.MUMBAI_RPC_PROVIDER!),

};
const app: Express = express();
const port = process.env.PORT;
const tempGroup = new Group();
// parse JSON and others
app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.json());
// log all requests and responses
morganBody(app, { logAllReqHeader: true, maxBodyLength: 5000 });

app.post("/balances", async (req: Request, res: Response) => {
  let result = await fetchAllTokenBalancesForAllAccounts(req.body.accounts);
  res.send(result);
});

app.post("/transactions", async (req: Request, res: Response) => {
  let result = await fetchAllTokenTransactionsForAllAccounts(req.body.accounts);
  res.send(result);
});

app.get("/price", async (req: Request, res: Response) => {
  let result = await fetchTokenPriceBsc(req.query.tokenAddress as string);
  res.send(result);
});

app.get("/tokens", async (req: Request, res: Response) => {
  let result = {
    supportedTokens,
  };
  res.send(result);
});

app.get("/whatever", async (req: Request, res: Response) => {
  res.status(200).end();
});

app.post("/submit-receipt-v1", async (req: Request, res: Response) => {

  const {receiptData, storeName, storeKey, storeSignal, country, chainId, buyerAddr, transactionSummary} = req.body;

  const receiptTable = await buildReceiptTable(receiptData);
  const pdfFileName = "output.pdf";
  await createPDF([receiptTable] , storeName, country, storeSignal, buyerAddr, pdfFileName);

  // //we can opt to store this to other data storage providers
  const cids = await awaitAndFilter([
    storeToWeb3Storage(pdfFileName),
  ]);

  // const cids = ["hola"];

  if(!buyerAddr) {

    console.log("entering here", actionID,storeSignal, storeKey);

    const [nullifierHash, proof] = await getProof(actionID, solidityPack(["uint256"],[storeSignal]), storeKey);

    try {

      let cMockWorldID = new Contract(
        addresses.MockWorldID[chainId],
        worldCoinABI,
        new Wallet(ethereumPrivateKey!, serverProviders[chainId])
      );

      let cJomTx = new Contract(
        addresses.JomTx[chainId],
        JomTxABI,
        new Wallet(ethereumPrivateKey!, serverProviders[chainId])
      );

      let tx = await cJomTx.submitNonVerifiedUserTx(
        cids[0],
        transactionSummary || "Default-Purchase",
        storeSignal,
        await cMockWorldID.getRoot(storeSignal),
        nullifierHash,
        proof
      )

      await tx.wait();

      res.send({
        "web3.storage cid:": cids[0],
      });

      res.status(200).end();
    } catch (error: any) {
      console.error(error);
      res.status(500).end();
    }

  }else {

    const [nullifierHash, proof] = await getProof(actionID, solidityPack(["uint256"],[storeSignal]), storeKey);

    try {

      let cMockWorldID = new Contract(
        addresses.MockWorldID[chainId],
        worldCoinABI,
        new Wallet(ethereumPrivateKey!, serverProviders[chainId])
      );

      let cJomTx = new Contract(
        addresses.JomTx[chainId],
        JomTxABI,
        new Wallet(ethereumPrivateKey!, serverProviders[chainId])
      );

      let tx = await cJomTx.submitVerifiedTx(
        cids[0],
        transactionSummary,
        buyerAddr,
        storeSignal,
        await cMockWorldID.getRoot(storeSignal),
        nullifierHash,
        proof
      )

      await tx.wait();

      res.send({
        "web3.storage cid:": cids[0],
      });
      res.status(200).end();

    } catch (error: any) {
      console.error(error);
      res.status(500).end();
    }

  }
});

app.post("/generate-tax-declaration", async (req :Request , res : Response)=> {
  const {userAddr, userKey, userSignal, country, userName, chainId} = req.body;
  const [nullifierHash, proof] = await getProof(actionID, solidityPack(["uint256"],[userSignal]), userKey);

  try {

    let cJomTx = new Contract(
      addresses.JomTx[chainId],
      JomTxABI,
      new Wallet(ethereumPrivateKey!, serverProviders[chainId])
    )

    let cMockWorldID = new Contract(
      addresses.MockWorldID[chainId],
      worldCoinABI,
      new Wallet(ethereumPrivateKey!, serverProviders[chainId])
    );

    let tx = await cJomTx.verifyForTaxDeclaration(
      userAddr,
      userSignal,
      await cMockWorldID.getRoot(userSignal),
      nullifierHash,
      proof
    )

    //generate statement tables

    const response = await axios({
      url: 'https://api.thegraph.com/subgraphs/name/jrcarlos2000/miamipolygon',
      method: 'post',
      data: {
        query: `
        {
          transactions(first: 100) {
            id
            buyerAddr
            ipfsURI
            detail
          }
        }
          `
      }
    })

    
    let txList = response.data.data.transactions;
    txList = txList.filter((item:any ) => {return item.buyerAddr == userAddr})


    const receiptTable = await buildTaxDeclaration(txList);
    const pdfFileName = "output.pdf";
    await createTaxPDF ([receiptTable] , userAddr, userName, country, userSignal, pdfFileName);
  
    // //we can opt to store this to other data storage providers
    const cids = await awaitAndFilter([
      storeToWeb3Storage(pdfFileName),
    ]);

  }catch (error :any){
    console.error(error)
    res.status(500).end()
  }

})

app.post("/get-store-transactions", async (req :Request , res : Response)=> {
  const {storeKey, storeSignal, chainId} = req.body;
  const [nullifierHash, proof] = await getProof(actionID, solidityPack(["uint256"],[storeSignal]), storeKey);
  
  const response = await axios({
    url: 'https://api.thegraph.com/subgraphs/name/jrcarlos2000/miamipolygon',
    method: 'post',
    data: {
      query: `
      {
        transactions(first: 100) {
          id
          StoreNullifier
          ipfsURI
          detail
        }
      }
        `
    }
  })

  
  let txList = response.data.data.transactions;
  txList = txList.filter((item:any ) => {return item.StoreNullifier == nullifierHash})

  res.send({
    "transactions": txList,
  });
  res.status(200).end();

})

app.post("/get-user-transactions", async (req :Request , res : Response)=> {
  const {buyerAddr, buyerName, chainId} = req.body;

  const response = await axios({
    url: 'https://api.thegraph.com/subgraphs/name/jrcarlos2000/miamipolygon',
    method: 'post',
    data: {
      query: `
      {
        transactions(first: 100) {
          id
          ipfsURI
          buyerAddr
          detail
        }
      }
        `
    }
  })

  
  let txList = response.data.data.transactions;
  txList = txList.filter((item:any ) => {return item.buyerAddr == buyerAddr})

  res.send({
    "transactions": txList,
  });
  res.status(200).end();

})

app.post("/verify-user-app", async (req: Request, res: Response) => {
  const { storeKey , chainId} = req.body;
  console.log("debugging : ", storeKey, chainId);
  const identity = new ZkIdentity(Strategy.MESSAGE, storeKey);
  try {

    let cMockWorldID = new Contract(
      addresses.MockWorldID[chainId],
      worldCoinABI,
      new Wallet(ethereumPrivateKey!, serverProviders[chainId])
    );
    let cJomTx = new Contract(
      addresses.JomTx[chainId],
      JomTxABI,
      new Wallet(ethereumPrivateKey!, serverProviders[chainId])
    );
    const tx1 = await cMockWorldID.addMember(
      await cJomTx.getCurrGroupId(),
      identity.genIdentityCommitment()
    );

    await tx1.wait();

    const tx2 = await cMockWorldID.createGroup(
      await cJomTx.getCurrGroupId() + 1,
      20
    );
    await tx2.wait();
    res.status(200).end();
  } catch (error: any) {
    console.error(error);
    res.status(500).end();
  }
});

//verifies a certain store as if they did with the worldcoin orb
app.post("/verify-worldcoin-dev", async (req: Request, res: Response) => {
  const { storeKey , chainId} = req.body;
  console.log("debugging : ", storeKey, chainId);
  const identity = new ZkIdentity(Strategy.MESSAGE, storeKey);
  try {

    let cMockWorldID = new Contract(
      addresses.MockWorldID[chainId],
      worldCoinABI,
      new Wallet(ethereumPrivateKey!, serverProviders[chainId])
    );
    let cJomTx = new Contract(
      addresses.JomTx[chainId],
      JomTxABI,
      new Wallet(ethereumPrivateKey!, serverProviders[chainId])
    );

    const currGroupId = await cJomTx.getCurrGroupId();

    const tx1 = await cMockWorldID.addMember(
      currGroupId,
      identity.genIdentityCommitment()
    );

    await tx1.wait();

    const tx3 = await cJomTx.incrementGroupIds();
    await tx3.wait();

    const tx2 = await cMockWorldID.createGroup(
      await cJomTx.getCurrGroupId(),
      20
    );
    await tx2.wait();
    
    res.send({
      "storeID": currGroupId,
    });
    res.status(200).end();
  } catch (error: any) {
    console.error(error);
    res.status(500).end();
  }
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
