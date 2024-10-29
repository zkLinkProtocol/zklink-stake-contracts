import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { Contract, Signer } from 'ethers';
import { SimpleERC20Token } from '../typechain-types';

describe('Staking Contract', function () {
  let staking: Contract;
  let token: SimpleERC20Token;
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let tokenAddr: string;
  let stakingAddr: string;
  let aliceStaking: Contract;
  let aliceToken: Contract;
  let ownerStaking: Contract;
  let ownerToken: Contract;
  let bobStaking: Contract;
  let bobToken: Contract;
  let rewardPoolAmount = ethers.parseUnits('1000000', 18);

  interface StakeConfig {
    stakePeriod: number;
    apr: number;
  }

  interface Stake {
    amount: number;
    startTime: number;
    veZKL: number;
    rewards: number;
    config: StakeConfig;
    claimed: boolean;
  }

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory('SimpleERC20Token');
    token = await ERC20.deploy();
    tokenAddr = await token.getAddress();

    const Staking = await ethers.getContractFactory('Staking');
    staking = await upgrades.deployProxy(Staking, [], {
      initializer: 'initialize',
      kind: 'uups',
      unsafeAllow: ['constructor', 'state-variable-immutable'],
      constructorArgs: [await token.getAddress()],
    });
    stakingAddr = await staking.getAddress();

    await token.transfer(owner, rewardPoolAmount);
    aliceStaking = new ethers.Contract(stakingAddr, staking.interface, alice);
    aliceToken = new ethers.Contract(tokenAddr, token.interface, alice);
    ownerStaking = new ethers.Contract(stakingAddr, staking.interface, owner);
    ownerToken = new ethers.Contract(tokenAddr, token.interface, owner);
    bobStaking = new ethers.Contract(stakingAddr, staking.interface, bob);
    bobToken = new ethers.Contract(tokenAddr, token.interface, bob);
  });

  it('fundRewardPool', async function () {
    await ownerToken.approve(stakingAddr, rewardPoolAmount);
    await ownerStaking.fundRewardPool(rewardPoolAmount);
    const rewardPool = await staking.getRewardPool();
    expect(rewardPool).to.equal(rewardPoolAmount);
  });

  it('Should allow user to stake tokens', async function () {
    const stakeAmount = ethers.parseUnits('1000', 18);
    await token.transfer(alice, stakeAmount);
    await aliceToken.approve(stakingAddr, stakeAmount);
    await aliceStaking.stake(stakeAmount, 0);

    const userStakes: Stake[] = await staking.getUserStakes(alice);
    const config: StakeConfig = userStakes[0].config;
    const veTokenCount = (BigInt(stakeAmount) * BigInt(config.stakePeriod)) / BigInt(12 * 100);
    expect(config.stakePeriod).to.equal(3);
    expect(userStakes.length).to.equal(1);
    expect(userStakes[0].veZKL).to.equal(veTokenCount);
    expect(userStakes[0].amount).to.equal(stakeAmount);
    expect(await aliceStaking.getUserTotalVeZKL(alice)).to.equal(veTokenCount);
  });

  it('Should calculate rewards correctly', async function () {
    const userStake = await staking.getUserStakeDetails(alice, 0);
    const stakeAmount = BigInt(userStake.amount);
    const apr = BigInt(userStake.apr);
    const stakePeriod = BigInt(userStake.stakePeriod);
    const calculatedReward = (stakeAmount * apr * stakePeriod) / BigInt(12 * 100);
    expect(BigInt(userStake.rewards)).to.equal(calculatedReward);
    expect(await aliceStaking.getTotalLockedRewards()).to.equal(userStake.rewards);
  });

  it('Should not allow unstaking before staking period', async function () {
    await expect(aliceStaking.unstake(0)).to.be.revertedWith('Staking period not yet expired');
  });

  it('Should allow unstaking and claiming rewards after period', async function () {
    await ethers.provider.send('evm_increaseTime', [90 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);

    const userStakeBefore = await staking.getUserStakeDetails(await alice.getAddress(), 0);
    const userBalanceBefore = await token.balanceOf(await alice.getAddress());

    await aliceStaking.unstake(0);

    const userBalanceAfter = await token.balanceOf(await alice.getAddress());
    expect(userBalanceAfter).to.equal(userBalanceBefore + userStakeBefore.amount + userStakeBefore.rewards);

    expect(await aliceStaking.getUserTotalVeZKL(alice)).to.equal(0);
    const userStake = await staking.getUserStakeDetails(alice, 0);
    expect(userStake.claimed).to.equal(true);

    expect(await aliceStaking.getTotalLockedRewards()).to.equal(0);
    expect(await aliceStaking.getTotalStakedTokens()).to.equal(0);
    expect(await aliceStaking.getUserTotalVeZKL(alice)).to.equal(0);
    expect(await aliceStaking.getRewardPool()).to.equal(rewardPoolAmount - userStakeBefore.rewards);
  });

  it('Should revert Stake already claimed', async function () {
    await expect(aliceStaking.unstake(0)).to.be.revertedWith('Stake already claimed');
  });

  it('Should allow funding the reward pool', async function () {
    const rewardPoolBefore = await staking.getRewardPool();
    const fundAmount = ethers.parseUnits('500000', 18);
    await token.transfer(await owner.getAddress(), fundAmount);
    await ownerToken.approve(stakingAddr, fundAmount);

    await staking.fundRewardPool(fundAmount);
    const rewardPool = await staking.getRewardPool();
    expect(rewardPool).to.equal(rewardPoolBefore + fundAmount);
  });

  it('Should only allow owner to fund reward pool', async function () {
    const fundAmount = ethers.parseUnits('500000', 18);
    await token.transfer(await bob.getAddress(), fundAmount);
    await bobToken.approve(stakingAddr, fundAmount);

    await expect(bobStaking.fundRewardPool(fundAmount)).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
