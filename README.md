# Summary

## Repository
- GitHub: [https://github.com/zkLinkProtocol/zklink-stake-contracts.git](https://github.com/zkLinkProtocol/zklink-stake-contracts.git)
- Branch: `issues_1`

## Features
Supports staking and claim of ZKL tokens. Requirement document: [https://zklinklfg.sg.larksuite.com/docx/TdLXdMNNHoxZYFxUsMIl34FRgzh](https://zklinklfg.sg.larksuite.com/docx/TdLXdMNNHoxZYFxUsMIl34FRgzh)

## Code Summary
**Total lines of code: 225**

## Code Overview

### Variables
- `zklToken`: Address of the ZKL token contract.
- `Stake`: Stores data for each user stake. Includes `amount` (staked quantity), `startTime` (start time), `veZKL` (earned veZKL quantity), `rewards` (earned rewards), `config` (staking configuration), and `claimed` (whether rewards have been claimed).
- `StakeConfig`: Stores staking configuration. Includes `stakePeriod` (staking period) and `apr` (annual percentage rate).
- `userStakes`: Stores user staking information. Contains `stake` data.
- `userTotalVeZKL`: Stores the total veZKL quantity for each user.
- `rewardPool`: Stores the current reward pool amount.
- `totalLockedRewards`: Stores the current total locked rewards amount.

### Functions
- `stake`: Staking function. Allows users to stake ZKL tokens, with parameters `amount` and staking period.
- `unstake`: Redemption function. Allows users to redeem ZKL tokens and receive rewards, with the parameter being the index of the user’s stake array.
- `fundRewardPool`: Allows the administrator to add funds to the reward pool. Only callable by the admin.
- `withdrawExcessRewards`: Allows the administrator to withdraw excess funds from the reward pool. Only callable by the admin.
- `getUserStakes`: Retrieves all staking information for a user.
- `getUserStakesLength`: Retrieves the length of the user’s staking array.
- `getUserTotalStakedTokens`: Retrieves the total staked amount for a user.
- `getUserTotalVeZKL`: Retrieves the total veZKL amount for a user.
- `getTotalLockedRewards`: Retrieves the current total locked rewards amount.
- `getAvailableRewards`: Retrieves the current available rewards amount.
- `getRewardPool`: Retrieves the current reward pool amount.
- `getUserStakeDetails`: Retrieves detailed staking information for a user, with the parameter being the index of the user’s stake array.