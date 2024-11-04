import { ethers } from 'hardhat';
import dotenv from 'dotenv';

// Load env file
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ZKLINK_RPC);
  if (!process.env.WALLET_PRIVATE_KEY) throw "⛔️ Wallet private key wasn't found in .env file!";
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  if (!process.env.STAKING_ADDRESS) throw "⛔️ Skaking address wasn't found in .env file!";
  if (!process.env.ZKL_ADDRESS) throw "⛔️ Zkl address wasn't found in .env file!";

  const zklContract = new ethers.Contract(
    process.env.ZKL_ADDRESS,
    [
      {
        inputs: [
          {
            internalType: 'address',
            name: 'spender',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'approve',
        outputs: [
          {
            internalType: 'bool',
            name: '',
            type: 'bool',
          },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    wallet,
  );
  const rewardAmount = process.env.REWARD_AMOUNT;
  if (!rewardAmount) throw "⛔️ Reward amount wasn't found in .env file!";
  const approveTx = await zklContract.approve(process.env.STAKING_ADDRESS, ethers.parseEther(rewardAmount));
  console.log(`approve transaction hash: ${approveTx.hash}`);

  const staklingContract = new ethers.Contract(
    process.env.STAKING_ADDRESS,
    [
      {
        inputs: [
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
        ],
        name: 'fundRewardPool',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    wallet,
  );

  const tx = await staklingContract.fundRewardPool(ethers.parseEther(rewardAmount));
  console.log(`fundRewardPool transaction hash: ${tx.hash}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
