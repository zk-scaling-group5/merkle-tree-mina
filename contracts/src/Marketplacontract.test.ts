import { MarketplaceContract, Asset } from './Marketplacontract.js';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  MerkleTree,
  Signature,
  MerkleWitness,
  fetchAccount
} from 'o1js';
import dotenv from 'dotenv';
dotenv.config();

class MerkleWitness8 extends MerkleWitness(8) {}

describe('MarketplaceContract Devnet', () => {
  let senderAccount: PublicKey,
      senderKey: PrivateKey,
      zkApp: MarketplaceContract,
      tree: MerkleTree;
  
  let buyerAccount: PublicKey,
      buyerKey: PrivateKey;

  // Helper functions
  const wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const sendTransaction = async (
    txn: any, 
    signers: PrivateKey[], 
    memo: string
  ) => {
    await fetchAccount({ publicKey: senderAccount });
    await txn.prove();
    const result = await txn.sign(signers).send();
    console.log(`${memo} transaction sent with hash:`, result.hash);
    await result.wait({ maxAttempts: 30, interval: 60000 });
    // await wait(20000); // Wait 20 seconds between transactions
    return result;
  };

  beforeAll(async () => {
    const Devnet = Mina.Network({
      mina: 'https://proxy.devnet.minaexplorer.com/graphql',
      archive: 'https://archive.devnet.minaexplorer.com'
    });
    Mina.setActiveInstance(Devnet);
    
    const key = process.env.FEEPAYER_PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    if (!key) throw new Error('Missing FEEPAYER_PRIVATE_KEY environment variable');
    
    senderKey = PrivateKey.fromBase58(key);
    senderAccount = senderKey.toPublicKey();
    
    buyerKey = PrivateKey.random();
    buyerAccount = buyerKey.toPublicKey();
    
    console.log('Fee payer account:', senderAccount.toBase58());
    console.log('Buyer account:', buyerAccount.toBase58());
    
    const contractAddress = "B62qrFUDWNMKAmTcq1METQN9bRiFmKU8zUvHkoXYqrapdE5Ve1ZRTK7";
    const contractPublicKey = PublicKey.fromBase58(contractAddress);
    
    console.log('Fetching contract account...');
    await fetchAccount({ publicKey: contractPublicKey });
    
    zkApp = new MarketplaceContract(contractPublicKey);
    
    console.log('Compiling contract...');
    await MarketplaceContract.compile();
    
    tree = new MerkleTree(8);

    try {
      const currentRoot = await zkApp.assetsRoot.get();
      console.log('Current contract root:', currentRoot.toString());
    } catch (error) {
      console.log('Could not get current root, initializing with empty tree');
      tree = new MerkleTree(8);
    }
  });

  it('should mint a new asset on devnet', async () => {
    const assetHash = Field(123);
    const asset = new Asset({
      owner: senderAccount,
      contentHash: assetHash,
      price: Field(0),
      forSale: Field(0)
    });
    
    const merkleWitness = new MerkleWitness8(tree.getWitness(0n));
    const signature = Signature.create(senderKey, [assetHash]);

    console.log('Creating minting transaction...');
    try {
      await fetchAccount({ publicKey: zkApp.address });
      // await wait(2000);
      
      const txn = await Mina.transaction(
        { 
          sender: senderAccount, 
          fee: 0.1e9,
          memo: 'mint asset test'
        },
        async () => {
          await zkApp.mintAsset(merkleWitness, asset, signature);
        }
      );
      
      await sendTransaction(txn, [senderKey], 'Mint');
      
      await fetchAccount({ publicKey: zkApp.address });
      
      tree.setLeaf(0n, asset.hash());
      console.log('Local tree root after mint:', tree.getRoot().toString());
      
      const newRoot = await zkApp.assetsRoot.get();
      console.log('Contract root after mint:', newRoot.toString());
      
      expect(newRoot).toEqual(tree.getRoot());
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }, 2000000);

  it('should list an asset for sale on devnet', async () => {
    const assetHash = Field(456);
    const listingPrice = Field(1000);
    
    const asset = new Asset({
      owner: senderAccount,
      contentHash: assetHash,
      price: Field(0),
      forSale: Field(0)
    });
    
    const merkleWitness = new MerkleWitness8(tree.getWitness(1n));
    let signature = Signature.create(senderKey, [assetHash]);

    console.log('Creating mint transaction for listing test...');
    try {
      await fetchAccount({ publicKey: zkApp.address });
      
      const initialRoot = await zkApp.assetsRoot.get();
      console.log('Initial contract root:', initialRoot.toString());
      
      // await wait(2000);
      
      let txn = await Mina.transaction(
        { 
          sender: senderAccount, 
          fee: 0.1e9,
          memo: 'mint for listing test'
        },
        async () => {
          await zkApp.mintAsset(merkleWitness, asset, signature);
        }
      );
      
      await sendTransaction(txn, [senderKey], 'Mint for listing');
      
      await fetchAccount({ publicKey: zkApp.address });
      
      tree.setLeaf(1n, asset.hash());
      console.log('Tree root after mint:', tree.getRoot().toString());
      
      let contractRoot = await zkApp.assetsRoot.get();
      console.log('Contract root after mint:', contractRoot.toString());
      expect(contractRoot).toEqual(tree.getRoot());
      
      console.log('Creating listing transaction...');
      // await wait(2000);
      
      await fetchAccount({ publicKey: zkApp.address });
      
      txn = await Mina.transaction(
        { 
          sender: senderAccount, 
          fee: 0.1e9,
          memo: 'list asset test'
        },
        async () => {
          await zkApp.listForSale(merkleWitness, asset, listingPrice, signature);
        }
      );
      
      await sendTransaction(txn, [senderKey], 'List');
      
      await fetchAccount({ publicKey: zkApp.address });
      
      const listedAsset = new Asset({
        owner: senderAccount,
        contentHash: assetHash,
        price: listingPrice,
        forSale: Field(1)
      });
      
      tree.setLeaf(1n, listedAsset.hash());
      console.log('Tree root after listing:', tree.getRoot().toString());
      
      contractRoot = await zkApp.assetsRoot.get();
      console.log('Contract root after listing:', contractRoot.toString());
      
      expect(contractRoot).toEqual(tree.getRoot());
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }, 2000000);

  it('should purchase a listed asset on devnet', async () => {
    const assetHash = Field(789);
    const listingPrice = Field(1000);
    const leafIndex = 3n;
    
    const initialAsset = new Asset({
      owner: senderAccount,
      contentHash: assetHash,
      price: Field(0),
      forSale: Field(0)
    });
    
    const merkleWitness = new MerkleWitness8(tree.getWitness(leafIndex));
    let signature = Signature.create(senderKey, [assetHash]);

    console.log('Setting up asset for purchase test...');
    try {
      await fetchAccount({ publicKey: zkApp.address });
      const initialRoot = await zkApp.assetsRoot.get();
      console.log('Initial contract root:', initialRoot.toString());

      // 1. Mint the asset
      console.log('Minting new asset...');
      // await wait(2000);
      
      let txn = await Mina.transaction(
        { 
          sender: senderAccount, 
          fee: 0.1e9,
          memo: 'mint for purchase test'
        },
        async () => {
          await zkApp.mintAsset(merkleWitness, initialAsset, signature);
        }
      );
      
      await sendTransaction(txn, [senderKey], 'Mint for purchase');
      
      await fetchAccount({ publicKey: zkApp.address });
      tree.setLeaf(leafIndex, initialAsset.hash());
      let currentRoot = await zkApp.assetsRoot.get();
      console.log('Contract root after mint:', currentRoot.toString());
      expect(currentRoot).toEqual(tree.getRoot());
      
      // 2. List the asset for sale
      console.log('Listing asset for sale...');
      // await wait(2000);
      
      txn = await Mina.transaction(
        { 
          sender: senderAccount, 
          fee: 0.1e9,
          memo: 'list for purchase test'
        },
        async () => {
          await zkApp.listForSale(merkleWitness, initialAsset, listingPrice, signature);
        }
      );
      
      await sendTransaction(txn, [senderKey], 'List for purchase');
      
      await fetchAccount({ publicKey: zkApp.address });
      const listedAsset = new Asset({
        owner: senderAccount,
        contentHash: assetHash,
        price: listingPrice,
        forSale: Field(1)
      });
      
      tree.setLeaf(leafIndex, listedAsset.hash());
      currentRoot = await zkApp.assetsRoot.get();
      console.log('Contract root after listing:', currentRoot.toString());
      expect(currentRoot).toEqual(tree.getRoot());
      
      // 3. Purchase the asset
      console.log('Purchasing asset...');
      // await wait(2000);
      
      const buyerSignature = Signature.create(buyerKey, [assetHash, listingPrice]);
      
      txn = await Mina.transaction(
        { 
          sender: senderAccount,
          fee: 0.1e9,
          memo: 'purchase asset test'
        },
        async () => {
          await zkApp.purchaseAsset(
            merkleWitness,
            listedAsset,
            buyerAccount,
            buyerSignature
          );
        }
      );
      
      await sendTransaction(txn, [senderKey], 'Purchase');
      
      await fetchAccount({ publicKey: zkApp.address });
      const purchasedAsset = new Asset({
        owner: buyerAccount,
        contentHash: assetHash,
        price: Field(0),
        forSale: Field(0)
      });
      
      tree.setLeaf(leafIndex, purchasedAsset.hash());
      const finalRoot = await zkApp.assetsRoot.get();
      console.log('Final contract root:', finalRoot.toString());
      
      expect(finalRoot).toEqual(tree.getRoot());
      
      const finalAssetHash = purchasedAsset.hash();
      const finalWitness = new MerkleWitness8(tree.getWitness(leafIndex));
      const finalCalculatedRoot = finalWitness.calculateRoot(finalAssetHash);
      expect(finalRoot).toEqual(finalCalculatedRoot);
      
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }, 2000000);
});