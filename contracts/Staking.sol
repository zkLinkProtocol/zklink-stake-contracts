// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {console} from "hardhat/console.sol";

contract Staking is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    IERC20Upgradeable public immutable zklToken;
    uint256 public constant ONE_YEAR_IN_MONTHS = 12;
    uint256 public constant PERCENT_BASE = 100;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 veZKL;
        uint256 rewards;
        StakeConfig config;
        bool claimed;
    }

    struct StakeConfig {
        uint256 stakePeriod;
        uint256 apr;
    }

    enum StakingPeriod {
        THREE_MONTHS,
        SIX_MONTHS,
        NINE_MONTHS,
        TWELVE_MONTHS
    }

    mapping(address => Stake[]) public userStakes;
    mapping(address => uint256) public userTotalVeZKL;

    uint256 public rewardPool;
    uint256 public totalLockedRewards;

    event Staked(address indexed user, uint256 indexed amount, uint256 indexed stakingPeriod, uint256 veZKL);
    event Unstaked(address indexed user, uint256 indexed stakeIndex, uint256 indexed amount, uint256 rewards);
    event RewardPoolFunded(uint256 amount);
    event ExcessRewardWithdrawn(uint256 amount);

    constructor(address _zklToken) {
        _disableInitializers();
        zklToken = IERC20Upgradeable(_zklToken);
    }

    function initialize() public initializer {
        __UUPSUpgradeable_init_unchained();
        __ReentrancyGuard_init_unchained();
        __Pausable_init_unchained();
        __Ownable_init_unchained();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Stake tokens for a specific period
    function stake(uint256 amount, StakingPeriod stakePeriod) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        StakeConfig memory config = getStakeConfig(stakePeriod);

        uint256 veZKL = (amount * config.stakePeriod) / (ONE_YEAR_IN_MONTHS * PERCENT_BASE);
        uint256 estimatedRewards = calculateEstimatedRewards(amount, config);

        require(rewardPool >= totalLockedRewards + estimatedRewards, "Insufficient rewards in pool");

        totalLockedRewards += estimatedRewards;

        userTotalVeZKL[msg.sender] += veZKL;

        userStakes[msg.sender].push(
            Stake({
                amount: amount,
                startTime: block.timestamp,
                veZKL: veZKL,
                rewards: estimatedRewards,
                config: config,
                claimed: false
            })
        );

        zklToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, config.stakePeriod, veZKL);
    }

    // Get the configuration for a specific staking period
    function getStakeConfig(StakingPeriod stakePeriod) public pure returns (StakeConfig memory) {
        if (stakePeriod == StakingPeriod.THREE_MONTHS) {
            return StakeConfig({stakePeriod: 3, apr: 15});
        } else if (stakePeriod == StakingPeriod.SIX_MONTHS) {
            return StakeConfig({stakePeriod: 6, apr: 20});
        } else if (stakePeriod == StakingPeriod.NINE_MONTHS) {
            return StakeConfig({stakePeriod: 9, apr: 25});
        } else if (stakePeriod == StakingPeriod.TWELVE_MONTHS) {
            return StakeConfig({stakePeriod: 12, apr: 30});
        }
        revert("Invalid staking period");
    }

    // Calculate estimated rewards for a staking period
    function calculateEstimatedRewards(uint256 amount, StakeConfig memory config) public pure returns (uint256) {
        return (amount * config.apr * config.stakePeriod) / (ONE_YEAR_IN_MONTHS * PERCENT_BASE);
    }

    // Unstake tokens and claim rewards after staking period ends
    function unstake(uint256 stakeIndex) external nonReentrant whenNotPaused {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");

        Stake storage userStake = userStakes[msg.sender][stakeIndex];
        require(!userStake.claimed, "Stake already claimed");
        require(
            block.timestamp >= userStake.startTime + userStake.config.stakePeriod * 30 days,
            "Staking period not yet expired"
        );

        uint256 reward = userStake.rewards;

        userStake.claimed = true;

        totalLockedRewards -= reward;
        rewardPool -= reward;

        userTotalVeZKL[msg.sender] -= userStake.veZKL;

        zklToken.safeTransfer(msg.sender, userStake.amount + reward);

        emit Unstaked(msg.sender, stakeIndex, userStake.amount, reward);
    }

    // Fund the reward pool
    function fundRewardPool(uint256 amount) external onlyOwner {
        zklToken.safeTransferFrom(msg.sender, address(this), amount);

        rewardPool += amount;

        emit RewardPoolFunded(amount);
    }

    function withdrawExcessRewards(uint256 amount) external onlyOwner {
        uint256 availableRewards = rewardPool - totalLockedRewards;
        require(amount <= availableRewards, "Amount exceeds excess rewards");

        rewardPool -= amount;
        zklToken.safeTransfer(msg.sender, amount);

        emit ExcessRewardWithdrawn(amount);
    }

    function getUserStakes(address user) external view returns (Stake[] memory) {
        return userStakes[user];
    }

    function getUserStakesLength(address user) external view returns (uint256) {
        return userStakes[user].length;
    }

    function getTotalStakedTokens() external view returns (uint256) {
        uint256 totalStaked = 0;
        for (uint256 i = 0; i < userStakes[msg.sender].length; i++) {
            if (!userStakes[msg.sender][i].claimed) {
                totalStaked += userStakes[msg.sender][i].amount;
            }
        }
        return totalStaked;
    }

    function getUserTotalVeZKL(address user) external view returns (uint256) {
        return userTotalVeZKL[user];
    }

    function getTotalLockedRewards() external view returns (uint256) {
        return totalLockedRewards;
    }

    function getAvailableRewards() external view returns (uint256) {
        return rewardPool - totalLockedRewards;
    }

    function getRewardPool() external view returns (uint256) {
        return rewardPool;
    }

    function getUserStakeDetails(
        address user,
        uint256 stakeIndex
    )
        external
        view
        returns (
            uint256 amount,
            uint256 startTime,
            uint256 veZKL,
            uint256 rewards,
            uint256 stakePeriod,
            uint256 apr,
            bool claimed
        )
    {
        Stake memory userStake = userStakes[user][stakeIndex];
        return (
            userStake.amount,
            userStake.startTime,
            userStake.veZKL,
            userStake.rewards,
            userStake.config.stakePeriod,
            userStake.config.apr,
            userStake.claimed
        );
    }
}
